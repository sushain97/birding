import { BlockList } from "node:net";
import { NextResponse, type NextRequest } from "next/server";
import config from "@/lib/config";
import {
  getCurrentTaxon,
  setCurrentTaxon,
  subscribe,
  type CurrentTaxon,
} from "@/lib/labradorite";

export const dynamic = "force-dynamic";

const PING_INTERVAL_MS = 25_000;

const allowed = new BlockList();
if (config.labradoriteAllowedCidr) {
  const [network, prefix] = config.labradoriteAllowedCidr.split("/");
  allowed.addSubnet(network, Number(prefix), "ipv4");
}

/**
 * Next fills x-forwarded-for with the socket address when it's absent, and the
 * ingress appends the real client, so only the last entry is trustworthy.
 */
function isAllowedRequest(request: NextRequest): boolean {
  const address = request.headers
    .get("x-forwarded-for")
    ?.split(",")
    .at(-1)
    ?.trim()
    .replace(/^::ffff:/i, "");
  return !!address && allowed.check(address, "ipv4");
}

export async function PUT(request: NextRequest) {
  if (!isAllowedRequest(request)) {
    return new NextResponse(null, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as {
    taxon?: unknown;
  } | null;
  const taxon = typeof body?.taxon === "string" ? body.taxon.trim() : "";
  if (!taxon) {
    return NextResponse.json({ error: "Missing taxon" }, { status: 400 });
  }

  await setCurrentTaxon(taxon);
  return new NextResponse(null, { status: 204 });
}

export async function GET(request: NextRequest) {
  const encoder = new TextEncoder();
  const initial = await getCurrentTaxon();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (chunk: string) => {
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          cleanup();
        }
      };
      const sendTaxon = (current: CurrentTaxon) =>
        send(`data: ${JSON.stringify(current)}\n\n`);

      const unsubscribe = subscribe(sendTaxon);
      const ping = setInterval(() => send(": ping\n\n"), PING_INTERVAL_MS);
      const cleanup = () => {
        unsubscribe();
        clearInterval(ping);
      };

      request.signal.addEventListener("abort", () => {
        cleanup();
        try {
          controller.close();
        } catch {
          // Already closed.
        }
      });

      sendTaxon(initial);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
