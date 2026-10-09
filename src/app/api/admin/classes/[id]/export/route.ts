import { asc, eq } from "drizzle-orm";
import { db, classes, students } from "@/db";
import { getSession } from "@/lib/auth";
import { newWorkbook, styleHeader, xlsxResponse } from "@/lib/excel";

export async function GET(_req: Request, ctx: RouteContext<"/api/admin/classes/[id]/export">) {
  const session = await getSession();
  if (session?.role !== "admin") return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const cls = (await db.select().from(classes).where(eq(classes.id, id)).limit(1))[0];
  if (!cls) return new Response("Not found", { status: 404 });
  const list = await db.select().from(students).where(eq(students.classId, id)).orderBy(asc(students.name));

  const wb = await newWorkbook();
  const ws = wb.addWorksheet(`Lớp ${cls.name}`.slice(0, 31));
  ws.columns = [
    { header: "STT", key: "stt", width: 6 },
    { header: "Họ và tên", key: "name", width: 30 },
    { header: "Mã HS", key: "code", width: 14 },
  ];
  styleHeader(ws);
  list.forEach((s, i) => ws.addRow({ stt: i + 1, name: s.name, code: s.code }));
  const buf = await wb.xlsx.writeBuffer();
  return xlsxResponse(buf, `Danh-sach-lop-${cls.name}.xlsx`);
}
