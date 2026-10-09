"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { TabLock } from "@/lib/tab-lock";
import { formatClock } from "@/lib/format";

type Q = { id: string; passage: string | null; text: string; options: string[] };
type StartResponse = {
  attemptId: string;
  token: string;
  deadline: string;
  serverNow: string;
  answers: Record<string, number>;
  leaveCount: number;
  questions: Q[];
};
type Phase = "intro" | "checking" | "blocked" | "loading" | "running" | "conflict" | "submitting" | "error";
type SaveState = "saved" | "saving" | "pending" | "offline";

const LETTERS = "ABCDEFGH";

function readLocal<T>(key: string): T | null {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : null;
  } catch {
    return null;
  }
}
function writeLocal(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* bỏ qua: chế độ ẩn danh / bộ nhớ đầy */
  }
}

export function ExamRunner(props: {
  examId: string;
  studentId: string;
  title: string;
  description: string | null;
  durationMinutes: number;
  questionCount: number;
  attemptsUsed: number;
  maxAttempts: number;
  resume: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("intro");
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<Q[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [remaining, setRemaining] = useState(props.durationMinutes * 60);
  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [intrusion, setIntrusion] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const lockRef = useRef<TabLock | null>(null);
  const attemptRef = useRef<{ id: string; token: string; deadline: number; offset: number } | null>(null);
  const answersRef = useRef<Record<string, number>>({});
  const dirtyRef = useRef(false);
  const savingRef = useRef(false);
  const submittedRef = useRef(false);
  const leaveRef = useRef(0);
  const blockedRef = useRef(0);
  const startingRef = useRef(false);
  const tokenKey = `quiz-token:${props.studentId}:${props.examId}`;
  const ansKey = (attemptId: string) => `quiz-ans:${attemptId}`;

  /* ------------------------- khoá tab ------------------------- */
  useEffect(() => {
    const lock = new TabLock();
    lock.onIntrusion = () => {
      blockedRef.current += 1;
      dirtyRef.current = true;
      setIntrusion(true);
    };
    lockRef.current = lock;
    return () => lock.close();
  }, []);

  /* ------------------------- bắt đầu ------------------------- */
  const start = useCallback(async () => {
    if (startingRef.current) return;
    startingRef.current = true;
    try {
      await doStart();
    } finally {
      startingRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.examId, tokenKey]);

  const doStart = async () => {
    setError(null);
    setPhase("checking");
    const taken = await lockRef.current?.isTakenElsewhere();
    if (taken) {
      setPhase("blocked");
      return;
    }
    lockRef.current?.activate();
    setPhase("loading");
    try {
      const res = await fetch(`/api/student/exams/${props.examId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prevToken: readLocal<string>(tokenKey) }),
      });
      const data = await res.json();
      if (!res.ok) {
        lockRef.current?.release();
        setError(data.error ?? "Không bắt đầu được bài làm.");
        setPhase("error");
        return;
      }
      const d = data as StartResponse;
      writeLocal(tokenKey, d.token);
      const offset = new Date(d.serverNow).getTime() - Date.now();
      attemptRef.current = { id: d.attemptId, token: d.token, deadline: new Date(d.deadline).getTime(), offset };
      // Gộp với bản lưu tạm trên máy (phòng khi mất mạng lúc trước)
      const local = readLocal<Record<string, number>>(ansKey(d.attemptId)) ?? {};
      const merged = { ...d.answers, ...local };
      const ids = new Set(d.questions.map((q) => q.id));
      for (const k of Object.keys(merged)) if (!ids.has(k)) delete merged[k];
      answersRef.current = merged;
      dirtyRef.current = JSON.stringify(merged) !== JSON.stringify(d.answers);
      leaveRef.current = d.leaveCount;
      setAnswers(merged);
      setQuestions(d.questions);
      setRemaining(Math.max(0, Math.round((attemptRef.current.deadline - (Date.now() + offset)) / 1000)));
      setPhase("running");
    } catch {
      lockRef.current?.release();
      setError("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.");
      setPhase("error");
    }
  };

  // Đang làm dở → tự vào lại bài
  useEffect(() => {
    if (props.resume) void start();
  }, [props.resume, start]);

  /* ------------------------- lưu nháp ------------------------- */
  const handleWriteError = useCallback(
    (status: number, data: { error?: string; attemptId?: string }) => {
      if (status === 409) {
        lockRef.current?.release();
        setPhase("conflict");
        return true;
      }
      if (status === 410) {
        submittedRef.current = true;
        lockRef.current?.release();
        router.replace(`/student/attempts/${data.attemptId ?? attemptRef.current?.id}`);
        return true;
      }
      if (status === 401) {
        setError("Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại (bài làm đã được lưu).");
        setPhase("error");
        return true;
      }
      return false;
    },
    [router],
  );

  const saveNow = useCallback(async () => {
    const a = attemptRef.current;
    if (!a || savingRef.current || submittedRef.current || !dirtyRef.current) return;
    savingRef.current = true;
    dirtyRef.current = false;
    const newBlocked = blockedRef.current;
    blockedRef.current = 0;
    setSaveState("saving");
    try {
      const res = await fetch(`/api/student/attempts/${a.id}/save`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: a.token, answers: answersRef.current, leaveCount: leaveRef.current, newBlocked }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (!handleWriteError(res.status, data)) throw new Error("save failed");
        return;
      }
      setSaveState(dirtyRef.current ? "pending" : "saved");
    } catch {
      dirtyRef.current = true;
      blockedRef.current += newBlocked;
      setSaveState("offline");
    } finally {
      savingRef.current = false;
    }
  }, [handleWriteError]);

  const choose = (qid: string, idx: number) => {
    if (phase !== "running") return;
    const next = { ...answersRef.current, [qid]: idx };
    answersRef.current = next;
    dirtyRef.current = true;
    setAnswers(next);
    setSaveState("pending");
    if (attemptRef.current) writeLocal(ansKey(attemptRef.current.id), next);
  };

  // Lưu sau 0,7 giây kể từ lần chọn cuối
  useEffect(() => {
    if (phase !== "running") return;
    const t = setTimeout(() => void saveNow(), 700);
    return () => clearTimeout(t);
  }, [answers, phase, saveNow]);

  // Lưu định kỳ (thử lại khi mất mạng)
  useEffect(() => {
    if (phase !== "running") return;
    const t = setInterval(() => void saveNow(), 10_000);
    return () => clearInterval(t);
  }, [phase, saveNow]);

  /* ------------------------- nộp bài ------------------------- */
  const submit = useCallback(
    async (auto: boolean) => {
      const a = attemptRef.current;
      if (!a || submittedRef.current) return;
      submittedRef.current = true;
      setConfirmOpen(false);
      setPhase("submitting");
      // chờ lần lưu đang chạy (nếu có)
      for (let i = 0; i < 20 && savingRef.current; i++) await new Promise((r) => setTimeout(r, 100));
      try {
        const res = await fetch(`/api/student/attempts/${a.id}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: a.token,
            answers: answersRef.current,
            leaveCount: leaveRef.current,
            newBlocked: blockedRef.current,
            auto,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          if (handleWriteError(res.status, data)) return;
          throw new Error(data.error ?? "submit failed");
        }
        writeLocal(ansKey(a.id), null);
        writeLocal(tokenKey, null);
        lockRef.current?.release();
        router.replace(`/student/attempts/${data.attemptId}`);
      } catch {
        submittedRef.current = false;
        setError("Nộp bài không thành công do lỗi mạng. Bài làm vẫn được giữ, hãy bấm Nộp lại.");
        setPhase("running");
      }
    },
    [handleWriteError, router, tokenKey],
  );

  /* ------------------------- đồng hồ ------------------------- */
  useEffect(() => {
    if (phase !== "running") return;
    const tick = () => {
      const a = attemptRef.current;
      if (!a) return;
      const left = Math.round((a.deadline - (Date.now() + a.offset)) / 1000);
      setRemaining(Math.max(0, left));
      if (left <= 0) void submit(true);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [phase, submit]);

  /* ------------------------- rời trang / đóng tab ------------------------- */
  useEffect(() => {
    if (phase !== "running") return;
    const onVis = () => {
      if (document.visibilityState === "hidden") {
        leaveRef.current += 1;
        dirtyRef.current = true;
        void saveNow();
      }
    };
    const onUnload = (e: BeforeUnloadEvent) => {
      if (!submittedRef.current) e.preventDefault();
    };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("beforeunload", onUnload);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, [phase, saveNow]);

  const answeredCount = useMemo(
    () => questions.filter((q) => answers[q.id] !== undefined).length,
    [questions, answers],
  );
  const unanswered = questions.map((q, i) => (answers[q.id] === undefined ? i + 1 : 0)).filter(Boolean);

  /* =========================== GIAO DIỆN =========================== */

  if (phase === "intro" || phase === "checking" || (phase === "loading" && !questions.length) || phase === "error") {
    const busy = phase === "checking" || phase === "loading";
    return (
      <div className="card mx-auto max-w-lg p-8">
        <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900">{props.title}</h1>
        {props.description && <p className="mt-2 text-center text-slate-600">{props.description}</p>}
        <div className="mt-6 grid grid-cols-3 gap-3 text-center">
          <Info label="Số câu" value={props.questionCount} />
          <Info label="Thời gian" value={`${props.durationMinutes} phút`} />
          <Info
            label="Lượt làm"
            value={props.maxAttempts > 0 ? `${props.attemptsUsed + 1}/${props.maxAttempts}` : `Lần ${props.attemptsUsed + 1}`}
          />
        </div>
        <ul className="mt-6 space-y-1.5 text-sm text-slate-600">
          <li>• Đồng hồ bắt đầu chạy khi em bấm <b>Bắt đầu</b>, hết giờ bài sẽ tự nộp.</li>
          <li>• Đáp án được lưu tự động – lỡ tải lại trang em vẫn làm tiếp được.</li>
          <li>• Chỉ được mở bài ở <b>một tab</b>. Mở thêm tab khác sẽ bị chặn và giáo viên sẽ thấy.</li>
        </ul>
        {error && <p className="mt-5 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
        <div className="mt-6 flex justify-center gap-3">
          <Link href="/student" className="btn">
            Quay lại
          </Link>
          <button className="btn btn-primary px-6" disabled={busy} onClick={() => void start()}>
            {busy ? "Đang chuẩn bị..." : props.resume ? "Làm tiếp" : "Bắt đầu"}
          </button>
        </div>
      </div>
    );
  }

  if (phase === "blocked")
    return (
      <Notice title="Bài kiểm tra đang mở ở tab khác" tone="red">
        <p>
          Em đang làm bài này (hoặc một bài khác) ở một tab khác của trình duyệt. Mỗi lần chỉ được làm bài ở <b>một tab</b>.
        </p>
        <p className="mt-2">Hãy đóng tab này và quay lại tab đang làm bài.</p>
        <div className="mt-5 flex justify-center gap-2">
          <Link href="/student" className="btn">
            Về danh sách bài
          </Link>
          <button className="btn btn-primary" onClick={() => void start()}>
            Thử lại
          </button>
        </div>
      </Notice>
    );

  if (phase === "conflict")
    return (
      <Notice title="Tab này đã bị khoá" tone="red">
        <p>Bài làm vừa được mở ở một tab hoặc thiết bị khác, nên tab này không thể tiếp tục.</p>
        <p className="mt-2">Hãy quay lại tab/thiết bị đang làm bài. Giáo viên sẽ thấy ghi chú về việc này.</p>
        <div className="mt-5">
          <Link href="/student" className="btn">
            Về danh sách bài
          </Link>
        </div>
      </Notice>
    );

  const low = remaining <= 60;
  return (
    <div className="-mt-6 pb-24">
      {/* Thanh trên cùng */}
      <div className="sticky top-0 z-30 -mx-4 mb-5 border-b border-slate-200 bg-white/95 px-4 py-2.5 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-slate-900">{props.title}</div>
            <div className="text-xs text-slate-500">
              Đã làm {answeredCount}/{questions.length} ·{" "}
              {saveState === "saved" && <span className="text-emerald-600">Đã lưu</span>}
              {(saveState === "saving" || saveState === "pending") && <span>Đang lưu...</span>}
              {saveState === "offline" && <span className="text-red-600">Mất kết nối – sẽ tự lưu lại</span>}
            </div>
          </div>
          <div
            className={`rounded-lg px-3 py-1.5 font-mono text-lg font-semibold tabular-nums ${
              low ? "animate-pulse bg-red-50 text-red-600" : "bg-slate-100 text-slate-800"
            }`}
            aria-label="Thời gian còn lại"
          >
            {formatClock(remaining)}
          </div>
          <button className="btn btn-sm lg:hidden" onClick={() => setPaletteOpen((v) => !v)}>
            Câu
          </button>
          <button className="btn btn-primary" disabled={phase !== "running"} onClick={() => setConfirmOpen(true)}>
            Nộp bài
          </button>
        </div>
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full bg-brand-500 transition-all"
            style={{ width: `${questions.length ? (answeredCount / questions.length) * 100 : 0}%` }}
          />
        </div>
        {paletteOpen && (
          <div className="mt-3 lg:hidden">
            <Palette questions={questions} answers={answers} onJump={() => setPaletteOpen(false)} />
          </div>
        )}
      </div>

      {error && <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>}
      {intrusion && (
        <div className="mb-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          <span className="flex-1">Hệ thống vừa chặn một tab khác mở bài kiểm tra. Giáo viên sẽ thấy ghi chú này.</span>
          <button className="text-amber-700" onClick={() => setIntrusion(false)}>
            ✕
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_200px]">
        <div className="space-y-4">
          {questions.map((q, i) => {
            const showPassage = q.passage && (i === 0 || questions[i - 1].passage !== q.passage);
            const chosen = answers[q.id];
            return (
              <div key={q.id}>
                {showPassage && (
                  <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-[15px] leading-relaxed text-slate-800">
                    <div className="rich" dangerouslySetInnerHTML={{ __html: q.passage! }} />
                  </div>
                )}
                <div id={`q${i + 1}`} className="card scroll-mt-28 p-4">
                  <div className="mb-3 flex items-start gap-3">
                    <span
                      className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-semibold ${
                        chosen !== undefined ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      Câu {i + 1}
                    </span>
                    {q.text && <div className="rich text-[15px] text-slate-900" dangerouslySetInnerHTML={{ __html: q.text }} />}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label={`Câu ${i + 1}`}>
                    {q.options.map((o, k) => {
                      const on = chosen === k;
                      return (
                        <button
                          key={k}
                          type="button"
                          role="radio"
                          aria-checked={on}
                          onClick={() => choose(q.id, k)}
                          className={`flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-left text-[15px] transition ${
                            on
                              ? "border-brand-500 bg-brand-50 text-brand-900 ring-1 ring-brand-500"
                              : "border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-slate-50"
                          }`}
                        >
                          <span
                            className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-semibold ${
                              on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300 text-slate-500"
                            }`}
                          >
                            {LETTERS[k]}
                          </span>
                          <span className="rich pt-0.5" dangerouslySetInnerHTML={{ __html: o }} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            );
          })}
          <div className="pt-2 text-center">
            <button className="btn btn-primary px-8 py-2.5" disabled={phase !== "running"} onClick={() => setConfirmOpen(true)}>
              Nộp bài
            </button>
          </div>
        </div>
        <aside className="hidden lg:block">
          <div className="sticky top-28">
            <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Danh sách câu</div>
            <Palette questions={questions} answers={answers} />
          </div>
        </aside>
      </div>

      {/* Xác nhận nộp bài */}
      {confirmOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-900/40 p-4" onClick={() => setConfirmOpen(false)}>
          <div className="card w-full max-w-sm p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold text-slate-900">Nộp bài?</h2>
            {unanswered.length > 0 ? (
              <p className="mt-2 text-sm text-slate-600">
                Em còn <b className="text-red-600">{unanswered.length} câu chưa làm</b>: {unanswered.slice(0, 15).join(", ")}
                {unanswered.length > 15 ? "..." : ""}.
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-600">Em đã làm hết {questions.length} câu.</p>
            )}
            <p className="mt-1 text-sm text-slate-500">Sau khi nộp sẽ không sửa được nữa.</p>
            <div className="mt-5 flex justify-end gap-2">
              <button className="btn" onClick={() => setConfirmOpen(false)}>
                Làm tiếp
              </button>
              <button className="btn btn-primary" onClick={() => void submit(false)}>
                Nộp bài
              </button>
            </div>
          </div>
        </div>
      )}

      {phase === "submitting" && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-white/80 backdrop-blur-sm">
          <div className="text-center">
            <div className="mx-auto mb-3 h-8 w-8 animate-spin rounded-full border-4 border-brand-100 border-t-brand-600" />
            <p className="font-medium text-slate-800">{remaining <= 0 ? "Hết giờ – đang nộp bài..." : "Đang nộp bài..."}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function Palette({
  questions,
  answers,
  onJump,
}: {
  questions: Q[];
  answers: Record<string, number>;
  onJump?: () => void;
}) {
  return (
    <div className="grid grid-cols-8 gap-1.5 lg:grid-cols-5">
      {questions.map((q, i) => (
        <a
          key={q.id}
          href={`#q${i + 1}`}
          onClick={onJump}
          className={`grid h-8 place-items-center rounded-md text-xs font-semibold transition ${
            answers[q.id] !== undefined
              ? "bg-brand-600 text-white"
              : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300"
          }`}
        >
          {i + 1}
        </a>
      ))}
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-3">
      <div className="text-lg font-semibold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}

function Notice({ title, children, tone }: { title: string; children: React.ReactNode; tone: "red" }) {
  return (
    <div className={`card mx-auto max-w-lg p-8 text-center ${tone === "red" ? "border-red-200" : ""}`}>
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-red-50 text-2xl text-red-600">!</div>
      <h1 className="text-xl font-semibold text-slate-900">{title}</h1>
      <div className="mt-3 text-sm text-slate-600">{children}</div>
    </div>
  );
}
