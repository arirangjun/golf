import { requireAdmin } from "@/lib/auth";
import { apiErrorResponse } from "@/lib/utils";
import { buildMemberTemplateBuffer, excelResponse } from "@/lib/excel";

export async function GET() {
  try {
    await requireAdmin();
    const buffer = buildMemberTemplateBuffer();
    return excelResponse(buffer, "member-template.xlsx");
  } catch (error) {
    return apiErrorResponse(error);
  }
}
