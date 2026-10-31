import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
const secret = () => randomBytes(32).toString("hex");
if (existsSync(".env.integration.local") || existsSync(".env.northstar.local"))
  throw new Error(
    "Existing environment preserved. Edit it manually or back it up before setting up again.",
  );
writeFileSync(
  ".env.integration.local",
  `AEGIS_OWNER_KEYS=${JSON.stringify({ owner: secret() })}\nAEGIS_ORIGIN=http://localhost:5173\nAEGIS_INTEGRATION_PORT=8001\nAEGIS_INTEGRATION_DB=.integration-data/aegis.sqlite\n`,
);
writeFileSync(
  ".env.northstar.local",
  `NORTHSTAR_OWNER_PASSWORD=${secret()}\nNORTHSTAR_CUSTOMER_PASSWORD=${secret()}\nNORTHSTAR_DEMO_RUN_KEY=${secret()}\nNORTHSTAR_ENABLE_UNSAFE_DEMO=false\nNORTHSTAR_DIRECT_CUSTOMER_DEMO=true\nNORTHSTAR_ORIGIN=http://localhost:8000\nNORTHSTAR_INTERNAL_URL=http://127.0.0.1:8000\nNORTHSTAR_DB=.integration-data/northstar.sqlite\nAEGIS_ENDPOINT=http://127.0.0.1:8001\nAEGIS_APP_ID=\nAEGIS_CONNECTION_KEY=\nAEGIS_PSEUDONYM_KEY=${secret()}\nAEGIS_ROUTE_MAPPINGS={"statement":"statement.read","transfer":"transfer.create"}\n`,
);
console.log(
  "Created ignored local environment files with random secrets. No existing files overwritten. Read the owner key and demo passwords from these files.",
);
