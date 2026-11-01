# Northstar Finance + AEGIS local integration

This is an isolated copy of `nehitha-ss/aegis-agent-security`, on branch
`feature/northstar-fastapi-integration`. Its original Control room, Security twin,
Data DNA, policies, agent gateway and themes remain available. The public Vercel
confused-deputy prototype is a different project and was not edited or deployed.

**Interface correction:** the local home now opens the recovered public
confused-deputy prototype, with an Integrations entry in its sidebar. The protected
finance view is `/integrations`; the older dashboard is retained at `/agent-legacy`.
Read `PROTOTYPE-RECOVERY.md` for the explicit client-build recovery and local
analysis compatibility boundary. The original editable Vercel source is still unavailable.

## What runs

| Process | Local address | Responsibility |
| --- | --- | --- |
| Original AEGIS React/Vinext app | http://localhost:5173 | Existing dashboard plus owner-protected Integrations UI |
| AEGIS integration backend (Node 24) | http://127.0.0.1:8001 | Application registration, authenticated ingestion, persistent SQLite, shared analysis |
| Independent Northstar Finance (FastAPI) | http://localhost:8000 | Customer login, two fictional tenants, accounts, statements, history, simulated transfers, owner lab |

Only authenticated received reports appear in Integrations. The original dashboard
still contains its labelled historical demo fixtures. They are never copied into
the received integration flow list. Recent connection status means an event was
received in the last two minutes, not that a persistent heartbeat exists.

## Install (Windows PowerShell)

Prerequisites: Node.js 24 LTS (for `node:sqlite`), Python 3.11+ (tested with 3.12), Git.
Run all commands from this folder. No hosting credentials are required locally.

```powershell
npm run install:ci
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r python/requirements.txt -e python/connector
npm run integration:setup
```

The setup script generates independent random secrets in ignored files:

- `.env.integration.local`: private owner key, backend port, AEGIS browser origin.
- `.env.northstar.local`: owner and customer passwords, internal permit secret,
  pseudonymisation key and connector settings.

Setup refuses to overwrite existing environments. Placeholder-only examples are
provided in `.env.integration.example` and `.env.northstar.example`.
Do not commit real environment files, SQLite files, local virtual environments or keys.

If Python is not on PATH, replace `python` with your installed Python executable.
If a Windows temporary path containing braces causes a setuptools error, use
short workspace paths for `TEMP`, `TMP` and `PYTHONUSERBASE` during installation.
For example, under your writable Codex folder use `work/pip-temp` and
`work/python-userbase`. Short paths also avoid Windows wheel-build path limits.

## Start and connect

In terminal 1:

```powershell
npm run integration:dev
```

With that running, register Northstar once from another terminal:

```powershell
npm run integration:connect
```

This authenticates as the configured owner, creates a unique application ID and
random private key, and writes only the issued connection settings into Northstar’s
server environment. The database stores a hash of the connection key. It cannot
be retrieved later; register a new application to replace a lost key.

In terminal 2:

```powershell
npm run dev
```

In terminal 3:

```powershell
npm run finance:dev
```

Open AEGIS at http://localhost:5173 and select **Integrations**. For the Chain
Guard-style read-only walkthrough, enter the public demo code `stuportal123`
(or click **Open read-only demo**), select **Python — FastAPI**, and expand
**Northstar Finance**. Five illustrative scenarios are available.
Selecting Python also reveals a prominent **Open Northstar Finance** button,
which opens the independent finance website in a new tab without expanding the
sample card. With `NORTHSTAR_DIRECT_CUSTOMER_DEMO=true`, it opens a dedicated
shared fictional visitor account directly, without a password prompt. Owner and
private-customer sign-in and all resource authorisation checks remain in place.
The samples are generated locally for display; opening them makes no connection and exposes
no registered applications or received event records. Java and Node.js appear as
framework-match choices, not implemented connectors. The public demo code is not
a security credential and is rejected by owner/backend APIs.

For actual received reports and registration, use the private owner key from
`.env.integration.local` in the same access field, then select Northstar Finance.
Registration is also available through this UI; the issued key is shown once.
The optional `AEGIS_INTEGRATION_URL` server variable changes the dashboard bridge’s
backend address; default is loopback port 8001. Match `AEGIS_ORIGIN` to the exact
browser origin. Use `localhost` consistently for the default setup.

