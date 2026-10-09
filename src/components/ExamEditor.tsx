"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { parseDocxAction, saveExam, type ExamPayload } from "@/app/actions/admin";

export type EditorQuestion = {
  key: string;
  id?: string;
  passage: string | null;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string | null;
};

export type EditorInitial = Omit<ExamPayload, "questions"> & { questions: Omit<EditorQuestion, "key">[] };

const LETTERS = "ABCDEFGH";
let keySeq = 0;
const newKey = () => `q${Date.now().toString(36)}${(keySeq++).toString(36)}`;

/* ---------- chuyển HTML <-> văn bản dễ sửa trong ô nhập ---------- */
function toEditable(html: string | null) {
  if (!html) return "";
  return html
    .replace(/<\/p>\s*<p>/g, "\n\n")
    .replace(/<\/?p>/g, "")
    .replace(/<br\s*\/?>/g, "\n");
}
function fromEditable(text: string, paragraphs = false) {
  // không cắt khoảng trắng khi đang gõ (máy chủ sẽ làm gọn lúc lưu)
  const t = text.replace(/\r\n/g, "\n");
  if (!t.trim()) return "";
  if (paragraphs && /\n\s*\n/.test(t))
    return t
      .split(/\n\s*\n/)
      .map((p) => `<p>${p.replace(/\n/g, "<br />")}</p>`)
      .join("");
  return t.replace(/\n/g, "<br />");
}

function issuesOf(q: EditorQuestion) {
  const out: string[] = [];
  if (!q.text.trim() && !q.passage?.trim()) out.push("Thiếu nội dung câu hỏi");
  if (q.options.length < 2) out.push("Cần ít nhất 2 phương án");
  if (q.options.some((o) => !o.trim())) out.push("Có phương án trống");
  if (q.correctIndex < 0 || q.correctIndex >= q.options.length) out.push("Chưa chọn đáp án đúng");
  return out;
}

function Rich({ html, className = "" }: { html: string; className?: string }) {
  return <div className={`rich ${className}`} dangerouslySetInnerHTML={{ __html: html }} />;
}

