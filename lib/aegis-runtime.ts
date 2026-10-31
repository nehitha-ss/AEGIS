import type { PolicyDecision } from "@/lib/aegis-demo";
import {
  evaluateGatewayPolicy,
  isPolicyScenario,
  type GatewayScenario,
} from "@/lib/aegis-policy";

export type { GatewayScenario } from "@/lib/aegis-policy";

export const gatewayScenarios = [
  {
    id: "payroll-summary",
    label: "Read protected payroll summary",
    description: "Returns an aggregate-only reconciliation result.",
  },
  {
    id: "employee-search",
    label: "Search employee identity",
    description: "Exercises PRISM's cumulative disclosure boundary.",
  },
  {
    id: "delete-payroll",
    label: "Attempt payroll deletion",
    description: "Tests the production mutation guard.",
  },
] as const;

export type GatewayEvent = {
  id: string;
  timestamp: string;
  source: "demo-agent" | "mcp-client" | "agentguard" | "data-dna" | "prism" | "ledger";
  title: string;
  detail: string;
  state: "allowed" | "masked" | "blocked" | "contained" | "neutral";
};

export type GatewayResult = {
  requestId: string;
  scenario: GatewayScenario;
  decision: PolicyDecision;
  risk: number;
  privacyBudget: number;
  policy: string;
  summary: string;
  protectedSource?: "local-fixture" | "supabase-postgres";
  protectedResult?: Record<string, string | number>;
};

export type GatewayRequestOptions = {
  period?: string;
  searchHint?: string;
};

type EventController = ReadableStreamDefaultController<Uint8Array>;

const encoder = new TextEncoder();
const subscribers = new Set<EventController>();
let privacyBudget = 28;
let capabilitiesRevoked = false;
let sequence = 0;

function eventTime() {
  return new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(new Date());
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function emit(event: Omit<GatewayEvent, "id" | "timestamp">) {
  const payload: GatewayEvent = {
    id: `evt_${Date.now()}_${sequence += 1}`,
    timestamp: eventTime(),
    ...event,
  };
  const message = encoder.encode(`event: aegis\ndata: ${JSON.stringify(payload)}\n\n`);

  for (const controller of subscribers) {
    try {
      controller.enqueue(message);
    } catch {
      subscribers.delete(controller);
    }
  }

  return payload;
}

function newRequestId() {
  return `req_${crypto.randomUUID().slice(0, 8)}`;
}

export function isGatewayScenario(value: unknown): value is GatewayScenario {
  return isPolicyScenario(value);
}

export function isGatewayActor(value: unknown): value is "demo-agent" | "mcp-client" {
  return value === "demo-agent" || value === "mcp-client";
}

export function containGatewaySession(actor: "demo-agent" | "mcp-client" = "demo-agent") {
  capabilitiesRevoked = true;
  const actorLabel = actor === "mcp-client" ? "AEGIS MCP client" : "Demo agent";
  emit({
    source: "agentguard",
    title: "AgentGuard revoked temporary session capabilities",
    detail: `${actorLabel} can no longer reach protected tools through AEGIS.`,
    state: "contained",
  });
  emit({
    source: "ledger",
    title: "Evidence ledger recorded session containment",
    detail: "Write paths and temporary tool capabilities are inactive for this local session.",
    state: "contained",
  });
  return {
    decision: "CONTAIN" as const,
    privacyBudget,
    summary: "AEGIS revoked the local session's temporary capabilities.",
  };
}

export function openGatewayEventStream(request: Request) {
  let controller: EventController | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  const close = () => {
    if (controller) subscribers.delete(controller);
    if (heartbeat) clearInterval(heartbeat);
  };

  const stream = new ReadableStream<Uint8Array>({
    start(nextController) {
      controller = nextController;
      subscribers.add(nextController);
      nextController.enqueue(encoder.encode("event: ready\ndata: {\"status\":\"connected\"}\n\n"));
      heartbeat = setInterval(() => {
        try {
          nextController.enqueue(encoder.encode(": keepalive\n\n"));
        } catch {
          close();
        }
      }, 10_000);
      request.signal.addEventListener("abort", close, { once: true });
    },
    cancel: close,
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
    },
  });
}

