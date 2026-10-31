import { matchDeputyConditions } from "./deputy-rule.mjs";
/** Shared, evidence-based extension to the AEGIS policy engine. No request contents. */
export function evaluateDelegatedAccess(events) {
  const phases = new Set(events.map((e) => e.phase));
  const resource = events.find((e) => e.phase === "resource");
  const helper = events.find((e) => e.phase === "helper");
  const caller = events.find((e) => e.phase === "customer");
  const unknown = (reason) => ({
    verdict: "UNKNOWN",
    risk: null,
    policy: "delegated-access-boundary",
    enforcement: "MONITOR",
    explanation: reason,
    findings: [],
    checks: [],
  });
  if (!resource || !helper || !caller || phases.size !== 3)
    return unknown(
      "Incomplete flow: customer, helper and resource evidence are required.",
    );
  const identityFields = [
    "caller",
    "helper",
    "resource",
    "caller_tenant",
    "resource_tenant",
    "action",
  ];
  if (events.some((e) => identityFields.some((k) => e[k] !== caller[k])))
    return unknown(
      "Conflicting identity or resource evidence across the request chain.",
    );
  const f = resource.evidence;
  if (
    events.some((e) => Object.keys(f).some((key) => e.evidence[key] !== f[key]))
  )
    return unknown("Conflicting policy evidence across the correlated stages.");
  const rule = matchDeputyConditions({
    callerCanInvokeDeputy: f.caller_controls_resource,
    deputyUsesOwnIdentity: f.helper_uses_own_identity,
    callerContextPropagated: f.caller_context_propagated,
    resourceAuthorizesDeputyOnly: f.resource_trusts_helper_only,
    deputyHasSensitiveScope:
      f.helper_authorized == null || f.caller_authorized == null
        ? null
        : f.helper_authorized && !f.caller_authorized,
  });
  const checks = rule.conditions.map(({ id, matched, label }) => ({
    id,
    label,
    matched,
    evidence_event: resource.event_id,
  }));
  if (Object.values(f).some((v) => v === null) || Object.keys(f).length < 7)
    return {
      ...unknown(
        "Policy evidence is missing. Metadata and missing claims are not proof of a vulnerability.",
      ),
      checks,
    };
  const bypass =
    resource.outcome === "allowed" &&
    f.caller_authorized === false &&
    rule.conditions.find((c) => c.id === "privilege-amplification").matched ===
      true &&
    rule.conditions.find((c) => c.id === "identity-substitution").matched ===
      true &&
    f.original_caller_checked === false;
  const findings = [];
  if (bypass)
    findings.push({
      id: "CONFUSED_DEPUTY",
      explanation:
        "The resource allowed the helper although the authenticated original caller was not authorised, and the helper did not check that caller.",
      evidence: [caller.event_id, helper.event_id, resource.event_id],
    });
  if (bypass && caller.caller_tenant !== resource.resource_tenant)
    findings.push({
      id: "CROSS_TENANT_ACCESS",
      explanation:
        "The allowed helper request crossed the trusted server-side tenant boundary.",
      evidence: [resource.event_id],
    });
  if (bypass && !f.caller_context_propagated)
    findings.push({
      id: "LOST_CALLER_CONTEXT",
      explanation:
        "The resource received only the helper identity; the original caller context was not forwarded.",
      evidence: [helper.event_id, resource.event_id],
    });
  if (bypass && f.caller_controls_resource)
    findings.push({
      id: "CALLER_CONTROLLED_RESOURCE",
      explanation:
        "The caller selected the resource and the helper used broader authority without checking ownership.",
      evidence: [caller.event_id, resource.event_id],
    });
  return {
    verdict: bypass
      ? "CONFUSED_DEPUTY"
      : resource.outcome === "denied"
        ? "DENIED_AT_SOURCE"
        : "NO_BYPASS_OBSERVED",
    risk: bypass
      ? caller.caller_tenant !== resource.resource_tenant
        ? 98
        : 94
      : resource.outcome === "denied"
        ? 10
        : 5,
    policy: "delegated-access-boundary",
    enforcement: "MONITOR",
    checks,
    findings,
    explanation: bypass
      ? "Authenticated connector reports demonstrate an authorisation bypass in this fictional run. Monitoring did not block it."
      : resource.outcome === "denied"
        ? "Northstar denied access before reading the statement. AEGIS recorded that enforcement."
        : "The observed request was permitted by the caller policy. This does not establish whole-system safety.",
  };
}
