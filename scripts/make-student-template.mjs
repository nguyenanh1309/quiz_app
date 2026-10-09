// Tạo file Excel mẫu danh sách học sinh: node scripts/make-student-template.mjs
import ExcelJS from "exceljs";
const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet("Danh sách");
ws.columns = [
  { header: "STT", key: "stt", width: 6 },
  { header: "Họ và tên", key: "name", width: 30 },
  { header: "Mã HS", key: "code", width: 14 },
];
ws.getRow(1).font = { bold: true };
[
  ["Nguyễn Văn An", "HS01"],
  ["Trần Thị Bình", "HS02"],
  ["Lê Minh Châu", ""],
].forEach(([name, code], i) => ws.addRow({ stt: i + 1, name, code }));
ws.getCell("E1").value = "Ghi chú: để trống Mã HS thì hệ thống tự tạo mã 4 số.";
ws.getCell("E1").font = { italic: true, color: { argb: "FF888888" } };
await wb.xlsx.writeFile("public/mau-danh-sach-hoc-sinh.xlsx");
console.log("Đã tạo public/mau-danh-sach-hoc-sinh.xlsx");
