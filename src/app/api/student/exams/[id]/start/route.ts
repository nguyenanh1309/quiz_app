import { randomUUID } from "crypto";
import { and, asc, eq, sql } from "drizzle-orm";
import { db, attempts, questions } from "@/db";
import { getStudentFromSession } from "@/lib/auth";
import { countSubmitted, finalizeExpired } from "@/lib/grading";
import { getExamForStudent, json } from "@/lib/student-exam";

/**
 * Bắt đầu (hoặc tiếp tục) làm bài.
 * - Mỗi lượt làm có một "tabToken". Nếu bài được mở ở trình duyệt/thiết bị khác (không có token cũ)
 *   thì token được đổi mới → tab cũ bị khoá, và lượt làm bị ghi nhận "mở nhiều tab".
 */
export async function POST(req: Request, ctx: RouteContext<"/api/student/exams/[id]/start">) {
  const student = await getStudentFromSession();
  if (!student) return json({ error: "Phiên đăng nhập đã hết hạn, hãy đăng nhập lại." }, 401);
  const { id: examId } = await ctx.params;
  const exam = await getExamForStudent(examId, student);
  if (!exam) return json({ error: "Không tìm thấy đề hoặc đề không được giao cho lớp của em." }, 404);

  const body = (await req.json().catch(() => ({}))) as { prevToken?: unknown };
  const prevToken = typeof body.prevToken === "string" ? body.prevToken : null;

  await finalizeExpired({ examId, studentId: student.id });

  let attempt = (
    await db
      .select()
      .from(attempts)
      .where(and(eq(attempts.examId, examId), eq(attempts.studentId, student.id), eq(attempts.status, "IN_PROGRESS")))
      .limit(1)
  )[0];

  if (attempt) {
    if (!prevToken || prevToken !== attempt.tabToken) {
      const token = randomUUID();
      const [u] = await db
        .update(attempts)
        .set({
          tabToken: token,
          tabConflicts: attempt.tabToken ? sql`${attempts.tabConflicts} + 1` : attempts.tabConflicts,
        })
        .where(eq(attempts.id, attempt.id))
        .returning();
      attempt = u;
    }
  } else {
    if (!exam.isOpen) return json({ error: "Đề đã đóng, em không thể làm bài nữa." }, 403);
    const used = await countSubmitted(examId, student.id);
    if (exam.maxAttempts > 0 && used >= exam.maxAttempts)
      return json({ error: `Em đã dùng hết ${exam.maxAttempts} lượt làm bài.` }, 403);
    const now = new Date();
    try {
      [attempt] = await db
        .insert(attempts)
        .values({
          examId,
          studentId: student.id,
          startedAt: now,
          deadline: new Date(now.getTime() + exam.durationMinutes * 60_000),
          tabToken: randomUUID(),
        })
        .returning();
    } catch {
      // Bấm "bắt đầu" hai lần cùng lúc → dùng lại lượt đang làm vừa được tạo
      attempt = (
        await db
          .select()
          .from(attempts)
          .where(and(eq(attempts.examId, examId), eq(attempts.studentId, student.id), eq(attempts.status, "IN_PROGRESS")))
          .limit(1)
      )[0];
      if (!attempt) return json({ error: "Không bắt đầu được bài làm, hãy thử lại." }, 500);
    }
  }

  const qs = await db
    .select({
      id: questions.id,
      passage: questions.passage,
      text: questions.text,
      options: questions.options,
    })
    .from(questions)
    .where(eq(questions.examId, examId))
    .orderBy(asc(questions.order));

  return json({
    attemptId: attempt.id,
    token: attempt.tabToken,
    deadline: attempt.deadline.toISOString(),
    serverNow: new Date().toISOString(),
    answers: attempt.answers,
    leaveCount: attempt.leaveCount,
    exam: { id: exam.id, title: exam.title, durationMinutes: exam.durationMinutes },
    // Không gửi đáp án đúng / giải thích xuống trình duyệt khi đang làm bài
    questions: qs,
  });
}
