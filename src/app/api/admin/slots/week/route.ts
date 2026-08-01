import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiErrorResponse, parseDateInput, formatDate, getWeekRange } from "@/lib/utils";
import { getSlotsForWeek } from "@/lib/reservation-service";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const weekStartStr = request.nextUrl.searchParams.get("weekStart");

    const weekStart = weekStartStr
      ? parseDateInput(weekStartStr)
      : getWeekRange(new Date()).start;

    const days = await getSlotsForWeek(weekStart, undefined, { adminView: true });

    return Response.json({
      weekStart: formatDate(getWeekRange(weekStart).start),
      weekEnd: formatDate(getWeekRange(weekStart).end),
      days,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
