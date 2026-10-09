const TZ = "Asia/Ho_Chi_Minh";

export function formatDateTime(d: Date | string | null | undefined) {
  if (!d) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: TZ,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

/** 754 → "12 phút 34 giây" */
export function formatDuration(sec: number | null | undefined) {
  if (sec === null || sec === undefined) return "—";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  if (m === 0) return `${s} giây`;
  return `${m} phút ${s.toString().padStart(2, "0")} giây`;
}

/** 754 → "12:34" */
export function formatClock(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const mm = m.toString().padStart(2, "0");
  const ss = r.toString().padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export function formatScore(score: number | null | undefined) {
  if (score === null || score === undefined) return "—";
  return score.toLocaleString("vi-VN", { maximumFractionDigits: 2 });
}

export function scoreColor(score: number | null | undefined) {
  if (score === null || score === undefined) return "text-slate-400";
  if (score >= 8) return "text-emerald-600";
  if (score >= 5) return "text-amber-600";
  return "text-red-600";
}
