import { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { addDays } from "date-fns";
import {
  ApiError,
  canCancelReservation,
  formatDate,
  formatHour,
  formatMemberDisplay,
  formatPhone,
  getAllDayHours,
  getWeekRange,
  isOperatingHour,
  isNextDayBonusBookingAllowed,
  canBookDate,
  getCurrentlyBookableWeekRange,
  getNextBookingOpenTime,
  formatBookingWindowMessage,
  toDateOnly,
  getReservationDateTime,
  OPERATING_START_HOUR,
  OPERATING_END_HOUR,
} from "./utils";

export interface SlotInfo {
  startHour: number;
  endHour: number;
  available: boolean;
  isOperating: boolean;
  bookable: boolean;
  reservationId?: string;
  displayLabel?: string;
  isMine?: boolean;
}

export async function getSlotsForDate(
  date: Date,
  currentUserId?: string,
  options?: { adminView?: boolean }
): Promise<SlotInfo[]> {
  const dateOnly = toDateOnly(date);
  const reservations = await prisma.reservation.findMany({
    where: { date: dateOnly },
    include: { user: { select: { id: true, name: true, dong: true } } },
  });

  const bookedMap = new Map(
    reservations.map((r) => [r.startHour, r])
  );
  const bookable = options?.adminView ? true : canBookDate(dateOnly);

  return getAllDayHours().map((hour) => {
    const reservation = bookedMap.get(hour);
    const operating = isOperatingHour(hour);
    return {
      startHour: hour,
      endHour: hour + 1,
      available: operating && !reservation && bookable,
      isOperating: operating,
      bookable,
      reservationId: reservation?.id,
      displayLabel: reservation
        ? formatMemberDisplay(reservation.user.dong, reservation.user.name)
        : undefined,
      isMine: reservation?.userId === currentUserId,
    };
  });
}

export interface DaySlots {
  date: string;
  slots: SlotInfo[];
}

export async function getSlotsForWeek(
  weekStart: Date,
  currentUserId?: string,
  options?: { adminView?: boolean }
): Promise<DaySlots[]> {
  const monday = toDateOnly(weekStart);
  const days: DaySlots[] = [];

  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    const slots = await getSlotsForDate(date, currentUserId, options);
    days.push({ date: formatDate(date), slots });
  }

  return days;
}

export async function countWeeklyReservations(
  userId: string,
  date: Date,
  excludeSameDay: boolean = true
): Promise<number> {
  const { start, end } = getWeekRange(date);
  const where: Prisma.ReservationWhereInput = {
    userId,
    date: { gte: start, lte: end },
  };

  if (excludeSameDay) {
    where.isSameDayBooking = false;
  }

  return prisma.reservation.count({ where });
}

export interface CreateReservationInput {
  userId: string;
  date: Date;
  startHour: number;
  isAdmin?: boolean;
}

