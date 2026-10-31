"""Server-side AEGIS monitoring connector. No browser credentials or body capture."""
from contextvars import ContextVar
from datetime import datetime, timezone
import hashlib
import hmac
import logging
import uuid
import httpx

correlation_id: ContextVar[str] = ContextVar("aegis_correlation_id", default="")
FACTS = {"caller_authorized", "helper_authorized", "helper_uses_own_identity", "original_caller_checked", "caller_context_propagated", "caller_controls_resource", "resource_trusts_helper_only"}


class AegisConnector:
    @staticmethod
    async def register(endpoint, owner_key, owner_origin, application_name):
        """One-time server-side provisioning; returns the ID and one-time private key.

        Do not call this on customer requests. Keep the owner credential in your
        provisioning process, separate from the normal connector environment.
        """
        if not endpoint.startswith(("https://", "http://127.0.0.1:", "http://localhost:")):
            raise ValueError("Use HTTPS except for loopback development")
        async with httpx.AsyncClient(timeout=5, trust_env=False) as client:
            response = await client.post(endpoint.rstrip("/") + "/owner/login", json={"key": owner_key}, headers={"Origin": owner_origin})
            response.raise_for_status()
            cookie = "aegis_owner=" + response.cookies["aegis_owner"]
            try:
                registration = await client.post(endpoint.rstrip("/") + "/owner/apps", json={"name": application_name}, headers={"Origin": owner_origin, "Cookie": cookie})
                registration.raise_for_status()
                return registration.json()
            finally:
                await client.post(endpoint.rstrip("/") + "/owner/logout", json={}, headers={"Origin": owner_origin, "Cookie": cookie})

    def __init__(self, endpoint, application_id, connection_key, pseudonym_key, route_mappings, timeout=0.8):
        self.endpoint = endpoint.rstrip("/")
        if not self.endpoint.startswith(("https://", "http://127.0.0.1:", "http://localhost:")):
            raise ValueError("Use HTTPS except for loopback development")
        self.application_id = application_id
        self.connection_key = connection_key
        self.pseudonym_key = pseudonym_key.encode()
        if len(self.pseudonym_key) < 32:
            raise ValueError("A private pseudonym key of at least 32 characters is required")
        self.route_mappings = route_mappings
        self.timeout = timeout
        self.delivered = 0
        self.failed = 0

    def pseudonym(self, kind, value):
        return "p_" + hmac.new(self.pseudonym_key, f"{kind}:{value}".encode(), hashlib.sha256).hexdigest()[:24]

    def event(self, *, route, phase, caller, helper, resource, caller_tenant, resource_tenant, outcome, evidence):
        """Call ONLY with identities and policy evidence obtained from trusted server code."""
        action = self.route_mappings[route]
        if action not in {"statement.read", "transfer.create"} or phase not in {"customer", "helper", "resource"}:
            raise ValueError("Unrecognised route mapping or phase")
        cid = correlation_id.get()
        uuid.UUID(cid)  # Fail closed for instrumentation mistakes, never invent separate hop IDs.
        if outcome not in {"allowed", "denied"} or set(evidence) != FACTS or any(v is not None and type(v) is not bool for v in evidence.values()):
            raise ValueError("Use explicit boolean/unknown policy evidence")
        return {"schema_version": 1, "event_id": str(uuid.uuid4()), "correlation_id": cid,
                "phase": phase, "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "caller": self.pseudonym("customer", caller), "helper": self.pseudonym("service", helper),
                "resource": self.pseudonym("resource", resource), "caller_tenant": self.pseudonym("tenant", caller_tenant),
                "resource_tenant": self.pseudonym("tenant", resource_tenant), "action": action,
                "outcome": outcome, "evidence": evidence.copy()}

    async def send(self, events):
        """Bounded best-effort delivery. Never raises into the customer request."""
        try:
            async with httpx.AsyncClient(timeout=self.timeout, trust_env=False) as client:
                for event in events:
                    response = await client.post(self.endpoint + "/v1/events", json=event,
                                                 headers={"X-Aegis-App-Id": self.application_id, "Authorization": "Bearer " + self.connection_key})
                    response.raise_for_status()
                    self.delivered += 1
            return True
        except (httpx.HTTPError, ValueError):
            self.failed += 1
            logging.getLogger("aegis_connector").warning("AEGIS report delivery failed; customer operation remains independent")
            return False
