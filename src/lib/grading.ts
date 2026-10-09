import "server-only";
import { and, asc, eq, lt, sql, inArray } from "drizzle-orm";
import { db, attempts, questions, type AttemptRow, type GradedItem } from "@/db";

/** Học sinh được nộp muộn tối đa bấy nhiêu giây (bù độ trễ mạng). */
export const GRACE_SECONDS = 30;

export function computeScore(correct: number, total: number) {
  if (total === 0) return 0;
  return Math.round((correct / total) * 10 * 100) / 100;
}

/** Lọc đáp án gửi lên: chỉ giữ câu thuộc đề và chỉ số phương án hợp lệ. */
export function cleanAnswers(
  raw: unknown,
  qs: { id: string; options: string[] }[],
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!raw || typeof raw !== "object") return out;
  const byId = new Map(qs.map((q) => [q.id, q.options.length]));
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const n = byId.get(k);
    if (n === undefined) continue;
    if (typeof v === "number" && Number.isInteger(v) && v >= 0 && v < n) out[k] = v;
  }
  return out;
}

/**
 * Chấm và chốt bài. Chỉ cập nhật khi bài còn IN_PROGRESS (tránh nộp hai lần).
 * Trả về bản ghi đã chốt, hoặc null nếu bài đã được nộp trước đó.
 */
export async function finalizeAttempt(
  attempt: AttemptRow,
  answers: Record<string, number>,
  opts: { auto: boolean; now?: Date },
) {
  const qs = await db
    .select({ id: questions.id, correctIndex: questions.correctIndex, options: questions.options })
    .from(questions)
    .where(eq(questions.examId, attempt.examId))
    .orderBy(asc(questions.order));

  const clean = cleanAnswers(answers, qs);
  const result: GradedItem[] = qs.map((q) => {
    const chosen = clean[q.id] ?? null;
    return { questionId: q.id, chosen, correctIndex: q.correctIndex, correct: chosen === q.correctIndex };
  });
  const correctCount = result.filter((r) => r.correct).length;
  const now = opts.now ?? new Date();
  const end = now.getTime() > attempt.deadline.getTime() ? attempt.deadline : now;
  const durationSec = Math.max(0, Math.round((end.getTime() - attempt.startedAt.getTime()) / 1000));

  const updated = await db
    .update(attempts)
    .set({
      status: "SUBMITTED",
      submittedAt: now,
      autoSubmitted: opts.auto,
      answers: clean,
      result,
      correctCount,
      totalCount: qs.length,
      score: computeScore(correctCount, qs.length),
      durationSec,
      tabToken: null,
    })
    .where(and(eq(attempts.id, attempt.id), eq(attempts.status, "IN_PROGRESS")))
    .returning();
  return updated[0] ?? null;
}

/** Tự nộp các bài đã hết giờ mà học sinh chưa bấm nộp (đóng trình duyệt, mất mạng...). */
export async function finalizeExpired(filter: { examId?: string; studentId?: string; examIds?: string[] } = {}) {
  const cutoff = new Date(Date.now() - GRACE_SECONDS * 1000);
  const conds = [eq(attempts.status, "IN_PROGRESS"), lt(attempts.deadline, cutoff)];
  if (filter.examId) conds.push(eq(attempts.examId, filter.examId));
  if (filter.studentId) conds.push(eq(attempts.studentId, filter.studentId));
  if (filter.examIds) {
    if (filter.examIds.length === 0) return;
    conds.push(inArray(attempts.examId, filter.examIds));
  }
  const expired = await db.select().from(attempts).where(and(...conds));
  for (const a of expired) {
    await finalizeAttempt(a, a.answers, { auto: true, now: a.deadline });
  }
}

export async function countSubmitted(examId: string, studentId: string) {
  const r = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(attempts)
    .where(and(eq(attempts.examId, examId), eq(attempts.studentId, studentId), eq(attempts.status, "SUBMITTED")));
  return r[0]?.n ?? 0;
}
