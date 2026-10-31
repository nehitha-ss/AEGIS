"use client";

import { useEffect, useState } from "react";
import { IntegrationsView } from "@/components/integrations-view";
import {
  Activity,
  ArrowUpRight,
  Bell,
  Binary,
  Box,
  Check,
  ChevronRight,
  CircleAlert,
  Command,
  Database,
  EyeOff,
  FileKey2,
  Fingerprint,
  LayoutDashboard,
  LockKeyhole,
  MoreHorizontal,
  Moon,
  Network,
  Play,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  SquareTerminal,
  Sun,
  Workflow,
  X,
  Zap,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  demoActions,
  demoAssets,
  demoAuditEvents,
  demoPolicies,
  demoSession,
  getDemoAsset,
  type AgentAction,
  type EnforcementPolicy,
  type ProtectedAsset,
} from "@/lib/aegis-demo";
import type {
  GatewayEvent,
  GatewayResult,
  GatewayScenario,
} from "@/lib/aegis-runtime";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

type Decision = "Ready" | "Blocked" | "Contained";

const navItems = [
  { label: "Control room", icon: LayoutDashboard },
  { label: "Security twin", icon: Network },
  { label: "Data DNA", icon: Fingerprint },
  { label: "Policy library", icon: ShieldCheck },
  { label: "Integrations", icon: Workflow },
];

/* Previous page-local demo constants retained below only as a migration reference.
   The UI now reads its shared mock domain model from lib/aegis-demo.ts. */
/*
const assets = [
  { label: "Finance application", detail: "Service", x: "11%", y: "61%", tone: "mint" },
  { label: "Payroll database", detail: "Production", x: "43%", y: "31%", tone: "amber" },
  { label: "Immutable backup", detail: "Vaulted", x: "75%", y: "20%", tone: "blue" },
  { label: "Ledger export", detail: "Restricted", x: "72%", y: "70%", tone: "violet" },
];

const dnaAssets = [
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
    dependencies: ["Finance application", "Immutable backup"],
    fields: ["Legal name", "Bank account", "Salary", "Tax ID"],
    tone: "amber",
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
    dependencies: ["Finance application"],
    fields: ["Cost center", "Vendor", "Amount", "Memo"],
    tone: "violet",
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
    dependencies: ["Payroll database"],
    fields: ["Encrypted volume", "Recovery manifest", "Retention policy"],
    tone: "blue",
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
    dependencies: ["Payroll database", "Ledger export"],
    fields: ["Invoice ID", "Period", "Variance", "Approval state"],
    tone: "mint",
  },
];

const twinActions = [
  {
    id: "read-payroll-summary",
    label: "Read payroll summary",
    request: "finance.reconciliation.read",
    target: "Payroll database",
    description: "A reconciliation request needs a payroll summary, but identity and compensation detail must not leave the protected system.",
    recommendedDecision: "MASK",
    risk: 34,
    riskLabel: "Controlled read",
    businessFunction: "Finance reconciliation",
    backupImpact: "No backup path invoked",
    response: "Aggregate totals with tokenized identities",
    dependencies: ["Finance application", "Payroll database"],
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
    target: "Payroll database",
    description: "The agent believes the target is a test resource. Security Twin resolves the production database and its recovery dependency before any write is attempted.",
    recommendedDecision: "DENY",
    risk: 96,
    riskLabel: "Critical mutation",
    businessFunction: "Payroll operations and statutory reporting",
    backupImpact: "Recovery capability affected; immutable vault inspected",
    response: "No system call released to the agent",
    dependencies: ["Payroll database", "Immutable backup"],
    checks: [
      { label: "Target environment", value: "Production resolved", status: "warn" },
      { label: "Mutation authority", value: "No approved write path", status: "warn" },
      { label: "Recovery dependency", value: "Immutable backup affected", status: "warn" },
    ],
  },
];

const policies = [
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
*/