Open Northstar directly at http://localhost:8000/demo/open. The generated local
configuration enables this permanent demo entry link. Each visit uses or creates
a normal, expiring server-side session for the fixed `visitor` customer (Taylor
Demo), never an owner. It works again after expiry or server restarts. This
account and its fake balances are intentionally shared demo data. Identity and
tenant query parameters cannot select another customer. Set
`NORTHSTAR_DIRECT_CUSTOMER_DEMO=false` to disable the direct entry; it is disabled
when the variable is absent. No private passwords are changed by enabling it.

For private accounts, use http://localhost:8000/login. Customer usernames are `alex`, `jamie`,
and `riley`; use `NORTHSTAR_CUSTOMER_PASSWORD`. Owner username is `owner`; use
`NORTHSTAR_OWNER_PASSWORD`. These are local fake identities, not banking accounts.

On macOS/Linux use `.venv/bin/python` for installation; the launcher selects it
automatically. For a different Python binary set `NORTHSTAR_PYTHON`.

Customer passwords are scrypt-hashed when the database is first seeded. Editing
password environment variables later does not silently replace existing hashes;
for a fresh demonstration use a new `NORTHSTAR_DB` path.

## Five actual request scenarios

Unsafe behaviour is **off by default**. Customer statement and transfer routes
always enforce normal authorisation regardless of the demo flag.

To exercise the isolated vulnerable helpers, stop Northstar, explicitly set
`NORTHSTAR_ENABLE_UNSAFE_DEMO=true` in its ignored environment, restart it, and
sign in as `owner`. This flag should stay false in ordinary use and public demos.

| Owner lab button | Actual operation | Expected AEGIS result |
| --- | --- | --- |
| Normal | Alex reads Alex’s statement | No bypass observed, risk 5 |
| Direct denial | Alex requests Jamie’s statement | Denied at source, risk 10 |
| Confused deputy | Broad helper requests Jamie’s statement without checking Alex | Blocked confused deputy, risk 94 |
| Cross tenant | Broad helper requests Riley’s Aurora Studio statement | Blocked confused deputy + cross-tenant finding, risk 98 |
| Corrected | Corrected helper rejects Alex’s request for Riley’s statement | Denied at source, risk 10 |

Each button creates an actual loopback HTTP request with a server-issued customer
session and single-use owner permit. The server chooses the fixed test scenario;
browser fields cannot specify identities, ownership, permissions or arbitrary
unsafe resources. An HMAC signature and persisted expiring permit are checked
before unsafe code can run. Ordinary customer sessions cannot create permits,
access the owner lab or use the unsafe route. Disable unsafe mode after testing.

The receipt shows the customer request correlation ID. Find exactly that ID in
AEGIS and expand its flow to inspect customer, helper and resource policy evidence.
A denied resource stage records a denied policy check; no statement content was read.

## Connector contract and analysis

The installable package is `python/connector`. Other Python applications can use
`AegisConnector` with server-side credentials and configured route-to-action mappings.
Its asynchronous `register(endpoint, owner_key, owner_origin, application_name)`
helper supports one-time server-side provisioning and returns the application ID
and one-time connection key. Keep the owner credential separate from runtime keys.
The Northstar app supplies trusted, instrumented policy evidence; this is not an
automatic network scanner and cannot infer ownership policy from URLs alone.

`POST /v1/events` requires both `X-Aegis-App-Id` and a Bearer connection key.
Only the strict versioned allowlist is accepted: event/correlation IDs, timestamp,
phase, pseudonymous caller/helper/resource/tenant IDs, action, authorisation outcome
and seven explicit boolean-or-unknown policy facts. Extra fields are rejected.
The client pseudonymises IDs with an application-specific HMAC key. It never
automatically reads HTTP bodies, headers, cookies, credentials or finance contents.

Each customer request gets a new server-generated correlation ID. The same ID is
preserved inside the helper, resource check and all three reports. Browser-supplied
identity and correlation headers are not trusted. Lost context means that the
downstream resource received no original actor; the audit instrumentation still
knows the original actor from the trusted incoming customer session.

`lib/delegated-policy.mjs` extends the shared AEGIS policy module (re-exported by
`lib/aegis-policy.ts`) and is executed by the integration backend for received flows.
The older three agent-gateway scenarios keep their existing policy implementation;
their risk and enforcement results remain visible in Control room. This extension
does not claim to recover the unavailable Vercel prototype’s original source.

A finding requires a complete consistent flow, allowed resource access, a denied
original-caller policy, broader helper authority, service identity use and a missing
caller check. Missing or inconsistent evidence produces **UNKNOWN**, with no risk
number. Lost context or caller-selected resource metadata alone is not proof.
Every finding links to its source event IDs and explains what was observed.
Evidence is authenticated reporter evidence, not independent attestation of that
application’s honesty. Risk numbers are deterministic demo policy scores, not
probabilities, model confidence or a general security certification.

