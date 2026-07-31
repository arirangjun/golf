import { NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import { apiErrorResponse, formatMemberDisplay, formatUnit } from "@/lib/utils";
import { createMember } from "@/lib/member-service";

const createSchema = z.object({
  name: z.string().min(1, "이름을 입력해 주세요."),
  dong: z.string().min(1, "동을 입력해 주세요."),
  ho: z.string().min(1, "호수를 입력해 주세요."),
});

export async function GET() {
  try {
    await requireAdmin();
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        dong: true,
        ho: true,
        role: true,
        isActive: true,
        createdAt: true,
        _count: { select: { reservations: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return Response.json({
      users: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        dong: u.dong,
        ho: u.ho,
        unitLabel: formatUnit(u.dong, u.ho),
        displayName: formatMemberDisplay(u.dong, u.name),
        role: u.role,
        isActive: u.isActive,
        createdAt: u.createdAt.toISOString(),
        reservationCount: u._count.reservations,
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
    const { name, dong, ho } = createSchema.parse(body);

    const user = await createMember({ name, dong, ho });

    return Response.json(
      {
        user: {
          ...user,
          createdAt: user.createdAt.toISOString(),
        },
      },
      { status: 201 }
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return Response.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: error.errors[0]?.message ?? "입력값을 확인해 주세요.",
          },
        },
        { status: 400 }
      );
    }
    return apiErrorResponse(error);
  }
}
