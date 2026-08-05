import { NextResponse } from "next/server";

/** Railway healthcheck — FastAPI와 독립적으로 응답 */
export async function GET() {
  return NextResponse.json({ ok: true });
}
