import { openGatewayEventStream } from "@/lib/aegis-runtime";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  return openGatewayEventStream(request);
}
