"""Independent fictional finance service. Every account and document is fake."""
import hashlib
import hmac
import json
import os
from pathlib import Path
import secrets
import sqlite3
import time
import uuid
from contextlib import contextmanager
from decimal import Decimal, InvalidOperation

import httpx
from fastapi import FastAPI, Request, Form, HTTPException
from fastapi.responses import RedirectResponse, HTMLResponse
from fastapi.templating import Jinja2Templates
from starlette.background import BackgroundTask
from aegis_connector import AegisConnector, correlation_id

BASE = Path(__file__).parent
DB_PATH = Path(os.environ.get("NORTHSTAR_DB", ".integration-data/northstar.sqlite"))
DB_PATH.parent.mkdir(parents=True, exist_ok=True)
ORIGIN = (os.environ.get("NORTHSTAR_ORIGIN") or ("https://" + os.environ["RENDER_EXTERNAL_HOSTNAME"] if os.environ.get("RENDER_EXTERNAL_HOSTNAME") else "http://localhost:8000")).rstrip("/")
DEMO = os.environ.get("NORTHSTAR_ENABLE_UNSAFE_DEMO", "false").lower() == "true"
DIRECT_CUSTOMER_DEMO = os.environ.get("NORTHSTAR_DIRECT_CUSTOMER_DEMO", "false").lower() == "true"
OWNER_PASSWORD = os.environ.get("NORTHSTAR_OWNER_PASSWORD", "")
CUSTOMER_PASSWORD = os.environ.get("NORTHSTAR_CUSTOMER_PASSWORD", "")
RUN_KEY = os.environ.get("NORTHSTAR_DEMO_RUN_KEY", "")
if min(map(len, [OWNER_PASSWORD, CUSTOMER_PASSWORD, RUN_KEY])) < 24:
    raise RuntimeError("Set separate NORTHSTAR owner, customer and demo-run secrets (at least 24 characters)")
connector = AegisConnector(os.environ.get("AEGIS_ENDPOINT", "http://127.0.0.1:8001"), os.environ.get("AEGIS_APP_ID", ""), os.environ.get("AEGIS_CONNECTION_KEY", ""), os.environ.get("AEGIS_PSEUDONYM_KEY", ""), json.loads(os.environ.get("AEGIS_ROUTE_MAPPINGS", '{"statement":"statement.read","transfer":"transfer.create"}')))
app = FastAPI(title="Northstar Finance — fictional demo", docs_url=None, redoc_url=None)
templates = Jinja2Templates(directory=str(BASE / "templates"))


@contextmanager
def database():
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


def password_hash(password, salt):
    return hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), n=16384, r=8, p=1).hex()


