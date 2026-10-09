import "server-only";
import { and, eq } from "drizzle-orm";
import { db, examAssignments, exams, type StudentRow } from "@/db";

/** Đề có được giao cho lớp của học sinh không. */
export async function getExamForStudent(examId: string, student: StudentRow) {
  const row = (
    await db
      .select({ exam: exams })
      .from(exams)
      .innerJoin(
        examAssignments,
        and(eq(examAssignments.examId, exams.id), eq(examAssignments.classId, student.classId)),
      )
      .where(eq(exams.id, examId))
      .limit(1)
  )[0];
  return row?.exam ?? null;
}

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}
