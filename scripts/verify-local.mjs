// Explicit, isolated owner lab. Never changes the normal Northstar environment.
import { spawn } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
if (!process.argv.includes("--unsafe-owner-lab"))
  throw new Error(
    "Pass --unsafe-owner-lab to explicitly enable the isolated fictional vulnerable scenarios.",
  );
process.loadEnvFile(".env.northstar.local");
process.loadEnvFile(".env.integration.local");
const port = process.env.NORTHSTAR_VERIFY_PORT || "8002";
const finance = `http://127.0.0.1:${port}`;
const origin = finance;
const python =
  process.env.NORTHSTAR_PYTHON ||
  (process.platform === "win32"
    ? ".venv/Scripts/python.exe"
    : ".venv/bin/python");
mkdirSync(".integration-data", { recursive: true });
const child = spawn(
  python,
  [
    "-m",
    "uvicorn",
    "northstar.app:app",
    "--app-dir",
    "python",
    "--host",
    "127.0.0.1",
    "--port",
    port,
  ],
  {
    env: {
      ...process.env,
      NORTHSTAR_ENABLE_UNSAFE_DEMO: "true",
      NORTHSTAR_ORIGIN: origin,
      NORTHSTAR_INTERNAL_URL: finance,
      NORTHSTAR_DB: ".integration-data/isolated-owner-lab.sqlite",
    },
    stdio: "ignore",
  },
);
let started = false;
child.on("error", () => {});
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
try {
  for (let n = 0; n < 100; n++) {
    if (child.exitCode !== null) throw new Error("Owner lab failed to start");
    try {
      const r = await fetch(finance + "/health");
      if (r.ok) {
        started = true;
        break;
      }
    } catch {}
    await pause(100);
  }
  if (!started) throw new Error("Owner lab did not start");
  const login = await fetch(finance + "/login", {
    method: "POST",
    redirect: "manual",
    headers: {
      Origin: origin,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      username: "owner",
      password: process.env.NORTHSTAR_OWNER_PASSWORD,
    }),
  });
  if (login.status !== 303) throw new Error("Northstar owner login failed");
  const cookie = login.headers.get("set-cookie").split(";")[0];
  const page = await fetch(finance + "/owner", { headers: { Cookie: cookie } });
  const csrf = (await page.text()).match(/name="csrf" value="([^"]+)"/)?.[1];
  if (!csrf) throw new Error("Owner CSRF form missing");
  const cases = {
    normal: "NO_BYPASS_OBSERVED",
    "direct-denial": "DENIED_AT_SOURCE",
    "confused-deputy": "CONFUSED_DEPUTY",
    "cross-tenant": "CONFUSED_DEPUTY",
    corrected: "DENIED_AT_SOURCE",
  };
  const receipts = [];
  for (const [scenario, expected] of Object.entries(cases)) {
    const r = await fetch(finance + "/owner/scenarios", {
      method: "POST",
      headers: {
        Origin: origin,
        Cookie: cookie,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ scenario, csrf }),
      signal: AbortSignal.timeout(15000),
    });
    const html = await r.text();
    const id = html.match(/<code>([a-f0-9-]{36})<\/code>/)?.[1];
    if (!r.ok || !id) throw new Error(`Scenario ${scenario} failed`);
    receipts.push({ scenario, expected, correlation_id: id });
  }
  const aegisOrigin = process.env.AEGIS_ORIGIN;
  const bridge = aegisOrigin + "/api/integrations";
  const auth = await fetch(bridge + "/login", {
    method: "POST",
    headers: { Origin: aegisOrigin, "Content-Type": "application/json" },
    body: JSON.stringify({
      key: Object.values(JSON.parse(process.env.AEGIS_OWNER_KEYS))[0],
    }),
  });
  if (!auth.ok) throw new Error("AEGIS dashboard bridge sign-in failed");
  const ownerCookie = auth.headers.get("set-cookie").split(";")[0];
  const response = await fetch(
    `${bridge}/apps/${process.env.AEGIS_APP_ID}/flows`,
    { headers: { Cookie: ownerCookie } },
  );
  if (!response.ok)
    throw new Error("AEGIS protected dashboard evidence query failed");
  const data = await response.json();
  for (const receipt of receipts) {
    const flow = data.flows.find((f) => f.id === receipt.correlation_id);
    if (
      !flow ||
      flow.analysis.verdict !== receipt.expected ||
      flow.events.length !== 3
    )
      throw new Error(`Evidence mismatch: ${receipt.scenario}`);
    receipt.actual = flow.analysis.verdict;
    receipt.risk = flow.analysis.risk;
    receipt.findings = flow.analysis.findings.map((f) => f.id);
    console.log(
      `${receipt.scenario}: ${receipt.actual}, risk ${receipt.risk}, correlation ${receipt.correlation_id}`,
    );
  }
  writeFileSync(
    ".integration-data/local-verification.json",
    JSON.stringify(
      {
        verified_at: new Date().toISOString(),
        source:
          "Actual isolated Northstar owner-lab HTTP requests; authenticated events retrieved through AEGIS dashboard bridge",
        receipts,
      },
      null,
      2,
    ),
  );
  await fetch(bridge + "/logout", {
    method: "POST",
    headers: {
      Origin: aegisOrigin,
      Cookie: ownerCookie,
      "Content-Type": "application/json",
    },
    body: "{}",
  });
  console.log(
    "Verified all five flows through the protected AEGIS dashboard API. Normal Northstar remains in safe mode.",
  );
} finally {
  child.kill();
}
