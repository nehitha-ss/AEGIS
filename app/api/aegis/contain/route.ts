import { containGatewaySession, isGatewayActor } from "@/lib/aegis-runtime";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => undefined);
  const actor = body && typeof body === "object" && "actor" in body
    ? (body as { actor?: unknown }).actor
    : "demo-agent";

  if (!isGatewayActor(actor)) {
    return Response.json({ error: "Unknown AEGIS actor." }, { status: 400 });
  }

  return Response.json(containGatewaySession(actor), {
    headers: { "Cache-Control": "no-store" },
  });
}
