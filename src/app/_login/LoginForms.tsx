"use client";

import { useActionState } from "react";
import { classLogin, studentLogin, type ActionState } from "@/app/actions/auth";
import { SubmitButton } from "@/components/SubmitButton";

export function ClassLoginForm({ classes }: { classes: { id: string; name: string }[] }) {
  const [state, action] = useActionState<ActionState, FormData>(classLogin, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="classId">
          Lớp của em
        </label>
        <select id="classId" name="classId" className="input" defaultValue="" required>
          <option value="" disabled>
            — Chọn lớp —
          </option>
          {classes.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="password">
          Mật khẩu lớp
        </label>
        <input id="password" name="password" type="password" className="input" required autoComplete="off" />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton className="btn btn-primary w-full py-2.5">Vào lớp</SubmitButton>
    </form>
  );
}

export function StudentLoginForm({ students }: { students: { id: string; name: string }[] }) {
  const [state, action] = useActionState<ActionState, FormData>(studentLogin, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="studentId">
          Họ và tên
        </label>
        <select id="studentId" name="studentId" className="input" defaultValue="" required>
          <option value="" disabled>
            — Chọn tên của em —
          </option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="label" htmlFor="code">
          Mã học sinh
        </label>
        <input id="code" name="code" className="input" required autoComplete="off" placeholder="Mã do thầy/cô cung cấp" />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton className="btn btn-primary w-full py-2.5">Đăng nhập</SubmitButton>
    </form>
  );
}