function StatusPill({ decision }: { decision: Decision }) {
  const classes = decision === "Blocked"
    ? "border-rose-400/30 bg-rose-400/10 text-rose-200"
    : decision === "Contained"
      ? "border-amber-300/30 bg-amber-300/10 text-amber-100"
      : "border-emerald-300/25 bg-emerald-300/10 text-emerald-100";
  return <span className={`inline-flex items-center gap-2 rounded-full border px-2.5 py-1 text-xs font-medium ${classes}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{decision}</span>;
}

export default function Home() {
  const [activeNav, setActiveNav] = useState("Control room");
  const [decision, setDecision] = useState<Decision>("Ready");
  const [isChecking, setIsChecking] = useState(false);
  const [privacyBudget, setPrivacyBudget] = useState<number>(demoSession.privacyBudget);
  const [runtimeEvents, setRuntimeEvents] = useState<GatewayEvent[]>([]);
  const [runtimeStatus, setRuntimeStatus] = useState<"connecting" | "connected" | "offline">("connecting");
  const [lastGatewayResult, setLastGatewayResult] = useState<GatewayResult | null>(null);
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [selectedDnaId, setSelectedDnaId] = useState("payroll-primary");
  const [selectedTwinActionId, setSelectedTwinActionId] = useState("read-payroll-summary");
  const [selectedPolicyId, setSelectedPolicyId] = useState("finance-read-boundary");
  const risk = lastGatewayResult?.risk ?? (decision === "Blocked" ? 91 : decision === "Contained" ? 100 : 36);
  const eventLabel = lastGatewayResult?.summary ?? (decision === "Blocked" ? "Production mutation blocked" : decision === "Contained" ? "Agent session contained" : "Awaiting a protected request");
  const protectedSourceLabel = lastGatewayResult?.protectedSource === "supabase-postgres"
    ? "RESTRICTED SUPABASE POSTGRES"
    : "LOCAL AEGIS GATEWAY";
  const selectedDna = demoAssets.find((asset) => asset.id === selectedDnaId) ?? demoAssets[0];
  const selectedTwinAction = demoActions.find((action) => action.id === selectedTwinActionId) ?? demoActions[0];
  const selectedPolicy = demoPolicies.find((policy) => policy.id === selectedPolicyId) ?? demoPolicies[0];

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("aegis-theme");
    if (savedTheme === "light" || savedTheme === "dark") {
      const restoreTheme = window.setTimeout(() => setTheme(savedTheme), 0);
      return () => window.clearTimeout(restoreTheme);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("aegis-theme", theme);
  }, [theme]);

  useEffect(() => {
    const stream = new EventSource("/api/aegis/events");
    stream.addEventListener("ready", () => setRuntimeStatus("connected"));
    stream.addEventListener("aegis", (message) => {
      const event = JSON.parse((message as MessageEvent<string>).data) as GatewayEvent;
      setRuntimeEvents((events) => [...events, event].slice(-12));
      setRuntimeStatus("connected");
    });
    stream.onerror = () => setRuntimeStatus("offline");
    return () => stream.close();
  }, []);

  async function runGatewayScenario(scenario: GatewayScenario) {
    setIsChecking(true);
    try {
      const response = await fetch("/api/aegis/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scenario }),
      });
      if (!response.ok) throw new Error("Gateway request failed");
      const result = await response.json() as GatewayResult;
      setLastGatewayResult(result);
      setPrivacyBudget(result.privacyBudget);
      setDecision(result.decision === "CONTAIN" ? "Contained" : result.decision === "DENY" ? "Blocked" : "Ready");
    } finally {
      setIsChecking(false);
    }
  }

  async function containGatewaySession() {
    setIsChecking(true);
    try {
      const response = await fetch("/api/aegis/contain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actor: "demo-agent" }),
      });
      if (!response.ok) throw new Error("Gateway containment failed");
      const result = await response.json() as { decision: "CONTAIN"; privacyBudget: number; summary: string };
      setPrivacyBudget(result.privacyBudget);
      setDecision("Contained");
      setLastGatewayResult((previous) => previous ? { ...previous, decision: result.decision, risk: 100, privacyBudget: result.privacyBudget, summary: result.summary, policy: "session-containment" } : null);
    } finally {
      setIsChecking(false);
    }
  }

  return (
    <SidebarProvider defaultOpen>
      <Sidebar collapsible="icon" className="border-r border-white/8 bg-[#09101a]">
        <SidebarHeader className="border-b border-white/8 px-3 py-4">
          <div className="flex items-center gap-3 px-1">
            <div className="grid size-8 place-items-center rounded-lg bg-[#9af4ce] text-[#07110e] shadow-[0_0_24px_rgba(154,244,206,0.16)]"><ShieldCheck className="size-[18px]" strokeWidth={2.3} /></div>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden"><p className="text-sm font-semibold tracking-[0.08em] text-white">AEGIS</p><p className="mt-0.5 text-[11px] text-slate-400">Agent security control</p></div>
          </div>
        </SidebarHeader>
        <SidebarContent className="px-2 py-4">
          <SidebarGroup>
            <SidebarGroupLabel className="px-2 text-[10px] font-semibold tracking-[0.13em] text-slate-500">WORKSPACE</SidebarGroupLabel>
            <SidebarGroupContent><SidebarMenu>{navItems.map((item) => { const Icon = item.icon; const isActive = activeNav === item.label; return <SidebarMenuItem key={item.label}><SidebarMenuButton isActive={isActive} onClick={() => setActiveNav(item.label)} tooltip={item.label} className="h-10 rounded-md px-2.5 text-[13px] text-slate-400 hover:bg-white/5 hover:text-white data-[active=true]:bg-[#13261f] data-[active=true]:text-[#b8f8dc]"><Icon className="size-4" /><span>{item.label}</span></SidebarMenuButton></SidebarMenuItem>; })}</SidebarMenu></SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup className="mt-6">
            <SidebarGroupLabel className="px-2 text-[10px] font-semibold tracking-[0.13em] text-slate-500">ACTIVE SCOPE</SidebarGroupLabel>
            <SidebarGroupContent><div className="rounded-lg border border-white/8 bg-white/[0.025] px-3 py-3 group-data-[collapsible=icon]:hidden"><div className="flex items-center justify-between"><span className="text-xs font-medium text-slate-200">{demoSession.activeScope}</span><LockKeyhole className="size-3.5 text-[#8ef0c6]" /></div><p className="mt-1.5 text-[11px] leading-4 text-slate-500">Read-only · staging scoped</p></div></SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="border-t border-white/8 p-3"><div className="flex items-center gap-2.5 rounded-lg px-1.5 py-1.5 group-data-[collapsible=icon]:justify-center"><div className="grid size-7 place-items-center rounded-full bg-gradient-to-br from-slate-300 to-slate-600 text-[10px] font-semibold text-slate-950">NS</div><div className="min-w-0 group-data-[collapsible=icon]:hidden"><p className="truncate text-xs font-medium text-slate-200">Nehitha S.</p><p className="text-[10px] text-slate-500">Security operator</p></div></div></SidebarFooter>
      </Sidebar>

      <SidebarInset className="min-h-svh bg-[#0b111b] text-slate-100">
        <header className="flex h-16 items-center justify-between border-b border-white/8 bg-[#0b111b]/95 px-4 backdrop-blur md:px-7">
          <div className="flex items-center gap-3"><SidebarTrigger className="text-slate-400 hover:bg-white/5 hover:text-white" /><div className="hidden h-4 w-px bg-white/10 sm:block" /><div className="flex items-center gap-1.5 text-[11px] text-slate-500"><span>Northstar Logistics</span><ChevronRight className="size-3" /><span className="text-slate-300">{activeNav}</span></div></div>
          <div className="flex items-center gap-2"><div className="hidden items-center gap-2 rounded-md border border-white/8 bg-white/[0.025] px-2.5 py-1.5 text-xs text-slate-400 sm:flex"><Command className="size-3.5" /><span>{activeNav === "Integrations" ? "Monitoring only" : "All systems monitored"}</span></div><button onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`} className="inline-flex h-8 items-center gap-1.5 rounded-md border border-white/8 bg-white/[0.025] px-2 text-[11px] font-medium text-slate-400 transition hover:bg-white/5 hover:text-white"><span className="grid size-4 place-items-center">{theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}</span><span className="hidden sm:inline">{theme === "dark" ? "Light" : "Dark"}</span></button><button aria-label="Notifications" className="grid size-8 place-items-center rounded-md text-slate-400 transition hover:bg-white/5 hover:text-white"><Bell className="size-4" /></button></div>
        </header>

        <main className="mx-auto max-w-[1600px] px-4 py-6 md:px-7 md:py-8">
          {activeNav === "Integrations" ? <IntegrationsView /> : activeNav === "Data DNA" ? <DataDnaView selected={selectedDna} selectedId={selectedDnaId} onSelect={setSelectedDnaId} /> : activeNav === "Security twin" ? <SecurityTwinView selectedAction={selectedTwinAction} selectedActionId={selectedTwinActionId} onSelectAction={setSelectedTwinActionId} /> : activeNav === "Policy library" ? <PolicyLibraryView selected={selectedPolicy} selectedId={selectedPolicyId} onSelect={setSelectedPolicyId} /> : <>
          <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
            <div><div className="mb-3 flex items-center gap-2 text-xs font-medium text-[#a7f4d3]"><span className="inline-flex size-5 items-center justify-center rounded bg-[#a7f4d3]/10"><Radar className="size-3.5" /></span>Active agent session</div><h1 className="text-2xl font-semibold tracking-[-0.035em] text-white md:text-[30px]">Finance reconciliation review</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">AEGIS is enforcing a task-scoped boundary around the connected agent and finance systems.</p></div>
            <div className="flex flex-wrap items-center gap-2"><StatusPill decision={decision} /><Button onClick={() => runGatewayScenario("payroll-summary")} disabled={isChecking} className="h-9 rounded-md bg-[#a7f4d3] px-3.5 text-sm font-semibold text-[#07110e] hover:bg-[#c6ffe5]">{isChecking ? <Activity className="size-4 animate-pulse" /> : <Play className="size-4 fill-current" />}{isChecking ? "Evaluating…" : "Run protected read"}</Button></div>
          </section>

          <section className="mt-7 grid gap-4 md:grid-cols-3">
            <MetricCard icon={<SquareTerminal className="size-4" />} label="Agent boundary" value="Staging-only" detail="4 permitted tools" tone="mint" />
            <MetricCard icon={<Fingerprint className="size-4" />} label="Privacy budget" value={`${privacyBudget}%`} detail={privacyBudget >= 64 ? "Escalated this session" : "Within normal range"} tone={privacyBudget >= 64 ? "amber" : "blue"} />
            <MetricCard icon={<Workflow className="size-4" />} label="Security twin" value="12 linked assets" detail="3 critical dependencies" tone="violet" />
          </section>

          <section className="mt-4 flex flex-col gap-3 rounded-xl border border-sky-300/15 bg-sky-300/[0.05] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div><p className="text-xs font-semibold text-sky-100">{protectedSourceLabel}</p><p className="mt-1 text-xs text-slate-400">Choose a controlled request. The browser never receives a direct database route or a credential.</p></div>
            <div className="flex flex-wrap gap-2"><button onClick={() => runGatewayScenario("employee-search")} disabled={isChecking} className="rounded-md border border-white/8 bg-white/[0.025] px-3 py-2 text-xs font-medium text-slate-200 transition hover:bg-white/5 disabled:opacity-50">Test privacy search</button><button onClick={() => runGatewayScenario("delete-payroll")} disabled={isChecking} className="rounded-md border border-rose-300/20 bg-rose-300/[0.07] px-3 py-2 text-xs font-medium text-rose-100 transition hover:bg-rose-300/[0.12] disabled:opacity-50">Test blocked deletion</button></div>
          </section>

          <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.85fr)]">
            <div className="rounded-xl border border-white/8 bg-[#0e1622] shadow-[0_20px_70px_rgba(0,0,0,0.16)]">
              <div className="flex items-center justify-between border-b border-white/8 px-5 py-4"><div><p className="text-sm font-semibold text-white">Live gateway activity</p><p className="mt-1 text-xs text-slate-500">Events arrive from the local AEGIS gateway after a protected request.</p></div><span className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-semibold ${runtimeStatus === "connected" ? "bg-emerald-300/10 text-emerald-100" : "bg-amber-200/10 text-amber-100"}`}><span className="size-1.5 rounded-full bg-current" />{runtimeStatus === "connected" ? "STREAM CONNECTED" : runtimeStatus === "connecting" ? "CONNECTING" : "STREAM OFFLINE"}</span></div>
              <div className="divide-y divide-white/6 px-5">
                {runtimeEvents.length > 0 ? runtimeEvents.slice().reverse().map((event) => <ActivityRow key={event.id} time={event.timestamp} icon={<AuditEventIcon source={event.source} />} title={event.title} detail={event.detail} state={event.state} />) : <>
                {demoAuditEvents.slice(0, 2).map((event) => <ActivityRow key={event.id} time={event.time} icon={<AuditEventIcon source={event.source} />} title={event.title} detail={event.detail} state={event.state} />)}
                <ActivityRow time="09:42:41" icon={<Database className="size-3.5" />} title={eventLabel} detail={decision === "Ready" ? "No mutable operation has been requested" : decision === "Blocked" ? "Requested resource: payroll-primary · blast radius: critical" : "Capability tokens revoked and write channels closed"} state={decision === "Ready" ? "neutral" : decision === "Blocked" ? "blocked" : "contained"} />
                {demoAuditEvents.slice(2).map((event) => <ActivityRow key={event.id} time={event.time} icon={<AuditEventIcon source={event.source} />} title={event.title} detail={event.detail} state={event.state} />)}
                </>}
              </div>
              <div className="border-t border-white/8 px-5 py-3.5 text-xs text-slate-500">Session <span className="font-mono text-slate-300">{demoSession.id}</span> · Policy set <span className="font-mono text-slate-300">{demoSession.policySet}</span></div>
            </div>

            <div className="overflow-hidden rounded-xl border border-white/8 bg-[#0e1622]">
              <div className="border-b border-white/8 px-5 py-4"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Decision engine</p><p className="mt-1 text-xs text-slate-500">Live policy evaluation</p></div>{decision === "Blocked" ? <ShieldAlert className="size-5 text-rose-300" /> : decision === "Contained" ? <LockKeyhole className="size-5 text-amber-200" /> : <ShieldCheck className="size-5 text-[#a7f4d3]" />}</div></div>
              <div className="space-y-5 px-5 py-5"><div><div className="mb-2 flex items-center justify-between text-xs"><span className="text-slate-400">Action risk</span><span className={risk > 75 ? "font-semibold text-rose-200" : "font-semibold text-[#a7f4d3]"}>{risk}/100</span></div><Progress value={risk} className={risk > 75 ? "bg-rose-300/10 [&>[data-slot=progress-indicator]]:bg-rose-300" : "bg-[#a7f4d3]/10 [&>[data-slot=progress-indicator]]:bg-[#a7f4d3]"} /></div><DecisionLine label="Task scope" value="Finance review" verified /><DecisionLine label="Environment" value={decision === "Blocked" ? "Production target" : "Staging target"} verified={decision !== "Blocked"} warning={decision === "Blocked"} /><DecisionLine label="Data purpose" value="Reconciliation" verified /><DecisionLine label="Backup impact" value={decision === "Blocked" ? "Detected" : "No write path"} verified={decision === "Ready"} warning={decision === "Blocked"} /></div>
              <div className="border-t border-white/8 bg-white/[0.018] p-4">{decision === "Blocked" ? <Button onClick={containGatewaySession} disabled={isChecking} className="h-9 w-full rounded-md bg-rose-300 text-sm font-semibold text-[#22070b] hover:bg-rose-200"><LockKeyhole className="size-4" />Contain agent session</Button> : decision === "Contained" ? <div className="flex items-center justify-center gap-2 rounded-md border border-amber-200/15 bg-amber-200/10 px-3 py-2.5 text-sm font-medium text-amber-100"><Check className="size-4" />Temporary agent capabilities revoked</div> : <div className="flex items-center gap-2 rounded-md border border-emerald-300/10 bg-emerald-300/[0.06] px-3 py-2.5 text-sm text-emerald-100"><Check className="size-4" />Session is operating within policy</div>}</div>
            </div>
          </section>

          <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)]">
            <div className="rounded-xl border border-white/8 bg-[#0e1622] p-5"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold text-white">Security twin</p><p className="mt-1 text-xs text-slate-500">The dependency path evaluated for this session.</p></div><button onClick={() => setActiveNav("Security twin")} className="inline-flex items-center gap-1 text-xs font-medium text-[#a7f4d3] hover:text-[#d2ffe9]">Open graph <ArrowUpRight className="size-3.5" /></button></div><div className="relative mt-5 h-[190px] overflow-hidden rounded-lg border border-white/6 bg-[#09101a]"><div className="absolute left-[19%] top-[39%] h-px w-[31%] origin-left rotate-[-17deg] bg-gradient-to-r from-emerald-300/60 to-amber-300/60" /><div className="absolute left-[47%] top-[31%] h-px w-[30%] origin-left rotate-[-9deg] bg-gradient-to-r from-amber-300/60 to-sky-300/60" /><div className="absolute left-[48%] top-[42%] h-px w-[28%] origin-left rotate-[29deg] bg-gradient-to-r from-amber-300/60 to-violet-300/60" />{demoAssets.map((asset) => <AssetNode key={asset.id} label={asset.name} detail={asset.graph.detail} x={asset.graph.x} y={asset.graph.y} tone={asset.tone} />)}</div></div>
            <div className="rounded-xl border border-white/8 bg-[#0e1622] p-5"><div className="flex items-center justify-between"><div><p className="text-sm font-semibold text-white">PRISM privacy tracker</p><p className="mt-1 text-xs text-slate-500">Cumulative disclosure across this session</p></div><Binary className="size-4 text-slate-500" /></div><div className="mt-5 rounded-lg border border-white/6 bg-[#09101a] p-4"><div className="flex items-end justify-between"><div><p className="text-2xl font-semibold tracking-[-0.04em] text-white">{privacyBudget}<span className="text-sm text-slate-500">/100</span></p><p className="mt-1 text-xs text-slate-500">Disclosure budget used</p></div><Zap className={`mb-1 size-5 ${privacyBudget >= 64 ? "text-amber-200" : "text-[#a7f4d3]"}`} /></div><Progress value={privacyBudget} className={`mt-4 ${privacyBudget >= 64 ? "bg-amber-200/10 [&>[data-slot=progress-indicator]]:bg-amber-200" : "bg-sky-300/10 [&>[data-slot=progress-indicator]]:bg-sky-300"}`} /></div><div className="mt-4 space-y-3 text-xs"><PrivacyLine label="Identity fields" value="Tokenized" icon={<EyeOff className="size-3.5" />} /><PrivacyLine label="Payroll amounts" value="Aggregated" icon={<CircleAlert className="size-3.5" />} /><PrivacyLine label="Reconstruction risk" value={privacyBudget >= 64 ? "Elevated" : "Low"} icon={<Activity className="size-3.5" />} warn={privacyBudget >= 64} /></div></div>
          </section>
          </>}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function MetricCard({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string; detail: string; tone: "mint" | "amber" | "blue" | "violet" }) {
  const colors = { mint: "border-emerald-300/20 bg-emerald-300/[0.06] text-emerald-100", amber: "border-amber-200/20 bg-amber-200/[0.06] text-amber-100", blue: "border-sky-300/20 bg-sky-300/[0.06] text-sky-100", violet: "border-violet-300/20 bg-violet-300/[0.06] text-violet-100" };
  return <div className="rounded-xl border border-white/8 bg-[#0e1622] p-4"><div className="flex items-start justify-between"><div className={`grid size-8 place-items-center rounded-lg border ${colors[tone]}`}>{icon}</div><MoreHorizontal className="size-4 text-slate-600" /></div><p className="mt-4 text-xs text-slate-500">{label}</p><div className="mt-1 flex items-baseline gap-2"><p className="text-lg font-semibold tracking-[-0.025em] text-white">{value}</p><p className="text-[11px] text-slate-500">{detail}</p></div></div>;
}

function ActivityRow({ time, icon, title, detail, state }: { time: string; icon: React.ReactNode; title: string; detail: string; state: "allowed" | "masked" | "blocked" | "contained" | "neutral" }) {
  const colors = { allowed: "bg-emerald-300/10 text-emerald-200", masked: "bg-sky-300/10 text-sky-200", blocked: "bg-rose-300/10 text-rose-200", contained: "bg-amber-200/10 text-amber-100", neutral: "bg-slate-300/10 text-slate-300" };
  const labels = { allowed: "Allowed", masked: "Masked", blocked: "Blocked", contained: "Contained", neutral: "Watching" };
  return <div className="grid grid-cols-[52px_30px_minmax(0,1fr)_auto] gap-3 py-4"><span className="pt-1 text-[11px] font-mono text-slate-600">{time}</span><span className={`mt-0.5 grid size-6 place-items-center rounded-md ${colors[state]}`}>{icon}</span><div className="min-w-0"><p className="truncate text-sm text-slate-200">{title}</p><p className="mt-1 truncate text-xs text-slate-500">{detail}</p></div><span className={`mt-0.5 hidden rounded-full px-2 py-1 text-[10px] font-medium sm:block ${colors[state]}`}>{labels[state]}</span></div>;
}

function AuditEventIcon({ source }: { source: "agent" | "demo-agent" | "mcp-client" | "data-dna" | "agentguard" | "prism" | "ledger" }) {
  return source === "data-dna" ? <EyeOff className="size-3.5" /> : source === "prism" ? <Binary className="size-3.5" /> : source === "ledger" ? <FileKey2 className="size-3.5" /> : source === "agentguard" ? <ShieldCheck className="size-3.5" /> : <Sparkles className="size-3.5" />;
}

function DecisionLine({ label, value, verified, warning }: { label: string; value: string; verified?: boolean; warning?: boolean }) { return <div className="flex items-center justify-between gap-3"><span className="text-xs text-slate-500">{label}</span><span className={`flex items-center gap-1.5 text-xs font-medium ${warning ? "text-rose-200" : "text-slate-200"}`}>{warning ? <X className="size-3.5" /> : verified ? <Check className="size-3.5 text-[#a7f4d3]" /> : null}{value}</span></div>; }
function PrivacyLine({ label, value, icon, warn }: { label: string; value: string; icon: React.ReactNode; warn?: boolean }) { return <div className="flex items-center justify-between"><span className="flex items-center gap-2 text-slate-500">{icon}{label}</span><span className={warn ? "font-medium text-amber-100" : "font-medium text-slate-300"}>{value}</span></div>; }
function AssetNode({ label, detail, x, y, tone }: { label: string; detail: string; x: string; y: string; tone: string }) {
  const visual = tone === "mint" ? "border-emerald-300/30 bg-emerald-300/10 text-emerald-200" : tone === "amber" ? "border-amber-200/35 bg-amber-200/10 text-amber-100" : tone === "blue" ? "border-sky-300/30 bg-sky-300/10 text-sky-200" : "border-violet-300/30 bg-violet-300/10 text-violet-200";
  const icon = tone === "mint" ? <Box className="size-4" /> : tone === "amber" ? <Database className="size-4" /> : tone === "blue" ? <LockKeyhole className="size-4" /> : <FileKey2 className="size-4" />;
  return <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: x, top: y }}><div className={`mb-1.5 grid size-8 place-items-center rounded-lg border ${visual}`}>{icon}</div><p className="whitespace-nowrap text-[11px] font-medium text-slate-200">{label}</p><p className="text-[10px] text-slate-500">{detail}</p></div>;
}

function DataDnaView({ selected, selectedId, onSelect }: { selected: ProtectedAsset; selectedId: string; onSelect: (id: string) => void }) {
  const tone = selected.tone === "amber" ? "border-amber-200/25 bg-amber-200/[0.07] text-amber-100" : selected.tone === "blue" ? "border-sky-300/25 bg-sky-300/[0.07] text-sky-100" : selected.tone === "violet" ? "border-violet-300/25 bg-violet-300/[0.07] text-violet-100" : "border-emerald-300/25 bg-emerald-300/[0.07] text-emerald-100";
  return <>
    <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div><div className="mb-3 flex items-center gap-2 text-xs font-medium text-[#a7f4d3]"><span className="inline-flex size-5 items-center justify-center rounded bg-[#a7f4d3]/10"><Fingerprint className="size-3.5" /></span>Protection metadata</div><h1 className="text-2xl font-semibold tracking-[-0.035em] text-white md:text-[30px]">Data DNA registry</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Each protected asset has a machine-enforced identity: who owns it, why it may be used, and what an agent is permitted to receive.</p></div>
      <div className="flex items-center gap-2 rounded-lg border border-white/8 bg-white/[0.025] px-3 py-2 text-xs text-slate-400"><Check className="size-3.5 text-[#a7f4d3]" /><span>Registry integrity verified</span></div>
    </section>

    <section className="mt-7 grid gap-4 md:grid-cols-3">
      <MetricCard icon={<Fingerprint className="size-4" />} label="Protected assets" value="12" detail="4 shown in scope" tone="mint" />
      <MetricCard icon={<LockKeyhole className="size-4" />} label="Sensitive fields" value="38" detail="Policy-bound" tone="amber" />
      <MetricCard icon={<Activity className="size-4" />} label="Registry health" value="100%" detail="No unclassified fields" tone="blue" />
    </section>

    <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(300px,0.72fr)_minmax(0,1.28fr)]">
      <div className="overflow-hidden rounded-xl border border-white/8 bg-[#0e1622]">
        <div className="border-b border-white/8 px-5 py-4"><p className="text-sm font-semibold text-white">Protected assets</p><p className="mt-1 text-xs text-slate-500">Choose an asset to inspect its Data DNA.</p></div>
        <div className="divide-y divide-white/6">{demoAssets.map((asset) => { const active = asset.id === selectedId; return <button key={asset.id} onClick={() => onSelect(asset.id)} className={`flex w-full items-center gap-3 px-5 py-4 text-left transition ${active ? "bg-emerald-300/[0.06]" : "hover:bg-white/[0.025]"}`}><span className={`grid size-9 shrink-0 place-items-center rounded-lg border ${asset.tone === "amber" ? "border-amber-200/25 bg-amber-200/[0.07] text-amber-100" : asset.tone === "blue" ? "border-sky-300/25 bg-sky-300/[0.07] text-sky-100" : asset.tone === "violet" ? "border-violet-300/25 bg-violet-300/[0.07] text-violet-100" : "border-emerald-300/25 bg-emerald-300/[0.07] text-emerald-100"}`}>{asset.kind === "Database" ? <Database className="size-4" /> : asset.kind === "Recovery vault" ? <LockKeyhole className="size-4" /> : asset.kind === "Service" ? <Box className="size-4" /> : <FileKey2 className="size-4" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-200">{asset.name}</span><span className="mt-1 block truncate text-xs text-slate-500">{asset.kind} · {asset.environment}</span></span>{active ? <Check className="size-4 text-[#a7f4d3]" /> : <ChevronRight className="size-4 text-slate-600" />}</button>; })}</div>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/8 bg-[#0e1622] shadow-[0_20px_70px_rgba(0,0,0,0.16)]">
        <div className="flex flex-col gap-4 border-b border-white/8 px-5 py-5 sm:flex-row sm:items-start sm:justify-between"><div className="flex gap-3"><div className={`grid size-10 place-items-center rounded-lg border ${tone}`}>{selected.kind === "Database" ? <Database className="size-[18px]" /> : selected.kind === "Recovery vault" ? <LockKeyhole className="size-[18px]" /> : selected.kind === "Service" ? <Box className="size-[18px]" /> : <FileKey2 className="size-[18px]" />}</div><div><p className="text-lg font-semibold tracking-[-0.025em] text-white">{selected.name}</p><p className="mt-1 text-xs text-slate-500">{selected.kind} · {selected.environment}</p></div></div><span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium ${tone}`}><span className="size-1.5 rounded-full bg-current" />{selected.classification}</span></div>
        <div className="grid gap-px border-b border-white/8 bg-white/6 sm:grid-cols-2"><DnaDatum label="Owner" value={selected.owner} /><DnaDatum label="Approved purpose" value={selected.purpose} /><DnaDatum label="Agent permission" value={selected.access} mono /><DnaDatum label="Default response" value={selected.defaultResponse} /></div>
        <div className="grid gap-4 p-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(220px,0.85fr)]"><div><p className="text-xs font-semibold tracking-[0.12em] text-slate-500">DATA TREATMENT</p><div className="mt-3 rounded-lg border border-white/6 bg-[#09101a] p-4"><div className="flex items-start gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-md bg-sky-300/10 text-sky-200"><EyeOff className="size-4" /></span><div><p className="text-sm font-medium text-slate-200">{selected.treatment}</p><p className="mt-1.5 text-xs leading-5 text-slate-500">AEGIS applies this rule before any data leaves the protected system for an agent session.</p></div></div></div><p className="mt-5 text-xs font-semibold tracking-[0.12em] text-slate-500">SENSITIVE FIELDS</p><div className="mt-3 flex flex-wrap gap-2">{selected.fields.map((field) => <span key={field} className="rounded-md border border-white/8 bg-white/[0.025] px-2.5 py-1.5 text-xs text-slate-300">{field}</span>)}</div></div><div><p className="text-xs font-semibold tracking-[0.12em] text-slate-500">DEPENDENCY CHECK</p><div className="mt-3 space-y-2.5">{selected.dependencyIds.map((dependencyId) => { const dependency = getDemoAsset(dependencyId); return <div key={dependencyId} className="flex items-center gap-2.5 rounded-lg border border-white/6 bg-white/[0.025] px-3 py-2.5"><Network className="size-3.5 text-[#a7f4d3]" /><span className="text-xs text-slate-300">{dependency?.name ?? dependencyId}</span></div>; })}</div><div className="mt-4 rounded-lg border border-emerald-300/15 bg-emerald-300/[0.06] px-3 py-3"><div className="flex items-center gap-2 text-xs font-medium text-emerald-100"><ShieldCheck className="size-3.5" />Integrity signature valid</div><p className="mt-1.5 text-[11px] leading-4 text-slate-500">Last verified 42 seconds ago by the registry service.</p></div></div></div>
      </div>
    </section>
  </>;
}

