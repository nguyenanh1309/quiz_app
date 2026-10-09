import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db, attempts, questions } from "@/db";
import { requireStudent } from "@/lib/auth";
import { countSubmitted, finalizeExpired } from "@/lib/grading";
import { getExamForStudent } from "@/lib/student-exam";
import { ExamRunner } from "./ExamRunner";

export default async function TakeExamPage({ params }: PageProps<"/student/exams/[id]">) {
  const { id } = await params;
  const { student } = await requireStudent();
  const exam = await getExamForStudent(id, student);
  if (!exam) notFound();

  await finalizeExpired({ examId: id, studentId: student.id });
  const [inProgress] = await db
    .select({ id: attempts.id })
    .from(attempts)
    .where(and(eq(attempts.examId, id), eq(attempts.studentId, student.id), eq(attempts.status, "IN_PROGRESS")))
    .limit(1);
  const used = await countSubmitted(id, student.id);
  const [{ n: questionCount }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(questions)
    .where(eq(questions.examId, id));

  const blockedReason = inProgress
    ? null
    : !exam.isOpen
      ? "Đề đã đóng."
      : exam.maxAttempts > 0 && used >= exam.maxAttempts
        ? `Em đã dùng hết ${exam.maxAttempts} lượt làm bài.`
        : questionCount === 0
          ? "Đề chưa có câu hỏi."
          : null;

  if (blockedReason)
    return (
      <div className="card mx-auto max-w-lg p-8 text-center">
        <h1 className="text-xl font-semibold text-slate-900">{exam.title}</h1>
        <p className="mt-3 text-slate-600">{blockedReason}</p>
        <Link href="/student" className="btn mt-6">
          ← Về danh sách bài
        </Link>
      </div>
    );

  return (
    <ExamRunner
      examId={exam.id}
      studentId={student.id}
      title={exam.title}
      description={exam.description}
      durationMinutes={exam.durationMinutes}
      questionCount={questionCount}
      attemptsUsed={used}
      maxAttempts={exam.maxAttempts}
      resume={!!inProgress}
    />
  );
}
