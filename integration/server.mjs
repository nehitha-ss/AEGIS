import http from "node:http";
import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import {
  randomBytes,
  randomUUID,
  createHash,
  timingSafeEqual,
} from "node:crypto";
import { z } from "zod";
import { evaluateDelegatedAccess, evaluateDelegatedPreflight } from "../lib/delegated-policy.mjs";

const digest = (s) => createHash("sha256").update(s).digest("hex");
const equal = (a, b) => {
  const x = Buffer.from(digest(a)),
    y = Buffer.from(digest(b));
  return timingSafeEqual(x, y);
};
const ownerKeys = JSON.parse(process.env.AEGIS_OWNER_KEYS || "{}");
if (
  !Object.keys(ownerKeys).length ||
  Object.values(ownerKeys).some((k) => typeof k !== "string" || k.length < 32)
)
  throw new Error(
    "Configure AEGIS_OWNER_KEYS with private keys of at least 32 characters.",
  );
const origin = process.env.AEGIS_ORIGIN || "http://localhost:5173";
const dbPath =
  process.env.AEGIS_INTEGRATION_DB || ".integration-data/aegis.sqlite";
mkdirSync(dirname(dbPath), { recursive: true });
const db = new DatabaseSync(dbPath);
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS apps(id TEXT PRIMARY KEY,owner TEXT NOT NULL,name TEXT NOT NULL,key_hash TEXT NOT NULL,created TEXT NOT NULL,last_seen TEXT);
CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,owner TEXT NOT NULL,expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS events(app TEXT NOT NULL,id TEXT NOT NULL,flow TEXT NOT NULL,phase TEXT NOT NULL,data TEXT NOT NULL,received TEXT NOT NULL,PRIMARY KEY(app,id),UNIQUE(app,flow,phase),FOREIGN KEY(app) REFERENCES apps(id));
CREATE TABLE IF NOT EXISTS decisions(app TEXT NOT NULL,flow TEXT NOT NULL,request_hash TEXT NOT NULL,decision_id TEXT NOT NULL,data TEXT NOT NULL,created TEXT NOT NULL,PRIMARY KEY(app,flow),FOREIGN KEY(app) REFERENCES apps(id));`);
const pseudo = z.string().regex(/^p_[a-f0-9]{24}$/);
// Free hosting has ephemeral disks. Re-establish only explicitly provisioned
// applications after a restart; owner and connection keys remain host secrets.
for (const app of JSON.parse(process.env.AEGIS_BOOTSTRAP_APPS || "[]")) {
  if (!z.string().uuid().safeParse(app.id).success ||
      !Object.hasOwn(ownerKeys, app.owner) ||
      typeof app.key !== "string" || app.key.length < 32 ||
      typeof app.name !== "string" || !app.name.trim() || app.name.length > 120)
    throw new Error("Invalid server-side bootstrap application configuration");
  const existing = db.prepare("SELECT owner,key_hash FROM apps WHERE id=?").get(app.id);
  if (existing && (existing.owner !== app.owner || existing.key_hash !== digest(app.key)))
    throw new Error("Bootstrap application conflicts with stored registration");
  db.prepare("INSERT OR IGNORE INTO apps VALUES(?,?,?,?,?,NULL)")
    .run(app.id, app.owner, app.name, digest(app.key), new Date().toISOString());
}
const fact = z.boolean().nullable().default(null);
const schema = z
  .object({
    schema_version: z.literal(1),
    event_id: z.string().uuid(),
    correlation_id: z.string().uuid(),
    phase: z.enum(["customer", "helper", "resource"]),
    timestamp: z.string().datetime(),
    caller: pseudo,
    helper: pseudo,
    resource: pseudo,
    caller_tenant: pseudo,
    resource_tenant: pseudo,
    action: z.enum(["statement.read", "transfer.create"]),
    outcome: z.enum(["allowed", "denied"]),
    evidence: z
      .object({
        caller_authorized: fact,
        helper_authorized: fact,
        helper_uses_own_identity: fact,
        original_caller_checked: fact,
        caller_context_propagated: fact,
        caller_controls_resource: fact,
        resource_trusts_helper_only: fact,
      })
      .strict(),
  })
  .strict();
const limits = new Map();
function limit(key, max) {
  const now = Date.now();
  const entry = limits.get(key);
  const v =
    !entry || entry.until < now ? { count: 0, until: now + 60_000 } : entry;
  limits.set(key, v);
  if (limits.size > 10000)
    for (const [k, x] of limits) if (x.until < now) limits.delete(k);
  return ++v.count <= max;
}
function reply(res, status, data, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  res.end(JSON.stringify(data));
}
async function body(req) {
  let data = "";
  for await (const chunk of req) {
    data += chunk;
    if (Buffer.byteLength(data) > 32768)
      throw Object.assign(new Error("Request too large"), { status: 413 });
  }
  try {
    return JSON.parse(data || "{}");
  } catch {
    throw Object.assign(new Error("Invalid JSON"), { status: 400 });
  }
}
function owner(req) {
  const token = /(?:^|;\s*)aegis_owner=([^;]+)/.exec(
    req.headers.cookie || "",
  )?.[1];
  if (!token) return null;
  return db
    .prepare("SELECT owner FROM sessions WHERE hash=? AND expires>?")
    .get(digest(token), Date.now())?.owner;
}
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const path = url.pathname;
    if (path === "/health" && req.method === "GET")
      return reply(res, 200, { status: "ok", mode: "monitor" });
    if (path === "/v1/events" && req.method === "POST") {
      const id = req.headers["x-aegis-app-id"];
      const key = req.headers.authorization?.replace(/^Bearer /, "") || "";
      const app =
        typeof id === "string"
          ? db.prepare("SELECT * FROM apps WHERE id=?").get(id)
          : null;
      if (!app || !key || !equal(digest(key), app.key_hash))
        return reply(res, 401, { error: "Invalid application credentials" });
      if (!limit(id, 600))
        return reply(res, 429, { error: "Event rate limit" });
      const parsed = schema.safeParse(await body(req));
      if (!parsed.success)
        return reply(res, 400, {
          error:
            "Invalid event schema; only allowlisted pseudonymous fields are accepted",
        });
      const e = parsed.data;
      if (Math.abs(Date.now() - Date.parse(e.timestamp)) > 86400000)
        return reply(res, 400, {
          error: "Event timestamp outside 24-hour delivery window",
        });
      const existing = db
        .prepare("SELECT data FROM events WHERE app=? AND id=?")
        .get(id, e.event_id);
      if (existing)
        return reply(res, existing.data === JSON.stringify(e) ? 200 : 409, {
          duplicate: true,
        });
      if (
        db
          .prepare("SELECT id FROM events WHERE app=? AND flow=? AND phase=?")
          .get(id, e.correlation_id, e.phase)
      )
        return reply(res, 409, { error: "Flow phase already recorded" });
      db.prepare("INSERT INTO events VALUES(?,?,?,?,?,?)").run(
        id,
        e.event_id,
        e.correlation_id,
        e.phase,
        JSON.stringify(e),
        new Date().toISOString(),
      );
      db.prepare("UPDATE apps SET last_seen=? WHERE id=?").run(
        new Date().toISOString(),
        id,
      );
      const flow = db
        .prepare("SELECT data FROM events WHERE app=? AND flow=?")
        .all(id, e.correlation_id)
        .map((x) => JSON.parse(x.data));
      return reply(res, 201, {
        accepted: true,
        analysis: evaluateDelegatedAccess(flow),
      });
    }
    if (path === "/v1/verify" && req.method === "POST") {
      const id = req.headers["x-aegis-app-id"];
      const key = req.headers.authorization?.replace(/^Bearer /, "") || "";
      const app = typeof id === "string" ? db.prepare("SELECT * FROM apps WHERE id=?").get(id) : null;
      if (!app || !key || !equal(digest(key), app.key_hash))
        return reply(res, 401, { error: "Invalid application credentials" });
      if (!limit(`${id}:verify`, 300))
        return reply(res, 429, { error: "Verification rate limit" });
      const parsed = z.object({ events: z.array(schema).length(3) }).strict().safeParse(await body(req));
      if (!parsed.success)
        return reply(res, 400, { error: "A complete, allowlisted three-stage request is required" });
      const events = parsed.data.events;
      const flow = events[0].correlation_id;
      if (events.some((event) => event.correlation_id !== flow))
        return reply(res, 400, { error: "Verification stages must share one correlation ID" });
      const requestHash = digest(JSON.stringify(events));
      const existing = db.prepare("SELECT * FROM decisions WHERE app=? AND flow=?").get(id, flow);
      if (existing) {
        if (existing.request_hash !== requestHash)
          return reply(res, 409, { error: "Correlation ID already verified with different evidence" });
        return reply(res, 200, JSON.parse(existing.data));
      }
      const analysis = evaluateDelegatedPreflight(events);
      const response = { verified: true, decision_id: randomUUID(), decision: analysis.decision, analysis };
      db.prepare("INSERT INTO decisions VALUES(?,?,?,?,?,?)").run(id, flow, requestHash, response.decision_id, JSON.stringify(response), new Date().toISOString());
      return reply(res, 201, response);
    }
    if (path === "/owner/login" && req.method === "POST") {
      if (req.headers.origin !== origin)
        return reply(res, 403, { error: "Origin rejected" });
      if (!limit(req.socket.remoteAddress, 15))
        return reply(res, 429, { error: "Login rate limit" });
      const b = await body(req);
      const found = Object.entries(ownerKeys).find(
        ([, key]) => typeof b.key === "string" && equal(key, b.key),
      );
      if (!found) return reply(res, 401, { error: "Invalid owner key" });
      const token = randomBytes(32).toString("hex");
      db.prepare("DELETE FROM sessions WHERE expires<?").run(Date.now());
      db.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
        digest(token),
        found[0],
        Date.now() + 8 * 3600000,
      );
      return reply(
        res,
        200,
        { owner: found[0] },
        {
          "Set-Cookie": `aegis_owner=${token}; HttpOnly; SameSite=Strict; Path=/api/integrations; Max-Age=28800${origin.startsWith("https:") ? "; Secure" : ""}`,
        },
      );
    }
    const who = owner(req);
    if (!who) return reply(res, 401, { error: "Owner sign-in required" });
    if (req.method !== "GET" && req.headers.origin !== origin)
      return reply(res, 403, { error: "Origin rejected" });
    if (path === "/owner/logout" && req.method === "POST") {
      const token = /(?:^|;\s*)aegis_owner=([^;]+)/.exec(
        req.headers.cookie || "",
      )?.[1];
      if (token)
        db.prepare("DELETE FROM sessions WHERE hash=?").run(digest(token));
      return reply(
        res,
        200,
        { ok: true },
        {
          "Set-Cookie":
            "aegis_owner=; HttpOnly; SameSite=Strict; Path=/api/integrations; Max-Age=0",
        },
      );
    }
    if (path === "/owner/apps" && req.method === "POST") {
      const b = await body(req);
      if (typeof b.name !== "string" || b.name.length < 1 || b.name.length > 80)
        return reply(res, 400, {
          error: "Application name required (1–80 characters)",
        });
      const id = randomUUID(),
        key = randomBytes(32).toString("hex");
      db.prepare("INSERT INTO apps VALUES(?,?,?,?,?,NULL)").run(
        id,
        who,
        b.name,
        digest(key),
        new Date().toISOString(),
      );
      return reply(res, 201, {
        id,
        name: b.name,
        connection_key: key,
        message:
          "Copy this key to Northstar server environment. It is shown once.",
      });
    }
    if (path === "/owner/apps" && req.method === "GET")
      return reply(res, 200, {
        owner: who,
        applications: db
          .prepare("SELECT id,name,created,last_seen FROM apps WHERE owner=?")
          .all(who),
      });
    const match = /^\/owner\/apps\/([a-f0-9-]+)\/flows$/.exec(path);
    if (match && req.method === "GET") {
      const app = db
        .prepare("SELECT id,name,last_seen FROM apps WHERE id=? AND owner=?")
        .get(match[1], who);
      if (!app) return reply(res, 404, { error: "Application not found" });
      const flowIds = db
        .prepare(
          "SELECT flow,MAX(received) AS received FROM events WHERE app=? GROUP BY flow ORDER BY received DESC LIMIT 100",
        )
        .all(app.id);
      const flows = flowIds.map((x) => {
        const events = db
          .prepare(
            "SELECT data,received FROM events WHERE app=? AND flow=? ORDER BY received",
          )
          .all(app.id, x.flow);
        return {
          id: x.flow,
          received: x.received,
          source: "received",
          events: events.map((y) => ({
            ...JSON.parse(y.data),
            received_at: y.received,
          })),
          analysis: evaluateDelegatedAccess(
            events.map((y) => JSON.parse(y.data)),
          ),
        };
      });
      return reply(res, 200, {
        application: app,
        mode: "monitor",
        connected:
          !!app.last_seen && Date.now() - Date.parse(app.last_seen) < 120000,
        received_events: db
          .prepare("SELECT COUNT(*) AS n FROM events WHERE app=?")
          .get(app.id).n,
        flows,
      });
    }
    reply(res, 404, { error: "Not found" });
  } catch (error) {
    reply(res, error.status || 500, {
      error: error.status ? error.message : "Integration service error",
    });
  }
});
server.listen(
  Number(process.env.AEGIS_INTEGRATION_PORT || 8001),
  process.env.AEGIS_INTEGRATION_HOST || "127.0.0.1",
  () =>
    console.log(
      "AEGIS integration service listening; verification and evidence endpoints ready.",
    ),
);
