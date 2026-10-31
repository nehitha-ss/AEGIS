import { readFileSync, writeFileSync } from "node:fs";
process.loadEnvFile(".env.integration.local");
const keys = JSON.parse(process.env.AEGIS_OWNER_KEYS);
const origin = process.env.AEGIS_ORIGIN;
const base = `http://127.0.0.1:${process.env.AEGIS_INTEGRATION_PORT || 8001}`;
let env = readFileSync(".env.northstar.local", "utf8");
if (!/^AEGIS_APP_ID=$/m.test(env))
  throw new Error(
    "Northstar is already configured; refusing to create another registration",
  );
const login = await fetch(base + "/owner/login", {
  method: "POST",
  headers: { "Content-Type": "application/json", Origin: origin },
  body: JSON.stringify({ key: Object.values(keys)[0] }),
});
if (!login.ok) throw new Error("Owner login failed");
const cookie = login.headers.get("set-cookie").split(";")[0];
const response = await fetch(base + "/owner/apps", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    Origin: origin,
    Cookie: cookie,
  },
  body: JSON.stringify({ name: "Northstar Finance" }),
});
if (!response.ok) throw new Error("Application registration failed");
const app = await response.json();
env = env
  .replace(/^AEGIS_APP_ID=.*$/m, `AEGIS_APP_ID=${app.id}`)
  .replace(
    /^AEGIS_CONNECTION_KEY=.*$/m,
    `AEGIS_CONNECTION_KEY=${app.connection_key}`,
  );
writeFileSync(".env.northstar.local", env);
console.log(
  "Registered Northstar Finance and saved its connection credentials server-side. Restart Northstar if it is already running.",
);
