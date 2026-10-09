export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        className={`grid place-items-center rounded-lg bg-brand-600 font-bold text-white ${small ? "h-7 w-7 text-sm" : "h-9 w-9"}`}
      >
        ✓
      </span>
      <span className={`font-semibold tracking-tight text-slate-800 ${small ? "text-base" : "text-lg"}`}>
        Kiểm tra trực tuyến
      </span>
    </div>
  );
}
