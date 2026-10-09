import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db, attempts, classes, exams, students } from "@/db";
import { finalizeExpired } from "@/lib/grading";
import { formatDateTime, formatDuration, formatScore, scoreColor } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/PageHeader";

export default async function AdminHome() {
  await finalizeExpired();

  const [counts] = await db
    .select({
      classes: sql<number>`(select count(*)::int from classes)`,
      students: sql<number>`(select count(*)::int from students)`,
      exams: sql<number>`(select count(*)::int from exams)`,
      openExams: sql<number>`(select count(*)::int from exams where is_open)`,
      today: sql<number>`(select count(*)::int from attempts where status = 'SUBMITTED' and submitted_at >= date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') at time zone 'Asia/Ho_Chi_Minh')`,
      inProgress: sql<number>`(select count(*)::int from attempts where status = 'IN_PROGRESS')`,
    })
    .from(sql`(select 1) as one`);

  const recent = await db
    .select({
      id: attempts.id,
      score: attempts.score,
      correctCount: attempts.correctCount,
      totalCount: attempts.totalCount,
      durationSec: attempts.durationSec,
      submittedAt: attempts.submittedAt,
      autoSubmitted: attempts.autoSubmitted,
      tabConflicts: attempts.tabConflicts,
      studentName: students.name,
      className: classes.name,
      classId: classes.id,
      examTitle: exams.title,
      examId: exams.id,
    })
    .from(attempts)
    .innerJoin(students, eq(attempts.studentId, students.id))
    .innerJoin(classes, eq(students.classId, classes.id))
    .innerJoin(exams, eq(attempts.examId, exams.id))
    .where(eq(attempts.status, "SUBMITTED"))
    .orderBy(desc(attempts.submittedAt))
    .limit(15);

  const stats = [
    { label: "Lớp học", value: counts.classes, href: "/admin/classes" },
    { label: "Học sinh", value: counts.students, href: "/admin/classes" },
    { label: "Đề đang mở", value: `${counts.openExams}/${counts.exams}`, href: "/admin/exams" },
    { label: "Bài nộp hôm nay", value: counts.today },
    { label: "Đang làm bài", value: counts.inProgress },
  ];

  return (
    <>
      <PageHeader
        title="Tổng quan"
        actions={
          <Link href="/admin/exams/new" className="btn btn-primary">
            + Tạo đề từ file Word
          </Link>
        }
      />

      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {stats.map((s) => {
          const inner = (
            <>
              <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{s.label}</div>
              <div className="mt-1 text-2xl font-semibold text-slate-900">{s.value}</div>
            </>
          );
          return s.href ? (
            <Link key={s.label} href={s.href} className="card p-4 transition hover:border-brand-500">
              {inner}
            </Link>
          ) : (
            <div key={s.label} className="card p-4">
              {inner}
            </div>
          );
        })}
      </div>

      <h2 className="mb-3 text-lg font-semibold text-slate-900">Bài nộp gần đây</h2>
      {recent.length === 0 ? (
        <EmptyState>Chưa có học sinh nào nộp bài.</EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Học sinh</th>
                <th>Lớp</th>
                <th>Đề</th>
                <th className="text-right">Điểm</th>
                <th>Thời gian làm</th>
                <th>Nộp lúc</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="font-medium text-slate-800">{r.studentName}</td>
                  <td>{r.className}</td>
                  <td>
                    <Link href={`/admin/exams/${r.examId}?class=${r.classId}`} className="hover:text-brand-600">
                      {r.examTitle}
                    </Link>
                  </td>
                  <td className={`text-right font-semibold ${scoreColor(r.score)}`}>
                    {formatScore(r.score)}
                    <span className="ml-1 text-xs font-normal text-slate-400">
                      ({r.correctCount}/{r.totalCount})
                    </span>
                  </td>
                  <td className="text-slate-600">
                    {formatDuration(r.durationSec)}
                    {r.autoSubmitted && <span className="badge ml-1 bg-amber-50 text-amber-700">hết giờ</span>}
                    {r.tabConflicts > 0 && <span className="badge ml-1 bg-red-50 text-red-700">mở nhiều tab</span>}
                  </td>
                  <td className="whitespace-nowrap text-slate-500">{formatDateTime(r.submittedAt)}</td>
                  <td className="text-right">
                    <Link href={`/admin/attempts/${r.id}`} className="text-sm text-brand-600 hover:underline">
                      Xem bài
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
