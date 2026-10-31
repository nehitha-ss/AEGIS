"use client";
import { useCallback, useEffect, useState } from "react";
import { ReadOnlyIntegrationDemo } from "@/components/integration-demo";
type App = { id: string; name: string; last_seen: string | null };
type FlowResponse = {
  connected: boolean;
  received_events: number;
  flows: Flow[];
};
type Flow = {
  id: string;
  received: string;
  events: {
    phase: string;
    event_id: string;
    outcome: string;
    caller: string;
    helper: string;
    resource: string;
    caller_tenant: string;
    resource_tenant: string;
  }[];
  analysis: {
    verdict: string;
    risk: number | null;
    explanation: string;
    findings: { id: string; explanation: string; evidence: string[] }[];
    checks: { id: string; matched: boolean | null; evidence_event: string }[];
  };
};
export function IntegrationsView() {
  const [demo, setDemo] = useState(false);
  const [apps, setApps] = useState<App[]>([]),
    [selected, setSelected] = useState("");
  const [signedIn, setSignedIn] = useState(false),
    [key, setKey] = useState(""),
    [name, setName] = useState("Northstar Finance");
  const [message, setMessage] = useState(""),
    [issued, setIssued] = useState<{
      id: string;
      connection_key: string;
    } | null>(null);
  const [data, setData] = useState<FlowResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const api = useCallback(
    async <T,>(path: string, body?: object): Promise<T> => {
      const response = await fetch(`/api/integrations/${path}`, {
        method: body ? "POST" : "GET",
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
      });
      const result = (await response.json()) as T & { error?: string };
      if (!response.ok) {
        if (response.status === 401) {
          setSignedIn(false);
          setData(null);
          setApps([]);
        }
        throw new Error(result.error || "Request failed");
      }
      return result;
    },
    [],
  );
  const refresh = useCallback(async () => {
    if (demo) return;
    try {
      const result = await api<{ applications: App[] }>("apps");
      setApps(result.applications);
      setSignedIn(true);
      if (selected) setData(await api<FlowResponse>(`apps/${selected}/flows`));
      setMessage("");
    } catch (error) {
      setData(null);
      setMessage(
        (error as Error).message === "Owner sign-in required"
          ? ""
          : (error as Error).message,
      );
    }
  }, [api, selected, demo]);
  useEffect(() => {
    const initial = setTimeout(() => void refresh(), 0);
    const timer = setInterval(() => void refresh(), 10000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [refresh]);
  async function login(event: React.FormEvent) {
    event.preventDefault();
    if (key.trim() === "stuportal123") {
      setKey("");
      setMessage("");
      setDemo(true);
      return;
    }
    setBusy(true);
    try {
      await api("login", { key });
      setKey("");
      await refresh();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function register(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const result = await api<{ id: string; connection_key: string }>("apps", {
        name,
      });
      setIssued(result);
      setSelected(result.id);
      await refresh();
    } catch (error) {
      setMessage((error as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const input =
    "mt-2 w-full rounded-lg border border-slate-500/30 bg-transparent p-3 text-sm";
  const card = "rounded-xl border border-border bg-card p-5";
  if (demo)
    return (
      <ReadOnlyIntegrationDemo
        onExit={() => {
          setDemo(false);
          setMessage("");
        }}
      />
    );
  return (
    <section className="text-slate-300">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs tracking-widest text-[#a7f4d3]">
            PYTHON FASTAPI CONNECTOR
          </p>
          <h1 className="mt-2 text-3xl font-semibold">Integrations</h1>
          <p className="mt-3 max-w-3xl text-sm text-slate-400">
            Explore a read-only fictional integration, or use a private owner
            key to manage connected applications and inspect their received
            evidence.
          </p>
        </div>
        {signedIn && (
          <button
            className="rounded-lg border border-slate-500/30 px-4 py-2"
            onClick={async () => {
              try {
                await api("logout", {});
                setSignedIn(false);
                setData(null);
                setApps([]);
                setIssued(null);
              } catch (e) {
                setMessage((e as Error).message);
              }
            }}
          >
            Sign out
          </button>
        )}
      </div>
      <div className="my-5 rounded-xl border border-amber-400/20 bg-amber-400/5 p-4 text-sm">
        Monitoring mode · Findings do not block requests. Northstar’s corrected
        helper enforces authorisation server-side. All finance data is
        fictional.
      </div>
      {message && (
        <p role="status" className="mb-4 text-sm text-amber-200">
          {message}
        </p>
      )}
      {!signedIn ? (
        <form className={`${card} max-w-lg`} onSubmit={login}>
          <h2 className="font-semibold">Open an integration</h2>
          <label className="mt-4 block text-sm">
            Access key
            <input
              className={input}
              value={key}
              onChange={(e) => setKey(e.target.value)}
              type="password"
              placeholder="Enter demo code or private owner key"
              autoComplete="off"
              required
            />
          </label>
          <button
            disabled={busy}
            className="mt-4 rounded-lg bg-emerald-300 px-5 py-2 text-slate-950"
          >
            Unlock integrations
          </button>
          <p className="mt-3 text-xs text-slate-400">
            Shared read-only demo code:{" "}
            <code className="text-[#a7f4d3]">stuportal123</code>. Private owner
            keys unlock registration and protected received events.
          </p>
          <button
            type="button"
            className="mt-4 text-sm text-[#a7f4d3] underline"
            onClick={() => {
              setMessage("");
              setDemo(true);
            }}
          >
            Open read-only demo →
          </button>
        </form>
      ) : (
        <>
          <div className="grid gap-5 lg:grid-cols-2">
            <form className={card} onSubmit={register}>
              <h2 className="font-semibold">Register an application</h2>
              <label className="mt-3 block text-sm">
                Application name
                <input
                  className={input}
                  value={name}
                  maxLength={80}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </label>
              <button
                disabled={busy}
                className="mt-4 rounded-lg bg-emerald-300 px-5 py-2 text-slate-950"
              >
                Generate connection credentials
              </button>
            </form>
            <div className={card}>
              <label className="text-sm">
                Application
                <select
                  className={input}
                  value={selected}
                  onChange={(e) => {
                    setData(null);
                    setSelected(e.target.value);
                  }}
                >
                  <option value="">Select an application</option>
                  {apps.map((app) => (
                    <option key={app.id} value={app.id}>
                      {app.name}
                    </option>
                  ))}
                </select>
              </label>
              <p className="mt-4 text-sm">
                {data
                  ? data.connected
                    ? "Recently received authenticated events"
                    : "No recent events — idle or disconnected"
                  : "Select an application to inspect received evidence"}
              </p>
              <p className="mt-2 text-xs text-slate-400">
                Status is based on events received in the last two minutes; it
                is not a continuous heartbeat.
              </p>
            </div>
          </div>
          {issued && (
            <div className={`${card} mt-5`}>
              <h2>Connection key — shown once</h2>
              <p className="my-2 text-sm">
                Copy these values into Northstar’s server environment. Do not
                place them in browser code.
              </p>
              <pre className="overflow-x-auto text-xs">
                AEGIS_APP_ID={issued.id}
                {"\n"}AEGIS_CONNECTION_KEY={issued.connection_key}
              </pre>
              <button
                className="mt-3 underline"
                onClick={() => setIssued(null)}
              >
                Dismiss secret
              </button>
            </div>
          )}
          {data && (
            <>
              <div className="my-5 grid gap-4 sm:grid-cols-3">
                {[
                  ["Received events", data.received_events],
                  ["Correlated flows (latest 100)", data.flows.length],
                  [
                    "Highest integration risk",
                    data.flows.reduce<number | null>(
                      (n, f) =>
                        f.analysis.risk === null
                          ? n
                          : Math.max(n ?? 0, f.analysis.risk),
                      null,
                    ) ?? "Unknown",
                  ],
                ].map(([label, value]) => (
                  <div key={label} className={card}>
                    <p className="text-xs text-slate-400">{label}</p>
                    <p className="mt-2 text-3xl">{value}</p>
                  </div>
                ))}
              </div>
              <p className="mb-4 text-xs text-slate-400">
                RECEIVED EVENTS · No sample records are inserted. Existing
                agent-gateway risk results remain in Control room.
              </p>
              {!data.flows.length && (
                <div className={card}>
                  No events received. Configure Northstar’s connector and run a
                  request.
                </div>
              )}
              {data.flows.map((flow) => (
                <details key={flow.id} className={`${card} mb-4`}>
                  <summary className="cursor-pointer">
                    <span className="font-medium">
                      {flow.analysis.verdict.replaceAll("_", " ")}
                    </span>
                    <span className="ml-4 text-sm">
                      Risk {flow.analysis.risk ?? "unknown"}
                      {flow.analysis.risk !== null ? "/100" : ""}
                    </span>
                    <p className="mt-2 break-all font-mono text-xs text-slate-400">
                      {flow.id} · Received{" "}
                      {new Date(flow.received).toLocaleString()}
                    </p>
                  </summary>
                  <p className="my-4 text-sm">{flow.analysis.explanation}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr>
                          <th>Stage</th>
                          <th>Outcome</th>
                          <th>Evidence event</th>
                        </tr>
                      </thead>
                      <tbody>
                        {flow.events.map((event) => (
                          <tr key={event.event_id}>
                            <td className="py-2">{event.phase}</td>
                            <td>{event.outcome}</td>
                            <td className="font-mono">{event.event_id}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {flow.events[0] && (
                    <p className="my-3 break-all font-mono text-xs">
                      Caller {flow.events[0].caller} → Helper{" "}
                      {flow.events[0].helper} → Resource{" "}
                      {flow.events[0].resource}
                      <br />
                      Caller tenant {flow.events[0].caller_tenant} · Resource
                      tenant {flow.events[0].resource_tenant}
                    </p>
                  )}
                  <ul className="my-4 space-y-2 text-sm">
                    {flow.analysis.checks.map((check) => (
                      <li key={check.id}>
                        {check.matched === null
                          ? "Unknown"
                          : check.matched
                            ? "Matched"
                            : "Not matched"}{" "}
                        · {check.id}
                      </li>
                    ))}
                  </ul>
                  {flow.analysis.findings.map((finding) => (
                    <div
                      key={finding.id}
                      className="mt-3 rounded-lg border border-rose-400/20 bg-rose-400/5 p-3"
                    >
                      <p className="text-sm font-semibold text-rose-200">
                        {finding.id}
                      </p>
                      <p className="mt-2 text-sm">{finding.explanation}</p>
                      <p className="mt-2 break-all font-mono text-xs text-slate-400">
                        Evidence: {finding.evidence.join(", ")}
                      </p>
                    </div>
                  ))}
                </details>
              ))}
            </>
          )}
        </>
      )}
    </section>
  );
}
