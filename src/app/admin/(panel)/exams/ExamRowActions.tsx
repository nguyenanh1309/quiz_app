"use client";
import { useTransition } from "react";
import { deleteExam, duplicateExam, setExamOpen } from "@/app/actions/admin";

export function OpenToggle({ id, isOpen }: { id: string; isOpen: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isOpen}
      disabled={pending}
      onClick={() => start(() => setExamOpen(id, !isOpen))}
      className={`inline-flex items-center gap-2 text-xs font-medium ${isOpen ? "text-emerald-700" : "text-slate-500"}`}
      title={isOpen ? "Bấm để đóng đề" : "Bấm để mở đề"}
    >
      <span className={`relative h-5 w-9 rounded-full transition ${isOpen ? "bg-emerald-500" : "bg-slate-300"} ${pending ? "opacity-50" : ""}`}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${isOpen ? "left-4.5" : "left-0.5"}`} />
      </span>
      {isOpen ? "Đang mở" : "Đã đóng"}
    </button>
  );
}

export function ExamMenu({ id, title }: { id: string; title: string }) {
  const [pending, start] = useTransition();
  return (
    <span className="inline-flex gap-1">
      <button className="btn btn-sm" disabled={pending} onClick={() => start(() => duplicateExam(id))}>
        Nhân bản
      </button>
      <button
        className="btn btn-sm btn-danger"
        disabled={pending}
        onClick={() => {
          if (confirm(`Xoá đề "${title}"? Toàn bộ kết quả làm bài của đề này cũng bị xoá.`)) start(() => deleteExam(id));
        }}
      >
        Xoá
      </button>
    </span>
  );
}
