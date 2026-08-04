import { NextRequest } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/auth";
import { ApiError, apiErrorResponse } from "@/lib/utils";
import { authenticateMember } from "@/lib/member-auth";

const memberLoginSchema = z.object({
  loginType: z.literal("member").optional(),
  dong: z.string().min(1),
  ho: z.string().min(1),
  password: z.string().min(1),
});

const adminLoginSchema = z.object({
  loginType: z.literal("admin"),
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.loginType === "admin") {
      const { email, password } = adminLoginSchema.parse(body);
      const user = await prisma.user.findUnique({ where: { email } });
      if (!user || !user.isActive || user.role !== "ADMIN") {
        throw new ApiError("UNAUTHORIZED", "관리자 계정 정보가 올바르지 않습니다.", 401);
      }
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) {
        throw new ApiError("UNAUTHORIZED", "관리자 계정 정보가 올바르지 않습니다.", 401);
      }
      await createSession({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      });
      return Response.json({
        user: { id: user.id, email: user.email, name: user.name, role: user.role },
      });
    }

    const { dong, ho, password } = memberLoginSchema.parse(body);
    const user = await authenticateMember(dong, ho, password);

    await createSession({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    return Response.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
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
