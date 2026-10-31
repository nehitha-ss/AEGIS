import { isGatewayActor, isGatewayScenario, runGatewayScenario } from "@/lib/aegis-runtime";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => undefined);
  const scenario = body && typeof body === "object" && "scenario" in body
    ? (body as { scenario?: unknown }).scenario
    : undefined;
  const actor = body && typeof body === "object" && "actor" in body
    ? (body as { actor?: unknown }).actor
    : "demo-agent";
  const period = body && typeof body === "object" && "period" in body
    ? (body as { period?: unknown }).period
    : undefined;
  const searchHint = body && typeof body === "object" && "searchHint" in body
    ? (body as { searchHint?: unknown }).searchHint
    : undefined;

  if (
    !isGatewayScenario(scenario)
    || !isGatewayActor(actor)
    || (period !== undefined && (typeof period !== "string" || !/^\d{4}-\d{2}$/.test(period)))
    || (searchHint !== undefined && (typeof searchHint !== "string" || searchHint.length < 1 || searchHint.length > 64))
  ) {
    return Response.json(
      { error: "Only declared AEGIS demo tools may be requested." },
      { status: 400 },
    );
  }

  try {
    const result = await runGatewayScenario(scenario, actor, {
      period: typeof period === "string" ? period : undefined,
      searchHint: typeof searchHint === "string" ? searchHint : undefined,
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json(
      { error: "Protected source unavailable. No data was released." },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
