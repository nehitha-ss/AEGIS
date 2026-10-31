"use client";
import { useState } from "react";
import { evaluateDelegatedAccess } from "@/lib/delegated-policy.mjs";
import { financeDemoLink } from "@/lib/finance-link";

const examples = [
  {
    name: "Normal access",
    description: "Alex views Alex’s own statement.",
    allowed: true,
    own: true,
    unsafe: false,
    crossTenant: false,
  },
  {
    name: "Direct denial",
    description: "Alex requests Jamie’s statement and is denied.",
    allowed: false,
    own: false,
    unsafe: false,
    crossTenant: false,
  },
  {
    name: "Confused deputy",
    description:
      "The broad helper retrieves Jamie’s statement without checking Alex’s rights.",
    allowed: true,
    own: false,
    unsafe: true,
    crossTenant: false,
  },
  {
    name: "Cross-tenant access",
    description:
      "The broad helper reaches a statement in another fictional organisation.",
    allowed: true,
    own: false,
    unsafe: true,
    crossTenant: true,
  },
  {
    name: "Corrected helper",
    description:
      "Ownership, tenant and action checks deny the same cross-tenant request.",
    allowed: false,
    own: false,
    unsafe: false,
    crossTenant: true,
  },
];

function sampleAnalysis(example: (typeof examples)[number]) {
  return evaluateDelegatedAccess(
    ["customer", "helper", "resource"].map((phase) => ({
      phase,
      event_id: `sample-${phase}`,
      caller: "sample-customer-alex",
      helper: "sample-statement-helper",
      resource: example.own
        ? "sample-alex-statement"
        : "sample-other-statement",
      caller_tenant: "sample-northstar",
      resource_tenant: example.crossTenant
        ? "sample-aurora"
        : "sample-northstar",
      action: "statement.read",
      outcome: example.allowed ? "allowed" : "denied",
      evidence: {
        caller_authorized: example.own,
        helper_authorized: true,
        helper_uses_own_identity: true,
        original_caller_checked: !example.unsafe,
        caller_context_propagated: !example.unsafe,
        caller_controls_resource: true,
        resource_trusts_helper_only: example.unsafe,
      },
    })),
  );
}

