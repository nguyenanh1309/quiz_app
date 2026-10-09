import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, attempts, classes, exams, students } from "@/db";
import { buildReview } from "@/lib/review";
import { PageHeader } from "@/components/PageHeader";
import { AttemptReview } from "@/components/AttemptReview";

export default async function AdminAttemptPage({ params }: PageProps<"/admin/attempts/[id]">) {
  const { id } = await params;
  const row = (
    await db
      .select({ attempt: attempts, exam: exams, student: students, cls: classes })
      .from(attempts)
      .innerJoin(exams, eq(attempts.examId, exams.id))
      .innerJoin(students, eq(attempts.studentId, students.id))
      .innerJoin(classes, eq(students.classId, classes.id))
      .where(eq(attempts.id, id))
      .limit(1)
  )[0];
  if (!row || row.attempt.status !== "SUBMITTED") notFound();
  const data = await buildReview(row.attempt, row.exam, {
    revealAnswers: true,
    studentName: row.student.name,
    className: row.cls.name,
  });
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader
        title={row.exam.title}
        subtitle={`Bài làm của ${row.student.name} – lớp ${row.cls.name}`}
        back={{ href: `/admin/exams/${row.exam.id}?class=${row.cls.id}`, label: "Bảng kết quả" }}
      />
      {(row.attempt.tabConflicts > 0 || row.attempt.leaveCount > 0) && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {row.attempt.tabConflicts > 0 && <div>Bài bị mở ở tab/thiết bị khác {row.attempt.tabConflicts} lần.</div>}
          {row.attempt.leaveCount > 0 && <div>Học sinh rời khỏi trang làm bài {row.attempt.leaveCount} lần.</div>}
        </div>
      )}
      <AttemptReview data={data} />
    </div>
  );
}
