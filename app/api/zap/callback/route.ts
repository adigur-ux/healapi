import { NextResponse } from "next/server";

type CallbackRecord = {
  request_id: string;
  fixed_curl: string | null;
  result: unknown;
  original: unknown;
  status: string;
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
    const payloadUnknown = await request.json().catch(() => ({}));
    const payload = payloadUnknown as Record<string, unknown>;
    console.log("/api/zap/callback received:", JSON.stringify(payload, null, 2));

    const requestId = String((payload["request_id"] ?? payload["attempt"] ?? payload["id"]) ?? "");

    // Normalize result: if it's a JSON-looking string, parse safely; otherwise keep as is
    const rawResult = payload["result"] as unknown;
    let parsedResult: unknown = rawResult;
    if (typeof rawResult === "string") {
      const trimmed = rawResult.trim();
      const looksJson = (trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"));
      if (looksJson) {
        try {
          parsedResult = JSON.parse(trimmed);
        } catch {
          parsedResult = rawResult; // keep string if parsing fails
        }
      } else {
        parsedResult = rawResult;
      }
    }

    // Extract fixed_curl from payload or parsed result if present
    let fixedCurl: string | null = null;
    if (typeof payload["fixed_curl"] === "string" && (payload["fixed_curl"] as string).trim().length > 0) {
      fixedCurl = (payload["fixed_curl"] as string).trim();
    } else if (parsedResult && typeof parsedResult === "object") {
      const resultObj = parsedResult as Record<string, unknown>;
      if (typeof resultObj["fixed_curl"] === "string" && (resultObj["fixed_curl"] as string).trim().length > 0) {
        fixedCurl = (resultObj["fixed_curl"] as string).trim();
      }
    }

    const status = typeof payload["status"] === "string" && (payload["status"] as string).trim().length > 0
      ? (payload["status"] as string)
      : "completed";

    const record: CallbackRecord | null = requestId
      ? {
          request_id: requestId,
          fixed_curl: fixedCurl,
          result: parsedResult,
          original: payload,
          status,
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
    return NextResponse.json({ found: false, pending: true }, { status: 404, headers: CORS_HEADERS });
  }
  return NextResponse.json(
    {
      found: true,
      request_id: record.request_id,
      payload: {
        fixed_curl: record.fixed_curl,
        result: record.result,
        status: record.status,
      },
    },
    { status: 200, headers: CORS_HEADERS }
  );
}


