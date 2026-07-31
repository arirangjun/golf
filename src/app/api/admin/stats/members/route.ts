import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/utils";
import { getMonthlyMemberStats } from "@/lib/reservation-service";

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();

    const monthStr = request.nextUrl.searchParams.get("month");
    const now = new Date();
    const year = monthStr
      ? Number(monthStr.split("-")[0])
      : now.getFullYear();
    const month = monthStr
      ? Number(monthStr.split("-")[1])
      : now.getMonth() + 1;

    if (!year || !month || month < 1 || month > 12) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "month 형식은 YYYY-MM 입니다." } },
        { status: 400 }
      );
    }

    const stats = await getMonthlyMemberStats(year, month);
    return Response.json(stats);
  } catch (error) {
    return apiErrorResponse(error);
  }
}
