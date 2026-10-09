import { asc } from "drizzle-orm";
import { db, classes } from "@/db";
import { PageHeader } from "@/components/PageHeader";
import { ExamEditor } from "@/components/ExamEditor";

export default async function NewExamPage({ searchParams }: PageProps<"/admin/exams/new">) {
  const sp = await searchParams;
  const list = await db.select({ id: classes.id, name: classes.name }).from(classes).orderBy(asc(classes.name));
  const preClass = typeof sp.class === "string" ? [sp.class] : [];
  return (
    <>
      <PageHeader title="Tạo đề mới" back={{ href: "/admin/exams", label: "Đề kiểm tra" }} />
      <ExamEditor
        isNew
        classes={list}
        initial={{
          title: "",
          description: null,
          durationMinutes: 15,
          maxAttempts: 1,
          showAnswers: true,
          isOpen: true,
          sourceFileName: null,
          classIds: preClass,
          questions: [],
        }}
      />
    </>
  );
}
