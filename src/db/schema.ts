import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  doublePrecision,
  primaryKey,
  uniqueIndex,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";
import { randomUUID } from "crypto";

const id = () =>
  text("id")
    .primaryKey()
    .$defaultFn(() => randomUUID());
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

/** Lớp học – mỗi lớp có một mật khẩu chung. */
export const classes = pgTable("classes", {
  id: id(),
  name: text("name").notNull().unique(),
  password: text("password").notNull(),
  createdAt: createdAt(),
});

/** Học sinh – đăng nhập bằng tên + mã học sinh trong lớp. */
export const students = pgTable(
  "students",
  {
    id: id(),
    name: text("name").notNull(),
    code: text("code").notNull(),
    classId: text("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("students_class_code_idx").on(t.classId, t.code), index("students_class_idx").on(t.classId)],
);

/** Đề kiểm tra. */
export const exams = pgTable("exams", {
  id: id(),
  title: text("title").notNull(),
  description: text("description"),
  /** Thời gian làm bài (phút) – mỗi đề tự đặt */
  durationMinutes: integer("duration_minutes").notNull().default(45),
  /** Số lần làm tối đa, 0 = không giới hạn */
  maxAttempts: integer("max_attempts").notNull().default(0),
  /** Cho học sinh xem đáp án + giải thích sau khi nộp */
  showAnswers: boolean("show_answers").notNull().default(true),
  /** Đề đang mở cho học sinh làm */
  isOpen: boolean("is_open").notNull().default(true),
  sourceFileName: text("source_file_name"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

/** Giao đề cho lớp (một đề có thể giao nhiều lớp). */
export const examAssignments = pgTable(
  "exam_assignments",
  {
    examId: text("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    classId: text("class_id")
      .notNull()
      .references(() => classes.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [primaryKey({ columns: [t.examId, t.classId] })],
);

export const questions = pgTable(
  "questions",
  {
    id: id(),
    examId: text("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    order: integer("order").notNull(),
    /** Đoạn văn đọc hiểu dùng chung (HTML) */
    passage: text("passage"),
    /** Nội dung câu hỏi (HTML đã lọc an toàn) */
    text: text("text").notNull(),
    /** Các phương án (HTML) */
    options: jsonb("options").$type<string[]>().notNull(),
    correctIndex: integer("correct_index").notNull(),
    explanation: text("explanation"),
  },
  (t) => [index("questions_exam_idx").on(t.examId, t.order)],
);

export const attemptStatus = pgEnum("attempt_status", ["IN_PROGRESS", "SUBMITTED"]);

export type GradedItem = { questionId: string; chosen: number | null; correctIndex: number; correct: boolean };

export const attempts = pgTable(
  "attempts",
  {
    id: id(),
    examId: text("exam_id")
      .notNull()
      .references(() => exams.id, { onDelete: "cascade" }),
    studentId: text("student_id")
      .notNull()
      .references(() => students.id, { onDelete: "cascade" }),
    status: attemptStatus("status").notNull().default("IN_PROGRESS"),
    startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
    deadline: timestamp("deadline", { withTimezone: true }).notNull(),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    /** Tự nộp do hết giờ */
    autoSubmitted: boolean("auto_submitted").notNull().default(false),
    /** { [questionId]: chỉ số phương án đã chọn } */
    answers: jsonb("answers").$type<Record<string, number>>().notNull().default({}),
    /** Kết quả chấm lúc nộp */
    result: jsonb("result").$type<GradedItem[]>(),
    score: doublePrecision("score"),
    correctCount: integer("correct_count"),
    totalCount: integer("total_count"),
    /** Thời gian làm thực tế (giây) */
    durationSec: integer("duration_sec"),
    /** Token của tab đang làm bài – tab cũ bị khoá khi bài mở ở nơi khác */
    tabToken: text("tab_token"),
    /** Số lần bài bị mở ở tab/thiết bị khác */
    tabConflicts: integer("tab_conflicts").notNull().default(0),
    /** Số lần rời khỏi trang làm bài */
    leaveCount: integer("leave_count").notNull().default(0),
  },
  (t) => [
    index("attempts_exam_student_idx").on(t.examId, t.studentId),
    index("attempts_student_idx").on(t.studentId),
    // Mỗi học sinh chỉ có tối đa 1 lượt đang làm cho mỗi đề
    uniqueIndex("attempts_one_in_progress_idx")
      .on(t.examId, t.studentId)
      .where(sql`${t.status} = 'IN_PROGRESS'`),
  ],
);

export const classesRelations = relations(classes, ({ many }) => ({
  students: many(students),
  assignments: many(examAssignments),
}));
export const studentsRelations = relations(students, ({ one, many }) => ({
  classRoom: one(classes, { fields: [students.classId], references: [classes.id] }),
  attempts: many(attempts),
}));
export const examsRelations = relations(exams, ({ many }) => ({
  questions: many(questions),
  assignments: many(examAssignments),
  attempts: many(attempts),
}));
export const assignmentsRelations = relations(examAssignments, ({ one }) => ({
  exam: one(exams, { fields: [examAssignments.examId], references: [exams.id] }),
  classRoom: one(classes, { fields: [examAssignments.classId], references: [classes.id] }),
}));
export const questionsRelations = relations(questions, ({ one }) => ({
  exam: one(exams, { fields: [questions.examId], references: [exams.id] }),
}));
export const attemptsRelations = relations(attempts, ({ one }) => ({
  exam: one(exams, { fields: [attempts.examId], references: [exams.id] }),
  student: one(students, { fields: [attempts.studentId], references: [students.id] }),
}));

export type ClassRow = typeof classes.$inferSelect;
export type StudentRow = typeof students.$inferSelect;
export type ExamRow = typeof exams.$inferSelect;
export type QuestionRow = typeof questions.$inferSelect;
export type AttemptRow = typeof attempts.$inferSelect;
