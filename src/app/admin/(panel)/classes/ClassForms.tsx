"use client";

import { useActionState, useState, useTransition } from "react";
import { createClass, updateClass, deleteClass, type Result } from "@/app/actions/admin";
import { SubmitButton } from "@/components/SubmitButton";

type S = Result | undefined;

export function CreateClassForm() {
  const [state, action] = useActionState<S, FormData>(createClass, undefined);
  return (
    <form action={action} className="card space-y-3 p-4">
      <h2 className="font-semibold text-slate-900">Tạo lớp mới</h2>
      <div>
        <label className="label">Tên lớp</label>
        <input name="name" className="input" placeholder="VD: 6A1" required />
      </div>
      <div>
        <label className="label">Mật khẩu lớp</label>
        <input name="password" className="input" placeholder="VD: 6a1-2026" required />
        <p className="mt-1 text-xs text-slate-500">Học sinh dùng mật khẩu này để vào lớp.</p>
      </div>
      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton>Tạo lớp</SubmitButton>
    </form>
  );
}

export function EditClassForm({ id, name, password }: { id: string; name: string; password: string }) {
  const [state, action] = useActionState<S, FormData>(updateClass, undefined);
  const [show, setShow] = useState(false);
  const [pending, start] = useTransition();
  return (
    <form action={action} className="card space-y-3 p-4">
      <h2 className="font-semibold text-slate-900">Thông tin lớp</h2>
      <input type="hidden" name="id" value={id} />
      <div>
        <label className="label">Tên lớp</label>
        <input name="name" className="input" defaultValue={name} required />
      </div>
      <div>
        <label className="label">Mật khẩu lớp</label>
        <div className="flex gap-2">
          <input name="password" type={show ? "text" : "password"} className="input" defaultValue={password} required />
          <button type="button" className="btn" onClick={() => setShow((v) => !v)}>
            {show ? "Ẩn" : "Hiện"}
          </button>
        </div>
      </div>
      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-600">{state.message}</p>}
      <div className="flex justify-between gap-2">
        <SubmitButton>Lưu</SubmitButton>
        <button
          type="button"
          className="btn btn-danger"
          disabled={pending}
          onClick={() => {
            if (confirm(`Xoá lớp ${name}? Toàn bộ học sinh và kết quả làm bài của lớp sẽ bị xoá.`))
              start(() => deleteClass(id));
          }}
        >
          Xoá lớp
        </button>
      </div>
    </form>
  );
}
