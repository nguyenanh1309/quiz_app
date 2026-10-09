import "server-only";
import type { Worksheet } from "exceljs";

export async function newWorkbook() {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = "Kiểm tra trực tuyến";
  wb.created = new Date();
  return wb;
}

export function styleHeader(ws: Worksheet) {
  const row = ws.getRow(1);
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2453CC" } };
  row.alignment = { vertical: "middle" };
  row.height = 22;
  ws.views = [{ state: "frozen", ySplit: 1 }];
}

export function xlsxResponse(buffer: ArrayBuffer | Buffer, fileName: string) {
  const safe = fileName.replace(/[\\/:*?"<>|]+/g, "_");
  const ascii = safe
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/\s+/g, "_");
  return new Response(buffer as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(safe)}`,
      "Cache-Control": "no-store",
    },
  });
}
