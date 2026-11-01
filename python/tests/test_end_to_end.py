"""Real loopback HTTP tests: FastAPI -> reusable connector -> AEGIS SQLite/evaluator."""
import hashlib
import asyncio
import hmac
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import sqlite3
import subprocess
import sys
import time
import uuid
import httpx
import pytest

ROOT = Path(__file__).resolve().parents[2]
NODE = shutil.which("node")


def port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def wait_for(url, process):
    for _ in range(150):
        if process.poll() is not None:
            raise RuntimeError("Test server exited early")
        try:
            if httpx.get(url, timeout=.3, trust_env=False).status_code == 200:
                return
        except httpx.HTTPError:
            pass
        time.sleep(.1)
    raise RuntimeError("Test server did not start")


@pytest.fixture(scope="module")
def stack(tmp_path_factory):
    temp = tmp_path_factory.mktemp("northstar")
    ingest_port, finance_port = port(), port()
    origin = "http://localhost:5173"
    base = f"http://127.0.0.1:{ingest_port}"
    finance = f"http://127.0.0.1:{finance_port}"
    owner_key, other_key, customer_password, owner_password, run_key = [secrets.token_hex(32) for _ in range(5)]
    aegis_db, finance_db = temp / "aegis.sqlite", temp / "finance.sqlite"
    env = os.environ | {"AEGIS_OWNER_KEYS": json.dumps({"owner": owner_key, "other": other_key}), "AEGIS_INTEGRATION_PORT": str(ingest_port), "AEGIS_INTEGRATION_DB": str(aegis_db), "AEGIS_ORIGIN": origin}
    backend_log = open(temp / "backend.log", "w")
    backend = subprocess.Popen([NODE, "integration/server.mjs"], cwd=ROOT, env=env, stdout=backend_log, stderr=subprocess.STDOUT)
    processes = [backend]
    clients = []
    try:
        wait_for(base + "/health", backend)
        owner = httpx.Client(base_url=base, headers={"Origin": origin}, trust_env=False)
        other = httpx.Client(base_url=base, headers={"Origin": origin}, trust_env=False)
        clients += [owner, other]
        assert owner.post("/owner/login", json={"key": owner_key}).status_code == 200
        assert other.post("/owner/login", json={"key": other_key}).status_code == 200
        # Direct service tests use a cookie header because the browser cookie path is
        # deliberately restricted to the same-origin /api/integrations bridge.
        for client in [owner, other]:
            client.headers["Cookie"] = "aegis_owner=" + client.cookies.get("aegis_owner")
        app = owner.post("/owner/apps", json={"name": "Northstar Finance"}).json()
        other_app = other.post("/owner/apps", json={"name": "Other application"}).json()
        fin_env = os.environ | {"NORTHSTAR_DB": str(finance_db), "NORTHSTAR_ORIGIN": finance, "NORTHSTAR_INTERNAL_URL": finance, "NORTHSTAR_ENABLE_UNSAFE_DEMO": "true", "NORTHSTAR_OWNER_PASSWORD": owner_password, "NORTHSTAR_CUSTOMER_PASSWORD": customer_password, "NORTHSTAR_DEMO_RUN_KEY": run_key, "AEGIS_ENDPOINT": base, "AEGIS_APP_ID": app["id"], "AEGIS_CONNECTION_KEY": app["connection_key"], "AEGIS_PSEUDONYM_KEY": secrets.token_hex(32)}
        fin_env["NORTHSTAR_DIRECT_CUSTOMER_DEMO"] = "false"
        finance_log = open(temp / "finance.log", "w")
        service = subprocess.Popen([sys.executable, "-m", "uvicorn", "northstar.app:app", "--app-dir", "python", "--host", "127.0.0.1", "--port", str(finance_port)], cwd=ROOT, env=fin_env, stdout=finance_log, stderr=subprocess.STDOUT)
        processes.append(service)
        wait_for(finance + "/health", service)
        customer = httpx.Client(base_url=finance, headers={"Origin": finance}, trust_env=False, timeout=10)
        operator = httpx.Client(base_url=finance, headers={"Origin": finance}, trust_env=False, timeout=15)
        clients += [customer, operator]
        assert customer.post("/login", data={"username": "alex", "password": customer_password}).status_code == 303
        assert operator.post("/login", data={"username": "owner", "password": owner_password}).status_code == 303
        yield {"owner": owner, "other": other, "owner_key": owner_key, "backend_env": env, "app": app, "other_app": other_app, "customer": customer, "operator": operator, "base": base, "finance": finance, "aegis_db": aegis_db, "finance_db": finance_db, "backend": backend, "env": fin_env, "processes": processes, "temp": temp}
    finally:
        for client in clients:
            client.close()
        for process in reversed(processes):
            if process.poll() is None:
                process.terminate()
                process.wait(timeout=10)
        backend_log.close()


