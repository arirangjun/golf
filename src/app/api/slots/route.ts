import { NextRequest } from "next/server";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import { apiErrorResponse, parseDateInput } from "@/lib/utils";
import { getSlotsForDate } from "@/lib/reservation-service";

export async function GET(request: NextRequest) {
  try {
    const session = await requireMember();
    const dateStr = request.nextUrl.searchParams.get("date");
    if (!dateStr) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "date 파라미터가 필요합니다." } },
        { status: 400 }
      );
    }

    const date = parseDateInput(dateStr);
    const slots = await getSlotsForDate(date, session.id);

    return Response.json({ date: dateStr, slots });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
