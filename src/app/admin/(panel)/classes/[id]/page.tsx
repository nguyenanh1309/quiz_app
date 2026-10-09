import Link from "next/link";
import { notFound } from "next/navigation";
import { asc, desc, eq, sql } from "drizzle-orm";
import { db, classes, students, exams, examAssignments } from "@/db";
import { PageHeader } from "@/components/PageHeader";
import { EditClassForm } from "../ClassForms";
import { AddStudentForm, ImportStudentsForm, StudentTable } from "./Students";

export default async function ClassDetail({ params }: PageProps<"/admin/classes/[id]">) {
  const { id } = await params;
  const cls = (await db.select().from(classes).where(eq(classes.id, id)).limit(1))[0];
  if (!cls) notFound();

  const list = await db
    .select({
      id: students.id,
      name: students.name,
      code: students.code,
      attempts: sql<number>`(select count(*)::int from attempts a where a.student_id = ${students.id} and a.status = 'SUBMITTED')`,
    })
    .from(students)
    .where(eq(students.classId, id))
    .orderBy(asc(students.name));

  const assigned = await db
    .select({ id: exams.id, title: exams.title, isOpen: exams.isOpen })
    .from(examAssignments)
    .innerJoin(exams, eq(examAssignments.examId, exams.id))
    .where(eq(examAssignments.classId, id))
    .orderBy(desc(exams.createdAt));

  return (
    <>
      <PageHeader title={`Lớp ${cls.name}`} back={{ href: "/admin/classes", label: "Lớp học" }} />
      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-6">
          <StudentTable classId={id} students={list} />
          <div>
            <h2 className="mb-3 font-semibold text-slate-900">Đề được giao cho lớp</h2>
            {assigned.length === 0 ? (
              <p className="text-sm text-slate-500">
                Chưa có. Giao đề trong phần{" "}
                <Link href="/admin/exams" className="text-brand-600 hover:underline">
                  Đề kiểm tra
                </Link>
                .
              </p>
            ) : (
              <div className="card divide-y divide-slate-100">
                {assigned.map((e) => (
                  <Link
                    key={e.id}
                    href={`/admin/exams/${e.id}?class=${id}`}
                    className="flex items-center justify-between px-4 py-3 text-sm hover:bg-slate-50"
                  >
                    <span className="font-medium text-slate-800">{e.title}</span>
                    <span className="flex items-center gap-3">
                      <span className={`badge ${e.isOpen ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                        {e.isOpen ? "Đang mở" : "Đã đóng"}
                      </span>
                      <span className="text-brand-600">Xem kết quả →</span>
                    </span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="space-y-4">
          <EditClassForm id={cls.id} name={cls.name} password={cls.password} />
          <AddStudentForm classId={id} />
          <ImportStudentsForm classId={id} />
        </div>
      </div>
    </>
  );
}
