import "server-only";

type Row = { name: string; code: string };

const NAME_HEADERS = ["họ và tên", "họ tên", "ho ten", "ho va ten", "tên", "ten", "name", "full name", "học sinh"];
const CODE_HEADERS = ["mã", "ma", "mã hs", "mã học sinh", "ma hs", "ma hoc sinh", "code", "id", "mshs", "số báo danh", "sbd"];
const LAST_HEADERS = ["họ", "họ đệm", "ho dem", "họ và đệm"];

const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/** Từ bảng 2 chiều (đã đọc từ Excel/CSV/dán) → danh sách học sinh. */
export function rowsFromTable(table: string[][]): Row[] {
  const rows = table.map((r) => r.map((c) => (c ?? "").toString().trim())).filter((r) => r.some(Boolean));
  if (rows.length === 0) return [];

  // Tìm dòng tiêu đề trong 5 dòng đầu
  let nameCol = -1;
  let codeCol = -1;
  let lastCol = -1;
  let start = 0;
  for (let i = 0; i < Math.min(5, rows.length); i++) {
    const h = rows[i].map(norm);
    const n = h.findIndex((c) => NAME_HEADERS.includes(c));
    const c = h.findIndex((x) => CODE_HEADERS.includes(x));
    const l = h.findIndex((x) => LAST_HEADERS.includes(x));
    if (n >= 0 || c >= 0) {
      nameCol = n;
      codeCol = c;
      lastCol = l;
      start = i + 1;
      break;
    }
  }

  if (nameCol < 0) {
    // Không có tiêu đề: bỏ cột STT nếu cột đầu toàn số, cột tiếp theo là tên, cột sau là mã
    const firstIsIndex = rows.every((r) => /^\d{1,3}$/.test(r[0] ?? "")) && rows[0].length >= 2;
    nameCol = firstIsIndex ? 1 : 0;
    if (codeCol < 0) codeCol = rows[0].length > nameCol + 1 ? nameCol + 1 : -1;
  }

  const out: Row[] = [];
  for (const r of rows.slice(start)) {
    let name = r[nameCol] ?? "";
    if (lastCol >= 0 && r[lastCol]) name = `${r[lastCol]} ${name}`.trim();
    name = name.replace(/\s+/g, " ").trim();
    const code = codeCol >= 0 ? (r[codeCol] ?? "").replace(/\s+/g, "") : "";
    if (!name || /^\d+$/.test(name)) continue;
    out.push({ name: name.slice(0, 100), code: code.slice(0, 30) });
  }
  return out;
}

function splitCsvLine(line: string, sep: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (q && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else q = !q;
    } else if (ch === sep && !q) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export function tableFromText(text: string): string[][] {
  const lines = text.replace(/^﻿/, "").split(/\r?\n/).filter((l) => l.trim());
  const sample = lines.slice(0, 5).join("\n");
  const sep = sample.includes("\t") ? "\t" : sample.includes(";") ? ";" : ",";
  return lines.map((l) => splitCsvLine(l, sep));
}

export async function readStudentRows(input: { fileName: string; buffer: Buffer } | { text: string }): Promise<Row[]> {
  if ("text" in input) return rowsFromTable(tableFromText(input.text));
  const lower = input.fileName.toLowerCase();
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) return rowsFromTable(tableFromText(input.buffer.toString("utf8")));
  if (!lower.endsWith(".xlsx")) throw new Error("Chỉ hỗ trợ file .xlsx hoặc .csv (file .xls cũ hãy lưu lại thành .xlsx).");

  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(input.buffer as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  if (!ws) return [];
  const table: string[][] = [];
  ws.eachRow({ includeEmpty: false }, (row) => {
    const cells: string[] = [];
    for (let c = 1; c <= ws.columnCount; c++) {
      const v = row.getCell(c).value as unknown;
      let s = "";
      if (v === null || v === undefined) s = "";
      else if (typeof v === "object" && v !== null && "richText" in v)
        s = (v as { richText: { text: string }[] }).richText.map((t) => t.text).join("");
      else if (typeof v === "object" && v !== null && "text" in v) s = String((v as { text: unknown }).text);
      else if (typeof v === "object" && v !== null && "result" in v) s = String((v as { result: unknown }).result ?? "");
      else s = String(v);
      cells.push(s);
    }
    table.push(cells);
  });
  return rowsFromTable(table);
}