with database() as db:
    db.executescript("""PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS customers(id TEXT PRIMARY KEY,name TEXT,tenant TEXT,salt TEXT,password_hash TEXT,role TEXT);
    CREATE TABLE IF NOT EXISTS accounts(id TEXT PRIMARY KEY,owner TEXT,tenant TEXT,label TEXT,balance INTEGER);
    CREATE TABLE IF NOT EXISTS transactions(id TEXT PRIMARY KEY,account TEXT,label TEXT,amount INTEGER,created TEXT);
    CREATE TABLE IF NOT EXISTS sessions(hash TEXT PRIMARY KEY,customer TEXT,csrf TEXT,expires REAL);
    CREATE TABLE IF NOT EXISTS permits(hash TEXT PRIMARY KEY,customer TEXT,scenario TEXT,expires REAL,used INTEGER DEFAULT 0);
    """)
    for identity, name, tenant, role in [("alex", "Alex Morgan", "Northstar Logistics", "customer"), ("jamie", "Jamie Chen", "Northstar Logistics", "customer"), ("riley", "Riley Brooks", "Aurora Studio", "customer"), ("owner", "Demo operator", "Northstar Logistics", "owner")]:
        if not db.execute("SELECT id FROM customers WHERE id=?", (identity,)).fetchone():
            salt = secrets.token_hex(16)
            db.execute("INSERT INTO customers VALUES(?,?,?,?,?,?)", (identity, name, tenant, salt, password_hash(OWNER_PASSWORD if role == "owner" else CUSTOMER_PASSWORD, salt), role))
    for account, owner, tenant, label, balance in [("acct-alex", "alex", "Northstar Logistics", "Everyday account", 1248500), ("acct-jamie", "jamie", "Northstar Logistics", "Operations account", 875000), ("acct-riley", "riley", "Aurora Studio", "Studio account", 2490000)]:
        if not db.execute("SELECT id FROM accounts WHERE id=?", (account,)).fetchone():
            db.execute("INSERT INTO accounts VALUES(?,?,?,?,?)", (account, owner, tenant, label, balance))
            for text, amount in [("Opening fictional balance", balance + 4200), ("Demo office supplies", -4200)]:
                db.execute("INSERT INTO transactions VALUES(?,?,?,?,datetime('now'))", (str(uuid.uuid4()), account, text, amount))
    if DIRECT_CUSTOMER_DEMO:
        # A separate, intentionally shared fictional customer; never an owner or
        # one of the password-protected customer identities.
        if not db.execute("SELECT id FROM customers WHERE id='visitor'").fetchone():
            salt = secrets.token_hex(16)
            db.execute("INSERT INTO customers VALUES(?,?,?,?,?,?)", ("visitor", "Taylor Demo", "Northstar Logistics", salt, password_hash(secrets.token_urlsafe(32), salt), "customer"))
        if not db.execute("SELECT id FROM accounts WHERE id='acct-visitor'").fetchone():
            db.execute("INSERT INTO accounts VALUES(?,?,?,?,?)", ("acct-visitor", "visitor", "Northstar Logistics", "Visitor demo account", 250000))
            db.execute("INSERT INTO transactions VALUES(?,?,?,?,datetime('now'))", (str(uuid.uuid4()), "acct-visitor", "Fictional demo opening balance", 250000))


def new_session(customer):
    token = secrets.token_urlsafe(32)
    with database() as db:
        db.execute("DELETE FROM sessions WHERE expires<?", (time.time(),))
        db.execute("INSERT INTO sessions VALUES(?,?,?,?)", (hashlib.sha256(token.encode()).hexdigest(), customer, secrets.token_urlsafe(32), time.time() + 28800))
    return token


def current(request, owner=False):
    token = request.cookies.get("northstar_session", "")
    with database() as db:
        person = db.execute("SELECT c.*,s.csrf FROM sessions s JOIN customers c ON c.id=s.customer WHERE s.hash=? AND s.expires>?", (hashlib.sha256(token.encode()).hexdigest(), time.time())).fetchone()
    if not person:
        raise HTTPException(401, "Sign in required")
    if owner and person["role"] != "owner":
        raise HTTPException(403, "Owner access required")
    return dict(person)


def verify_form(request, person, csrf):
    if request.headers.get("origin") != ORIGIN or not secrets.compare_digest(person["csrf"], csrf):
        raise HTTPException(403, "Invalid form origin or CSRF token")


@app.middleware("http")
async def request_context(request, call_next):
    # Always generated by this server: do not trust browser-supplied identity or correlation claims.
    token = correlation_id.set(str(uuid.uuid4()))
    request.state.correlation_id = correlation_id.get()
    try:
        response = await call_next(request)
        response.headers["X-Correlation-ID"] = request.state.correlation_id
        response.headers["Cache-Control"] = "no-store"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Content-Security-Policy"] = "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'none'; frame-ancestors 'none'; form-action 'self'"
        return response
    finally:
        correlation_id.reset(token)


@app.get("/health")
def health():
    return {"status": "ok", "fictional": True, "monitoring": True}


@app.get("/login", response_class=HTMLResponse)
def login_page(request: Request):
    return templates.TemplateResponse(request=request, name="login.html", context={"direct_demo": DIRECT_CUSTOMER_DEMO})


