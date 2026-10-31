import { demoPolicies, type PolicyDecision } from "@/lib/aegis-demo";
// Integration ingestion and the dashboard use the same delegated-access policy extension.
export { evaluateDelegatedAccess } from "./delegated-policy.mjs";
export { matchDeputyConditions, analyzePrototypeInput } from "./deputy-rule.mjs";

export const policyScenarios = [
  "payroll-summary",
  "employee-search",
  "delete-payroll",
] as const;

export type GatewayScenario = (typeof policyScenarios)[number];

type PolicyRule = {
  policyId: string;
  target: string;
  purpose: string;
  risk: number;
  mode: "masked-read" | "privacy-read" | "blocked-mutation";
};

const rules: Record<GatewayScenario, PolicyRule> = {
  "payroll-summary": {
    policyId: "finance-read-boundary",
    target: "payroll-primary",
    purpose: "Finance reconciliation",
    risk: 34,
    mode: "masked-read",
  },
  "employee-search": {
    policyId: "prism-disclosure-budget",
    target: "payroll-primary",
    purpose: "Employee identity lookup",
    risk: 51,
    mode: "privacy-read",
  },
  "delete-payroll": {
    policyId: "production-mutation-guard",
    target: "payroll-primary",
    purpose: "Production mutation",
    risk: 96,
    mode: "blocked-mutation",
  },
};

export type PolicyEvaluation = {
  decision: PolicyDecision;
  policyId: string;
  policyName: string;
  purpose: string;
  target: string;
  risk: number;
  privacyBudget: number;
  treatment: string;
  reason: string;
};

export function isPolicyScenario(value: unknown): value is GatewayScenario {
  return policyScenarios.some((scenario) => scenario === value);
}

export function evaluateGatewayPolicy({
  scenario,
  privacyBudget,
  capabilitiesRevoked,
}: {
  scenario: GatewayScenario;
  privacyBudget: number;
  capabilitiesRevoked: boolean;
}): PolicyEvaluation {
  if (capabilitiesRevoked) {
    return {
      decision: "CONTAIN",
      policyId: "session-containment",
      policyName: "Session containment",
      purpose: "No further tool access",
      target: "all temporary capabilities",
      risk: 100,
      privacyBudget,
      treatment: "No system call released",
      reason: "Agent capabilities were revoked by an AEGIS containment decision.",
    };
  }

  const rule = rules[scenario];
  const policy = demoPolicies.find((entry) => entry.id === rule.policyId);
  const policyName = policy?.name ?? rule.policyId;

  if (rule.mode === "masked-read") {
    return {
      decision: "MASK",
      policyId: rule.policyId,
      policyName,
      purpose: rule.purpose,
      target: rule.target,
      risk: rule.risk,
      privacyBudget,
      treatment: "Tokenize employee identity and aggregate compensation",
      reason: "The staging-scoped reconciliation read is permitted only with Data DNA minimization.",
    };
  }

  if (rule.mode === "privacy-read") {
    const nextBudget = Math.min(100, privacyBudget + 26);
    const deny = nextBudget >= 80;
    return {
      decision: deny ? "DENY" : "MASK",
      policyId: rule.policyId,
      policyName,
      purpose: rule.purpose,
      target: rule.target,
      risk: deny ? 78 : rule.risk,
      privacyBudget: nextBudget,
      treatment: deny ? "No identity result released" : "Return non-identifying employee token only",
      reason: deny
        ? "PRISM reached the hard disclosure threshold for this session."
        : "PRISM increased cumulative disclosure exposure and tightened the result treatment.",
    };
  }

  return {
    decision: "DENY",
    policyId: rule.policyId,
    policyName,
    purpose: rule.purpose,
    target: rule.target,
    risk: rule.risk,
    privacyBudget,
    treatment: "Do not release a database mutation",
    reason: "Security Twin resolved a production payroll target with an immutable recovery dependency.",
  };
}
