import Link from "next/link";
import { requireStudent } from "@/lib/auth";
import { logout } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";

export default async function StudentLayout({ children }: { children: React.ReactNode }) {
  const { student, classRoom } = await requireStudent();
  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-slate-200 bg-white" data-student-header>
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-4 py-3">
          <Link href="/student" className="shrink-0">
            <Logo small />
          </Link>
          <div className="flex-1" />
          <div className="text-right text-sm leading-tight">
            <div className="font-medium text-slate-800">{student.name}</div>
            <div className="text-xs text-slate-500">Lớp {classRoom.name}</div>
          </div>
          <form action={logout}>
            <button className="btn btn-sm">Thoát</button>
          </form>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