public_demo_attempts = {}


@app.get("/demo/open")
def open_customer_demo(request: Request):
    if not DIRECT_CUSTOMER_DEMO:
        raise HTTPException(404, "Direct customer demo is disabled")
    try:
        person = current(request)
    except HTTPException:
        person = None
    if person:
        return RedirectResponse("/owner" if person["role"] == "owner" else "/", status_code=303)
    ip = request.client.host
    attempts = [t for t in public_demo_attempts.get(ip, []) if time.time() - t < 60]
    if len(attempts) >= 30:
        raise HTTPException(429, "Try again in a minute")
    public_demo_attempts[ip] = attempts + [time.time()]
    with database() as db:
        visitor = db.execute("SELECT role FROM customers WHERE id='visitor'").fetchone()
    if not visitor or visitor["role"] != "customer":
        raise HTTPException(403, "Customer demo account is unavailable")
    response = RedirectResponse("/", status_code=303)
    response.set_cookie("northstar_session", new_session("visitor"), httponly=True, secure=ORIGIN.startswith("https:"), samesite="strict", max_age=28800)
    return response


login_attempts = {}


@app.post("/login")
def login(request: Request, username: str = Form(), password: str = Form()):
    if request.headers.get("origin") != ORIGIN:
        raise HTTPException(403, "Invalid origin")
    ip = request.client.host
    times = [t for t in login_attempts.get(ip, []) if time.time() - t < 60]
    if len(times) >= 15:
        raise HTTPException(429, "Try again in a minute")
    login_attempts[ip] = times + [time.time()]
    with database() as db:
        person = db.execute("SELECT * FROM customers WHERE id=?", (username,)).fetchone()
    if not person or not secrets.compare_digest(password_hash(password, person["salt"]), person["password_hash"]):
        raise HTTPException(401, "Invalid demo credentials")
    response = RedirectResponse("/owner" if person["role"] == "owner" else "/", status_code=303)
    response.set_cookie("northstar_session", new_session(person["id"]), httponly=True, secure=ORIGIN.startswith("https:"), samesite="strict", max_age=28800)
    return response


@app.post("/logout")
def logout(request: Request, csrf: str = Form()):
    person = current(request)
    verify_form(request, person, csrf)
    with database() as db:
        db.execute("DELETE FROM sessions WHERE hash=?", (hashlib.sha256(request.cookies["northstar_session"].encode()).hexdigest(),))
    response = RedirectResponse("/login", status_code=303)
    response.delete_cookie("northstar_session")
    return response


@app.get("/", response_class=HTMLResponse)
def dashboard(request: Request):
    try:
        person = current(request)
    except HTTPException:
        return RedirectResponse("/demo/open" if DIRECT_CUSTOMER_DEMO else "/login", status_code=303)
    if person["role"] == "owner":
        return RedirectResponse("/owner", status_code=303)
    with database() as db:
        accounts = [dict(x) for x in db.execute("SELECT * FROM accounts WHERE owner=?", (person["id"],))]
        transactions = [dict(x) for x in db.execute("SELECT t.* FROM transactions t JOIN accounts a ON a.id=t.account WHERE a.owner=? ORDER BY t.rowid DESC LIMIT 20", (person["id"],))]
        recipients = [dict(x) for x in db.execute("SELECT id,label FROM accounts WHERE tenant=? AND owner<>?", (person["tenant"], person["id"]))]
    return templates.TemplateResponse(request=request, name="dashboard.html", context={"person": person, "accounts": accounts, "transactions": transactions, "recipients": recipients})


def policy(person, account, action):
    # Identity and ownership come exclusively from persisted server-side records.
    return person["role"] == "customer" and person["id"] == account["owner"] and person["tenant"] == account["tenant"] and action in {"statement.read", "transfer.create"}


