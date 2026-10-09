import Link from "next/link";
import { asc, sql } from "drizzle-orm";
import { db, classes } from "@/db";
import { EmptyState, PageHeader } from "@/components/PageHeader";
import { CreateClassForm } from "./ClassForms";

export default async function ClassesPage() {
  const list = await db
    .select({
      id: classes.id,
      name: classes.name,
      password: classes.password,
      students: sql<number>`(select count(*)::int from students s where s.class_id = ${classes.id})`,
      exams: sql<number>`(select count(*)::int from exam_assignments a where a.class_id = ${classes.id})`,
    })
    .from(classes)
    .orderBy(asc(classes.name));

  return (
    <>
      <PageHeader title="Lớp học" subtitle="Mỗi lớp có một mật khẩu riêng; học sinh chỉ thấy đề được giao cho lớp mình." />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div>
          {list.length === 0 ? (
            <EmptyState>Chưa có lớp nào. Tạo lớp đầu tiên ở bên cạnh.</EmptyState>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {list.map((c) => (
                <Link key={c.id} href={`/admin/classes/${c.id}`} className="card p-4 transition hover:border-brand-500">
                  <div className="text-lg font-semibold text-slate-900">Lớp {c.name}</div>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
                    <span>{c.students} học sinh</span>
                    <span>{c.exams} đề được giao</span>
                  </div>
                  <div className="mt-3 text-xs text-slate-400">
                    Mật khẩu: <span className="font-mono text-slate-600">{c.password}</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
        <div>
          <CreateClassForm />
        </div>
      </div>
    </>
  );
}
