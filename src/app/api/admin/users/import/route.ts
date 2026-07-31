import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiErrorResponse, ApiError } from "@/lib/utils";
import { parseMemberExcel } from "@/lib/excel";
import { importMembers } from "@/lib/member-service";

export async function POST(request: NextRequest) {
  try {
    await requireAdmin();

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      throw new ApiError("VALIDATION_ERROR", "엑셀 파일을 선택해 주세요.");
    }

    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
    ];
    const name = file.name.toLowerCase();
    if (
      !allowedTypes.includes(file.type) &&
      !name.endsWith(".xlsx") &&
      !name.endsWith(".xls")
    ) {
      throw new ApiError(
        "VALIDATION_ERROR",
        "xlsx 또는 xls 파일만 업로드할 수 있습니다."
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rows = parseMemberExcel(buffer);

    if (rows.length === 0) {
      throw new ApiError(
        "VALIDATION_ERROR",
        "등록할 회원 데이터가 없습니다. 양식을 확인해 주세요."
      );
    }

    const result = await importMembers(rows);

    return Response.json({
      created: result.created,
      skipped: result.skipped,
      errors: result.errors,
      users: result.users.map((u) => ({
        ...u,
        createdAt: u.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    return apiErrorResponse(error);
  }
}