export async function createReservation(
  input: CreateReservationInput
): Promise<{ id: string }> {
  const { userId, date, startHour, isAdmin = false } = input;
  const now = new Date();
  const dateOnly = toDateOnly(date);

  if (startHour < OPERATING_START_HOUR || startHour >= OPERATING_END_HOUR) {
    throw new ApiError(
      "VALIDATION_ERROR",
      `예약 가능 시간은 ${formatHour(OPERATING_START_HOUR)} ~ ${formatHour(OPERATING_END_HOUR)} 입니다.`
    );
  }

  const reservationTime = getReservationDateTime(dateOnly, startHour);
  if (reservationTime <= now && !isAdmin) {
    throw new ApiError("VALIDATION_ERROR", "과거 시간은 예약할 수 없습니다.");
  }

  if (!isAdmin && !canBookDate(dateOnly, now)) {
    const range = getCurrentlyBookableWeekRange(now);
    if (range) {
      throw new ApiError(
        "BOOKING_NOT_OPEN",
        `현재 예약 가능한 주간은 ${formatDate(range.start)} ~ ${formatDate(range.end)} 입니다. 매주 토요일 14:00에 다음 주 예약이 오픈됩니다.`
      );
    }
    const nextOpen = getNextBookingOpenTime(now);
    throw new ApiError(
      "BOOKING_NOT_OPEN",
      `예약 오픈 전입니다. ${formatDate(nextOpen)} ${formatHour(nextOpen.getHours())}부터 예약 가능합니다.`
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || !user.isActive) {
    throw new ApiError("USER_INACTIVE", "비활성화된 계정입니다.", 403);
  }

  const isNextDayBonus = isNextDayBonusBookingAllowed(dateOnly, now);
  let markAsBonus = false;

  if (!isAdmin) {
    if (isNextDayBonus) {
      markAsBonus = true;
    } else {
      const weeklyCount = await countWeeklyReservations(userId, dateOnly);
      if (weeklyCount >= 1) {
        throw new ApiError(
          "WEEKLY_LIMIT",
          "이번 주(월~일) 기본 예약은 1회만 가능합니다. 21:00 이후 내일 슬롯은 추가 1회 예약이 가능합니다."
        );
      }
    }
  }

  try {
    const reservation = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.reservation.findUnique({
          where: {
            date_startHour: { date: dateOnly, startHour },
          },
        });

        if (existing) {
          throw new ApiError("SLOT_TAKEN", "이미 예약된 시간입니다.", 409);
        }

        if (!isAdmin && !markAsBonus) {
          const weeklyCount = await tx.reservation.count({
            where: {
              userId,
              isSameDayBooking: false,
              date: {
                gte: getWeekRange(dateOnly).start,
                lte: getWeekRange(dateOnly).end,
              },
            },
          });
          if (weeklyCount >= 1) {
            throw new ApiError(
              "WEEKLY_LIMIT",
              "이번 주(월~일) 기본 예약은 1회만 가능합니다."
            );
          }
        }

        if (!isAdmin && markAsBonus) {
          const bonusCount = await tx.reservation.count({
            where: {
              userId,
              isSameDayBooking: true,
              date: dateOnly,
            },
          });
          if (bonusCount >= 1) {
            throw new ApiError(
              "BONUS_LIMIT",
              "내일 추가 예약은 1회만 가능합니다."
            );
          }
        }

        return tx.reservation.create({
          data: {
            userId,
            date: dateOnly,
            startHour,
            endHour: startHour + 1,
            isSameDayBooking: markAsBonus,
          },
        });
      },
      {
        isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      }
    );

    return { id: reservation.id };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ApiError("SLOT_TAKEN", "이미 예약된 시간입니다.", 409);
    }
    throw error;
  }
}

export async function cancelReservation(
  reservationId: string,
  userId: string,
  isAdmin: boolean = false
): Promise<void> {
  const reservation = await prisma.reservation.findUnique({
    where: { id: reservationId },
  });

  if (!reservation) {
    throw new ApiError("NOT_FOUND", "예약을 찾을 수 없습니다.", 404);
  }

  if (!isAdmin && reservation.userId !== userId) {
    throw new ApiError("FORBIDDEN", "본인 예약만 취소할 수 있습니다.", 403);
  }

  if (
    !isAdmin &&
    !canCancelReservation(reservation.date, reservation.startHour)
  ) {
    throw new ApiError(
      "CANCEL_TOO_LATE",
      "예약 3시간 전까지만 취소할 수 있습니다."
    );
  }

  await prisma.reservation.delete({ where: { id: reservationId } });
}

export async function getUserReservations(userId: string) {
  return prisma.reservation.findMany({
    where: { userId },
    orderBy: [{ date: "asc" }, { startHour: "asc" }],
  });
}

export async function getAllReservations(from?: Date, to?: Date) {
  const where: Prisma.ReservationWhereInput = {};
  if (from || to) {
    where.date = {};
    if (from) where.date.gte = toDateOnly(from);
    if (to) where.date.lte = toDateOnly(to);
  }

  return prisma.reservation.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, email: true, dong: true } },
    },
    orderBy: [{ date: "asc" }, { startHour: "asc" }],
  });
}

