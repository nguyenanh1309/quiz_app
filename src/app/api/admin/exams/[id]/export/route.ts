import { and, asc, eq, inArray } from "drizzle-orm";
import { db, attempts, classes, exams, students } from "@/db";
import { getSession } from "@/lib/auth";
import { finalizeExpired } from "@/lib/grading";
import { newWorkbook, styleHeader, xlsxResponse } from "@/lib/excel";
import { formatDateTime, formatDuration } from "@/lib/format";

export async function GET(req: Request, ctx: RouteContext<"/api/admin/exams/[id]/export">) {
  const session = await getSession();
  if (session?.role !== "admin") return new Response("Unauthorized", { status: 401 });
  const { id } = await ctx.params;
  const classId = new URL(req.url).searchParams.get("class");
  const exam = (await db.select().from(exams).where(eq(exams.id, id)).limit(1))[0];
  const cls = classId ? (await db.select().from(classes).where(eq(classes.id, classId)).limit(1))[0] : undefined;
  if (!exam || !cls) return new Response("Not found", { status: 404 });

  await finalizeExpired({ examId: id });
  const list = await db.select().from(students).where(eq(students.classId, cls.id)).orderBy(asc(students.name));
  const atts = list.length
    ? await db
        .select()
        .from(attempts)
        .where(and(eq(attempts.examId, id), eq(attempts.status, "SUBMITTED"), inArray(attempts.studentId, list.map((s) => s.id))))
        .orderBy(asc(attempts.startedAt))
    : [];

  const wb = await newWorkbook();
  const ws = wb.addWorksheet("Kết quả");
  ws.columns = [
    { header: "STT", key: "stt", width: 6 },
    { header: "Họ và tên", key: "name", width: 28 },
    { header: "Mã HS", key: "code", width: 12 },
    { header: "Số lần làm", key: "count", width: 11 },
    { header: "Điểm cao nhất", key: "best", width: 14 },
    { header: "Điểm lần cuối", key: "last", width: 14 },
    { header: "Số câu đúng (lần cuối)", key: "correct", width: 20 },
    { header: "Thời gian làm (lần cuối)", key: "dur", width: 22 },
    { header: "Nộp lúc (lần cuối)", key: "at", width: 20 },
    { header: "Ghi chú", key: "note", width: 30 },
  ];
  styleHeader(ws);
  list.forEach((s, i) => {
    const mine = atts.filter((a) => a.studentId === s.id);
    const last = mine[mine.length - 1];
    const best = mine.reduce<number | null>((b, a) => (b === null || (a.score ?? 0) > b ? (a.score ?? 0) : b), null);
    const notes: string[] = [];
    const conflicts = mine.reduce((n, a) => n + a.tabConflicts, 0);
    if (!mine.length) notes.push("Chưa làm");
    if (conflicts) notes.push(`Mở nhiều tab ${conflicts} lần`);
    if (mine.some((a) => a.autoSubmitted)) notes.push("Có lần hết giờ tự nộp");
    ws.addRow({
      stt: i + 1,
      name: s.name,
      code: s.code,
      count: mine.length,
      best,
      last: last?.score ?? null,
      correct: last ? `${last.correctCount}/${last.totalCount}` : "",
      dur: last ? formatDuration(last.durationSec) : "",
      at: last ? formatDateTime(last.submittedAt) : "",
      note: notes.join("; "),
    });
  });
  ws.getColumn("best").numFmt = "0.00";
  ws.getColumn("last").numFmt = "0.00";

  const ws2 = wb.addWorksheet("Chi tiết từng lần");
  ws2.columns = [
    { header: "Họ và tên", key: "name", width: 28 },
    { header: "Mã HS", key: "code", width: 12 },
    { header: "Lần", key: "n", width: 6 },
    { header: "Điểm", key: "score", width: 9 },
    { header: "Câu đúng", key: "correct", width: 10 },
    { header: "Bắt đầu", key: "start", width: 20 },
    { header: "Nộp lúc", key: "at", width: 20 },
    { header: "Thời gian làm", key: "dur", width: 18 },
    { header: "Tự nộp do hết giờ", key: "auto", width: 16 },
    { header: "Mở ở tab khác (lần)", key: "conf", width: 18 },
    { header: "Rời trang (lần)", key: "leave", width: 15 },
  ];
  styleHeader(ws2);
  for (const s of list) {
    atts
      .filter((a) => a.studentId === s.id)
      .forEach((a, i) =>
        ws2.addRow({
          name: s.name,
          code: s.code,
          n: i + 1,
          score: a.score,
          correct: `${a.correctCount}/${a.totalCount}`,
          start: formatDateTime(a.startedAt),
          at: formatDateTime(a.submittedAt),
          dur: formatDuration(a.durationSec),
          auto: a.autoSubmitted ? "Có" : "",
          conf: a.tabConflicts || "",
          leave: a.leaveCount || "",
        }),
      );
  }
  ws2.getColumn("score").numFmt = "0.00";

  const buf = await wb.xlsx.writeBuffer();
  return xlsxResponse(buf, `Ket-qua_${exam.title}_Lop-${cls.name}.xlsx`);
}
