import Link from "next/link";
import { desc, eq, sql } from "drizzle-orm";
import { db, exams, examAssignments, classes } from "@/db";
import { formatDateTime } from "@/lib/format";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { ExamMenu, OpenToggle } from "./ExamRowActions";

export default async function ExamsPage() {
  const list = await db
    .select({
      id: exams.id,
      title: exams.title,
      isOpen: exams.isOpen,
      durationMinutes: exams.durationMinutes,
      maxAttempts: exams.maxAttempts,
      createdAt: exams.createdAt,
      questionCount: sql<number>`(select count(*)::int from questions q where q.exam_id = ${exams.id})`,
      submitted: sql<number>`(select count(*)::int from attempts a where a.exam_id = ${exams.id} and a.status = 'SUBMITTED')`,
    })
    .from(exams)
    .orderBy(desc(exams.createdAt));

  const assigns = await db
    .select({ examId: examAssignments.examId, classId: classes.id, name: classes.name })
    .from(examAssignments)
    .innerJoin(classes, eq(examAssignments.classId, classes.id));
  const byExam = new Map<string, { classId: string; name: string }[]>();
  for (const a of assigns) byExam.set(a.examId, [...(byExam.get(a.examId) ?? []), a]);

  return (
    <>
      <PageHeader
        title="Đề kiểm tra"
        subtitle="Đề được lưu lại để giao cho nhiều lớp và làm nhiều lần."
        actions={
          <>
            <a href="/mau-de-trac-nghiem.docx" className="btn" download>
              Tải file Word mẫu
            </a>
            <Link href="/admin/exams/new" className="btn btn-primary">
              + Tạo đề mới
            </Link>
          </>
        }
      />
      {list.length === 0 ? (
        <EmptyState>
          Chưa có đề nào. Tải{" "}
          <a href="/mau-de-trac-nghiem.docx" className="text-brand-600 hover:underline">
            file Word mẫu
          </a>
          , soạn đề theo mẫu rồi bấm <b>Tạo đề mới</b>.
        </EmptyState>
      ) : (
        <div className="card overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Đề</th>
                <th>Lớp được giao</th>
                <th>Trạng thái</th>
                <th className="text-right">Bài nộp</th>
                <th className="text-right"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((e) => (
                <tr key={e.id} className="hover:bg-slate-50">
                  <td className="min-w-64">
                    <Link href={`/admin/exams/${e.id}`} className="font-medium text-slate-900 hover:text-brand-600">
                      {e.title}
                    </Link>
                    <div className="mt-0.5 text-xs text-slate-500">
                      {e.questionCount} câu · {e.durationMinutes} phút ·{" "}
                      {e.maxAttempts === 0 ? "không giới hạn lượt" : `tối đa ${e.maxAttempts} lượt`} · tạo{" "}
                      {formatDateTime(e.createdAt)}
                    </div>
                  </td>
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {(byExam.get(e.id) ?? []).map((c) => (
                        <Link
                          key={c.classId}
                          href={`/admin/exams/${e.id}?class=${c.classId}`}
                          className="badge bg-brand-50 text-brand-700 hover:bg-brand-100"
                        >
                          {c.name}
                        </Link>
                      ))}
                      {!byExam.get(e.id)?.length && <span className="text-xs text-slate-400">Chưa giao</span>}
                    </div>
                  </td>
                  <td>
                    <OpenToggle id={e.id} isOpen={e.isOpen} />
                  </td>
                  <td className="text-right font-medium">{e.submitted}</td>
                  <td className="whitespace-nowrap text-right">
                    <span className="inline-flex gap-1">
                      <Link href={`/admin/exams/${e.id}`} className="btn btn-sm">
                        Kết quả
                      </Link>
                      <Link href={`/admin/exams/${e.id}/edit`} className="btn btn-sm">
                        Sửa
                      </Link>
                      <ExamMenu id={e.id} title={e.title} />
                    </span>
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