export interface StatsPeriod {
  label: string;
  count: number;
}

export interface HourlyUtilization {
  hour: number;
  count: number;
  rate: number;
}

export interface MonthlyMemberStat {
  userId: string;
  dong: string;
  name: string;
  phone: string;
  displayName: string;
  count: number;
}

export async function getMonthlyMemberStats(
  year: number,
  month: number
): Promise<{
  month: string;
  members: MonthlyMemberStat[];
  totalReservations: number;
  uniqueMembers: number;
}> {
  const monthStart = new Date(year, month - 1, 1);
  const monthEnd = new Date(year, month, 0);

  const reservations = await prisma.reservation.findMany({
    where: {
      date: { gte: toDateOnly(monthStart), lte: toDateOnly(monthEnd) },
    },
    include: {
      user: { select: { id: true, name: true, dong: true, phone: true } },
    },
  });

  const memberMap = new Map<
    string,
    { dong: string; name: string; phone: string; count: number }
  >();

  for (const r of reservations) {
    const existing = memberMap.get(r.userId);
    if (existing) {
      existing.count += 1;
    } else {
      memberMap.set(r.userId, {
        dong: r.user.dong,
        name: r.user.name,
        phone: r.user.phone,
        count: 1,
      });
    }
  }

  const members = Array.from(memberMap.entries())
    .map(([userId, { dong, name, phone, count }]) => ({
      userId,
      dong,
      name,
      phone: formatPhone(phone),
      displayName: formatMemberDisplay(dong, name),
      count,
    }))
    .sort((a, b) => b.count - a.count || a.displayName.localeCompare(b.displayName, "ko"));

  const monthLabel = `${year}-${String(month).padStart(2, "0")}`;

  return {
    month: monthLabel,
    members,
    totalReservations: reservations.length,
    uniqueMembers: members.length,
  };
}

export async function getReservationStats(
  from: Date,
  to: Date
): Promise<{
  daily: StatsPeriod[];
  weekly: StatsPeriod[];
  monthly: StatsPeriod[];
  hourlyUtilization: HourlyUtilization[];
  total: number;
}> {
  const reservations = await prisma.reservation.findMany({
    where: {
      date: { gte: toDateOnly(from), lte: toDateOnly(to) },
    },
  });

  const dailyMap = new Map<string, number>();
  const weeklyMap = new Map<string, number>();
  const monthlyMap = new Map<string, number>();
  const hourlyMap = new Map<number, number>();

  for (const r of reservations) {
    const dayKey = r.date.toISOString().slice(0, 10);
    dailyMap.set(dayKey, (dailyMap.get(dayKey) ?? 0) + 1);

    const weekStart = getWeekRange(r.date).start.toISOString().slice(0, 10);
    weeklyMap.set(weekStart, (weeklyMap.get(weekStart) ?? 0) + 1);

    const monthKey = r.date.toISOString().slice(0, 7);
    monthlyMap.set(monthKey, (monthlyMap.get(monthKey) ?? 0) + 1);

    hourlyMap.set(r.startHour, (hourlyMap.get(r.startHour) ?? 0) + 1);
  }

  const totalDays = Math.max(
    1,
    Math.ceil(
      (toDateOnly(to).getTime() - toDateOnly(from).getTime()) /
        (1000 * 60 * 60 * 24)
    ) + 1
  );

  return {
    daily: Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, count]) => ({ label, count })),
    weekly: Array.from(weeklyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, count]) => ({ label, count })),
    monthly: Array.from(monthlyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([label, count]) => ({ label, count })),
    hourlyUtilization: getAllDayHours().map((hour) => {
      const count = hourlyMap.get(hour) ?? 0;
      return {
        hour,
        count,
        rate: totalDays > 0 ? Math.round((count / totalDays) * 100) : 0,
      };
    }),
    total: reservations.length,
  };
}
