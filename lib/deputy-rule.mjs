/** Five-condition rule shared by manual prototype comparisons and received flows.
 * A match describes a path pattern; authenticated outcome evidence is separately
 * required by evaluateDelegatedAccess before reporting an actual bypass.
 */
export function matchDeputyConditions(input) {
  const definitions = [
    [
      "caller-influence",
      "Caller can influence privileged deputy",
      input.callerCanInvokeDeputy,
    ],
    [
      "identity-substitution",
      "Deputy substitutes its own identity",
      input.deputyUsesOwnIdentity,
    ],
    [
      "context-loss",
      "Original caller context is lost",
      input.callerContextPropagated == null
        ? null
        : !input.callerContextPropagated,
    ],
    [
      "implicit-trust",
      "Resource authorizes deputy only",
      input.resourceAuthorizesDeputyOnly,
    ],
    [
      "privilege-amplification",
      "Deputy has sensitive caller-absent scope",
      input.deputyHasSensitiveScope,
    ],
  ];
  const conditions = definitions.map(([id, label, matched]) => ({
    id,
    label,
    matched: typeof matched === "boolean" ? matched : null,
  }));
  return {
    conditions,
    matchedConditions: conditions.filter((c) => c.matched === true).length,
    complete: conditions.every((c) => c.matched !== null),
    allMatched: conditions.every((c) => c.matched === true),
  };
}

export function analyzePrototypeInput(input) {
  const observed = input.mode === "observed";
  const request = observed ? input.request : input;
  if (!request || typeof request !== "object")
    throw new Error("Request evidence is required");
  for (const key of ["callerService", "deputyService", "sensitiveResource"])
    if (
      typeof request[key] !== "string" ||
      !request[key].trim() ||
      request[key].length > 160
    )
      throw new Error(
        "Service and resource names are required (maximum 160 characters)",
      );
  let facts = request;
  if (observed) {
    for (const key of [
      "callerPrincipal",
      "requiredInboundScope",
      "deputyPrincipal",
      "presentedDownstreamPrincipal",
      "requiredSensitiveScope",
      "sensitiveOperation",
    ])
      if (
        typeof request[key] !== "string" ||
        !request[key].trim() ||
        request[key].length > 256
      )
        throw new Error("Complete identity and scope evidence is required");
    for (const key of [
      "callerScopes",
      "deputyScopes",
      "resourceAcceptedPrincipals",
    ])
      if (
        !Array.isArray(request[key]) ||
        request[key].length > 100 ||
        request[key].some((s) => typeof s !== "string" || s.length > 256)
      )
        throw new Error(
          "Scope and accepted-principal lists must contain bounded strings",
        );
    if (typeof request.propagatedActorPrincipal !== "string")
      throw new Error(
        "Explicit caller context, including an empty value if absent, is required",
      );
    facts = {
      callerCanInvokeDeputy: request.callerScopes.includes(
        request.requiredInboundScope,
      ),
      deputyUsesOwnIdentity:
        request.presentedDownstreamPrincipal === request.deputyPrincipal &&
        request.deputyPrincipal !== request.callerPrincipal,
      callerContextPropagated:
        request.propagatedActorPrincipal === request.callerPrincipal,
      resourceAuthorizesDeputyOnly:
        request.resourceAcceptedPrincipals.includes(request.deputyPrincipal) &&
        !request.resourceAcceptedPrincipals.includes(request.callerPrincipal),
      deputyHasSensitiveScope:
        request.deputyScopes.includes(request.requiredSensitiveScope) &&
        !request.callerScopes.includes(request.requiredSensitiveScope),
    };
  } else {
    for (const key of [
      "callerCanInvokeDeputy",
      "deputyUsesOwnIdentity",
      "callerContextPropagated",
      "resourceAuthorizesDeputyOnly",
      "deputyHasSensitiveScope",
    ])
      if (typeof request[key] !== "boolean")
        throw new Error(
          "All five manual conditions must be explicitly true or false",
        );
  }
  const rule = matchDeputyConditions(facts);
  return {
    runId: `demo-${crypto.randomUUID().slice(0, 12)}`,
    analyzedAt: new Date().toISOString(),
    verdict: rule.allMatched
      ? "DEMO_CONFUSED_DEPUTY_PATH"
      : "NO_CONFUSED_DEPUTY_PATH",
    decision: rule.allMatched ? "ALERT" : "ALLOW",
    confidence: rule.allMatched ? 98 : 92,
    riskScore: rule.allMatched ? 94 : Math.max(5, rule.matchedConditions * 15),
    matchedConditions: rule.matchedConditions,
    conditions: rule.conditions,
    path: [
      request.callerService,
      request.deputyService,
      request.sensitiveResource,
    ],
    evidenceStatus: "UNVERIFIED_MANUAL_INPUT",
    source: "prototype-demonstration",
    explanation: rule.allMatched
      ? "Manual-input demonstration: all five path conditions match. This is not evidence of a real authorisation bypass. Use authenticated Northstar flows in Integrations to confirm outcomes."
      : "Manual-input demonstration: at least one required path condition is absent. This does not establish that a connected application is secure.",
  };
}
