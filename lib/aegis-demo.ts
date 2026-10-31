export type PolicyDecision = "ALLOW" | "MASK" | "APPROVAL" | "DENY" | "CONTAIN";
export type AssetTone = "mint" | "amber" | "blue" | "violet";

export type ProtectedAsset = {
  id: string;
  name: string;
  kind: "Database" | "File collection" | "Recovery vault" | "Service";
  environment: string;
  classification: string;
  owner: string;
  purpose: string;
  treatment: string;
  access: string;
  defaultResponse: string;
  dependencyIds: string[];
  fields: string[];
  tone: AssetTone;
  graph: { x: string; y: string; detail: string };
};

export type AgentAction = {
  id: string;
  label: string;
  request: string;
  targetAssetId: string;
  description: string;
  recommendedDecision: Extract<PolicyDecision, "MASK" | "DENY">;
  risk: number;
  riskLabel: string;
  businessFunction: string;
  backupImpact: string;
  response: string;
  dependencyAssetIds: string[];
  checks: Array<{ label: string; value: string; status: "pass" | "warn" }>;
};

export type EnforcementPolicy = {
  id: string;
  name: string;
  module: string;
  decision: Extract<PolicyDecision, "MASK" | "APPROVAL" | "DENY">;
  scope: string;
  summary: string;
  conditions: string[];
  enforcement: string[];
  evidence: string;
  tone: "blue" | "rose" | "amber" | "violet";
};

export type AuditEvent = {
  id: string;
  time: string;
  title: string;
  detail: string;
  state: "allowed" | "masked" | "blocked" | "contained" | "neutral";
  source: "agent" | "data-dna" | "agentguard" | "ledger";
};

export const demoAssets: ProtectedAsset[] = [
  {
    id: "payroll-primary",
    name: "Payroll database",
    kind: "Database",
    environment: "Production",
    classification: "Restricted",
    owner: "Finance systems",
    purpose: "Reconciliation and statutory reporting",
    treatment: "Tokenize identity · aggregate compensation",
    access: "finance.reconciliation.read",
    defaultResponse: "Masked records",
    dependencyIds: ["finance-app", "immutable-backup"],
    fields: ["Legal name", "Bank account", "Salary", "Tax ID"],
    tone: "amber",
    graph: { x: "43%", y: "31%", detail: "Production" },
  },
  {
    id: "ledger-export",
    name: "Ledger export",
    kind: "File collection",
    environment: "Restricted zone",
    classification: "Confidential",
    owner: "Corporate finance",
    purpose: "Month-end variance investigation",
    treatment: "Remove employee identifiers before retrieval",
    access: "finance.ledger.summary",
    defaultResponse: "Aggregate-only result",
    dependencyIds: ["finance-app"],
    fields: ["Cost center", "Vendor", "Amount", "Memo"],
    tone: "violet",
    graph: { x: "72%", y: "70%", detail: "Restricted" },
  },
  {
    id: "immutable-backup",
    name: "Immutable backup",
    kind: "Recovery vault",
    environment: "Vaulted",
    classification: "Critical",
    owner: "Platform security",
    purpose: "Disaster recovery only",
    treatment: "No agent disclosure · no direct retrieval",
    access: "recovery.approval.required",
    defaultResponse: "Human approval required",
    dependencyIds: ["payroll-primary"],
    fields: ["Encrypted volume", "Recovery manifest", "Retention policy"],
    tone: "blue",
    graph: { x: "75%", y: "20%", detail: "Vaulted" },
  },
  {
    id: "finance-app",
    name: "Finance application",
    kind: "Service",
    environment: "Staging",
    classification: "Internal",
    owner: "Finance engineering",
    purpose: "Read-only reconciliation workflows",
    treatment: "Task-scoped output filtering",
    access: "finance.staging.read",
    defaultResponse: "Scoped result",
    dependencyIds: ["payroll-primary", "ledger-export"],
    fields: ["Invoice ID", "Period", "Variance", "Approval state"],
    tone: "mint",
    graph: { x: "11%", y: "61%", detail: "Service" },
  },
];

