import { NextRequest } from "next/server";
import { z } from "zod";
import { requireMember } from "@/lib/auth";
import {
  apiErrorResponse,
  parseDateInput,
  canCancelReservation,
  formatDate,
  formatHour,
} from "@/lib/utils";
import {
  createReservation,
  cancelReservation,
  getUserReservations,
} from "@/lib/reservation-service";

const createSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startHour: z.number().int().min(0).max(23),
});

export async function GET() {
  try {
    const session = await requireMember();
    const reservations = await getUserReservations(session.id);

    return Response.json({
      reservations: reservations.map((r) => ({
        id: r.id,
        date: formatDate(r.date),
        startHour: r.startHour,
        endHour: r.endHour,
        isSameDayBooking: r.isSameDayBooking,
        canCancel: canCancelReservation(r.date, r.startHour),
        timeLabel: `${formatHour(r.startHour)} - ${formatHour(r.endHour)}`,
      })),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireMember();
    const body = await request.json();
    const { date, startHour } = createSchema.parse(body);

    const result = await createReservation({
      userId: session.id,
      date: parseDateInput(date),
      startHour,
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
    const session = await requireMember();
    const id = request.nextUrl.searchParams.get("id");
    if (!id) {
      return Response.json(
        { error: { code: "VALIDATION_ERROR", message: "id 파라미터가 필요합니다." } },
        { status: 400 }
      );
    }

    await cancelReservation(id, session.id, false);
    return Response.json({ ok: true });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