export function ExamEditor({
  initial,
  classes,
  isNew,
}: {
  initial: EditorInitial;
  classes: { id: string; name: string }[];
  isNew: boolean;
}) {
  const router = useRouter();
  const [meta, setMeta] = useState(() => {
    const { questions: _q, ...rest } = initial;
    void _q;
    return rest;
  });
  const [qs, setQs] = useState<EditorQuestion[]>(() => initial.questions.map((q) => ({ ...q, key: newKey() })));
  const [warnings, setWarnings] = useState<string[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [onlyIssues, setOnlyIssues] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [saving, startSave] = useTransition();
  const [uploading, startUpload] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);
  const importMode = useRef<"replace" | "append">("replace");

  useEffect(() => {
    if (!dirty) return;
    const h = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", h);
    return () => window.removeEventListener("beforeunload", h);
  }, [dirty]);

  const issues = useMemo(() => new Map(qs.map((q) => [q.key, issuesOf(q)])), [qs]);
  const issueCount = [...issues.values()].filter((v) => v.length).length;

  const update = (key: string, patch: Partial<EditorQuestion>) => {
    setDirty(true);
    setQs((list) => list.map((q) => (q.key === key ? { ...q, ...patch } : q)));
  };

  /** Sửa đoạn văn → áp dụng cho cả nhóm câu liền kề dùng chung đoạn văn đó. */
  const updatePassage = (key: string, passage: string | null) => {
    setDirty(true);
    setQs((list) => {
      const i = list.findIndex((q) => q.key === key);
      const old = list[i].passage;
      let a = i;
      let b = i;
      if (old) {
        while (a > 0 && list[a - 1].passage === old) a--;
        while (b < list.length - 1 && list[b + 1].passage === old) b++;
      }
      return list.map((q, k) => (k >= a && k <= b ? { ...q, passage } : q));
    });
  };

  const move = (key: string, dir: -1 | 1) => {
    setDirty(true);
    setQs((list) => {
      const i = list.findIndex((q) => q.key === key);
      const j = i + dir;
      if (j < 0 || j >= list.length) return list;
      const copy = [...list];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  };

  const addQuestion = () => {
    const key = newKey();
    const last = qs[qs.length - 1];
    setQs((list) => [
      ...list,
      { key, passage: last?.passage ?? null, text: "", options: ["", "", "", ""], correctIndex: -1, explanation: null },
    ]);
    setEditing(key);
    setDirty(true);
    setTimeout(() => document.getElementById(key)?.scrollIntoView({ behavior: "smooth", block: "center" }), 50);
  };

  const onFile = (file: File) => {
    setUploadError(null);
    const fd = new FormData();
    fd.set("file", file);
    startUpload(async () => {
      const r = await parseDocxAction(fd);
      if (!r.ok || !r.data) {
        setUploadError(r.ok ? "Không đọc được file." : r.error);
        return;
      }
      const parsed = r.data.questions.map((q) => ({ ...q, key: newKey() }));
      if (importMode.current === "append") setQs((list) => [...list, ...parsed]);
      else {
        setQs(parsed);
        setMeta((m) => ({
          ...m,
          title: m.title || r.data!.titleSuggestion || r.data!.fileName.replace(/\.docx$/i, ""),
          sourceFileName: r.data!.fileName,
        }));
      }
      setWarnings(r.data.warnings);
      setDirty(true);
    });
  };

  const pickFile = (mode: "replace" | "append") => {
    importMode.current = mode;
    fileRef.current?.click();
  };

  const save = () => {
    setError(null);
    const firstBad = qs.findIndex((q) => issuesOf(q).length);
    if (firstBad >= 0) {
      setError(`Câu ${firstBad + 1}: ${issuesOf(qs[firstBad])[0]}.`);
      document.getElementById(qs[firstBad].key)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    startSave(async () => {
      const r = await saveExam({
        ...meta,
        questions: qs.map(({ key: _k, ...q }) => {
          void _k;
          return q;
        }),
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setDirty(false);
      router.push(`/admin/exams/${r.data!.id}`);
      router.refresh();
    });
  };

  const visible = qs.map((q, i) => ({ q, i })).filter(({ q }) => !onlyIssues || issues.get(q.key)!.length);
  const hasQuestions = qs.length > 0;

  return (
    <div className="pb-28">
      <input
        ref={fileRef}
        type="file"
        accept=".docx"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />

      {/* ---------- Bước 1: tải file Word ---------- */}
      {isNew && !hasQuestions && (
        <DropZone uploading={uploading} onFile={onFile} onPick={() => pickFile("replace")} error={uploadError}>
          <button type="button" className="text-sm text-slate-500 hover:text-slate-800" onClick={addQuestion}>
            hoặc tạo đề trống và nhập câu hỏi bằng tay →
          </button>
        </DropZone>
      )}

      {hasQuestions && (
        <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
          {/* ---------- Danh sách câu hỏi ---------- */}
          <div className="order-2 lg:order-1">
            {warnings.length > 0 && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <div className="mb-1 font-semibold">Cần kiểm tra lại ({warnings.length})</div>
                <ul className="list-inside list-disc space-y-0.5">
                  {warnings.slice(0, 12).map((w, i) => (
                    <li key={i}>{w}</li>
                  ))}
                </ul>
                {warnings.length > 12 && <div className="mt-1">… và {warnings.length - 12} cảnh báo khác</div>}
              </div>
            )}
            {uploadError && <p className="mb-3 text-sm text-red-600">{uploadError}</p>}

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-slate-900">{qs.length} câu hỏi</h2>
              {issueCount > 0 && (
                <button
                  type="button"
                  onClick={() => setOnlyIssues((v) => !v)}
                  className={`badge ${onlyIssues ? "bg-red-600 text-white" : "bg-red-50 text-red-700"}`}
                >
                  {issueCount} câu cần sửa {onlyIssues ? "· hiện tất cả" : "· chỉ hiện câu lỗi"}
                </button>
              )}
              <div className="flex-1" />
              <button type="button" className="btn btn-sm" disabled={uploading} onClick={() => pickFile("append")}>
                {uploading ? "Đang đọc..." : "Thêm câu từ Word"}
              </button>
              <button
                type="button"
                className="btn btn-sm"
                disabled={uploading}
                onClick={() => {
                  if (confirm("Thay toàn bộ câu hỏi hiện tại bằng nội dung file Word mới?")) pickFile("replace");
                }}
              >
                Thay bằng file Word khác
              </button>
            </div>

            <div className="space-y-3">
              {visible.map(({ q, i }) => {
                const showPassage = q.passage && (i === 0 || qs[i - 1].passage !== q.passage);
                return (
                  <div key={q.key}>
                    {showPassage && editing !== q.key && (
                      <div className="mb-2 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                        <Rich html={q.passage!} />
                      </div>
                    )}
                    <QuestionCard
                      q={q}
                      index={i}
                      total={qs.length}
                      issues={issues.get(q.key)!}
                      editing={editing === q.key}
                      onEdit={() => setEditing(editing === q.key ? null : q.key)}
                      onChange={(p) => update(q.key, p)}
                      onPassage={(p) => updatePassage(q.key, p)}
                      onMove={(d) => move(q.key, d)}
                      onDelete={() => {
                        if (confirm(`Xoá câu ${i + 1}?`)) {
                          setQs((l) => l.filter((x) => x.key !== q.key));
                          setDirty(true);
                        }
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <button type="button" className="btn mt-4 w-full border-dashed py-3" onClick={addQuestion}>
              + Thêm câu hỏi
            </button>
          </div>

          {/* ---------- Thông tin đề ---------- */}
          <aside className="order-1 lg:order-2">
            <div className="card space-y-4 p-4 lg:sticky lg:top-20">
              <div>
                <label className="label">Tên đề</label>
                <input
                  className="input"
                  value={meta.title}
                  onChange={(e) => {
                    setMeta({ ...meta, title: e.target.value });
                    setDirty(true);
                  }}
                  placeholder="VD: Kiểm tra 15 phút Unit 1"
                />
              </div>
              <div>
                <label className="label">Ghi chú cho học sinh</label>
                <textarea
                  className="input min-h-16"
                  value={meta.description ?? ""}
                  onChange={(e) => {
                    setMeta({ ...meta, description: e.target.value });
                    setDirty(true);
                  }}
                  placeholder="Không bắt buộc"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Thời gian (phút)</label>
                  <input
                    type="number"
                    min={1}
                    max={600}
                    className="input"
                    value={meta.durationMinutes}
                    onChange={(e) => {
                      setMeta({ ...meta, durationMinutes: Number(e.target.value) || 0 });
                      setDirty(true);
                    }}
                  />
                </div>
                <div>
                  <label className="label">Số lần làm</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    className="input"
                    value={meta.maxAttempts}
                    onChange={(e) => {
                      setMeta({ ...meta, maxAttempts: Math.max(0, Number(e.target.value) || 0) });
                      setDirty(true);
                    }}
                  />
                  <p className="mt-1 text-xs text-slate-500">0 = không giới hạn</p>
                </div>
              </div>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-brand-600"
                  checked={meta.showAnswers}
                  onChange={(e) => {
                    setMeta({ ...meta, showAnswers: e.target.checked });
                    setDirty(true);
                  }}
                />
                <span>Cho học sinh xem đáp án đúng và giải thích sau khi nộp</span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-brand-600"
                  checked={meta.isOpen}
                  onChange={(e) => {
                    setMeta({ ...meta, isOpen: e.target.checked });
                    setDirty(true);
                  }}
                />
                <span>Mở đề (học sinh có thể vào làm)</span>
              </label>
              <div>
                <div className="label">Giao cho lớp</div>
                {classes.length === 0 ? (
                  <p className="text-xs text-slate-500">Chưa có lớp nào – hãy tạo lớp trước.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {classes.map((c) => {
                      const on = meta.classIds.includes(c.id);
                      return (
                        <button
                          type="button"
                          key={c.id}
                          onClick={() => {
                            setMeta({
                              ...meta,
                              classIds: on ? meta.classIds.filter((x) => x !== c.id) : [...meta.classIds, c.id],
                            });
                            setDirty(true);
                          }}
                          className={`rounded-lg border px-3 py-1.5 text-sm transition ${
                            on
                              ? "border-brand-600 bg-brand-600 text-white"
                              : "border-slate-200 text-slate-600 hover:border-slate-300"
                          }`}
                        >
                          {on ? "✓ " : ""}
                          {c.name}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* ---------- Thanh lưu ---------- */}
      {hasQuestions && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1 text-sm">
              {error ? (
                <span className="text-red-600">{error}</span>
              ) : issueCount > 0 ? (
                <span className="text-amber-700">Còn {issueCount} câu cần sửa trước khi lưu.</span>
              ) : (
                <span className="text-slate-500">
                  {qs.length} câu · {meta.durationMinutes} phút · {meta.classIds.length} lớp
                  {dirty ? " · có thay đổi chưa lưu" : ""}
                </span>
              )}
            </div>
            <button type="button" className="btn" onClick={() => router.back()}>
              Huỷ
            </button>
            <button type="button" className="btn btn-primary px-6" disabled={saving} onClick={save}>
              {saving ? "Đang lưu..." : isNew ? "Lưu đề" : "Lưu thay đổi"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function DropZone({
  uploading,
  onFile,
  onPick,
  error,
  children,
}: {
  uploading: boolean;
  onFile: (f: File) => void;
  onPick: () => void;
  error: string | null;
  children: React.ReactNode;
}) {
  const [over, setOver] = useState(false);
  return (
    <div className="mx-auto max-w-2xl">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onFile(f);
        }}
        className={`flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-14 text-center transition ${
          over ? "border-brand-500 bg-brand-50" : "border-slate-300 bg-white"
        }`}
      >
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-brand-50 text-2xl text-brand-600">W</div>
        <h2 className="text-lg font-semibold text-slate-900">
          {uploading ? "Đang đọc file Word..." : "Kéo thả file Word (.docx) vào đây"}
        </h2>
        <p className="mt-1 max-w-md text-sm text-slate-500">
          Câu hỏi bắt đầu bằng &quot;Câu 1:&quot;, phương án &quot;A. B. C. D.&quot;, <b>bôi đậm</b> đáp án đúng, giải thích
          bắt đầu bằng &quot;Giải thích:&quot;.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <button type="button" className="btn btn-primary" disabled={uploading} onClick={onPick}>
            Chọn file Word
          </button>
          <a href="/mau-de-trac-nghiem.docx" className="btn" download>
            Tải file mẫu
          </a>
        </div>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
      </div>
      <div className="mt-4 text-center">{children}</div>
    </div>
  );
}

function QuestionCard({
  q,
  index,
  total,
  issues,
  editing,
  onEdit,
  onChange,
  onPassage,
  onMove,
  onDelete,
}: {
  q: EditorQuestion;
  index: number;
  total: number;
  issues: string[];
  editing: boolean;
  onEdit: () => void;
  onChange: (p: Partial<EditorQuestion>) => void;
  onPassage: (p: string | null) => void;
  onMove: (d: -1 | 1) => void;
  onDelete: () => void;
}) {
  return (
    <div
      id={q.key}
      className={`card scroll-mt-24 p-4 ${issues.length ? "border-red-300" : ""} ${editing ? "ring-2 ring-brand-100" : ""}`}
    >
      <div className="mb-2 flex items-start gap-2">
        <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
          Câu {index + 1}
        </span>
        <div className="flex flex-1 flex-wrap gap-1">
          {issues.map((m) => (
            <span key={m} className="badge bg-red-50 text-red-700">
              {m}
            </span>
          ))}
        </div>
        <div className="flex shrink-0 gap-1">
          <button type="button" className="btn btn-sm" disabled={index === 0} onClick={() => onMove(-1)} title="Lên">
            ↑
          </button>
          <button type="button" className="btn btn-sm" disabled={index === total - 1} onClick={() => onMove(1)} title="Xuống">
            ↓
          </button>
          <button type="button" className={`btn btn-sm ${editing ? "btn-primary" : ""}`} onClick={onEdit}>
            {editing ? "Xong" : "Sửa"}
          </button>
          <button type="button" className="btn btn-sm btn-danger" onClick={onDelete}>
            Xoá
          </button>
        </div>
      </div>

      {!editing ? (
        <div onDoubleClick={onEdit}>
          {q.text ? <Rich html={q.text} className="text-slate-900" /> : null}
          <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
            {q.options.map((o, k) => (
              <div
                key={k}
                className={`flex gap-2 rounded-lg border px-3 py-1.5 text-sm ${
                  k === q.correctIndex
                    ? "border-emerald-300 bg-emerald-50 font-medium text-emerald-800"
                    : "border-slate-200 text-slate-700"
                }`}
              >
                <span className="font-semibold">{LETTERS[k]}.</span>
                <Rich html={o || "<i>(trống)</i>"} />
                {k === q.correctIndex && <span className="ml-auto">✓</span>}
              </div>
            ))}
          </div>
          {q.explanation && (
            <div className="mt-2 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">
              <span className="font-medium">Giải thích: </span>
              <Rich html={q.explanation} className="inline" />
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div>
            <label className="label">Đoạn văn / hướng dẫn chung (dùng cho cả nhóm câu liền kề)</label>
            <textarea
              className="input min-h-20 text-sm"
              value={toEditable(q.passage)}
              onChange={(e) => onPassage(fromEditable(e.target.value, true) || null)}
              placeholder="Không bắt buộc"
            />
          </div>
          <div>
            <label className="label">Câu hỏi</label>
            <textarea
              className="input min-h-16"
              value={toEditable(q.text)}
              onChange={(e) => onChange({ text: fromEditable(e.target.value) })}
            />
            <p className="mt-1 text-xs text-slate-500">
              Gạch chân: &lt;u&gt;chữ&lt;/u&gt; · In nghiêng: &lt;em&gt;chữ&lt;/em&gt;
            </p>
          </div>
          <div>
            <label className="label">Phương án (chọn ô tròn ở đáp án đúng)</label>
            <div className="space-y-2">
              {q.options.map((o, k) => (
                <div key={k} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name={`correct-${q.key}`}
                    className="h-4 w-4 accent-emerald-600"
                    checked={q.correctIndex === k}
                    onChange={() => onChange({ correctIndex: k })}
                    title="Đáp án đúng"
                  />
                  <span className="w-5 text-sm font-semibold text-slate-600">{LETTERS[k]}.</span>
                  <input
                    className={`input ${q.correctIndex === k ? "border-emerald-400" : ""}`}
                    value={toEditable(o)}
                    onChange={(e) => {
                      const options = [...q.options];
                      options[k] = fromEditable(e.target.value);
                      onChange({ options });
                    }}
                  />
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={q.options.length <= 2}
                    onClick={() => {
                      const options = q.options.filter((_, x) => x !== k);
                      let correctIndex = q.correctIndex;
                      if (k === correctIndex) correctIndex = -1;
                      else if (k < correctIndex) correctIndex--;
                      onChange({ options, correctIndex });
                    }}
                    title="Xoá phương án"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
            {q.options.length < LETTERS.length && (
              <button type="button" className="btn btn-sm mt-2" onClick={() => onChange({ options: [...q.options, ""] })}>
                + Phương án
              </button>
            )}
          </div>
          <div>
            <label className="label">Giải thích (hiện cho học sinh sau khi nộp)</label>
            <textarea
              className="input min-h-14 text-sm"
              value={toEditable(q.explanation)}
              onChange={(e) => onChange({ explanation: fromEditable(e.target.value) || null })}
              placeholder="Không bắt buộc"
            />
          </div>
        </div>
      )}
    </div>
  );
}