def report_chain(request, person, account, allowed, *, vulnerable=False, route="statement"):
    authorised = policy(person, account, connector.route_mappings[route])
    facts = {"caller_authorized": authorised, "helper_authorized": True, "helper_uses_own_identity": True,
             "original_caller_checked": not vulnerable, "caller_context_propagated": not vulnerable,
             "caller_controls_resource": True, "resource_trusts_helper_only": vulnerable}
    # The complete report retains a pseudonymous original actor for audit even when
    # the vulnerable downstream resource receives only the helper identity.
    cid_token = correlation_id.set(request.state.correlation_id)
    try:
        return [connector.event(route=route, phase=phase, caller=person["id"], helper="statement-helper" if route == "statement" else "transfer-helper", resource=account["id"], caller_tenant=person["tenant"], resource_tenant=account["tenant"], outcome="allowed" if allowed else "denied", evidence=facts) for phase in ("customer", "helper", "resource")]
    finally:
        correlation_id.reset(cid_token)


def statement_service(request, person, account_id, vulnerable=False):
    with database() as db:
        row = db.execute("SELECT * FROM accounts WHERE id=?", (account_id,)).fetchone()
        if not row:
            raise HTTPException(404, "Account not found")
        account = dict(row)
        allowed = vulnerable or policy(person, account, "statement.read")
        events = report_chain(request, person, account, allowed, vulnerable=vulnerable)
        # Resource access is inside the authorised branch. In vulnerable owner-only
        # runs the broad service credential is deliberately sufficient for fake data.
        transactions = [dict(x) for x in db.execute("SELECT label,amount,created FROM transactions WHERE account=?", (account_id,))] if allowed else []
    return allowed, account, transactions, events


@app.get("/statements/{account_id}", response_class=HTMLResponse)
def statement(request: Request, account_id: str):
    person = current(request)
    allowed, account, transactions, events = statement_service(request, person, account_id)
    return templates.TemplateResponse(request=request, name="statement.html", status_code=200 if allowed else 403, context={"person": person, "allowed": allowed, "account": account if allowed else None, "transactions": transactions, "correlation": request.state.correlation_id}, background=BackgroundTask(connector.send, events))


@app.post("/transfers", response_class=HTMLResponse)
def transfer(request: Request, source: str = Form(), destination: str = Form(), amount: str = Form(), csrf: str = Form()):
    person = current(request)
    verify_form(request, person, csrf)
    try:
        value = Decimal(amount)
        if not value.is_finite() or value <= 0 or value > 100000 or value * 100 != (value * 100).to_integral_value():
            raise ValueError()
        cents = int(value * 100)
    except (InvalidOperation, ValueError, OverflowError):
        raise HTTPException(400, "Enter a positive amount with at most two decimals (maximum 100,000)")
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        src = db.execute("SELECT * FROM accounts WHERE id=?", (source,)).fetchone()
        dst = db.execute("SELECT * FROM accounts WHERE id=?", (destination,)).fetchone()
        if not src or not dst:
            raise HTTPException(404, "Account not found")
        src, dst = dict(src), dict(dst)
        allowed = policy(person, src, "transfer.create") and dst["tenant"] == person["tenant"] and source != destination
        events = report_chain(request, person, src, allowed, route="transfer")
        if allowed and src["balance"] >= cents:
            db.execute("UPDATE accounts SET balance=balance-? WHERE id=?", (cents, source))
            db.execute("UPDATE accounts SET balance=balance+? WHERE id=?", (cents, destination))
            for target, delta in [(source, -cents), (destination, cents)]:
                db.execute("INSERT INTO transactions VALUES(?,?,?,?,datetime('now'))", (str(uuid.uuid4()), target, "Simulated transfer", delta))
            message, status = "Demo transfer completed. Only fictional balances changed.", 200
        else:
            message, status = "Transfer denied: ownership, tenant, recipient or funds check failed.", 403
            for event in events:
                event["outcome"] = "denied"
    return templates.TemplateResponse(request=request, name="result.html", status_code=status, context={"person": person, "message": message, "correlation": request.state.correlation_id}, background=BackgroundTask(connector.send, events))