def csrf(client, path="/"):
    response = client.get(path)
    assert response.status_code == 200
    return re.search(r'name="csrf" value="([^"]+)"', response.text).group(1)


def flows(stack):
    return stack["owner"].get(f"/owner/apps/{stack['app']['id']}/flows").json()


def wait_flow(stack, cid):
    for _ in range(50):
        for flow in flows(stack)["flows"]:
            if flow["id"] == cid and len(flow["events"]) == 3:
                return flow
        time.sleep(.1)
    raise AssertionError("Complete correlated evidence not received")


def test_01_authorised_and_direct_denial(stack):
    for account, expected, verdict in [("acct-alex", 200, "NO_BYPASS_OBSERVED"), ("acct-jamie", 403, "DENIED_AT_SOURCE")]:
        response = stack["customer"].get("/statements/" + account, headers={"X-Correlation-ID": str(uuid.uuid4()), "X-Caller": "jamie"})
        assert response.status_code == expected
        flow = wait_flow(stack, response.headers["x-correlation-id"])
        assert flow["analysis"]["verdict"] == verdict
        assert {e["phase"] for e in flow["events"]} == {"customer", "helper", "resource"}
        assert len({e["correlation_id"] for e in flow["events"]}) == 1
        assert re.fullmatch(r"p_[a-f0-9]{24}", flow["events"][0]["caller"])


def test_02_owner_actual_scenarios_and_findings(stack):
    expected = {"normal": "NO_BYPASS_OBSERVED", "direct-denial": "DENIED_AT_SOURCE", "confused-deputy": "BLOCKED_CONFUSED_DEPUTY", "cross-tenant": "BLOCKED_CONFUSED_DEPUTY", "corrected": "DENIED_AT_SOURCE"}
    token = csrf(stack["operator"], "/owner")
    for scenario, verdict in expected.items():
        response = stack["operator"].post("/owner/scenarios", data={"csrf": token, "scenario": scenario})
        assert response.status_code == 200, response.text
        cid = re.search(r"<code>([a-f0-9-]{36})</code>", response.text).group(1)
        flow = wait_flow(stack, cid)
        assert flow["analysis"]["verdict"] == verdict
        if scenario == "cross-tenant":
            assert flow["analysis"]["risk"] == 98
            assert any(f["id"] == "CROSS_TENANT_ACCESS" for f in flow["analysis"]["findings"])
            assert "outcome = denied" in response.text
        if scenario == "corrected":
            assert all(e["outcome"] == "denied" for e in flow["events"])
    assert stack["customer"].get("/owner").status_code == 403
    assert stack["customer"].post("/owner/scenarios", data={"csrf": csrf(stack["customer"]), "scenario": "confused-deputy"}).status_code == 403
    assert stack["customer"].post("/demo/customer-statement").status_code == 403


def test_03_credentials_isolation_and_privacy(stack):
    app = stack["app"]
    assert httpx.post(stack["base"] + "/owner/login", json={"key": "stuportal123"}, headers={"Origin": "http://localhost:5173"}, trust_env=False).status_code == 401
    assert httpx.get(stack["base"] + "/owner/apps", headers={"Authorization": "Bearer stuportal123"}, trust_env=False).status_code == 401
    assert stack["other"].get(f"/owner/apps/{app['id']}/flows").status_code == 404
    assert all(a["id"] != app["id"] for a in stack["other"].get("/owner/apps").json()["applications"])
    event = flows(stack)["flows"][0]["events"][0].copy()
    event.pop("received_at")
    assert httpx.post(stack["base"] + "/v1/events", json=event, headers={"X-Aegis-App-Id": app["id"], "Authorization": "Bearer invalid"}, trust_env=False).status_code == 401
    headers = {"X-Aegis-App-Id": app["id"], "Authorization": "Bearer " + app["connection_key"]}
    assert httpx.post(stack["base"] + "/v1/events", json=event | {"password": "forbidden"}, headers=headers, trust_env=False).status_code == 400
    assert httpx.post(stack["base"] + "/v1/events", json=event, headers=headers, trust_env=False).status_code == 200  # idempotency
    assert httpx.post(stack["base"] + "/v1/events", json=event, headers={"X-Aegis-App-Id": stack["other_app"]["id"], "Authorization": "Bearer " + app["connection_key"]}, trust_env=False).status_code == 401
    stored = json.dumps(flows(stack))
    for secret in [stack["env"]["NORTHSTAR_CUSTOMER_PASSWORD"], stack["env"]["NORTHSTAR_OWNER_PASSWORD"], app["connection_key"], "Opening fictional balance", "1248500", "Alex Morgan", "acct-alex"]:
        assert secret not in stored
    assert httpx.get(stack["base"] + "/owner/apps", trust_env=False).status_code == 401
    assert stack["owner"].post("/owner/apps", json={"name": "CSRF"}, headers={"Origin": "http://attacker.invalid"}).status_code == 403


