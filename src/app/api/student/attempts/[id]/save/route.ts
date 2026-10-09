import { eq, sql } from "drizzle-orm";
import { db, attempts } from "@/db";
import { loadAttemptForWrite, type AttemptBody } from "@/lib/attempt-api";
import { json } from "@/lib/student-exam";

/** Tự động lưu đáp án trong khi làm bài. */
export async function POST(req: Request, ctx: RouteContext<"/api/student/attempts/[id]/save">) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as AttemptBody;
  const r = await loadAttemptForWrite(id, body);
  if ("error" in r) return r.error;
  await db
    .update(attempts)
    .set({
      answers: r.answers,
      leaveCount: r.leaveCount,
      tabConflicts: sql`${attempts.tabConflicts} + ${r.newBlocked}`,
    })
    .where(eq(attempts.id, id));
  return json({ ok: true, savedAt: new Date().toISOString() });
}
