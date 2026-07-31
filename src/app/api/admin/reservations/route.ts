import { NextRequest } from "next/server";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
  apiErrorResponse,
  parseDateInput,
  formatDate,
  formatHour,
  formatMemberDisplay,
  canCancelReservation,
} from "@/lib/utils";
import {
  getAllReservations,
  createReservation,
  cancelReservation,
} from "@/lib/reservation-service";

const createSchema = z.object({
  userId: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startHour: z.number().int().min(0).max(23),
});

export async function GET(request: NextRequest) {
  try {
    await requireAdmin();
    const fromStr = request.nextUrl.searchParams.get("from");
    const toStr = request.nextUrl.searchParams.get("to");

    const from = fromStr ? parseDateInput(fromStr) : undefined;
    const to = toStr ? parseDateInput(toStr) : undefined;

    const reservations = await getAllReservations(from, to);

    return Response.json({
      reservations: reservations.map((r) => ({
        id: r.id,
        date: formatDate(r.date),
        startHour: r.startHour,
        endHour: r.endHour,
        isSameDayBooking: r.isSameDayBooking,
        timeLabel: `${formatHour(r.startHour)} - ${formatHour(r.endHour)}`,
        canCancel: canCancelReservation(r.date, r.startHour),
        user: {
          id: r.user.id,
          name: r.user.name,
          email: r.user.email,
          dong: r.user.dong,
          displayName: formatMemberDisplay(r.user.dong, r.user.name),
        },
      })),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();
    const body = await request.json();
    const { userId, date, startHour } = createSchema.parse(body);

    const result = await createReservation({
      userId,
      date: parseDateInput(date),
      startHour,
      isAdmin: true,
    });

    return Response.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "입력값을 확인해 주세요." } },
        { status: 400 }
      );
    }
    return apiErrorResponse(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "id 파라미터가 필요합니다." } },
        { status: 400 }
      );
    }

    await cancelReservation(id, admin.id, true);
    return Response.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