function DnaDatum({ label, value, mono }: { label: string; value: string; mono?: boolean }) { return <div className="bg-[#0e1622] px-5 py-4"><p className="text-[11px] font-semibold tracking-[0.11em] text-slate-500">{label}</p><p className={`mt-2 text-sm leading-5 text-slate-200 ${mono ? "font-mono text-[12px]" : ""}`}>{value}</p></div>; }

function SecurityTwinView({ selectedAction, selectedActionId, onSelectAction }: { selectedAction: AgentAction; selectedActionId: string; onSelectAction: (id: string) => void }) {
  const isDeny = selectedAction.recommendedDecision === "DENY";
  const decisionClass = isDeny ? "border-rose-300/25 bg-rose-300/[0.08] text-rose-200" : "border-sky-300/25 bg-sky-300/[0.08] text-sky-100";
  const activeIds = selectedAction.id === "delete-payroll-database" ? ["payroll-primary", "immutable-backup"] : ["finance-app", "payroll-primary"];
  const targetAsset = getDemoAsset(selectedAction.targetAssetId);
  const dependencyNames = selectedAction.dependencyAssetIds.map((assetId) => getDemoAsset(assetId)?.name ?? assetId);

  return <>
    <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div><div className="mb-3 flex items-center gap-2 text-xs font-medium text-[#a7f4d3]"><span className="inline-flex size-5 items-center justify-center rounded bg-[#a7f4d3]/10"><Network className="size-3.5" /></span>Impact simulation</div><h1 className="text-2xl font-semibold tracking-[-0.035em] text-white md:text-[30px]">Security Twin workspace</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Resolve the dependency path and expected AgentGuard decision before a protected action can be released.</p></div>
      <div className="flex items-center gap-2 rounded-lg border border-sky-300/15 bg-sky-300/[0.06] px-3 py-2 text-xs text-sky-100"><CircleAlert className="size-3.5" /><span>Demo data — no live infrastructure connected</span></div>
    </section>

    <section className="mt-7 grid gap-4 md:grid-cols-3">
      <MetricCard icon={<Network className="size-4" />} label="Assets in scope" value="4" detail="Northstar Finance" tone="mint" />
      <MetricCard icon={<ShieldAlert className="size-4" />} label="High-impact path" value="1" detail="Production mutation" tone="amber" />
      <MetricCard icon={<ShieldCheck className="size-4" />} label="Recommended decision" value={selectedAction.recommendedDecision} detail={selectedAction.riskLabel} tone={isDeny ? "amber" : "blue"} />
    </section>

    <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.18fr)_minmax(360px,0.82fr)]">
      <div className="overflow-hidden rounded-xl border border-white/8 bg-[#0e1622] shadow-[0_20px_70px_rgba(0,0,0,0.16)]">
        <div className="flex flex-col gap-3 border-b border-white/8 px-5 py-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-sm font-semibold text-white">Dependency graph</p><p className="mt-1 text-xs text-slate-500">The highlighted path is evaluated for the selected action.</p></div><div className="flex items-center gap-3 text-[11px] text-slate-500"><span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-[#a7f4d3]" />Permitted route</span><span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-rose-300" />Impact route</span></div></div>
        <div className="overflow-x-auto p-4"><div className="relative h-[390px] min-w-[660px] overflow-hidden rounded-lg border border-white/6 bg-[#09101a]">
          <svg aria-hidden="true" className="absolute inset-0 size-full" viewBox="0 0 660 390" preserveAspectRatio="none"><line x1="150" y1="248" x2="322" y2="156" className={selectedAction.id === "read-payroll-summary" ? "stroke-emerald-300/70" : "stroke-white/10"} strokeWidth="2" /><line x1="367" y1="145" x2="514" y2="90" className={selectedAction.id === "delete-payroll-database" ? "stroke-rose-300/80" : "stroke-white/10"} strokeWidth="2" /><line x1="150" y1="258" x2="510" y2="298" className="stroke-white/10" strokeWidth="2" /><line x1="365" y1="164" x2="510" y2="292" className="stroke-white/10" strokeWidth="2" /></svg>
          <TwinNode asset={getDemoAsset("finance-app") ?? demoAssets[0]} x="10%" y="57%" active={activeIds.includes("finance-app")} />
          <TwinNode asset={getDemoAsset("payroll-primary") ?? demoAssets[0]} x="40%" y="29%" active={activeIds.includes("payroll-primary")} danger={isDeny} />
          <TwinNode asset={getDemoAsset("immutable-backup") ?? demoAssets[0]} x="70%" y="12%" active={activeIds.includes("immutable-backup")} danger={isDeny} />
          <TwinNode asset={getDemoAsset("ledger-export") ?? demoAssets[0]} x="70%" y="66%" active={activeIds.includes("ledger-export")} />
          <div className={`absolute bottom-4 left-4 right-4 flex items-center gap-2 rounded-md border px-3 py-2 text-xs ${isDeny ? "border-rose-300/20 bg-rose-300/[0.07] text-rose-100" : "border-sky-300/20 bg-sky-300/[0.07] text-sky-100"}`}><ShieldAlert className="size-3.5 shrink-0" />{isDeny ? "Production and recovery impact detected before execution." : "Sensitive fields stay protected at retrieval time."}</div>
        </div></div>
      </div>

      <div className="overflow-hidden rounded-xl border border-white/8 bg-[#0e1622]">
        <div className="border-b border-white/8 px-5 py-4"><p className="text-sm font-semibold text-white">Action-impact panel</p><p className="mt-1 text-xs text-slate-500">Choose a demo request to evaluate.</p></div>
        <div className="space-y-2 border-b border-white/8 p-3">{demoActions.map((action) => { const active = action.id === selectedActionId; const actionDeny = action.recommendedDecision === "DENY"; return <button key={action.id} onClick={() => onSelectAction(action.id)} aria-pressed={active} className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left transition ${active ? actionDeny ? "border-rose-300/30 bg-rose-300/[0.08]" : "border-sky-300/30 bg-sky-300/[0.08]" : "border-transparent bg-white/[0.018] hover:border-white/10 hover:bg-white/[0.035]"}`}><span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-md ${actionDeny ? "bg-rose-300/10 text-rose-200" : "bg-sky-300/10 text-sky-100"}`}>{actionDeny ? <Database className="size-4" /> : <EyeOff className="size-4" />}</span><span className="min-w-0 flex-1"><span className="block text-sm font-medium text-slate-200">{action.label}</span><span className="mt-1 block truncate font-mono text-[11px] text-slate-500">{action.request}</span></span><span className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${actionDeny ? "border-rose-300/20 text-rose-200" : "border-sky-300/20 text-sky-100"}`}>{action.recommendedDecision}</span></button>; })}</div>
        <div className="space-y-5 p-5"><div><div className="flex items-start justify-between gap-3"><div><p className="text-base font-semibold tracking-[-0.02em] text-white">{selectedAction.label}</p><p className="mt-1 text-xs text-slate-500">Target: <span className="font-medium text-slate-300">{targetAsset?.name ?? selectedAction.targetAssetId}</span></p></div><span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${decisionClass}`}>{selectedAction.recommendedDecision}</span></div><p className="mt-3 text-xs leading-5 text-slate-400">{selectedAction.description}</p></div>
          <div><div className="mb-2 flex items-center justify-between text-xs"><span className="text-slate-500">Impact risk</span><span className={isDeny ? "font-semibold text-rose-200" : "font-semibold text-sky-100"}>{selectedAction.risk}/100</span></div><Progress value={selectedAction.risk} className={isDeny ? "bg-rose-300/10 [&>[data-slot=progress-indicator]]:bg-rose-300" : "bg-sky-300/10 [&>[data-slot=progress-indicator]]:bg-sky-300"} /></div>
          <div className="grid gap-2"><TwinDatum label="Direct dependencies" value={dependencyNames.join(" · ")} icon={<Network className="size-3.5" />} /><TwinDatum label="Business function" value={selectedAction.businessFunction} icon={<Workflow className="size-3.5" />} /><TwinDatum label="Backup impact" value={selectedAction.backupImpact} icon={<LockKeyhole className="size-3.5" />} /><TwinDatum label="Agent response" value={selectedAction.response} icon={<EyeOff className="size-3.5" />} /></div>
          <div className="rounded-lg border border-white/6 bg-[#09101a] p-3"><p className="text-[11px] font-semibold tracking-[0.11em] text-slate-500">AGENTGUARD CHECKS</p><div className="mt-3 space-y-2.5">{selectedAction.checks.map((check) => <div key={check.label} className="flex items-center justify-between gap-3"><span className="text-xs text-slate-500">{check.label}</span><span className={`flex items-center gap-1.5 text-right text-xs font-medium ${check.status === "warn" ? "text-rose-200" : "text-emerald-100"}`}>{check.status === "warn" ? <X className="size-3.5 shrink-0" /> : <Check className="size-3.5 shrink-0" />}{check.value}</span></div>)}</div></div>
        </div>
      </div>
    </section>
  </>;
}

function TwinNode({ asset, x, y, active, danger }: { asset: ProtectedAsset; x: string; y: string; active?: boolean; danger?: boolean }) {
  const visual = danger && active ? "border-rose-300/45 bg-rose-300/[0.14] text-rose-100 shadow-[0_0_28px_rgba(253,164,175,0.15)]" : asset.tone === "amber" ? "border-amber-200/30 bg-amber-200/10 text-amber-100" : asset.tone === "blue" ? "border-sky-300/30 bg-sky-300/10 text-sky-100" : asset.tone === "violet" ? "border-violet-300/30 bg-violet-300/10 text-violet-200" : "border-emerald-300/30 bg-emerald-300/10 text-emerald-100";
  const icon = asset.kind === "Database" ? <Database className="size-4" /> : asset.kind === "Recovery vault" ? <LockKeyhole className="size-4" /> : asset.kind === "Service" ? <Box className="size-4" /> : <FileKey2 className="size-4" />;
  return <div className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: x, top: y }}><div className={`grid size-10 place-items-center rounded-lg border transition ${visual} ${active ? "ring-2 ring-white/10" : "opacity-75"}`}>{icon}</div><p className="mt-2 whitespace-nowrap text-center text-xs font-medium text-slate-200">{asset.name}</p><p className="mt-0.5 whitespace-nowrap text-center text-[10px] text-slate-500">{asset.environment}</p></div>;
}