export function ReadOnlyIntegrationDemo({ onExit }: { onExit: () => void }) {
  const [framework, setFramework] = useState("");
  const [selected, setSelected] = useState(0);
  const correct = framework === "fastapi";
  const example = examples[selected];
  const analysis = sampleAnalysis(example);
  const card = "rounded-xl border border-border bg-card p-5";
  return (
    <section className="text-slate-300">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs tracking-widest text-[#a7f4d3]">
            CONNECT AN APPLICATION
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Integrations</h1>
          <p className="mt-3 text-sm text-slate-400">
            Explore how the Python connector reports delegated access from
            Northstar Finance.
          </p>
        </div>
        <button
          onClick={onExit}
          className="rounded-lg border border-border px-4 py-2 text-sm"
        >
          Exit demo
        </button>
      </div>
      <p
        role="status"
        className="my-5 rounded-lg border border-emerald-300/20 bg-emerald-300/5 p-4 text-sm text-emerald-100"
      >
        {!framework
          ? "Read-only demo unlocked. Now select your backend framework."
          : correct
            ? "Correct connector. Open the read-only demo integration below."
            : "Northstar Finance uses Python — FastAPI. Select that connector to open this demo."}
      </p>
      <div className={card}>
        <label className="text-sm font-semibold" htmlFor="unlocked-demo-code">
          Access key
        </label>
        <div className="mt-2 flex flex-wrap gap-3">
          <input
            id="unlocked-demo-code"
            className="min-w-0 flex-1 rounded-lg border border-border bg-transparent p-3"
            value="stuportal123"
            disabled
          />
          <span className="rounded-lg bg-emerald-300 px-4 py-3 text-sm font-medium text-slate-950">
            Demo unlocked
          </span>
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Shared read-only demo code: <code>stuportal123</code>. This code opens
          sample data only; it does not grant owner access.
        </p>
      </div>
      <fieldset className={`${card} mt-5`}>
        <legend className="px-2 text-sm font-semibold">
          Select your backend framework
        </legend>
        <div className="space-y-3">
          {[
            ["fastapi", "Python — FastAPI"],
            ["spring", "Java — Spring Boot"],
            ["express", "Node.js — Express"],
          ].map(([value, label]) => (
            <label
              key={value}
              className={`flex cursor-pointer items-center gap-3 rounded-lg border p-4 text-sm font-medium ${framework === value ? "border-emerald-300/50 bg-emerald-300/5" : "border-border"}`}
            >
              <input
                type="radio"
                name="backend-framework"
                value={value}
                checked={framework === value}
                onChange={() => setFramework(value)}
              />
              {label}
            </label>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-400">
          Only the Python — FastAPI connector is implemented. Other choices
          explain the framework match.
        </p>
      </fieldset>
      {correct && (
        <div className="mt-6">
          <div className={`${card} mb-6 border-emerald-300/20`}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs tracking-widest text-[#a7f4d3]">
                  PYTHON — FASTAPI
                </p>
                <h2 className="mt-2 text-lg font-semibold">
                  Northstar Finance
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  Open the finance website to view fictional accounts,
                  statements and simulated transfers.
                </p>
              </div>
              <a
                href={financeDemoLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-emerald-300 px-5 py-3 text-sm font-semibold text-slate-950 hover:bg-emerald-200 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-emerald-300"
              >
                Open Northstar Finance <span aria-hidden="true">↗</span>
              </a>
            </div>
            <p className="mt-3 text-xs text-slate-400">
              Opens the shared fictional customer demo directly in a new tab. No
              password needed. Owner access stays protected.
            </p>
          </div>
          <h2 className="mb-3 text-lg font-semibold">Demo integration</h2>
          <details className={card}>
            <summary className="cursor-pointer">
              <span className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  <strong className="block text-base">Northstar Finance</strong>
                  <span className="mt-1 block text-xs text-slate-400">
                    Python — FastAPI connector · Fictional application
                  </span>
                </span>
                <span className="rounded-full bg-emerald-300/10 px-3 py-1 text-xs text-emerald-100">
                  Sample · read only
                </span>
              </span>
            </summary>
            <div className="mt-5 border-t border-border pt-5">
              <p className="text-sm text-slate-400">
                This is an illustrative sample of the integration. These records
                are not live received events and no connection is established by
                opening this card.
              </p>
              <div className="my-5 grid gap-3 sm:grid-cols-3">
                {[
                  ["Sample scenarios", "5"],
                  ["Illustrative stage records", "15"],
                  ["Sample highest risk", "98/100"],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="rounded-lg border border-border p-4"
                  >
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="mt-2 text-2xl font-semibold">{value}</p>
                  </div>
                ))}
              </div>
              <label className="text-sm font-medium" htmlFor="sample-scenario">
                Explore a sample scenario
              </label>
              <select
                id="sample-scenario"
                className="mt-2 w-full rounded-lg border border-border bg-card p-3"
                value={selected}
                onChange={(e) => setSelected(Number(e.target.value))}
              >
                {examples.map((item, index) => (
                  <option key={item.name} value={index}>
                    {item.name}
                  </option>
                ))}
              </select>
              <div className="mt-4 rounded-lg border border-border p-4">
                <p className="text-xs tracking-widest text-slate-400">
                  SAMPLE ANALYSIS · NOT LIVE EVIDENCE
                </p>
                <p className="mt-3 font-semibold">
                  {analysis.verdict.replaceAll("_", " ")} · Risk {analysis.risk}
                  /100
                </p>
                <p className="mt-2 text-sm">{example.description}</p>
                <p className="mt-3 text-xs text-slate-400">
                  Illustrative path: Customer → Statement helper → Statement
                  resource.
                </p>
                <ul className="mt-3 space-y-2 text-sm">
                  {analysis.findings.map((finding) => (
                    <li key={finding.id}>
                      <strong>{finding.id.replaceAll("_", " ")}</strong>
                      <p className="mt-1 text-xs text-slate-400">
                        {finding.explanation}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
              <p className="mt-4 text-xs text-slate-400">
                Monitoring does not prevent access. The corrected helper
                enforces authorisation in Northstar. Real received events and
                owner-only test runs stay behind private owner sign-in.
              </p>
              <div className="mt-5 flex flex-wrap gap-4 text-sm">
                <a
                  href={financeDemoLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#a7f4d3] underline"
                >
                  Open Northstar Finance →
                </a>
                <button onClick={onExit} className="underline">
                  Use private owner access →
                </button>
              </div>
            </div>
          </details>
        </div>
      )}
    </section>
  );
}
