import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { db, classes, students } from "@/db";
import { getSession } from "@/lib/auth";
import { resetClassLogin } from "@/app/actions/auth";
import { Logo } from "@/components/Logo";
import { ClassLoginForm, StudentLoginForm } from "./_login/LoginForms";

export default async function HomePage() {
  const session = await getSession();
  if (session?.role === "student") redirect("/student");

  let content: React.ReactNode;
  if (session?.role === "class") {
    const cls = (await db.select().from(classes).where(eq(classes.id, session.classId)).limit(1))[0];
    if (!cls) redirect("/admin/login");
    const list = await db
      .select({ id: students.id, name: students.name })
      .from(students)
      .where(eq(students.classId, cls.id))
      .orderBy(asc(students.name));
    content = (
      <>
        <div className="mb-6">
          <p className="text-sm text-slate-500">Bước 2/2</p>
          <h1 className="text-xl font-semibold text-slate-900">Lớp {cls.name}</h1>
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-slate-600">Lớp chưa có danh sách học sinh. Hãy báo thầy/cô.</p>
        ) : (
          <StudentLoginForm students={list} />
        )}
        <form action={resetClassLogin} className="mt-4 text-center">
          <button className="text-sm text-slate-500 hover:text-slate-800">← Chọn lớp khác</button>
        </form>
      </>
    );
  } else {
    const list = await db.select({ id: classes.id, name: classes.name }).from(classes).orderBy(asc(classes.name));
    content = (
      <>
        <div className="mb-6">
          <p className="text-sm text-slate-500">Bước 1/2</p>
          <h1 className="text-xl font-semibold text-slate-900">Đăng nhập làm bài</h1>
        </div>
        {list.length === 0 ? (
          <p className="text-sm text-slate-600">Chưa có lớp nào. Thầy/cô cần tạo lớp trong trang quản trị.</p>
        ) : (
          <ClassLoginForm classes={list} />
        )}
      </>
    );
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-12">
      <div className="mb-8">
        <Logo />
      </div>
      <div className="card w-full max-w-sm p-6 shadow-sm">{content}</div>
      <Link href="/admin/login" className="mt-6 text-xs text-slate-400 hover:text-slate-600">
        Dành cho giáo viên
      </Link>
    </main>
  );
}
