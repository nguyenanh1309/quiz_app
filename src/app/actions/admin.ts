"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, inArray, notInArray } from "drizzle-orm";
import { z } from "zod";
import { db, classes, students, exams, questions, examAssignments, attempts } from "@/db";
import { requireAdmin } from "@/lib/auth";
import { parseDocx, type ParsedExam } from "@/lib/docx-parser";
import { sanitizeRichHtml } from "@/lib/sanitize";
import { readStudentRows } from "@/lib/student-import";

export type Result<T = undefined> = { ok: true; data?: T; message?: string } | { ok: false; error: string };

function pgErrorMessage(e: unknown): string | null {
  const code = (e as { code?: string; cause?: { code?: string } })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;
  if (code === "23505") return "Dữ liệu bị trùng (tên lớp hoặc mã học sinh đã tồn tại).";
  return null;
}

/* ============================ LỚP HỌC ============================ */

const classSchema = z.object({
  name: z.string().trim().min(1, "Nhập tên lớp").max(60),
  password: z.string().trim().min(3, "Mật khẩu lớp tối thiểu 3 ký tự").max(60),
});

export async function createClass(_: unknown, formData: FormData): Promise<Result> {
  await requireAdmin();
  const parsed = classSchema.safeParse({ name: formData.get("name"), password: formData.get("password") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  let id: string;
  try {
    const [row] = await db.insert(classes).values(parsed.data).returning();
    id = row.id;
  } catch (e) {
    if (pgErrorMessage(e)) return { ok: false, error: "Tên lớp đã tồn tại." };
    throw e;
  }
  revalidatePath("/admin", "layout");
  redirect(`/admin/classes/${id}`);
}

export async function updateClass(_: unknown, formData: FormData): Promise<Result> {
  await requireAdmin();
  const id = String(formData.get("id"));
  const parsed = classSchema.safeParse({ name: formData.get("name"), password: formData.get("password") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  try {
    await db.update(classes).set(parsed.data).where(eq(classes.id, id));
  } catch (e) {
    if (pgErrorMessage(e)) return { ok: false, error: "Tên lớp đã tồn tại." };
    throw e;
  }
  revalidatePath("/admin", "layout");
  return { ok: true, message: "Đã lưu." };
}

export async function deleteClass(id: string) {
  await requireAdmin();
  await db.delete(classes).where(eq(classes.id, id));
  revalidatePath("/admin", "layout");
  redirect("/admin/classes");
}

/* ============================ HỌC SINH ============================ */

async function uniqueCode(classId: string, taken?: Set<string>) {
  const existing =
    taken ??
    new Set(
      (await db.select({ code: students.code }).from(students).where(eq(students.classId, classId))).map((r) =>
        r.code.toLowerCase(),
      ),
    );
  for (let i = 0; i < 1000; i++) {
    const c = String(Math.floor(1000 + Math.random() * 9000));
    if (!existing.has(c)) {
      existing.add(c);
      return c;
    }
  }
  throw new Error("Không tạo được mã học sinh");
}

const studentSchema = z.object({
  name: z.string().trim().min(1, "Nhập họ tên").max(100),
  code: z.string().trim().max(30),
});

export async function addStudent(_: unknown, formData: FormData): Promise<Result> {
  await requireAdmin();
  const classId = String(formData.get("classId"));
  const parsed = studentSchema.safeParse({ name: formData.get("name"), code: formData.get("code") ?? "" });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const code = parsed.data.code || (await uniqueCode(classId));
  try {
    await db.insert(students).values({ classId, name: parsed.data.name, code });
  } catch (e) {
    if (pgErrorMessage(e)) return { ok: false, error: `Mã "${code}" đã có trong lớp.` };
    throw e;
  }
  revalidatePath(`/admin/classes/${classId}`);
  return { ok: true, message: `Đã thêm ${parsed.data.name} (mã ${code}).` };
}

export async function updateStudent(id: string, name: string, code: string): Promise<Result> {
  await requireAdmin();
  const parsed = studentSchema.safeParse({ name, code });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  if (!parsed.data.code) return { ok: false, error: "Mã học sinh không được để trống." };
  try {
    const [row] = await db.update(students).set(parsed.data).where(eq(students.id, id)).returning();
    if (row) revalidatePath(`/admin/classes/${row.classId}`);
  } catch (e) {
    if (pgErrorMessage(e)) return { ok: false, error: "Mã học sinh đã có trong lớp." };
    throw e;
  }
  return { ok: true };
}

export async function deleteStudent(id: string): Promise<Result> {
  await requireAdmin();
  const [row] = await db.delete(students).where(eq(students.id, id)).returning();
  if (row) revalidatePath(`/admin/classes/${row.classId}`);
  return { ok: true };
}

export async function deleteAllStudents(classId: string): Promise<Result> {
  await requireAdmin();
  await db.delete(students).where(eq(students.classId, classId));
  revalidatePath(`/admin/classes/${classId}`);
  return { ok: true };
}

/** Nhập danh sách học sinh từ file Excel/CSV hoặc từ ô dán văn bản. */
export async function importStudents(_: unknown, formData: FormData): Promise<Result> {
  await requireAdmin();
  const classId = String(formData.get("classId"));
  const file = formData.get("file");
  const text = String(formData.get("text") ?? "");

  let rows: { name: string; code: string }[];
  try {
    if (file instanceof File && file.size > 0) {
      rows = await readStudentRows({ fileName: file.name, buffer: Buffer.from(await file.arrayBuffer()) });
    } else if (text.trim()) {
      rows = await readStudentRows({ text });
    } else {
      return { ok: false, error: "Chọn file Excel/CSV hoặc dán danh sách." };
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Không đọc được file." };
  }
  if (rows.length === 0) return { ok: false, error: "Không tìm thấy học sinh nào trong dữ liệu." };

  const existing = await db.select().from(students).where(eq(students.classId, classId));
  const byCode = new Map(existing.map((s) => [s.code.toLowerCase(), s]));
  const taken = new Set(byCode.keys());
  let added = 0;
  let updated = 0;
  await db.transaction(async (tx) => {
    for (const r of rows) {
      const hit = r.code ? byCode.get(r.code.toLowerCase()) : undefined;
      if (hit) {
        if (hit.name !== r.name) {
          await tx.update(students).set({ name: r.name }).where(eq(students.id, hit.id));
          updated++;
        }
        continue;
      }
      const code = r.code || (await uniqueCode(classId, taken));
      taken.add(code.toLowerCase());
      const [row] = await tx.insert(students).values({ classId, name: r.name, code }).returning();
      byCode.set(code.toLowerCase(), row);
      added++;
    }
  });
  revalidatePath(`/admin/classes/${classId}`);
  return { ok: true, message: `Đã thêm ${added} học sinh${updated ? `, cập nhật tên ${updated} học sinh` : ""}.` };
}

/* ============================ ĐỀ KIỂM TRA ============================ */

export async function parseDocxAction(formData: FormData): Promise<Result<ParsedExam & { fileName: string }>> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Chưa chọn file Word." };
  if (!/\.docx$/i.test(file.name))
    return { ok: false, error: "Chỉ hỗ trợ file .docx (Word 2007 trở lên). File .doc cũ hãy mở bằng Word rồi Lưu thành .docx." };
  try {
    const parsed = await parseDocx(Buffer.from(await file.arrayBuffer()));
    return { ok: true, data: { ...parsed, fileName: file.name } };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Không đọc được file Word. File có thể bị hỏng hoặc không phải .docx." };
  }
}

const questionSchema = z.object({
  id: z.string().optional(),
  passage: z.string().nullable(),
  text: z.string(),
  options: z.array(z.string()).min(2, "Mỗi câu cần ít nhất 2 phương án").max(8),
  correctIndex: z.number().int(),
  explanation: z.string().nullable(),
});

const examSchema = z.object({
  id: z.string().optional(),
  title: z.string().trim().min(1, "Nhập tên đề").max(200),
  description: z.string().max(2000).nullable(),
  durationMinutes: z.number().int().min(1, "Thời gian tối thiểu 1 phút").max(600),
  maxAttempts: z.number().int().min(0).max(100),
  showAnswers: z.boolean(),
  isOpen: z.boolean(),
  sourceFileName: z.string().nullable(),
  classIds: z.array(z.string()),
  questions: z.array(questionSchema).min(1, "Đề cần ít nhất 1 câu hỏi"),
});

export type ExamPayload = z.infer<typeof examSchema>;

export async function saveExam(payload: ExamPayload): Promise<Result<{ id: string }>> {
  await requireAdmin();
  const parsed = examSchema.safeParse(payload);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0].message };
  const data = parsed.data;

  for (const [i, q] of data.questions.entries()) {
    if (q.options.some((o) => !o.trim())) return { ok: false, error: `Câu ${i + 1}: có phương án đang để trống.` };
    if (q.correctIndex < 0 || q.correctIndex >= q.options.length)
      return { ok: false, error: `Câu ${i + 1}: chưa chọn đáp án đúng.` };
    if (!q.text.trim() && !q.passage?.trim()) return { ok: false, error: `Câu ${i + 1}: chưa có nội dung câu hỏi.` };
  }

  const clean = data.questions.map((q, i) => ({
    id: q.id,
    order: i,
    passage: q.passage?.trim() ? sanitizeRichHtml(q.passage) : null,
    text: sanitizeRichHtml(q.text),
    options: q.options.map((o) => sanitizeRichHtml(o)),
    correctIndex: q.correctIndex,
    explanation: q.explanation?.trim() ? sanitizeRichHtml(q.explanation) : null,
  }));

  const examValues = {
    title: data.title,
    description: data.description?.trim() || null,
    durationMinutes: data.durationMinutes,
    maxAttempts: data.maxAttempts,
    showAnswers: data.showAnswers,
    isOpen: data.isOpen,
    sourceFileName: data.sourceFileName,
    updatedAt: new Date(),
  };

  const examId = await db.transaction(async (tx) => {
    let id = data.id;
    if (id) {
      const updated = await tx.update(exams).set(examValues).where(eq(exams.id, id)).returning({ id: exams.id });
      if (!updated[0]) throw new Error("Không tìm thấy đề");
      const keepIds = clean.map((q) => q.id).filter((x): x is string => !!x);
      await tx
        .delete(questions)
        .where(keepIds.length ? and(eq(questions.examId, id), notInArray(questions.id, keepIds)) : eq(questions.examId, id));
    } else {
      const [row] = await tx.insert(exams).values(examValues).returning({ id: exams.id });
      id = row.id;
    }
    for (const q of clean) {
      const { id: qid, ...values } = q;
      if (qid && data.id) {
        const res = await tx
          .update(questions)
          .set(values)
          .where(and(eq(questions.id, qid), eq(questions.examId, id)))
          .returning({ id: questions.id });
        if (res[0]) continue;
      }
      await tx.insert(questions).values({ ...values, examId: id });
    }
    await tx.delete(examAssignments).where(eq(examAssignments.examId, id));
    if (data.classIds.length) {
      const valid = await tx.select({ id: classes.id }).from(classes).where(inArray(classes.id, data.classIds));
      if (valid.length) await tx.insert(examAssignments).values(valid.map((c) => ({ examId: id!, classId: c.id })));
    }
    return id;
  });

  revalidatePath("/admin", "layout");
  return { ok: true, data: { id: examId } };
}

export async function deleteExam(id: string) {
  await requireAdmin();
  await db.delete(exams).where(eq(exams.id, id));
  revalidatePath("/admin", "layout");
  redirect("/admin/exams");
}

export async function setExamOpen(id: string, isOpen: boolean) {
  await requireAdmin();
  await db.update(exams).set({ isOpen, updatedAt: new Date() }).where(eq(exams.id, id));
  revalidatePath("/admin", "layout");
}

export async function duplicateExam(id: string) {
  await requireAdmin();
  const exam = (await db.select().from(exams).where(eq(exams.id, id)).limit(1))[0];
  if (!exam) return;
  const qs = await db.select().from(questions).where(eq(questions.examId, id));
  const newId = await db.transaction(async (tx) => {
    const { id: _old, createdAt: _c, updatedAt: _u, ...rest } = exam;
    void _old;
    void _c;
    void _u;
    const [row] = await tx
      .insert(exams)
      .values({ ...rest, title: `${exam.title} (bản sao)`, isOpen: false })
      .returning({ id: exams.id });
    if (qs.length)
      await tx.insert(questions).values(
        qs.map((q) => ({
          examId: row.id,
          order: q.order,
          passage: q.passage,
          text: q.text,
          options: q.options,
          correctIndex: q.correctIndex,
          explanation: q.explanation,
        })),
      );
    return row.id;
  });
  revalidatePath("/admin", "layout");
  redirect(`/admin/exams/${newId}/edit`);
}

/** Xoá một lượt làm bài (ví dụ để cho học sinh làm lại). */
export async function deleteAttempt(id: string): Promise<Result> {
  await requireAdmin();
  await db.delete(attempts).where(eq(attempts.id, id));
  revalidatePath("/admin", "layout");
  return { ok: true };
}
