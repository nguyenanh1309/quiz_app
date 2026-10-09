import "server-only";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { db, attempts, questions, type AttemptRow, type ExamRow } from "@/db";
import type { ReviewData } from "@/components/AttemptReview";

/** Dữ liệu cho trang xem lại bài. revealAnswers = false sẽ ẩn đáp án đúng và giải thích. */
export async function buildReview(
  attempt: AttemptRow,
  exam: ExamRow,
  opts: { revealAnswers: boolean; studentName?: string; className?: string },
): Promise<ReviewData> {
  const qs = await db.select().from(questions).where(eq(questions.examId, exam.id)).orderBy(asc(questions.order));
  const byId = new Map(qs.map((q) => [q.id, q]));
  const items = attempt.result ?? [];

  const [{ n }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(attempts)
    .where(
      and(
        eq(attempts.examId, attempt.examId),
        eq(attempts.studentId, attempt.studentId),
        eq(attempts.status, "SUBMITTED"),
        lte(attempts.startedAt, attempt.startedAt),
      ),
    );

  return {
    examTitle: exam.title,
    studentName: opts.studentName,
    className: opts.className,
    score: attempt.score,
    correctCount: attempt.correctCount,
    totalCount: attempt.totalCount,
    durationSec: attempt.durationSec,
    submittedAt: attempt.submittedAt?.toISOString() ?? null,
    autoSubmitted: attempt.autoSubmitted,
    attemptIndex: n,
    showAnswers: opts.revealAnswers,
    questions: items.flatMap((it) => {
      const q = byId.get(it.questionId);
      if (!q) return [];
      return [
        {
          id: q.id,
          passage: q.passage,
          text: q.text,
          options: q.options,
          explanation: opts.revealAnswers ? q.explanation : null,
          chosen: it.chosen,
          correctIndex: opts.revealAnswers ? it.correctIndex : null,
          correct: it.correct,
        },
      ];
    }),
  };
}
