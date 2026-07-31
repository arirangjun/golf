import { NextRequest } from "next/server";
import { requireMember } from "@/lib/auth";
import { apiErrorResponse, parseDateInput, formatDate, getWeekRange } from "@/lib/utils";
import { getSlotsForWeek } from "@/lib/reservation-service";

export async function GET(request: NextRequest) {
  try {
    const session = await requireMember();
    const weekStartStr = request.nextUrl.searchParams.get("weekStart");

    const weekStart = weekStartStr
      ? parseDateInput(weekStartStr)
      : getWeekRange(new Date()).start;

    const days = await getSlotsForWeek(weekStart, session.id);

    return Response.json({
      weekStart: formatDate(getWeekRange(weekStart).start),
      weekEnd: formatDate(getWeekRange(weekStart).end),
      days,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
