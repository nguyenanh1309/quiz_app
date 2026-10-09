"use client";
import { useActionState } from "react";
import { adminLogin, type ActionState } from "@/app/actions/auth";
import { SubmitButton } from "@/components/SubmitButton";

export function AdminLoginForm() {
  const [state, action] = useActionState<ActionState, FormData>(adminLogin, undefined);
  return (
    <form action={action} className="space-y-4">
      <div>
        <label className="label" htmlFor="password">
          Mật khẩu
        </label>
        <input id="password" name="password" type="password" className="input" required autoFocus />
      </div>
      {state?.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton className="btn btn-primary w-full py-2.5">Đăng nhập</SubmitButton>
    </form>
  );
}
