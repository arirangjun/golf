import bcrypt from "bcryptjs";
import { Role, User } from "@prisma/client";
import { prisma } from "./prisma";
import {
  ApiError,
  DEFAULT_MEMBER_PASSWORD,
  formatMemberDisplay,
  formatPhone,
  formatUnit,
} from "./utils";

export async function generateUniqueMemberEmail(
  dong: string,
  ho: string
): Promise<string> {
  const base = `${dong.trim()}-${ho.trim()}`;

  for (let attempt = 0; attempt < 100; attempt++) {
    const suffix = attempt === 0 ? "" : `-${attempt + 1}`;
    const email = `${base}${suffix}@member.golf`;
    const existing = await prisma.user.findUnique({ where: { email } });
    if (!existing) return email;
  }

  return `${base}-${crypto.randomUUID().slice(0, 8)}@member.golf`;
}

export async function countMembersWithUnitPassword(
  dong: string,
  ho: string,
  plainPassword: string,
  excludeUserId?: string
): Promise<number> {
  const users = await prisma.user.findMany({
    where: {
      dong,
      ho,
      role: Role.USER,
      ...(excludeUserId ? { NOT: { id: excludeUserId } } : {}),
    },
  });

  let matches = 0;
  for (const user of users) {
    if (await bcrypt.compare(plainPassword, user.passwordHash)) {
      matches += 1;
    }
  }
  return matches;
}

export async function authenticateMember(
  dong: string,
  ho: string,
  password: string
): Promise<User> {
  const trimmedDong = dong.trim();
  const trimmedHo = ho.trim();

  const users = await prisma.user.findMany({
    where: {
      dong: trimmedDong,
      ho: trimmedHo,
      role: Role.USER,
      isActive: true,
    },
  });

  if (users.length === 0) {
    throw new ApiError("UNAUTHORIZED", "등록되지 않았거나 비활성화된 회원입니다.", 401);
  }

  const matches: User[] = [];
  for (const user of users) {
    if (await bcrypt.compare(password, user.passwordHash)) {
      matches.push(user);
    }
  }

  if (matches.length === 0) {
    throw new ApiError("UNAUTHORIZED", "동·호수 또는 비밀번호가 올바르지 않습니다.", 401);
  }

  if (matches.length > 1) {
    throw new ApiError(
      "UNAUTHORIZED",
      "같은 동·호수에 동일 비밀번호 회원이 여러 명 있습니다. 관리자에게 문의해 주세요.",
      401
    );
  }

  return matches[0];
}
