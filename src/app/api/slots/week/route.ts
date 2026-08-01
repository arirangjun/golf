import { NextRequest } from "next/server";
import { requireMember } from "@/lib/auth";
import { apiErrorResponse, parseDateInput, formatDate, getWeekRange, getCurrentlyBookableWeekRange, getNextBookingOpenTime, formatBookingWindowMessage } from "@/lib/utils";
import { getSlotsForWeek } from "@/lib/reservation-service";

export async function GET(request: NextRequest) {
  try {
    const session = await requireMember();
    const weekStartStr = request.nextUrl.searchParams.get("weekStart");

    const weekStart = weekStartStr
      ? parseDateInput(weekStartStr)
      : getCurrentlyBookableWeekRange()?.start ?? getWeekRange(new Date()).start;

    const days = await getSlotsForWeek(weekStart, session.id);
    const bookableRange = getCurrentlyBookableWeekRange();
    const nextOpen = getNextBookingOpenTime();

    return Response.json({
      weekStart: formatDate(getWeekRange(weekStart).start),
      weekEnd: formatDate(getWeekRange(weekStart).end),
      bookableWeekStart: bookableRange ? formatDate(bookableRange.start) : null,
      bookableWeekEnd: bookableRange ? formatDate(bookableRange.end) : null,
      nextBookingOpenAt: nextOpen.toISOString(),
      bookingWindowMessage: formatBookingWindowMessage(),
      days,
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
