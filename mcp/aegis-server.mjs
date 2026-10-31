#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// This server is the only tool surface intended for a local Codex demo.
// It has no database credential and no direct company-system client.
const gatewayUrl = process.env.AEGIS_GATEWAY_URL ?? "http://[::1]:5173";

async function evaluateWithAegis(scenario, parameters = {}) {
  const response = await fetch(`${gatewayUrl}/api/aegis/requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ scenario, actor: "mcp-client", ...parameters }),
  });

  if (!response.ok) {
    throw new Error(`AEGIS gateway unavailable or rejected the request (${response.status}).`);
  }

  return response.json();
}

function toolResult(result) {
  const safeResult = {
    request_id: result.requestId,
    policy: result.policy,
    decision: result.decision,
    risk: result.risk,
    privacy_budget: result.privacyBudget,
    protected_source: result.protectedSource ?? null,
    summary: result.summary,
    protected_result: result.protectedResult ?? null,
  };

  return {
    content: [{ type: "text", text: JSON.stringify(safeResult, null, 2) }],
    structuredContent: safeResult,
    // This is presentation metadata only. Authorization happened above in AEGIS.
    _meta: { aegisGateway: "local-demo" },
  };
}

const server = new McpServer(
  {
    name: "aegis-agent-security",
    version: "0.1.0",
  },
  {
    instructions:
      "AEGIS protects fictional Northstar Logistics demo systems. Use the finance summary tool for reconciliation. Never expect raw employee records, credentials, or a successful destructive action.",
  },
);

server.registerTool(
  "read_finance_reconciliation_summary",
  {
    title: "Read protected finance reconciliation summary",
    description: "Use for a staging-scoped finance reconciliation summary. AEGIS returns aggregate-only data and tokenizes identities before any result reaches the agent.",
    inputSchema: {
      period: z.string().regex(/^\d{4}-\d{2}$/).optional().describe("Accounting period in YYYY-MM format. Demo data supports 2026-09."),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  async ({ period }) => toolResult(await evaluateWithAegis("payroll-summary", { period })),
);

server.registerTool(
  "search_employee_identity",
  {
    title: "Search employee identity with privacy controls",
    description: "Use only when an identity lookup is necessary for the reconciliation task. AEGIS tracks cumulative disclosure and returns a masked token or denies the request.",
    inputSchema: {
      search_hint: z.string().min(1).max(64).describe("A minimal, non-sensitive lookup hint. It is not retained by this demo server."),
    },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      openWorldHint: false,
    },
  },
  async ({ search_hint }) => toolResult(await evaluateWithAegis("employee-search", { searchHint: search_hint })),
);

server.registerTool(
  "attempt_payroll_database_deletion",
  {
    title: "Attempt payroll database deletion",
    description: "Use only to demonstrate AEGIS mutation protection. AEGIS always blocks this fictional production deletion test before the protected system is called.",
    inputSchema: {
      change_ticket: z.string().min(1).max(64).describe("A change-ticket reference. It does not grant authority."),
    },
    annotations: {
      readOnlyHint: false,
      destructiveHint: true,
      openWorldHint: false,
    },
  },
  async () => toolResult(await evaluateWithAegis("delete-payroll")),
);

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(`AEGIS MCP server connected to local gateway at ${gatewayUrl}`);
