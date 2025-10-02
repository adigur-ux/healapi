import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    // Accept any JSON body and respond 200 for testing callbacks
    await request.json().catch(() => ({}));
    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || "error" }, { status: 400 });
  }
}


