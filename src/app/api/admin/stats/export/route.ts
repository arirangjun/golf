import { NextRequest } from "next/server";
import { subDays } from "date-fns";
import { requireAdmin } from "@/lib/auth";
import { apiErrorResponse, parseDateInput, formatDate } from "@/lib/utils";
import {
  getReservationStats,
  getMonthlyMemberStats,
} from "@/lib/reservation-service";
import { buildStatsExportBuffer, excelResponse } from "@/lib/excel";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const fromStr = request.nextUrl.searchParams.get("from");
    const toStr = request.nextUrl.searchParams.get("to");
    const monthStr = request.nextUrl.searchParams.get("month");

    const to = toStr ? parseDateInput(toStr) : new Date();
    const from = fromStr ? parseDateInput(fromStr) : subDays(to, 30);

    const stats = await getReservationStats(from, to);

    let memberStats;
    if (monthStr) {
      const year = Number(monthStr.split("-")[0]);
      const month = Number(monthStr.split("-")[1]);
      if (year && month >= 1 && month <= 12) {
        memberStats = await getMonthlyMemberStats(year, month);
      }
    }

    const buffer = buildStatsExportBuffer({
      from: formatDate(from),
      to: formatDate(to),
      month: monthStr ?? undefined,
      total: stats.total,
      daily: stats.daily,
      weekly: stats.weekly,
      monthly: stats.monthly,
      hourlyUtilization: stats.hourlyUtilization,
      memberStats,
    });

    const filename = monthStr
      ? `stats-${monthStr}.xlsx`
      : `stats-${formatDate(from)}_${formatDate(to)}.xlsx`;

    return excelResponse(buffer, filename);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