function TwinDatum({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) { return <div className="flex items-start gap-2.5 rounded-md border border-white/6 bg-white/[0.018] px-3 py-2.5"><span className="mt-0.5 text-slate-500">{icon}</span><div className="min-w-0"><p className="text-[10px] font-semibold tracking-[0.1em] text-slate-500">{label}</p><p className="mt-1 text-xs leading-5 text-slate-300">{value}</p></div></div>; }

function PolicyLibraryView({ selected, selectedId, onSelect }: { selected: EnforcementPolicy; selectedId: string; onSelect: (id: string) => void }) {
  const isDeny = selected.decision === "DENY";
  const decisionClass = selected.decision === "DENY" ? "border-rose-300/25 bg-rose-300/[0.08] text-rose-200" : selected.decision === "APPROVAL" ? "border-violet-300/25 bg-violet-300/[0.08] text-violet-200" : selected.decision === "MASK" ? "border-sky-300/25 bg-sky-300/[0.08] text-sky-100" : "border-emerald-300/25 bg-emerald-300/[0.08] text-emerald-100";

  return <>
    <section className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
      <div><div className="mb-3 flex items-center gap-2 text-xs font-medium text-[#a7f4d3]"><span className="inline-flex size-5 items-center justify-center rounded bg-[#a7f4d3]/10"><ShieldCheck className="size-3.5" /></span>External enforcement rules</div><h1 className="text-2xl font-semibold tracking-[-0.035em] text-white md:text-[30px]">Policy library</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">Policies are evaluated by AEGIS at the tool gateway, independently of an agent’s instructions or static permissions.</p></div>
      <div className="flex items-center gap-2 rounded-lg border border-sky-300/15 bg-sky-300/[0.06] px-3 py-2 text-xs text-sky-100"><CircleAlert className="size-3.5" /><span>Demo policy set — not connected to a live gateway</span></div>
    </section>

    <section className="mt-7 grid gap-4 md:grid-cols-3">
      <MetricCard icon={<ShieldCheck className="size-4" />} label="Active policies" value="4" detail="Finance production set" tone="mint" />
      <MetricCard icon={<ShieldAlert className="size-4" />} label="Hard guardrails" value="2" detail="Deny or approval" tone="amber" />
      <MetricCard icon={<EyeOff className="size-4" />} label="Data transformations" value="2" detail="Mask and aggregate" tone="blue" />
    </section>

    <section className="mt-4 grid gap-4 xl:grid-cols-[minmax(310px,0.72fr)_minmax(0,1.28fr)]">
      <div className="overflow-hidden rounded-xl border border-white/8 bg-[#0e1622]"><div className="border-b border-white/8 px-5 py-4"><p className="text-sm font-semibold text-white">Enforcement policies</p><p className="mt-1 text-xs text-slate-500">Select a rule to inspect its gateway behavior.</p></div><div className="divide-y divide-white/6">{demoPolicies.map((policy) => { const active = policy.id === selectedId; const tone = policy.decision === "DENY" ? "text-rose-200 bg-rose-300/10" : policy.decision === "APPROVAL" ? "text-violet-200 bg-violet-300/10" : policy.decision === "MASK" ? "text-sky-100 bg-sky-300/10" : "text-emerald-100 bg-emerald-300/10"; return <button key={policy.id} onClick={() => onSelect(policy.id)} className={`flex w-full items-start gap-3 px-5 py-4 text-left transition ${active ? "bg-emerald-300/[0.06]" : "hover:bg-white/[0.025]"}`}><span className={`mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg ${tone}`}>{policy.decision === "DENY" ? <ShieldAlert className="size-4" /> : policy.decision === "APPROVAL" ? <LockKeyhole className="size-4" /> : policy.id === "prism-disclosure-budget" ? <Binary className="size-4" /> : <EyeOff className="size-4" />}</span><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-slate-200">{policy.name}</span><span className="mt-1 block truncate text-xs text-slate-500">{policy.module}</span></span><span className={`mt-0.5 rounded-full px-2 py-1 text-[10px] font-semibold ${tone}`}>{policy.decision}</span></button>; })}</div><div className="border-t border-white/8 bg-white/[0.018] px-5 py-3 text-[11px] text-slate-500">Policy set <span className="font-mono text-slate-300">{demoSession.policySet}</span> · Integrity signature verified</div></div>

      <div className="overflow-hidden rounded-xl border border-white/8 bg-[#0e1622] shadow-[0_20px_70px_rgba(0,0,0,0.16)]"><div className="flex flex-col gap-4 border-b border-white/8 px-5 py-5 sm:flex-row sm:items-start sm:justify-between"><div><p className="text-lg font-semibold tracking-[-0.025em] text-white">{selected.name}</p><p className="mt-1 text-xs text-slate-500">{selected.module}</p></div><span className={`inline-flex w-fit items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${decisionClass}`}><span className="size-1.5 rounded-full bg-current" />{selected.decision}</span></div>
        <div className="grid gap-px border-b border-white/8 bg-white/6 sm:grid-cols-2"><DnaDatum label="Gateway scope" value={selected.scope} mono /><DnaDatum label="Default decision" value={selected.decision} /></div>
        <div className="grid gap-5 p-5 lg:grid-cols-[minmax(0,1.06fr)_minmax(240px,0.94fr)]"><div><p className="text-xs leading-5 text-slate-400">{selected.summary}</p><p className="mt-6 text-[11px] font-semibold tracking-[0.12em] text-slate-500">MATCH CONDITIONS</p><div className="mt-3 flex flex-wrap gap-2">{selected.conditions.map((condition) => <span key={condition} className="rounded-md border border-white/8 bg-white/[0.025] px-2.5 py-1.5 text-xs text-slate-300">{condition}</span>)}</div><div className="mt-6 rounded-lg border border-white/6 bg-[#09101a] p-4"><p className="text-[11px] font-semibold tracking-[0.12em] text-slate-500">GATEWAY EVALUATION</p><div className="mt-4 flex items-center gap-2 overflow-x-auto whitespace-nowrap text-xs"><span className="rounded bg-white/[0.04] px-2.5 py-1.5 text-slate-300">Tool request</span><ChevronRight className="size-3.5 shrink-0 text-slate-600" /><span className="rounded bg-white/[0.04] px-2.5 py-1.5 text-slate-300">Policy match</span><ChevronRight className="size-3.5 shrink-0 text-slate-600" /><span className={`rounded px-2.5 py-1.5 font-semibold ${isDeny ? "bg-rose-300/10 text-rose-200" : "bg-sky-300/10 text-sky-100"}`}>{selected.decision}</span><ChevronRight className="size-3.5 shrink-0 text-slate-600" /><span className="rounded bg-white/[0.04] px-2.5 py-1.5 text-slate-300">Evidence</span></div></div></div>
          <div><p className="text-[11px] font-semibold tracking-[0.12em] text-slate-500">ENFORCEMENT ACTIONS</p><div className="mt-3 space-y-2.5">{selected.enforcement.map((action, index) => <div key={action} className="flex items-start gap-3 rounded-lg border border-white/6 bg-white/[0.018] px-3 py-3"><span className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold ${isDeny ? "bg-rose-300/10 text-rose-200" : "bg-emerald-300/10 text-emerald-100"}`}>{index + 1}</span><p className="text-xs leading-5 text-slate-300">{action}</p></div>)}</div><div className="mt-5 rounded-lg border border-emerald-300/15 bg-emerald-300/[0.06] p-3"><div className="flex items-center gap-2 text-xs font-medium text-emerald-100"><FileKey2 className="size-3.5" />Evidence ledger entry</div><p className="mt-1.5 text-[11px] leading-4 text-slate-500">{selected.evidence}</p></div></div></div>
      </div>
    </section>
  </>;
}
