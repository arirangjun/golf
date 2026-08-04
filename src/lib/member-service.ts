import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "./prisma";
import {
  ApiError,
  DEFAULT_MEMBER_PASSWORD,
  formatMemberDisplay,
  formatPhone,
  formatUnit,
  normalizePhone,
} from "./utils";
import {
  countMembersWithUnitPassword,
  generateUniqueMemberEmail,
} from "./member-auth";

export interface MemberInput {
  dong: string;
  ho: string;
  name: string;
  phone?: string;
  password?: string;
}

export interface CreatedMember {
  id: string;
  email: string;
  name: string;
  phone: string;
  dong: string;
  ho: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
  unitLabel: string;
  displayName: string;
  reservationCount: number;
}

function toStoredPhone(phone?: string): string {
  return phone ? normalizePhone(phone) : "";
}

export async function createMember(input: MemberInput): Promise<CreatedMember> {
  const trimmedDong = input.dong.trim();
  const trimmedHo = input.ho.trim();
  const name = input.name.trim();
  const phone = toStoredPhone(input.phone);
  const plainPassword = input.password?.trim() || DEFAULT_MEMBER_PASSWORD;

  if (!trimmedDong || !trimmedHo || !name) {
    throw new ApiError("VALIDATION_ERROR", "동, 호수, 이름을 모두 입력해 주세요.");
  }

  const duplicatePasswordCount = await countMembersWithUnitPassword(
    trimmedDong,
    trimmedHo,
    plainPassword
  );
  if (duplicatePasswordCount > 0) {
    throw new ApiError(
      "VALIDATION_ERROR",
      "같은 동·호수에 이미 동일 비밀번호를 사용하는 회원이 있습니다. 다른 비밀번호를 사용해 주세요."
    );
  }

  const email = await generateUniqueMemberEmail(trimmedDong, trimmedHo);
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  const user = await prisma.user.create({
    data: {
      name,
      phone,
      dong: trimmedDong,
      ho: trimmedHo,
      email,
      passwordHash,
      role: Role.USER,
      isActive: true,
    },
  });

  return {
    ...user,
    phone: formatPhone(user.phone),
    unitLabel: formatUnit(user.dong, user.ho),
    displayName: formatMemberDisplay(user.dong, user.name),
    reservationCount: 0,
  };
}

export interface ImportRow extends MemberInput {
  row: number;
}

export interface ImportResult {
  created: number;
  skipped: number;
  errors: { row: number; message: string }[];
  users: CreatedMember[];
}

export async function importMembers(rows: ImportRow[]): Promise<ImportResult> {
  const result: ImportResult = {
    created: 0,
    skipped: 0,
    errors: [],
    users: [],
  };

  const seenInFile = new Set<string>();

  for (const row of rows) {
    const trimmedDong = row.dong.trim();
    const trimmedHo = row.ho.trim();
    const name = row.name.trim();
    const phone = toStoredPhone(row.phone);
    const plainPassword = row.password?.trim() || DEFAULT_MEMBER_PASSWORD;
    const key = `${trimmedDong}:${trimmedHo}:${plainPassword}`;

    if (!trimmedDong && !trimmedHo && !name && !phone) continue;

    if (!trimmedDong || !trimmedHo || !name) {
      result.errors.push({
        row: row.row,
        message: "동, 호수, 이름을 모두 입력해 주세요.",
      });
      continue;
    }

    if (seenInFile.has(key)) {
      result.skipped += 1;
      result.errors.push({
        row: row.row,
        message: "파일 내 동·호수·비밀번호 조합이 중복입니다.",
      });
      continue;
    }
    seenInFile.add(key);

    try {
      const duplicatePasswordCount = await countMembersWithUnitPassword(
        trimmedDong,
        trimmedHo,
        plainPassword
      );
      if (duplicatePasswordCount > 0) {
        result.skipped += 1;
        result.errors.push({
          row: row.row,
          message: "같은 동·호수에 이미 동일 비밀번호 회원이 있습니다.",
        });
        continue;
      }

      const email = await generateUniqueMemberEmail(trimmedDong, trimmedHo);
      const passwordHash = await bcrypt.hash(plainPassword, 10);
      const user = await prisma.user.create({
        data: {
          name,
          phone,
          dong: trimmedDong,
          ho: trimmedHo,
          email,
          passwordHash,
          role: Role.USER,
          isActive: true,
        },
      });

      result.created += 1;
      result.users.push({
        ...user,
        phone: formatPhone(user.phone),
        unitLabel: formatUnit(user.dong, user.ho),
        displayName: formatMemberDisplay(user.dong, user.name),
        reservationCount: 0,
      });
    } catch {
      result.errors.push({
        row: row.row,
        message: "등록 중 오류가 발생했습니다.",
      });
    }
  }

  return result;
}
