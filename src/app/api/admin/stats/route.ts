import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiErrorResponse, parseDateInput } from "@/lib/utils";
import { getReservationStats } from "@/lib/reservation-service";
import { subDays } from "date-fns";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const fromStr = request.nextUrl.searchParams.get("from");
    const toStr = request.nextUrl.searchParams.get("to");

    const to = toStr ? parseDateInput(toStr) : new Date();
    const from = fromStr ? parseDateInput(fromStr) : subDays(to, 30);

    const stats = await getReservationStats(from, to);
    return Response.json(stats);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
