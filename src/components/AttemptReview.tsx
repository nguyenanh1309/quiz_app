"use client";

import { useState } from "react";
import { formatDateTime, formatDuration, formatScore, scoreColor } from "@/lib/format";

export type ReviewQuestion = {
  id: string;
  passage: string | null;
  text: string;
  options: string[];
  explanation: string | null;
};

export type ReviewData = {
  examTitle: string;
  studentName?: string;
  className?: string;
  score: number | null;
  correctCount: number | null;
  totalCount: number | null;
  durationSec: number | null;
  submittedAt: string | null;
  autoSubmitted: boolean;
  attemptIndex?: number;
  /** null = ẩn đáp án đúng (giáo viên tắt chế độ xem đáp án) */
  questions: (ReviewQuestion & { chosen: number | null; correctIndex: number | null; correct: boolean })[];
  showAnswers: boolean;
};

const LETTERS = "ABCDEFGH";

function Rich({ html, className = "" }: { html: string; className?: string }) {
  return <div className={`rich ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function AttemptReview({ data }: { data: ReviewData }) {
  const [onlyWrong, setOnlyWrong] = useState(false);
  const wrong = data.questions.filter((q) => !q.correct).length;
  const blank = data.questions.filter((q) => q.chosen === null).length;

  return (
    <div>
      <div className="card mb-6 overflow-hidden">
        <div className="flex flex-wrap items-center gap-6 p-5">
          <div className="text-center">
            <div className={`text-5xl font-bold tracking-tight ${scoreColor(data.score)}`}>{formatScore(data.score)}</div>
            <div className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-400">điểm / 10</div>
          </div>
          <div className="grid flex-1 grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <Info label="Số câu đúng" value={`${data.correctCount ?? 0}/${data.totalCount ?? 0}`} />
            <Info label="Câu sai" value={wrong - blank} />
            <Info label="Bỏ trống" value={blank} />
            <Info label="Thời gian làm" value={formatDuration(data.durationSec)} />
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-slate-100 bg-slate-50 px-5 py-2.5 text-xs text-slate-500">
          {data.studentName && (
            <span>
              {data.studentName}
              {data.className ? ` · Lớp ${data.className}` : ""}
            </span>
          )}
          {data.attemptIndex && <span>Lần làm thứ {data.attemptIndex}</span>}
          <span>Nộp lúc {formatDateTime(data.submittedAt)}</span>
          {data.autoSubmitted && <span className="font-medium text-amber-700">Hết giờ – bài được tự động nộp</span>}
        </div>
      </div>

      {/* Bản đồ câu */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {data.questions.map((q, i) => (
          <a
            key={q.id}
            href={`#c${i + 1}`}
            className={`grid h-8 w-8 place-items-center rounded-md text-xs font-semibold ${
              q.correct
                ? "bg-emerald-100 text-emerald-800"
                : q.chosen === null
                  ? "bg-slate-200 text-slate-600"
                  : "bg-red-100 text-red-700"
            }`}
          >
            {i + 1}
          </a>
        ))}
      </div>

      {wrong > 0 && (
        <label className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600">
          <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={onlyWrong} onChange={(e) => setOnlyWrong(e.target.checked)} />
          Chỉ xem các câu làm sai / bỏ trống ({wrong})
        </label>
      )}

      <div className="space-y-4">
        {data.questions.map((q, i) => {
          if (onlyWrong && q.correct) return null;
          const showPassage = q.passage && (i === 0 || data.questions[i - 1].passage !== q.passage || onlyWrong);
          return (
            <div key={q.id} id={`c${i + 1}`} className="scroll-mt-24">
              {showPassage && (
                <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm leading-relaxed text-slate-700">
                  <Rich html={q.passage!} />
                </div>
              )}
              <div className={`card p-4 ${q.correct ? "" : q.chosen === null ? "border-slate-300" : "border-red-200"}`}>
                <div className="mb-3 flex items-start gap-3">
                  <span
                    className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${
                      q.correct ? "bg-emerald-100 text-emerald-800" : q.chosen === null ? "bg-slate-200 text-slate-600" : "bg-red-100 text-red-700"
                    }`}
                  >
                    Câu {i + 1} · {q.correct ? "Đúng" : q.chosen === null ? "Bỏ trống" : "Sai"}
                  </span>
                  {q.text && <Rich html={q.text} className="text-slate-900" />}
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {q.options.map((o, k) => {
                    const isChosen = q.chosen === k;
                    const isCorrect = q.correctIndex === k;
                    let cls = "border-slate-200 text-slate-700";
                    if (isCorrect) cls = "border-emerald-400 bg-emerald-50 text-emerald-900";
                    if (isChosen && !q.correct) cls = "border-red-400 bg-red-50 text-red-900";
                    if (isChosen && q.correct) cls = "border-emerald-500 bg-emerald-50 text-emerald-900";
                    return (
                      <div key={k} className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${cls}`}>
                        <span className="font-semibold">{LETTERS[k]}.</span>
                        <Rich html={o} className="flex-1" />
                        {isChosen && <span className="shrink-0 text-xs font-medium">{q.correct ? "✓ Em chọn" : "✗ Em chọn"}</span>}
                        {!isChosen && isCorrect && <span className="shrink-0 text-xs font-medium">✓ Đáp án đúng</span>}
                      </div>
                    );
                  })}
                </div>
                {data.showAnswers && q.explanation && (
                  q.correct ? (
                    <details className="mt-3 text-sm">
                      <summary className="cursor-pointer text-slate-500 hover:text-slate-800">Xem giải thích</summary>
                      <Rich html={q.explanation} className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-slate-700" />
                    </details>
                  ) : (
                    <div className="mt-3 rounded-lg border-l-4 border-amber-400 bg-amber-50 px-3 py-2 text-sm text-slate-800">
                      <div className="mb-0.5 text-xs font-semibold uppercase tracking-wide text-amber-700">Giải thích</div>
                      <Rich html={q.explanation} />
                    </div>
                  )
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="text-lg font-semibold text-slate-900">{value}</div>
    </div>
  );
}
