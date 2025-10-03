import { NextResponse } from "next/server";

type CallbackRecord = {
  request_id: string;
  result: unknown;
  status?: string;
};

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

// Naive in-memory store (per server instance) for callback results
const memoryStore = globalThis as unknown as {
  __zapCallbackStore?: Record<string, CallbackRecord>;
};
if (!memoryStore.__zapCallbackStore) memoryStore.__zapCallbackStore = {};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({} as any));
    console.log("/api/zap/callback received:", JSON.stringify(payload, null, 2));

    const requestId = (payload?.request_id ?? "").toString();

    // Normalize result: if it's a JSON-looking string, parse safely; otherwise keep as is
    const rawResult = payload?.result as unknown;
    let normalizedResult: unknown = rawResult;
    if (typeof rawResult === "string") {
      const trimmed = rawResult.trim();
      const looksJson = (trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"));
      if (looksJson) {
        try {
          normalizedResult = JSON.parse(trimmed);
        } catch {
          normalizedResult = rawResult; // keep string if parsing fails
        }
      } else {
        normalizedResult = rawResult;
      }
    }

    const record: CallbackRecord | null = requestId
      ? {
          request_id: requestId,
          result: normalizedResult,
          status: typeof payload?.status === "string" ? payload.status : (payload?.status as any) ?? "received",
        }
      : null;

    if (record) {
      memoryStore.__zapCallbackStore![requestId] = record;
    }

    return NextResponse.json({ ok: true }, { status: 200, headers: CORS_HEADERS });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "error" }, { status: 400, headers: CORS_HEADERS });
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const requestId = (url.searchParams.get("request_id") || "").toString();
  if (!requestId) {
    return NextResponse.json({ error: "request_id required" }, { status: 400, headers: CORS_HEADERS });
  }
  const record = memoryStore.__zapCallbackStore?.[requestId];
  if (!record) {
    return NextResponse.json({ pending: true }, { status: 404, headers: CORS_HEADERS });
  }
  return NextResponse.json(record, { status: 200, headers: CORS_HEADERS });
}





