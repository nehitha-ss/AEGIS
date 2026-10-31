import test from "node:test";
import assert from "node:assert/strict";
import { evaluateDelegatedAccess } from "../lib/delegated-policy.mjs";
function chain(overrides = {}) {
  return ["customer", "helper", "resource"].map((phase) => ({
    phase,
    event_id: phase,
    caller: "caller",
    helper: "helper",
    resource: "resource",
    caller_tenant: "a",
    resource_tenant: "a",
    action: "statement.read",
    outcome: "allowed",
    evidence: {
      caller_authorized: false,
      helper_authorized: true,
      helper_uses_own_identity: true,
      original_caller_checked: false,
      caller_context_propagated: false,
      caller_controls_resource: true,
      resource_trusts_helper_only: true,
    },
    ...overrides,
  }));
}
test("confirmed bypass requires observed allowed resource and denied caller policy", () => {
  const result = evaluateDelegatedAccess(chain());
  assert.equal(result.verdict, "CONFUSED_DEPUTY");
  assert.equal(result.risk, 94);
  assert.equal(result.enforcement, "MONITOR");
  assert.ok(result.findings.every((f) => f.evidence.length));
});
test("cross-tenant bypass is explained and scored separately", () => {
  const result = evaluateDelegatedAccess(chain({ resource_tenant: "b" }));
  assert.equal(result.risk, 98);
  assert.ok(result.findings.some((f) => f.id === "CROSS_TENANT_ACCESS"));
});
test("metadata and incomplete chains never prove a confused deputy", () => {
  assert.equal(evaluateDelegatedAccess(chain().slice(0, 2)).verdict, "UNKNOWN");
  const events = chain();
  events[2].evidence.caller_authorized = null;
  assert.equal(evaluateDelegatedAccess(events).risk, null);
});
test("conflicting correlated identities are unknown", () => {
  const events = chain();
  events[1].resource = "another";
  assert.equal(evaluateDelegatedAccess(events).verdict, "UNKNOWN");
});
test("a resource denial is not a successful bypass", () => {
  const result = evaluateDelegatedAccess(chain({ outcome: "denied" }));
  assert.equal(result.verdict, "DENIED_AT_SOURCE");
  assert.equal(result.findings.length, 0);
});
test("lost context alone does not prove a bypass", () => {
  const events = chain();
  for (const e of events) e.evidence.caller_authorized = true;
  assert.equal(evaluateDelegatedAccess(events).verdict, "NO_BYPASS_OBSERVED");
});
