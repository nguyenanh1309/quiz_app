import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Logo } from "@/components/Logo";
import { AdminLoginForm } from "./AdminLoginForm";

export default async function AdminLoginPage() {
  const s = await getSession();
  if (s?.role === "admin") redirect("/admin");
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <Logo />
      </div>
      <div className="card w-full max-w-sm p-6 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold text-slate-900">Đăng nhập quản trị</h1>
        <AdminLoginForm />
      </div>
    </main>
  );
}
