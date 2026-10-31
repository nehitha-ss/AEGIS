import { analyzePrototypeInput } from "@/lib/deputy-rule.mjs";
import { expectedBrowserOrigin } from "@/lib/server-origin";
export const dynamic = "force-dynamic";
export async function POST(request: Request) {
  try {
    if (
      request.headers.get("origin") &&
      request.headers.get("origin") !== expectedBrowserOrigin(request)
    )
      return Response.json({ error: "Invalid origin" }, { status: 403 });
    const text = await request.text();
    if (text.length > 32768)
      return Response.json({ error: "Request too large" }, { status: 413 });
    return Response.json(analyzePrototypeInput(JSON.parse(text)), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return Response.json(
      {
        error:
          error instanceof Error ? error.message : "Invalid analysis input",
      },
      { status: 400 },
    );
  }
}