export async function runGatewayScenario(
  scenario: GatewayScenario,
  actor: "demo-agent" | "mcp-client" = "demo-agent",
  options: GatewayRequestOptions = {},
): Promise<GatewayResult> {
  const requestId = newRequestId();
  const actorLabel = actor === "mcp-client" ? "AEGIS MCP client" : "Demo agent";
  const evaluation = evaluateGatewayPolicy({
    scenario,
    privacyBudget,
    capabilitiesRevoked,
  });
  const common = {
    requestId,
    policy: evaluation.policyId,
  };

  if (evaluation.decision === "CONTAIN") {
    emit({
      source: actor,
      title: `${actorLabel} request stopped by session containment`,
      detail: `${requestId} · All temporary AEGIS capabilities are revoked.`,
      state: "contained",
    });
    emit({
      source: "ledger",
      title: "Evidence ledger recorded a contained tool request",
      detail: `${requestId} · No protected-system call was released.`,
      state: "contained",
    });
    return {
      ...common,
      scenario,
      decision: evaluation.decision,
      risk: evaluation.risk,
      privacyBudget: evaluation.privacyBudget,
      summary: evaluation.reason,
    };
  }

  if (scenario === "payroll-summary") {
    emit({
      source: actor,
      title: `${actorLabel} requested a payroll reconciliation summary`,
      detail: `${requestId} · Tool: finance.reconciliation.read`,
      state: "neutral",
    });
    await wait(180);
    emit({
      source: "agentguard",
      title: `AgentGuard matched ${evaluation.policyName}`,
      detail: evaluation.reason,
      state: "allowed",
    });
    await wait(180);
    emit({
      source: "data-dna",
      title: "Data DNA minimized the result at retrieval",
      detail: evaluation.treatment,
      state: "masked",
    });
    const { readPayrollReconciliationSummary } = await import("@/lib/protected-data-source");
    const protectedSummary = await readPayrollReconciliationSummary(options.period ?? "2026-09");
    const result: GatewayResult = {
      ...common,
      scenario,
      decision: evaluation.decision,
      risk: evaluation.risk,
      privacyBudget: evaluation.privacyBudget,
      protectedSource: protectedSummary.mode,
      summary: `Protected finance summary returned to ${actorLabel.toLowerCase()}.`,
      protectedResult: {
        period: protectedSummary.period,
        employees_in_scope: protectedSummary.employeesInScope,
        gross_pay_total: protectedSummary.grossPayTotal,
        identity_treatment: protectedSummary.identityTreatment,
        compensation_treatment: protectedSummary.compensationTreatment,
      },
    };
    emit({
      source: "ledger",
      title: "Evidence ledger recorded a masked result",
      detail: `${requestId} · Raw payroll fields never left the protected service.`,
      state: "masked",
    });
    return result;
  }

  if (scenario === "employee-search") {
    emit({
      source: actor,
      title: `${actorLabel} requested an employee identity search`,
      detail: `${requestId} · Tool: employee.search`,
      state: "neutral",
    });
    await wait(180);
    privacyBudget = evaluation.privacyBudget;
    const hardStop = evaluation.decision === "DENY";

    emit({
      source: "prism",
      title: `${evaluation.policyName} ${hardStop ? "denied further identity disclosure" : "increased session disclosure exposure"}`,
      detail: `${evaluation.reason} Disclosure budget is ${privacyBudget}/100.`,
      state: hardStop ? "blocked" : "masked",
    });
    const { readTokenizedEmployeeIdentity } = await import("@/lib/protected-data-source");
    const protectedIdentity = hardStop
      ? undefined
      : await readTokenizedEmployeeIdentity(options.searchHint ?? "northstar-finance-1");
    const result: GatewayResult = {
      ...common,
      scenario,
      decision: evaluation.decision,
      risk: evaluation.risk,
      privacyBudget: evaluation.privacyBudget,
      protectedSource: protectedIdentity?.mode,
      summary: hardStop
        ? "No employee identity result was released to the demo agent."
        : "Only a non-identifying employee token was returned to the demo agent.",
      protectedResult: protectedIdentity
        ? { employee_token: protectedIdentity.employeeToken, treatment: protectedIdentity.treatment }
        : undefined,
    };
    emit({
      source: "ledger",
      title: "Evidence ledger recorded PRISM's decision",
      detail: `${requestId} · Cumulative disclosure is now ${privacyBudget}/100.`,
      state: hardStop ? "blocked" : "masked",
    });
    return result;
  }

  emit({
    source: actor,
    title: `${actorLabel} attempted a payroll database deletion`,
    detail: `${requestId} · Tool: database.delete`,
    state: "neutral",
  });
  await wait(180);
  emit({
    source: "agentguard",
    title: `AgentGuard matched ${evaluation.policyName}`,
    detail: evaluation.reason,
    state: "blocked",
  });
  await wait(180);
  emit({
    source: "ledger",
    title: "Evidence ledger recorded the blocked tool call",
    detail: `${requestId} · No delete command was released to the fake company system.`,
    state: "blocked",
  });
  return {
    ...common,
    scenario,
    decision: evaluation.decision,
    risk: evaluation.risk,
    privacyBudget: evaluation.privacyBudget,
    summary: "The destructive request was stopped before the fake company system was called.",
  };
}
