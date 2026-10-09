import { eq, sql } from "drizzle-orm";
import { db, attempts } from "@/db";
import { loadAttemptForWrite, type AttemptBody } from "@/lib/attempt-api";
import { finalizeAttempt } from "@/lib/grading";
import { json } from "@/lib/student-exam";

/** Nộp bài và chấm điểm. */
export async function POST(req: Request, ctx: RouteContext<"/api/student/attempts/[id]/submit">) {
  const { id } = await ctx.params;
  const body = (await req.json().catch(() => ({}))) as AttemptBody;
  const r = await loadAttemptForWrite(id, body);
  if ("error" in r) return r.error;
  if (r.leaveCount !== r.attempt.leaveCount || r.newBlocked) {
    await db
      .update(attempts)
      .set({ leaveCount: r.leaveCount, tabConflicts: sql`${attempts.tabConflicts} + ${r.newBlocked}` })
      .where(eq(attempts.id, id));
  }
  const done = await finalizeAttempt(r.attempt, r.answers, { auto: body.auto === true });
  return json({ ok: true, attemptId: done?.id ?? id });
}