## Verification and enforcement

Northstar sends a strict, pseudonymous three-stage evidence set to AEGIS before a
protected statement or transfer can proceed. AEGIS verifies caller and helper
authority, tenant consistency, caller-context propagation, helper-only trust and
confused-deputy indicators. With the default `AEGIS_ENFORCEMENT_MODE=enforce`, a
deny, invalid response or unavailable AEGIS service fails closed: Northstar does
not read the statement or commit the fictional transfer. Transfers still re-check
ownership, tenant, recipient and balance inside their atomic SQLite transaction.

Each protected request is then recorded as a separate evidence flow. Statement
contents, balances, credentials, cookies and raw request bodies never reach AEGIS.
Setting `AEGIS_ENFORCEMENT_MODE=monitor` is permitted only for explicit local
demonstration; it preserves Northstar’s own authorisation checks but does not turn
an unavailable AEGIS service into an allow decision.

## Access boundaries and storage

Owner keys are supplied server-side through `AEGIS_OWNER_KEYS` (JSON map of owner ID
to private key). Owner login sets an eight-hour HttpOnly SameSite=Strict cookie.
Mutation routes check browser Origin; Northstar forms additionally use session CSRF
tokens. Login is rate-limited. Applications and flows are queried with the signed-in
owner scope, with cross-owner requests returning 404. Each app uses a distinct key.
Event replay with an identical event ID is idempotent; conflicting IDs or repeated
phases are rejected. Timestamps have a 24-hour delivery window and ingestion is
limited to 600 events per application per minute, with a 32 KB body limit.

AEGIS stores reports and sessions in `.integration-data/aegis.sqlite`; Northstar
stores fictional records separately in `.integration-data/northstar.sqlite`.
Integration analysis is recomputed from stored evidence on reads. SQLite persistence
is real but local; it is not the old prototype’s hash-linked tamper-evident ledger.
No production credentials or actual bank/payment APIs are used.

## Verification commands

```powershell
npm run test:integration
.\.venv\Scripts\python.exe -m pytest python/tests -v
npx tsc --noEmit
npm run lint
npm run build
```

With all three normal local services running, the following explicit command
starts a temporary isolated owner lab, executes all five real scenarios and checks
their matching evidence through the protected AEGIS dashboard API:

```powershell
node scripts/verify-local.mjs --unsafe-owner-lab
```

The temporary lab uses loopback port 8002 and a separate fictional database. It
stops after verification and does not enable unsafe mode on the normal Northstar
service. Its actual reports remain visible in the configured application's flow
list. `.integration-data/local-verification.json` contains the correlation IDs.
Use `NORTHSTAR_VERIFY_PORT` if port 8002 is occupied.

The HTTP tests start separate Node ingestion and FastAPI processes on temporary
ports, use temporary databases, and generate real requests. They test authorised
access, direct denial, vulnerable helper access, cross-tenant access, corrected
denial, customer exclusion from unsafe mode, disabled demo mode, transfers, invalid
keys, owner/application isolation, extra-field rejection, idempotency, unknown
evidence, database persistence and AEGIS unavailability. Node policy tests check
missing and contradictory evidence and require concrete bypass outcomes.

## Hosting later (not deployed)

Preserve the existing public sites and use new projects/URLs. The existing AEGIS
frontend can use its current hosting platform, with the bridge configured to reach
the separate integration backend over HTTPS. Deploy that Node 24 backend and the
independent Python FastAPI service as persistent web services, each with its own
environment and persistent disk. The backend currently binds loopback: use a reverse
proxy in the same host, or adapt the listen address behind an authenticated network
boundary when hosting. Do not expose an unsecured local development server.

SQLite requires a persistent disk and a single writer service instance. Ephemeral
Vercel function filesystems are unsuitable for this backend. Multi-instance hosting
requires moving storage and rate limits to a shared database/service. Configure
HTTPS origins and Secure cookies, secret storage, reverse-proxy routing, backups,
retention and operational monitoring before publishing. The existing demo agent
endpoints remain as inherited; their hardening is outside this integration’s owner
boundary. No optional AEGIS gateway enforcement was added.

Known limits: no durable retry queue, key rotation/revocation UI, automatic data
retention, MFA or production identity provider; single-process rate limits; no
independent policy attestation; no production penetration test. Only fictional data
is appropriate. This implementation is a local integration prototype.
