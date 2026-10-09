import "server-only";
import { and, asc, eq } from "drizzle-orm";
import { db, attempts, questions } from "@/db";
import { getStudentFromSession } from "@/lib/auth";
import { cleanAnswers, finalizeAttempt, GRACE_SECONDS } from "@/lib/grading";
import { json } from "@/lib/student-exam";

export type AttemptBody = { token?: unknown; answers?: unknown; leaveCount?: unknown; newBlocked?: unknown; auto?: unknown };

/** Kiểm tra quyền + token chung cho lưu nháp và nộp bài. */
export async function loadAttemptForWrite(attemptId: string, body: AttemptBody) {
  const student = await getStudentFromSession();
  if (!student) return { error: json({ error: "Phiên đăng nhập đã hết hạn." }, 401) };
  const attempt = (
    await db
      .select()
      .from(attempts)
      .where(and(eq(attempts.id, attemptId), eq(attempts.studentId, student.id)))
      .limit(1)
  )[0];
  if (!attempt) return { error: json({ error: "Không tìm thấy bài làm." }, 404) };
  if (attempt.status === "SUBMITTED") return { error: json({ error: "submitted", attemptId }, 410) };
  if (typeof body.token !== "string" || body.token !== attempt.tabToken)
    return { error: json({ error: "conflict" }, 409) };

  const qs = await db
    .select({ id: questions.id, options: questions.options })
    .from(questions)
    .where(eq(questions.examId, attempt.examId))
    .orderBy(asc(questions.order));
  const answers = cleanAnswers(body.answers, qs);
  const leaveCount = Math.max(
    attempt.leaveCount,
    typeof body.leaveCount === "number" && Number.isFinite(body.leaveCount) ? Math.min(10_000, Math.floor(body.leaveCount)) : 0,
  );
  const newBlocked =
    typeof body.newBlocked === "number" && Number.isFinite(body.newBlocked) ? Math.max(0, Math.min(100, Math.floor(body.newBlocked))) : 0;
  const expired = Date.now() > attempt.deadline.getTime() + GRACE_SECONDS * 1000;

  if (expired) {
    // Quá giờ: chấm theo bản đã lưu gần nhất, bỏ qua đáp án gửi muộn
    const done = await finalizeAttempt(attempt, attempt.answers, { auto: true, now: attempt.deadline });
    return { error: json({ error: "expired", attemptId: done?.id ?? attempt.id }, 410) };
  }
  return { attempt, answers, leaveCount, newBlocked };
}
