"use client";

import Link from "next/link";
import { Fragment, useMemo, useState, useTransition } from "react";
import { deleteAttempt } from "@/app/actions/admin";
import { formatDateTime, formatDuration, formatScore, scoreColor } from "@/lib/format";

export type AttemptSummary = {
  id: string;
  index: number;
  score: number | null;
  correctCount: number | null;
  totalCount: number | null;
  durationSec: number | null;
  submittedAt: string | null;
  autoSubmitted: boolean;
  tabConflicts: number;
  leaveCount: number;
};

export type StudentResult = {
  studentId: string;
  name: string;
  code: string;
  inProgress: boolean;
  bestScore: number | null;
  lastScore: number | null;
  attempts: AttemptSummary[];
};

type SortKey = "name" | "best" | "attempts";

export function ResultsTable({ rows }: { rows: StudentResult[] }) {
  const [sort, setSort] = useState<SortKey>("name");
  const [open, setOpen] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "done" | "notdone">("all");

  const list = useMemo(() => {
    let r = rows;
    if (filter === "done") r = r.filter((x) => x.attempts.length > 0);
    if (filter === "notdone") r = r.filter((x) => x.attempts.length === 0);
    const sorted = [...r];
    if (sort === "best") sorted.sort((a, b) => (b.bestScore ?? -1) - (a.bestScore ?? -1));
    if (sort === "attempts") sorted.sort((a, b) => b.attempts.length - a.attempts.length);
    return sorted;
  }, [rows, sort, filter]);

  return (
    <div className="card min-w-0">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3 text-sm">
        <select className="input w-auto py-1.5" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
          <option value="all">Tất cả học sinh</option>
          <option value="done">Đã làm</option>
          <option value="notdone">Chưa làm</option>
        </select>
        <select className="input w-auto py-1.5" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
          <option value="name">Sắp xếp theo tên</option>
          <option value="best">Điểm cao → thấp</option>
          <option value="attempts">Số lần làm</option>
        </select>
        <span className="text-slate-400">Bấm vào một học sinh để xem từng lần làm.</span>
      </div>
      {rows.length === 0 ? (
        <p className="p-6 text-center text-sm text-slate-500">Lớp chưa có học sinh.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th>Học sinh</th>
                <th className="text-right">Điểm cao nhất</th>
                <th className="text-right">Lần cuối</th>
                <th className="text-center">Số lần</th>
                <th>Thời gian (lần cuối)</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const last = r.attempts[r.attempts.length - 1];
                const conflicts = r.attempts.reduce((n, a) => n + a.tabConflicts, 0);
                const isOpen = open === r.studentId;
                return (
                  <Fragment key={r.studentId}>
                    <tr
                      className={`cursor-pointer ${isOpen ? "bg-slate-50" : "hover:bg-slate-50"}`}
                      onClick={() => setOpen(isOpen ? null : r.studentId)}
                    >
                      <td>
                        <div className="font-medium text-slate-800">{r.name}</div>
                        <div className="font-mono text-xs text-slate-400">{r.code}</div>
                      </td>
                      <td className={`text-right text-base font-semibold ${scoreColor(r.bestScore)}`}>
                        {formatScore(r.bestScore)}
                      </td>
                      <td className={`text-right ${scoreColor(r.lastScore)}`}>{formatScore(r.lastScore)}</td>
                      <td className="text-center">{r.attempts.length}</td>
                      <td className="whitespace-nowrap text-slate-600">
                        {last ? formatDuration(last.durationSec) : "—"}
                        {last && <div className="text-xs text-slate-400">{formatDateTime(last.submittedAt)}</div>}
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-1">
                          {r.inProgress && <span className="badge bg-sky-50 text-sky-700">Đang làm</span>}
                          {r.attempts.length === 0 && !r.inProgress && (
                            <span className="badge bg-slate-100 text-slate-500">Chưa làm</span>
                          )}
                          {conflicts > 0 && <span className="badge bg-red-50 text-red-700">Mở nhiều tab ×{conflicts}</span>}
                          {r.attempts.some((a) => a.autoSubmitted) && (
                            <span className="badge bg-amber-50 text-amber-700">Hết giờ tự nộp</span>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr className="bg-slate-50">
                        <td colSpan={6} className="pb-4">
                          {r.attempts.length === 0 ? (
                            <p className="text-sm text-slate-500">Học sinh chưa nộp bài lần nào.</p>
                          ) : (
                            <div className="space-y-1.5">
                              {r.attempts.map((a) => (
                                <AttemptLine key={a.id} a={a} />
                              ))}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function AttemptLine({ a }: { a: AttemptSummary }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm">
      <span className="font-medium text-slate-700">Lần {a.index}</span>
      <span className={`font-semibold ${scoreColor(a.score)}`}>
        {formatScore(a.score)} điểm{" "}
        <span className="font-normal text-slate-400">
          ({a.correctCount}/{a.totalCount} câu đúng)
        </span>
      </span>
      <span className="text-slate-500">{formatDuration(a.durationSec)}</span>
      <span className="text-slate-400">{formatDateTime(a.submittedAt)}</span>
      {a.leaveCount > 0 && <span className="text-xs text-slate-500">Rời trang {a.leaveCount} lần</span>}
      {a.tabConflicts > 0 && <span className="badge bg-red-50 text-red-700">Mở ở tab khác ×{a.tabConflicts}</span>}
      {a.autoSubmitted && <span className="badge bg-amber-50 text-amber-700">Hết giờ</span>}
      <span className="flex-1" />
      <Link href={`/admin/attempts/${a.id}`} className="btn btn-sm" onClick={(e) => e.stopPropagation()}>
        Xem bài
      </Link>
      <button
        className="btn btn-sm btn-danger"
        disabled={pending}
        onClick={(e) => {
          e.stopPropagation();
          if (confirm("Xoá lượt làm này? Học sinh sẽ được thêm một lượt làm lại.")) start(() => void deleteAttempt(a.id));
        }}
      >
        Xoá
      </button>
    </div>
  );
}
