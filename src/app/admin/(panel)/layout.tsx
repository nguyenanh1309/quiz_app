import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { AdminNav } from "@/components/AdminNav";
import { Logo } from "@/components/Logo";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
          <Link href="/admin" className="shrink-0">
            <Logo small />
          </Link>
          <div className="min-w-0 flex-1">
            <AdminNav />
          </div>
          <form action={logout}>
            <button className="btn btn-sm">Đăng xuất</button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
