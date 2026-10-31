# Public deployment: nehitha-ss account only

Status: deployed and verified on Render Free as nehitha-ss on 2026-10-31.

- AEGIS: https://aegis-northstar-console.onrender.com/
- Integrations: https://aegis-northstar-console.onrender.com/integrations
- Northstar direct demo: https://northstar-finance-demo.onrender.com/demo/open
- Authenticated ingestion: https://aegis-northstar-ingestion.onrender.com

All three services show Free. No paid disks were created. Deployment source: 78994c618eecae68d4f6a6f243e2b64225a5d774. GitHub Actions run 41194473530 passed both production builds, type/lint checks and all 20 tests. Actual public allowed and denied statement requests were verified; the allowed request correlation 1a90d35d-8dc4-4a22-a07a-b887fc499e16 appeared with three authenticated events and risk 5. Unsafe helper mode stays disabled publicly; vulnerable paths were tested in the isolated test environment. Private hosting values are stored only in Render and ignored local configuration.
The original Vercel prototype and the existing Sites project are unchanged.

## Proposed deployment

`render.yaml` defines three NEW services from the dedicated
`feature/northstar-fastapi-integration` branch of
`https://github.com/nehitha-ss/aegis-agent-security`:

- AEGIS console: Node 24 / Next.js, public, health `/api/health`.
- AEGIS ingestion: authenticated Node service, temporary SQLite evidence storage.
- Northstar Finance: independent Python FastAPI service, temporary fake-finance storage.

All three services use the free plan with no disks or paid resources. Free services sleep while idle and may take time to wake up. Filesystem contents, demo balances, sessions and event history may reset on restarts or redeploys.
These service names are configuration names, not confirmed public domains.

The local Vinext build remains available. The separate public-hosting scripts
build and serve the same app with Next.js on a normal Node host; Sites' Workers
runtime cannot run the Python and SQLite processes unchanged.

## Account requirements

1. Connect GitHub as **nehitha-ss**, with write access to the selected repository.
   The GitHub browser session is nehitha-ss; the separate connector account has no write access.
2. Install/connect Render using the intended owner/workspace and verify its identity.
3. Push this dedicated branch only. Do not modify main or deploy an existing service.
4. Keep every service on Free and do not attach paid disks.

## Deployment order and configuration

Create the ingestion service first on Free, with no persistent disk.
Set `AEGIS_OWNER_KEYS` privately (JSON map of owner to a random private key of at
least 32 characters). Never put that value in the repository or public frontend.
Use `AEGIS_INTEGRATION_HOST=0.0.0.0` on this hosting target, and port 10000.
Set `AEGIS_ORIGIN` to the eventual exact public AEGIS console HTTPS origin.
Until the console exists and this value is correct, owner sign-in will be blocked.

Create the Finance service on Free with generated secrets. Set
`AEGIS_ENDPOINT` to the actual HTTPS ingestion origin. Privately register Northstar
using the ingestion owner's API (the Python connector registration helper is
available), then supply its returned `AEGIS_APP_ID` and `AEGIS_CONNECTION_KEY`
as Finance runtime secrets. To retain the registration across free-hosting restarts, set ingestion's private `AEGIS_BOOTSTRAP_APPS` to a JSON array of `{id, owner, name, key}` using that same application ID and connection key. Only configured owners are accepted; conflicts with stored credentials fail startup. Never put this value in source control. Owner registration requires the exact configured Origin.
Generate a separate `AEGIS_PSEUDONYM_KEY`; do not reuse an owner/connection key.
Do not label the connection as received/live before actual reports arrive.

Render provides `RENDER_EXTERNAL_HOSTNAME`; Finance derives its HTTPS form origin
and Secure-cookie policy from it. Owner-lab internal HTTP calls use the local
`PORT`. The direct shared fictional customer entry stays enabled; unsafe helper
mode stays disabled. Private customer/owner passwords remain separate.

Create the console and set:

- `NEXT_PUBLIC_NORTHSTAR_URL`: the actual Finance HTTPS origin (public address only).
- `AEGIS_INTEGRATION_URL`: the actual ingestion HTTPS origin (server-side value).

The public build refuses missing, HTTP or localhost target addresses. Placeholder
example domains used in CI are only compilation fixtures, not deployed services.
Once its origin is assigned, update ingestion's `AEGIS_ORIGIN` and redeploy that
service. Verify owner access, a real customer statement report and correlated
evidence in the public console. Verify direct customer access and owner denial.

## Automatic updates

`.github/workflows/northstar-ci.yml` checks the dedicated branch. Render's
`autoDeployTrigger: checksPass` deploys a pushed commit only after its checks pass.
Every service builds the same branch; changing the public Finance address requires
rebuilding the console because its public link is embedded at build time.

Local unsaved edits do not change the public sites. Save, commit and push the
intended changes to this branch. A failed build leaves the previous deployment
in place. Free SQLite records are temporary and can reset across redeploys; bootstrap registration restores only the configured connection, not past events. This is not an
unattended watcher that publishes all filesystem changes.

## Limits

The hosted Linux CI production build passed. The earlier local Windows prerender EPERM does not affect the verified Linux deployment.

The public frontend currently embeds the recovered prototype build; its original
editable Vercel source/backend are not available. Source-level maintenance of
those original screens requires obtaining that repository. Node/FastAPI owner
authentication is prototype authentication, not an enterprise identity provider.
This deployment is fictional/demo-only, single-instance SQLite storage, with no
banking connections or production data. Follow INTEGRATION.md for other limits.
