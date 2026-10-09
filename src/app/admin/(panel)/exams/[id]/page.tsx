import Link from "next/link";
import { notFound } from "next/navigation";
import { and, asc, eq, inArray } from "drizzle-orm";
import { db, attempts, classes, examAssignments, exams, questions, students } from "@/db";
import { finalizeExpired } from "@/lib/grading";
import { formatScore } from "@/lib/format";
import { stripHtml } from "@/lib/sanitize";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { OpenToggle } from "../ExamRowActions";
import { ResultsTable, type StudentResult } from "./ResultsTable";

export default async function ExamResultsPage({ params, searchParams }: PageProps<"/admin/exams/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  const exam = (await db.select().from(exams).where(eq(exams.id, id)).limit(1))[0];
  if (!exam) notFound();

  await finalizeExpired({ examId: id });

  const assigned = await db
    .select({ id: classes.id, name: classes.name })
    .from(examAssignments)
    .innerJoin(classes, eq(examAssignments.classId, classes.id))
    .where(eq(examAssignments.examId, id))
    .orderBy(asc(classes.name));

  const qs = await db.select().from(questions).where(eq(questions.examId, id)).orderBy(asc(questions.order));
  const classId = typeof sp.class === "string" && assigned.some((c) => c.id === sp.class) ? sp.class : assigned[0]?.id;

  const header = (
    <PageHeader
      title={exam.title}
      back={{ href: "/admin/exams", label: "Đề kiểm tra" }}
      subtitle={
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{qs.length} câu</span>
          <span>{exam.durationMinutes} phút</span>
          <span>{exam.maxAttempts === 0 ? "Không giới hạn lượt làm" : `Tối đa ${exam.maxAttempts} lượt`}</span>
          <span>{exam.showAnswers ? "Học sinh được xem đáp án" : "Ẩn đáp án với học sinh"}</span>
          <OpenToggle id={exam.id} isOpen={exam.isOpen} />
        </span>
      }
      actions={
        <>
          <Link href={`/admin/exams/${id}/edit`} className="btn">
            Sửa đề
          </Link>
          {classId && (
            <a href={`/api/admin/exams/${id}/export?class=${classId}`} className="btn btn-primary">
              Xuất Excel
            </a>
          )}
        </>
      }
    />
  );

  if (!classId)
    return (
      <>
        {header}
        <EmptyState>
          Đề chưa được giao cho lớp nào.{" "}
          <Link href={`/admin/exams/${id}/edit`} className="text-brand-600 hover:underline">
            Giao đề cho lớp
          </Link>
        </EmptyState>
      </>
    );

  const classStudents = await db
    .select()
    .from(students)
    .where(eq(students.classId, classId))
    .orderBy(asc(students.name));
  const studentIds = classStudents.map((s) => s.id);
  const atts = studentIds.length
    ? await db
        .select()
        .from(attempts)
        .where(and(eq(attempts.examId, id), inArray(attempts.studentId, studentIds)))
        .orderBy(asc(attempts.startedAt))
    : [];

  const rows: StudentResult[] = classStudents.map((s) => {
    const mine = atts.filter((a) => a.studentId === s.id);
    const done = mine.filter((a) => a.status === "SUBMITTED");
    const best = done.reduce<(typeof done)[number] | null>((b, a) => (!b || (a.score ?? 0) > (b.score ?? 0) ? a : b), null);
    const last = done[done.length - 1] ?? null;
    return {
      studentId: s.id,
      name: s.name,
      code: s.code,
      inProgress: mine.some((a) => a.status === "IN_PROGRESS"),
      bestScore: best?.score ?? null,
      lastScore: last?.score ?? null,
      attempts: done.map((a, i) => ({
        id: a.id,
        index: i + 1,
        score: a.score,
        correctCount: a.correctCount,
        totalCount: a.totalCount,
        durationSec: a.durationSec,
        submittedAt: a.submittedAt?.toISOString() ?? null,
        autoSubmitted: a.autoSubmitted,
        tabConflicts: a.tabConflicts,
        leaveCount: a.leaveCount,
      })),
    };
  });

  /* ---------- Thống kê: lấy điểm cao nhất của mỗi học sinh ---------- */
  const scores = rows.map((r) => r.bestScore).filter((x): x is number => x !== null);
  const avg = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
  const buckets = [
    { label: "Dưới 5", test: (s: number) => s < 5, color: "bg-red-400" },
    { label: "5 – 6.4", test: (s: number) => s >= 5 && s < 6.5, color: "bg-amber-400" },
    { label: "6.5 – 7.9", test: (s: number) => s >= 6.5 && s < 8, color: "bg-sky-400" },
    { label: "8 – 10", test: (s: number) => s >= 8, color: "bg-emerald-500" },
  ].map((b) => ({ ...b, count: scores.filter(b.test).length }));
  const maxBucket = Math.max(1, ...buckets.map((b) => b.count));
  const flagged = rows.filter((r) => r.attempts.some((a) => a.tabConflicts > 0)).length;

  /* ---------- Phân tích từng câu (tất cả lượt nộp của lớp) ---------- */
  const submitted = atts.filter((a) => a.status === "SUBMITTED");
  const qStats = qs.map((q, i) => {
    let answered = 0;
    let correct = 0;
    const picks = q.options.map(() => 0);
    for (const a of submitted) {
      const item = a.result?.find((r) => r.questionId === q.id);
      if (!item) continue;
      answered++;
      if (item.correct) correct++;
      if (item.chosen !== null && item.chosen < picks.length) picks[item.chosen]++;
    }
    return { index: i + 1, text: stripHtml(q.text || q.passage || ""), correctIndex: q.correctIndex, answered, correct, picks };
  });
  const hardest = [...qStats].filter((q) => q.answered > 0).sort((a, b) => a.correct / a.answered - b.correct / b.answered);

  return (
    <>
      {header}

      <div className="mb-5 flex flex-wrap gap-2">
        {assigned.map((c) => (
          <Link
            key={c.id}
            href={`/admin/exams/${id}?class=${c.id}`}
            className={`rounded-lg border px-4 py-1.5 text-sm font-medium transition ${
              c.id === classId
                ? "border-brand-600 bg-brand-600 text-white"
                : "border-slate-200 text-slate-600 hover:border-slate-300"
            }`}
          >
            Lớp {c.name}
          </Link>
        ))}
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Đã làm bài" value={`${scores.length}/${rows.length}`} />
        <Stat label="Điểm trung bình" value={avg === null ? "—" : formatScore(Math.round(avg * 100) / 100)} />
        <Stat label="Cao nhất" value={scores.length ? formatScore(Math.max(...scores)) : "—"} />
        <Stat label="Thấp nhất" value={scores.length ? formatScore(Math.min(...scores)) : "—"} />
        <Stat label="Mở nhiều tab" value={flagged} warn={flagged > 0} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <ResultsTable rows={rows} />

        <div className="space-y-6">
          <div className="card p-4">
            <h3 className="mb-3 font-semibold text-slate-900">Phổ điểm</h3>
            <div className="space-y-2">
              {buckets.map((b) => (
                <div key={b.label} className="flex items-center gap-2 text-sm">
                  <span className="w-20 shrink-0 text-slate-500">{b.label}</span>
                  <div className="h-5 flex-1 rounded bg-slate-100">
                    <div className={`h-5 rounded ${b.color}`} style={{ width: `${(b.count / maxBucket) * 100}%` }} />
                  </div>
                  <span className="w-6 text-right font-medium">{b.count}</span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-400">Tính theo điểm cao nhất của mỗi học sinh.</p>
          </div>

          <div className="card p-4">
            <h3 className="mb-1 font-semibold text-slate-900">Câu sai nhiều nhất</h3>
            <p className="mb-3 text-xs text-slate-400">Tỉ lệ đúng trên {submitted.length} lượt nộp của lớp.</p>
            {hardest.length === 0 ? (
              <p className="text-sm text-slate-500">Chưa có dữ liệu.</p>
            ) : (
              <div className="space-y-3">
                {hardest.slice(0, 8).map((q) => {
                  const pct = Math.round((q.correct / q.answered) * 100);
                  return (
                    <div key={q.index} className="text-sm">
                      <div className="flex justify-between gap-2">
                        <span className="truncate text-slate-700" title={q.text}>
                          <b>Câu {q.index}.</b> {q.text}
                        </span>
                        <span className={`shrink-0 font-semibold ${pct < 50 ? "text-red-600" : "text-slate-700"}`}>{pct}%</span>
                      </div>
                      <div className="mt-1 flex gap-1 text-xs text-slate-500">
                        {q.picks.map((n, k) => (
                          <span
                            key={k}
                            className={`rounded px-1.5 py-0.5 ${k === q.correctIndex ? "bg-emerald-50 font-semibold text-emerald-700" : "bg-slate-100"}`}
                          >
                            {"ABCDEFGH"[k]}: {n}
                          </span>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function Stat({ label, value, warn }: { label: string; value: React.ReactNode; warn?: boolean }) {
  return (
    <div className={`card p-4 ${warn ? "border-red-200 bg-red-50/40" : ""}`}>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-semibold ${warn ? "text-red-600" : "text-slate-900"}`}>{value}</div>
    </div>
  );
}
