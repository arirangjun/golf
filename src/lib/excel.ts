import * as XLSX from "xlsx";
import { formatHour } from "./utils";
import type { ImportRow } from "./member-service";
import type { MonthlyMemberStat } from "./reservation-service";

const MEMBER_HEADERS = ["동", "호수", "이름"] as const;

export function buildMemberTemplateBuffer(): Buffer {
  const rows = [
    [...MEMBER_HEADERS],
    ["101", "1001", "홍길동"],
    ["102", "2001", "김철수"],
  ];
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [{ wch: 10 }, { wch: 10 }, { wch: 12 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "회원등록");
  return Buffer.from(
    XLSX.write(wb, { type: "buffer", bookType: "xlsx" })
  );
}

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s/g, "");
}

function cellValue(row: unknown[], index: number): string {
  const value = row[index];
  if (value == null) return "";
  return String(value).trim();
}

export function parseMemberExcel(buffer: Buffer): ImportRow[] {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];

  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
  });

  if (rows.length === 0) return [];

  const headerRow = rows[0].map(normalizeHeader);
  const dongIdx = headerRow.findIndex((h) => h === "동" || h === "dong");
  const hoIdx = headerRow.findIndex(
    (h) => h === "호수" || h === "ho" || h === "호"
  );
  const nameIdx = headerRow.findIndex(
    (h) => h === "이름" || h === "name" || h === "성명"
  );

  const useHeader =
    dongIdx >= 0 && hoIdx >= 0 && nameIdx >= 0
      ? { dong: dongIdx, ho: hoIdx, name: nameIdx, start: 1 }
      : { dong: 0, ho: 1, name: 2, start: 0 };

  const result: ImportRow[] = [];

  for (let i = useHeader.start; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row)) continue;

    const dong = cellValue(row, useHeader.dong);
    const ho = cellValue(row, useHeader.ho);
    const name = cellValue(row, useHeader.name);

    if (!dong && !ho && !name) continue;

    result.push({
      row: i + 1,
      dong,
      ho,
      name,
    });
  }

  return result;
}

interface StatsExportData {
  from: string;
  to: string;
  month?: string;
  total: number;
  daily: { label: string; count: number }[];
  weekly: { label: string; count: number }[];
  monthly: { label: string; count: number }[];
  hourlyUtilization: { hour: number; count: number; rate: number }[];
  memberStats?: {
    month: string;
    totalReservations: number;
    uniqueMembers: number;
    members: MonthlyMemberStat[];
  };
}

export function buildStatsExportBuffer(data: StatsExportData): Buffer {
  const wb = XLSX.utils.book_new();

  const summaryRows: (string | number)[][] = [
    ["항목", "값"],
    ["조회 시작", data.from],
    ["조회 종료", data.to],
    ["총 예약 건수", data.total],
  ];
  if (data.memberStats) {
    summaryRows.push(
      ["월별 회원 집계 월", data.memberStats.month],
      ["해당 월 예약 회원 수", data.memberStats.uniqueMembers],
      ["해당 월 총 예약", data.memberStats.totalReservations]
    );
  }
  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet(summaryRows),
    "요약"
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["날짜", "예약 건수"],
      ...data.daily.map((d) => [d.label, d.count]),
    ]),
    "일별"
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["주 시작일", "예약 건수"],
      ...data.weekly.map((d) => [d.label, d.count]),
    ]),
    "주별"
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["월", "예약 건수"],
      ...data.monthly.map((d) => [d.label, d.count]),
    ]),
    "월별"
  );

  XLSX.utils.book_append_sheet(
    wb,
    XLSX.utils.aoa_to_sheet([
      ["시간", "예약 건수", "이용률(%)"],
      ...data.hourlyUtilization.map((h) => [
        formatHour(h.hour),
        h.count,
        h.rate,
      ]),
    ]),
    "타임별"
  );

  if (data.memberStats) {
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ["순위", "동", "이름(마스킹)", "예약 횟수"],
        ...data.memberStats.members.map((m, idx) => [
          idx + 1,
          m.dong,
          m.displayName,
          m.count,
        ]),
      ]),
      "월별회원집계"
    );
  }

  return Buffer.from(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }));
}

export function excelResponse(buffer: Buffer, filename: string): Response {
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
