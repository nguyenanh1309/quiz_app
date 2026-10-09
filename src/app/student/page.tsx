import Link from "next/link";
import { and, asc, desc, eq, sql } from "drizzle-orm";
import { db, attempts, examAssignments, exams } from "@/db";
import { requireStudent } from "@/lib/auth";
import { finalizeExpired } from "@/lib/grading";
import { formatDateTime, formatDuration, formatScore, scoreColor } from "@/lib/format";

export default async function StudentHome() {
  const { student } = await requireStudent();
  await finalizeExpired({ studentId: student.id });

  const list = await db
    .select({
      id: exams.id,
      title: exams.title,
      description: exams.description,
      durationMinutes: exams.durationMinutes,
      maxAttempts: exams.maxAttempts,
      isOpen: exams.isOpen,
      questionCount: sql<number>`(select count(*)::int from questions q where q.exam_id = ${exams.id})`,
    })
    .from(exams)
    .innerJoin(examAssignments, and(eq(examAssignments.examId, exams.id), eq(examAssignments.classId, student.classId)))
    .orderBy(desc(examAssignments.createdAt));

  const mine = await db
    .select()
    .from(attempts)
    .where(eq(attempts.studentId, student.id))
    .orderBy(asc(attempts.startedAt));

  return (
    <>
      <h1 className="mb-1 text-2xl font-semibold tracking-tight text-slate-900">Bài kiểm tra của em</h1>
      <p className="mb-6 text-sm text-slate-500">Chọn một bài để bắt đầu. Kết quả và lời giải hiện ngay sau khi nộp.</p>

      {list.length === 0 ? (
        <div className="card px-6 py-12 text-center text-sm text-slate-500">Hiện chưa có bài kiểm tra nào.</div>
      ) : (
        <div className="space-y-4">
          {list.map((e) => {
            const atts = mine.filter((a) => a.examId === e.id);
            const done = atts.filter((a) => a.status === "SUBMITTED");
            const inProgress = atts.some((a) => a.status === "IN_PROGRESS");
            const best = done.reduce<number | null>((b, a) => (b === null || (a.score ?? 0) > b ? (a.score ?? 0) : b), null);
            const outOfTurns = e.maxAttempts > 0 && done.length >= e.maxAttempts;
            const canStart = inProgress || (e.isOpen && !outOfTurns);
            return (
              <div key={e.id} className="card p-5">
                <div className="flex flex-wrap items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg font-semibold text-slate-900">{e.title}</h2>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-sm text-slate-500">
                      <span>{e.questionCount} câu</span>
                      <span>{e.durationMinutes} phút</span>
                      <span>
                        Đã làm {done.length}
                        {e.maxAttempts > 0 ? `/${e.maxAttempts}` : ""} lần
                      </span>
                    </div>
                    {e.description && <p className="mt-2 text-sm text-slate-600">{e.description}</p>}
                  </div>
                  {best !== null && (
                    <div className="text-right">
                      <div className={`text-3xl font-bold ${scoreColor(best)}`}>{formatScore(best)}</div>
                      <div className="text-xs text-slate-400">điểm cao nhất</div>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {canStart ? (
                    <Link href={`/student/exams/${e.id}`} className="btn btn-primary px-5">
                      {inProgress ? "Làm tiếp" : done.length ? "Làm lại" : "Bắt đầu làm bài"}
                    </Link>
                  ) : (
                    <span className="badge bg-slate-100 py-1 text-slate-500">
                      {!e.isOpen ? "Đề đã đóng" : "Đã hết lượt làm"}
                    </span>
                  )}
                </div>

                {done.length > 0 && (
                  <div className="mt-4 divide-y divide-slate-100 rounded-lg border border-slate-100">
                    {done.map((a, i) => (
                      <Link
                        key={a.id}
                        href={`/student/attempts/${a.id}`}
                        className="flex flex-wrap items-center gap-x-4 gap-y-1 px-3 py-2 text-sm hover:bg-slate-50"
                      >
                        <span className="w-14 font-medium text-slate-600">Lần {i + 1}</span>
                        <span className={`w-16 font-semibold ${scoreColor(a.score)}`}>{formatScore(a.score)} đ</span>
                        <span className="text-slate-500">
                          {a.correctCount}/{a.totalCount} câu đúng
                        </span>
                        <span className="text-slate-400">{formatDuration(a.durationSec)}</span>
                        <span className="hidden text-slate-400 sm:inline">{formatDateTime(a.submittedAt)}</span>
                        <span className="ml-auto text-brand-600">Xem lại →</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