export const demoActions: AgentAction[] = [
  {
    id: "read-payroll-summary",
    label: "Read payroll summary",
    request: "finance.reconciliation.read",
    targetAssetId: "payroll-primary",
    description: "A reconciliation request needs a payroll summary, but identity and compensation detail must not leave the protected system.",
    recommendedDecision: "MASK",
    risk: 34,
    riskLabel: "Controlled read",
    businessFunction: "Finance reconciliation",
    backupImpact: "No backup path invoked",
    response: "Aggregate totals with tokenized identities",
    dependencyAssetIds: ["finance-app", "payroll-primary"],
    checks: [
      { label: "Task scope", value: "Reconciliation workflow", status: "pass" },
      { label: "Data DNA treatment", value: "Tokenize + aggregate", status: "pass" },
      { label: "Production data boundary", value: "Raw records withheld", status: "pass" },
    ],
  },
  {
    id: "delete-payroll-database",
    label: "Delete payroll database",
    request: "database.delete",
    targetAssetId: "payroll-primary",
    description: "The agent believes the target is a test resource. Security Twin resolves the production database and its recovery dependency before any write is attempted.",
    recommendedDecision: "DENY",
    risk: 96,
    riskLabel: "Critical mutation",
    businessFunction: "Payroll operations and statutory reporting",
    backupImpact: "Recovery capability affected; immutable vault inspected",
    response: "No system call released to the agent",
    dependencyAssetIds: ["payroll-primary", "immutable-backup"],
    checks: [
      { label: "Target environment", value: "Production resolved", status: "warn" },
      { label: "Mutation authority", value: "No approved write path", status: "warn" },
      { label: "Recovery dependency", value: "Immutable backup affected", status: "warn" },
    ],
  },
];

export const demoPolicies: EnforcementPolicy[] = [
  {
    id: "finance-read-boundary",
    name: "Finance reconciliation boundary",
    module: "AgentGuard + Data DNA",
    decision: "MASK",
    scope: "finance.reconciliation.read",
    summary: "Allows a reconciliation summary only when the task is staging-scoped; protected fields are transformed before return.",
    conditions: ["Task: finance reconciliation", "Environment: staging", "Permission: finance.reconciliation.read"],
    enforcement: ["Allow the scoped query", "Tokenize employee identities", "Aggregate compensation values"],
    evidence: "Sanitized request, applied transformation, result receipt",
    tone: "blue",
  },
  {
    id: "production-mutation-guard",
    name: "Production mutation guard",
    module: "AgentGuard + Security Twin",
    decision: "DENY",
    scope: "database.delete · database.write",
    summary: "Blocks high-impact production mutations when the resolved asset or dependency path would affect payroll operations or recovery.",
    conditions: ["Environment: production", "Mutation: delete or write", "Impact: critical dependency detected"],
    enforcement: ["Do not release the tool call", "Record resolved target and blast radius", "Offer containment when session risk escalates"],
    evidence: "Resolved asset, dependency path, denied tool request",
    tone: "rose",
  },
  {
    id: "prism-disclosure-budget",
    name: "PRISM disclosure budget",
    module: "PRISM + Data DNA",
    decision: "MASK",
    scope: "employee.search · payroll.summary",
    summary: "Tracks cumulative disclosure within an agent session and strengthens response treatment before fragments can reconstruct sensitive employee data.",
    conditions: ["Session exposure: monitored", "Identity attributes: requested", "Budget threshold: adaptive"],
    enforcement: ["Increase disclosure score", "Mask new identity attributes", "Deny further disclosure at the hard threshold"],
    evidence: "Exposure deltas, response treatment, threshold decision",
    tone: "amber",
  },
  {
    id: "recovery-vault-gate",
    name: "Recovery vault access gate",
    module: "AgentGuard + Security Twin",
    decision: "APPROVAL",
    scope: "recovery.*",
    summary: "Keeps immutable-backup access outside normal agent capabilities and pauses any exceptional request for a named human approver.",
    conditions: ["Asset: immutable backup", "Purpose: disaster recovery", "Approval: named operator required"],
    enforcement: ["Pause the request", "Do not disclose recovery material", "Issue a temporary capability only after approval"],
    evidence: "Approver identity, decision timestamp, temporary capability record",
    tone: "violet",
  },
];

export const demoAuditEvents: AuditEvent[] = [
  { id: "session-started", time: "09:42:18", title: "Agent began finance reconciliation review", detail: "Session scope issued: finance.read · staging", state: "allowed", source: "agent" },
  { id: "pii-masked", time: "09:42:23", title: "Employee PII removed from result set", detail: "6 identity fields replaced with protected tokens", state: "masked", source: "data-dna" },
  { id: "ledger-recorded", time: "09:42:44", title: "Evidence ledger updated", detail: "Session decision recorded with integrity signature", state: "allowed", source: "ledger" },
];

export const demoSession = {
  id: "asg_7f2b9e",
  policySet: "finance-prod-v4",
  scope: "Finance reconciliation review",
  activeScope: "Finance operations",
  privacyBudget: 28,
} as const;

export function getDemoAsset(id: string) {
  return demoAssets.find((asset) => asset.id === id);
}
