import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import {
  apiErrorResponse,
  ApiError,
  formatMemberDisplay,
  formatPhone,
  formatUnit,
  generateMemberEmail,
  normalizePhone,
} from "@/lib/utils";
import { prisma } from "@/lib/prisma";

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  dong: z.string().min(1).optional(),
  ho: z.string().min(1).optional(),
  phone: z.string().optional(),
  password: z.string().min(1).optional(),
  role: z.enum(["USER", "ADMIN"]).optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await request.json();
    const data = updateSchema.parse(body);

    if (id === admin.id && data.role === "USER") {
      throw new ApiError("VALIDATION_ERROR", "본인의 관리자 권한은 해제할 수 없습니다.");
    }
    if (id === admin.id && data.isActive === false) {
      throw new ApiError("VALIDATION_ERROR", "본인 계정은 비활성화할 수 없습니다.");
    }

    const current = await prisma.user.findUnique({ where: { id } });
    if (!current) {
      throw new ApiError("NOT_FOUND", "회원을 찾을 수 없습니다.", 404);
    }

    const newDong = data.dong?.trim() ?? current.dong;
    const newHo = data.ho?.trim() ?? current.ho;

    if (current.role === "USER" && (data.dong || data.ho)) {
      const duplicate = await prisma.user.findFirst({
        where: {
          dong: newDong,
          ho: newHo,
          NOT: { id },
        },
      });
      if (duplicate) {
        throw new ApiError("VALIDATION_ERROR", "이미 등록된 동·호수입니다.");
      }
    }

    const { password, ...rest } = data;
    const updateData: Record<string, unknown> = { ...rest };
    if (data.dong) updateData.dong = newDong;
    if (data.ho) updateData.ho = newHo;
    if (current.role === "USER" && (data.dong || data.ho)) {
      updateData.email = generateMemberEmail(newDong, newHo);
    }
    if (data.phone !== undefined) {
      updateData.phone = normalizePhone(data.phone);
    }
    if (password) {
      updateData.passwordHash = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        dong: true,
        ho: true,
        role: true,
        isActive: true,
      },
    });

    return Response.json({
      user: {
        ...user,
        phone: formatPhone(user.phone),
        unitLabel: formatUnit(user.dong, user.ho),
        displayName: formatMemberDisplay(user.dong, user.name),
      },
    });
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
