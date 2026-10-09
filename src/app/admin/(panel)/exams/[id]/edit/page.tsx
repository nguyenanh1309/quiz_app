import { notFound } from "next/navigation";
import { asc, eq, sql } from "drizzle-orm";
import { db, classes, exams, questions, examAssignments } from "@/db";
import { PageHeader } from "@/components/PageHeader";
import { ExamEditor } from "@/components/ExamEditor";

export default async function EditExamPage({ params }: PageProps<"/admin/exams/[id]/edit">) {
  const { id } = await params;
  const exam = (await db.select().from(exams).where(eq(exams.id, id)).limit(1))[0];
  if (!exam) notFound();
  const [qs, assigned, list, [{ n: submitted }]] = await Promise.all([
    db.select().from(questions).where(eq(questions.examId, id)).orderBy(asc(questions.order)),
    db.select({ classId: examAssignments.classId }).from(examAssignments).where(eq(examAssignments.examId, id)),
    db.select({ id: classes.id, name: classes.name }).from(classes).orderBy(asc(classes.name)),
    db.select({ n: sql<number>`count(*)::int` }).from(sql`attempts`).where(sql`exam_id = ${id} and status = 'SUBMITTED'`),
  ]);

  return (
    <>
      <PageHeader
        title="Sửa đề"
        subtitle={exam.title}
        back={{ href: `/admin/exams/${id}`, label: "Kết quả đề" }}
      />
      {submitted > 0 && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Đề đã có <b>{submitted}</b> bài nộp. Điểm của các bài đã nộp được giữ nguyên; nếu bạn sửa đáp án, hãy xoá bài
          của học sinh để các em làm lại.
        </div>
      )}
      <ExamEditor
        isNew={false}
        classes={list}
        initial={{
          id: exam.id,
          title: exam.title,
          description: exam.description,
          durationMinutes: exam.durationMinutes,
          maxAttempts: exam.maxAttempts,
          showAnswers: exam.showAnswers,
          isOpen: exam.isOpen,
          sourceFileName: exam.sourceFileName,
          classIds: assigned.map((a) => a.classId),
          questions: qs.map((q) => ({
            id: q.id,
            passage: q.passage,
            text: q.text,
            options: q.options,
            correctIndex: q.correctIndex,
            explanation: q.explanation,
          })),
        }}
      />
    </>
  );
}