def test_04_transfer_updates_demo_only_and_checks_ownership(stack):
    customer = stack["customer"]
    token = csrf(customer)
    with sqlite3.connect(stack["finance_db"]) as db:
        before = dict(db.execute("SELECT id,balance FROM accounts"))
    assert customer.post("/transfers", data={"source": "acct-alex", "destination": "acct-jamie", "amount": "12.34", "csrf": token}).status_code == 200
    with sqlite3.connect(stack["finance_db"]) as db:
        after = dict(db.execute("SELECT id,balance FROM accounts"))
    assert after["acct-alex"] == before["acct-alex"] - 1234
    assert after["acct-jamie"] == before["acct-jamie"] + 1234
    assert sum(before.values()) == sum(after.values())
    for source, dest, amount in [("acct-jamie", "acct-alex", "1"), ("acct-alex", "acct-riley", "1"), ("acct-alex", "acct-jamie", "99999")]:
        assert customer.post("/transfers", data={"source": source, "destination": dest, "amount": amount, "csrf": token}).status_code == 403
    for amount in ["NaN", "-1", "0", "1.001"]:
        assert customer.post("/transfers", data={"source": "acct-alex", "destination": "acct-jamie", "amount": amount, "csrf": token}).status_code == 400


def test_05_unknown_evidence_and_app_data_separation(stack):
    original = flows(stack)["flows"][0]["events"][0].copy()
    original.pop("received_at")
    cid = str(uuid.uuid4())
    headers = {"X-Aegis-App-Id": stack["other_app"]["id"], "Authorization": "Bearer " + stack["other_app"]["connection_key"]}
    for phase in ["resource", "customer", "helper"]:  # out-of-order delivery
        event = original | {"event_id": str(uuid.uuid4()), "correlation_id": cid, "phase": phase, "evidence": {}}
        response = httpx.post(stack["base"] + "/v1/events", json=event, headers=headers, trust_env=False)
        assert response.status_code == 201
        assert response.json()["analysis"]["verdict"] == "UNKNOWN"
    assert cid not in {f["id"] for f in flows(stack)["flows"]}


def test_06_disabled_unsafe_demo_and_unavailable_aegis(stack):
    # A separate Northstar process uses default-safe mode and an unreachable AEGIS.
    # Enforced protected operations must fail closed rather than release data.
    finance_port = port()
    finance = f"http://127.0.0.1:{finance_port}"
    env = stack["env"] | {"NORTHSTAR_DB": str(stack["temp"] / "safe.sqlite"), "NORTHSTAR_ENABLE_UNSAFE_DEMO": "false", "NORTHSTAR_ORIGIN": finance, "NORTHSTAR_INTERNAL_URL": finance, "AEGIS_ENDPOINT": "http://127.0.0.1:1"}
    log = open(stack["temp"] / "safe.log", "w")
    process = subprocess.Popen([sys.executable, "-m", "uvicorn", "northstar.app:app", "--app-dir", "python", "--host", "127.0.0.1", "--port", str(finance_port)], cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)
    stack["processes"].append(process)
    wait_for(finance + "/health", process)
    with httpx.Client(base_url=finance, headers={"Origin": finance}, trust_env=False, timeout=10) as client:
        client.post("/login", data={"username": "owner", "password": env["NORTHSTAR_OWNER_PASSWORD"]})
        token = csrf(client, "/owner")
        assert client.post("/owner/scenarios", data={"csrf": token, "scenario": "confused-deputy"}).status_code == 403
        client.post("/logout", data={"csrf": token})
        client.post("/login", data={"username": "alex", "password": env["NORTHSTAR_CUSTOMER_PASSWORD"]})
        response = client.get("/statements/acct-alex")
        assert response.status_code == 403
        assert "AEGIS DENY" in response.text
        token = csrf(client)
        assert client.post("/transfers", data={"source": "acct-alex", "destination": "acct-jamie", "amount": "1", "csrf": token}).status_code == 403
        assert client.get("/statements/acct-jamie").status_code == 403


