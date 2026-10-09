import Link from "next/link";
import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, attempts, exams } from "@/db";
import { requireStudent } from "@/lib/auth";
import { buildReview } from "@/lib/review";
import { AttemptReview } from "@/components/AttemptReview";

export default async function StudentAttemptPage({ params }: PageProps<"/student/attempts/[id]">) {
  const { id } = await params;
  const { student, classRoom } = await requireStudent();
  const row = (
    await db
      .select({ attempt: attempts, exam: exams })
      .from(attempts)
      .innerJoin(exams, eq(attempts.examId, exams.id))
      .where(and(eq(attempts.id, id), eq(attempts.studentId, student.id)))
      .limit(1)
  )[0];
  if (!row || row.attempt.status !== "SUBMITTED") notFound();
  const data = await buildReview(row.attempt, row.exam, {
    revealAnswers: row.exam.showAnswers,
    studentName: student.name,
    className: classRoom.name,
  });
  return (
    <>
      <Link href="/student" className="mb-2 inline-block text-sm text-slate-500 hover:text-slate-800">
        ← Danh sách bài
      </Link>
      <h1 className="mb-5 text-2xl font-semibold tracking-tight text-slate-900">{row.exam.title}</h1>
      {!row.exam.showAnswers && (
        <p className="mb-4 rounded-lg bg-slate-50 px-4 py-2 text-sm text-slate-600">
          Thầy/cô chưa cho xem đáp án đúng của bài này. Em vẫn xem được câu nào đúng, câu nào sai.
        </p>
      )}
      <AttemptReview data={data} />
    </>
  );
}
