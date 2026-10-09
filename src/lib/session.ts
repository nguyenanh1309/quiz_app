import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "quiz_session";

export type Session =
  | { role: "admin" }
  | { role: "class"; classId: string }
  | { role: "student"; classId: string; studentId: string };

function secretKey() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 16) throw new Error("AUTH_SECRET chưa được đặt hoặc quá ngắn");
  return new TextEncoder().encode(s);
}

export async function signSession(session: Session, maxAgeSec: number) {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSec}s`)
    .sign(secretKey());
}

export async function verifySession(token: string | undefined): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secretKey());
    const role = payload.role;
    if (role === "admin") return { role };
    if (role === "class" && typeof payload.classId === "string") return { role, classId: payload.classId };
    if (role === "student" && typeof payload.classId === "string" && typeof payload.studentId === "string")
      return { role, classId: payload.classId, studentId: payload.studentId };
    return null;
  } catch {
    return null;
  }
}
