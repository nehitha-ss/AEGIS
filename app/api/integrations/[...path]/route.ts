// Same-origin owner API bridge. Connector ingestion is a separate server-only service.
import { expectedBrowserOrigin } from "@/lib/server-origin";
export const dynamic = "force-dynamic";
async function proxy(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  if (!path.every((segment) => /^[a-zA-Z0-9-]+$/.test(segment)))
    return Response.json({ error: "Invalid route" }, { status: 400 });
  if (
    request.method !== "GET" &&
    request.headers.get("origin") !== expectedBrowserOrigin(request)
  )
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  const route = path.join("/");
  if (!/^(login|logout|apps|apps\/[a-f0-9-]+\/flows)$/.test(route))
    return Response.json({ error: "Not found" }, { status: 404 });
  try {
    const backend =
      process.env.AEGIS_INTEGRATION_URL || "http://127.0.0.1:8001";
    const payload = request.method === "GET" ? undefined : await request.text();
    if (payload && payload.length > 32768)
      return Response.json({ error: "Request too large" }, { status: 413 });
    const response = await fetch(`${backend}/owner/${route}`, {
      method: request.method,
      headers: {
        "Content-Type": "application/json",
        Cookie: request.headers.get("cookie") || "",
        Origin: request.headers.get("origin") || "",
      },
      body: payload,
      signal: AbortSignal.timeout(5000),
      redirect: "manual",
    });
    if (response.status >= 300 && response.status < 400)
      return Response.json(
        { error: "Unexpected backend redirect" },
        { status: 503 },
      );
    const headers = new Headers({
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    });
    const cookie = response.headers.get("set-cookie");
    if (cookie) headers.set("Set-Cookie", cookie);
    return new Response(await response.text(), {
      status: response.status,
      headers,
    });
  } catch (error) {
    console.error(
      "Integration bridge:",
      error instanceof Error ? error.message : "unavailable",
    );
    return Response.json(
      {
        error:
          "Integration backend unavailable; no live connection is claimed.",
      },
      { status: 503 },
    );
  }
}
export const GET = proxy;
export const POST = proxy;
