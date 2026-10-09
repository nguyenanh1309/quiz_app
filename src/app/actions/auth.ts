"use server";

import { redirect } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db, classes, students } from "@/db";
import { clearSession, getSession, safeEqual, setSession } from "@/lib/auth";

export type ActionState = { error?: string } | undefined;

/* ---------------- Admin ---------------- */

export async function adminLogin(_: ActionState, formData: FormData): Promise<ActionState> {
  const password = String(formData.get("password") ?? "");
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return { error: "Máy chủ chưa đặt ADMIN_PASSWORD." };
  if (!safeEqual(password, expected)) {
    await new Promise((r) => setTimeout(r, 600));
    return { error: "Sai mật khẩu quản trị." };
  }
  await setSession({ role: "admin" });
  redirect("/admin");
}

/* ---------------- Học sinh ---------------- */

/** Bước 1: chọn lớp + nhập mật khẩu lớp. */
export async function classLogin(_: ActionState, formData: FormData): Promise<ActionState> {
  const classId = String(formData.get("classId") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!classId) return { error: "Hãy chọn lớp." };
  const row = (await db.select().from(classes).where(eq(classes.id, classId)).limit(1))[0];
  if (!row || !safeEqual(password, row.password)) {
    await new Promise((r) => setTimeout(r, 600));
    return { error: "Sai mật khẩu lớp." };
  }
  await setSession({ role: "class", classId });
  redirect("/");
}

/** Bước 2: chọn tên + nhập mã học sinh. */
export async function studentLogin(_: ActionState, formData: FormData): Promise<ActionState> {
  const session = await getSession();
  if (session?.role !== "class") return { error: "Phiên đăng nhập lớp đã hết hạn, hãy đăng nhập lại." };
  const studentId = String(formData.get("studentId") ?? "");
  const code = String(formData.get("code") ?? "").trim();
  if (!studentId) return { error: "Hãy chọn tên của em." };
  const row = (
    await db
      .select()
      .from(students)
      .where(and(eq(students.id, studentId), eq(students.classId, session.classId)))
      .limit(1)
  )[0];
  if (!row || row.code.toLowerCase() !== code.toLowerCase()) {
    await new Promise((r) => setTimeout(r, 600));
    return { error: "Mã học sinh không đúng." };
  }
  await setSession({ role: "student", classId: session.classId, studentId: row.id });
  redirect("/student");
}

export async function logout() {
  const s = await getSession();
  await clearSession();
  redirect(s?.role === "admin" ? "/admin/login" : "/");
}

/** Quay lại bước chọn lớp. */
export async function resetClassLogin() {
  await clearSession();
  redirect("/");
}