SCENARIOS = {"normal": ("acct-alex", False), "direct-denial": ("acct-jamie", False), "confused-deputy": ("acct-jamie", True), "cross-tenant": ("acct-riley", True), "corrected": ("acct-riley", False)}


@app.get("/owner", response_class=HTMLResponse)
def owner_page(request: Request):
    person = current(request, owner=True)
    return templates.TemplateResponse(request=request, name="owner.html", context={"person": person, "demo": DEMO, "scenarios": SCENARIOS, "delivered": connector.delivered, "failed": connector.failed})


@app.post("/owner/scenarios", response_class=HTMLResponse)
async def scenario(request: Request, scenario: str = Form(), csrf: str = Form()):
    person = current(request, owner=True)
    verify_form(request, person, csrf)
    if scenario not in SCENARIOS:
        raise HTTPException(400, "Unknown scenario")
    if SCENARIOS[scenario][1] and not DEMO:
        raise HTTPException(403, "Unsafe demo mode is disabled")
    # A real loopback HTTP customer request, with a server-issued, single-use
    # owner permit. Customers cannot create permits or reach unsafe behaviour.
    permit = secrets.token_urlsafe(32)
    with database() as db:
        db.execute("DELETE FROM permits WHERE expires<?", (time.time(),))
        db.execute("INSERT INTO permits VALUES(?,?,?,?,0)", (hashlib.sha256(permit.encode()).hexdigest(), "alex", scenario, time.time() + 30))
    customer_token = new_session("alex")
    try:
        async with httpx.AsyncClient(timeout=10, trust_env=False) as client:
            internal_url = os.environ.get("NORTHSTAR_INTERNAL_URL") or "http://127.0.0.1:" + os.environ.get("PORT", "8000")
            result = await client.post(internal_url + "/demo/customer-statement", headers={"X-Demo-Permit": permit, "X-Demo-Signature": hmac.new(RUN_KEY.encode(), permit.encode(), hashlib.sha256).hexdigest()}, cookies={"northstar_session": customer_token})
        result.raise_for_status()
        data = result.json()
    finally:
        with database() as db:
            db.execute("DELETE FROM sessions WHERE hash=?", (hashlib.sha256(customer_token.encode()).hexdigest(),))
    return templates.TemplateResponse(request=request, name="result.html", context={"person": person, "message": f"{scenario}: Northstar resource outcome = {data['outcome']}. Report delivery = {data['delivery']}. Check this correlation ID in AEGIS.", "correlation": data["correlation_id"]})


@app.post("/demo/customer-statement")
async def demo_request(request: Request):
    person = current(request)
    permit = request.headers.get("X-Demo-Permit", "")
    signature = request.headers.get("X-Demo-Signature", "")
    if not hmac.compare_digest(signature, hmac.new(RUN_KEY.encode(), permit.encode(), hashlib.sha256).hexdigest()):
        raise HTTPException(403, "Owner-issued permit required")
    with database() as db:
        db.execute("BEGIN IMMEDIATE")
        run = db.execute("SELECT * FROM permits WHERE hash=? AND expires>? AND used=0 AND customer=?", (hashlib.sha256(permit.encode()).hexdigest(), time.time(), person["id"])).fetchone()
        if not run:
            raise HTTPException(403, "Invalid or consumed demo permit")
        db.execute("UPDATE permits SET used=1 WHERE hash=?", (run["hash"],))
    account, unsafe = SCENARIOS[run["scenario"]]
    if unsafe and not DEMO:
        raise HTTPException(403, "Unsafe demo mode disabled")
    allowed, _, _, events = statement_service(request, person, account, vulnerable=unsafe)
    delivery = await connector.send(events)
    return {"outcome": "allowed" if allowed else "denied", "correlation_id": request.state.correlation_id, "delivery": "received" if delivery else "failed (monitoring only)"}
