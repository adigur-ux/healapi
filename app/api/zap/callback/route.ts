import { NextResponse } from "next/server";

// Naive in-memory store (per server instance) for callback results
const memoryStore = globalThis as unknown as {
  __zapCallbackStore?: Record<string, any>;
};
if (!memoryStore.__zapCallbackStore) memoryStore.__zapCallbackStore = {};

export async function POST(request: Request) {
  try {
    // Echo back whatever Zapier sent and log it for verification
    const payload = await request.json().catch(() => ({}));
    console.log("/api/zap/callback received:", JSON.stringify(payload, null, 2));
    // Try to persist by request_id or attempt if present
    const requestId = (payload?.request_id || payload?.attempt || payload?.id || "").toString();
    // Normalize: if payload.result is a JSON string, parse and lift fixed_curl
    let normalized: any = payload;
    try {
      if (payload && typeof payload.result === "string") {
        const rStr = (payload.result as string).trim();
        try {
          const r = JSON.parse(rStr);
          if (r && typeof r === "object") {
            normalized = { ...payload, result: r };
            if (!normalized.fixed_curl && (r.fixed_curl || r.curl)) {
              normalized.fixed_curl = r.fixed_curl || r.curl;
            }
          }
        } catch {
          if (rStr.startsWith("curl")) {
            normalized = { ...payload, result: { fixed_curl: rStr } };
            normalized.fixed_curl = rStr;
          } else {
            const match = rStr.match(/\"fixed_curl\"\s*:\s*\"([^\"]+)/);
            if (match && match[1]) {
              normalized = { ...payload, result: { fixed_curl: match[1] } };
              normalized.fixed_curl = match[1];
            }
          }
        }
      } else if (payload && typeof payload.result === "object" && payload.result) {
        const r = payload.result as any;
        if (!payload.fixed_curl && (r.fixed_curl || r.curl)) {
          normalized = { ...payload, fixed_curl: r.fixed_curl || r.curl };
        }
      }
    } catch {}
    if (requestId) {
      memoryStore.__zapCallbackStore![requestId] = normalized;
    }
    return NextResponse.json(normalized, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "error" }, { status: 400 });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestId = (url.searchParams.get("request_id") || url.searchParams.get("id") || "").toString();
  if (!requestId) {
    return NextResponse.json({ error: "request_id required" }, { status: 400 });
  }
  const payload = memoryStore.__zapCallbackStore?.[requestId];
  if (!payload) {
    return NextResponse.json({ found: false }, { status: 200 });
  }
  return NextResponse.json({ found: true, payload }, { status: 200 });
}