def test_07_restart_keeps_received_evidence(stack):
    before = flows(stack)
    stack["backend"].terminate()
    stack["backend"].wait(timeout=10)
    log = open(stack["temp"] / "restart.log", "w")
    process = subprocess.Popen([NODE, "integration/server.mjs"], cwd=ROOT, env=stack["backend_env"], stdout=log, stderr=subprocess.STDOUT)
    stack["processes"].append(process)
    wait_for(stack["base"] + "/health", process)
    assert flows(stack)["received_events"] == before["received_events"]
    assert flows(stack)["flows"][0]["analysis"] == before["flows"][0]["analysis"]
    with sqlite3.connect(stack["aegis_db"]) as db:
        assert db.execute("SELECT COUNT(*) FROM events WHERE app=?", (stack["app"]["id"],)).fetchone()[0] >= 21
        assert db.execute("SELECT key_hash FROM apps WHERE id=?", (stack["app"]["id"],)).fetchone()[0] != stack["app"]["connection_key"]


def test_08_reusable_python_registration_and_bad_key_delivery(stack):
    from aegis_connector import AegisConnector
    app = asyncio.run(AegisConnector.register(stack["base"], stack["owner_key"], "http://localhost:5173", "Reusable Python app"))
    assert uuid.UUID(app["id"])
    assert len(app["connection_key"]) == 64
    event = flows(stack)["flows"][0]["events"][0].copy()
    event.pop("received_at")
    connector = AegisConnector(stack["base"], app["id"], "invalid", secrets.token_hex(32), {"statement": "statement.read"})
    assert asyncio.run(connector.send([event])) is False
    assert connector.failed == 1
    assert stack["owner"].get(f"/owner/apps/{app['id']}/flows").json()["received_events"] == 0


def test_09_direct_demo_creates_only_a_fixed_customer_session(stack):
    finance_port = port()
    finance = f"http://127.0.0.1:{finance_port}"
    demo_db = stack["temp"] / "direct-demo.sqlite"
    env = stack["env"] | {"NORTHSTAR_DB": str(demo_db), "NORTHSTAR_DIRECT_CUSTOMER_DEMO": "true", "NORTHSTAR_ENABLE_UNSAFE_DEMO": "false", "NORTHSTAR_ORIGIN": finance, "NORTHSTAR_INTERNAL_URL": finance}
    log = open(stack["temp"] / "direct-demo.log", "w")
    process = subprocess.Popen([sys.executable, "-m", "uvicorn", "northstar.app:app", "--app-dir", "python", "--host", "127.0.0.1", "--port", str(finance_port)], cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)
    stack["processes"].append(process)
    wait_for(finance + "/health", process)
    with httpx.Client(base_url=finance, headers={"Origin": finance}, trust_env=False, timeout=10) as client:
        assert client.get("/").headers["location"] == "/demo/open"
        response = client.get("/demo/open?username=owner&role=owner&tenant=Aurora")
        assert response.status_code == 303
        assert "HttpOnly" in response.headers["set-cookie"]
        assert "SameSite=strict" in response.headers["set-cookie"]
        dashboard = client.get("/")
        assert dashboard.status_code == 200
        assert "Taylor Demo" in dashboard.text and "Visitor demo account" in dashboard.text
        assert client.get("/statements/acct-visitor").status_code == 200
        assert client.get("/statements/acct-alex").status_code == 403
        assert client.get("/statements/acct-riley").status_code == 403
        assert client.get("/owner").status_code == 403
        assert client.post("/owner/scenarios", data={"scenario": "confused-deputy", "csrf": csrf(client)}).status_code == 403
        assert client.post("/demo/customer-statement").status_code == 403
        old_cookie = client.cookies.get("northstar_session")
        with sqlite3.connect(demo_db) as db:
            db.execute("UPDATE sessions SET expires=0 WHERE customer='visitor'")
        assert client.get("/demo/open").status_code == 303
        assert client.cookies.get("northstar_session") != old_cookie
        assert client.get("/").status_code == 200
    # Restart without re-seeding/changing credentials: the same direct link works.
    process.terminate()
    process.wait(timeout=10)
    restarted = subprocess.Popen([sys.executable, "-m", "uvicorn", "northstar.app:app", "--app-dir", "python", "--host", "127.0.0.1", "--port", str(finance_port)], cwd=ROOT, env=env, stdout=log, stderr=subprocess.STDOUT)
    stack["processes"].append(restarted)
    wait_for(finance + "/health", restarted)
    with httpx.Client(base_url=finance, headers={"Origin": finance}, trust_env=False, timeout=10) as client:
        assert client.get("/demo/open").status_code == 303
        assert "Taylor Demo" in client.get("/").text
        client.post("/login", data={"username": "owner", "password": env["NORTHSTAR_OWNER_PASSWORD"]})
        response = client.get("/demo/open")
        assert response.headers["location"] == "/owner"
        assert "set-cookie" not in response.headers


def test_10_direct_demo_is_disabled_without_explicit_configuration(stack):
    assert httpx.get(stack["finance"] + "/demo/open", trust_env=False).status_code == 404
