import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db, students, classes } from "@/db";
import { SESSION_COOKIE, signSession, verifySession, type Session } from "./session";

const ADMIN_MAX_AGE = 60 * 60 * 12; // 12 giờ
const STUDENT_MAX_AGE = 60 * 60 * 6; // 6 giờ

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

export async function setSession(session: Session) {
  const maxAge = session.role === "admin" ? ADMIN_MAX_AGE : STUDENT_MAX_AGE;
  const token = await signSession(session, maxAge);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}

/** Dùng trong trang/action của admin. */
export async function requireAdmin() {
  const s = await getSession();
  if (s?.role !== "admin") redirect("/admin/login");
  return s;
}

/** Dùng trong trang/action của học sinh: trả về học sinh + lớp, hoặc chuyển về trang đăng nhập. */
export async function requireStudent() {
  const s = await getSession();
  if (s?.role !== "student") redirect("/");
  const row = await db
    .select({ student: students, classRoom: classes })
    .from(students)
    .innerJoin(classes, eq(students.classId, classes.id))
    .where(and(eq(students.id, s.studentId), eq(students.classId, s.classId)))
    .limit(1);
  if (!row[0]) redirect("/?expired=1");
  return row[0];
}

/** Phiên học sinh cho API (không redirect). */
export async function getStudentFromSession() {
  const s = await getSession();
  if (s?.role !== "student") return null;
  const row = await db
    .select()
    .from(students)
    .where(and(eq(students.id, s.studentId), eq(students.classId, s.classId)))
    .limit(1);
  return row[0] ?? null;
}

/** So sánh chuỗi an toàn với timing attack. */
export function safeEqual(a: string, b: string) {
  const ea = new TextEncoder().encode(a);
  const eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}
