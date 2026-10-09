"use client";

import { useActionState, useState, useTransition } from "react";
import {
  addStudent,
  importStudents,
  updateStudent,
  deleteStudent,
  deleteAllStudents,
  type Result,
} from "@/app/actions/admin";
import { SubmitButton } from "@/components/SubmitButton";

type S = Result | undefined;
type Student = { id: string; name: string; code: string; attempts: number };

export function StudentTable({ classId, students }: { classId: string; students: Student[] }) {
  const [filter, setFilter] = useState("");
  const [pending, start] = useTransition();
  const list = students.filter(
    (s) => !filter || s.name.toLowerCase().includes(filter.toLowerCase()) || s.code.includes(filter),
  );
  return (
    <div className="card">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 p-3">
        <input
          className="input max-w-xs"
          placeholder="Tìm theo tên hoặc mã..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
        <span className="text-sm text-slate-500">{students.length} học sinh</span>
        <div className="flex-1" />
        <a href={`/api/admin/classes/${classId}/export`} className="btn btn-sm">
          Tải danh sách (Excel)
        </a>
        {students.length > 0 && (
          <button
            className="btn btn-sm btn-danger"
            disabled={pending}
            onClick={() => {
              if (confirm("Xoá TẤT CẢ học sinh của lớp (kèm kết quả làm bài)?")) start(() => void deleteAllStudents(classId));
            }}
          >
            Xoá tất cả
          </button>
        )}
      </div>
      {students.length === 0 ? (
        <p className="p-6 text-center text-sm text-slate-500">Chưa có học sinh. Thêm tay hoặc nhập từ Excel ở bên cạnh.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="table-base">
            <thead>
              <tr>
                <th className="w-10">#</th>
                <th>Họ và tên</th>
                <th>Mã học sinh</th>
                <th className="text-right">Lượt làm</th>
                <th className="w-32"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((s, i) => (
                <StudentRow key={s.id} s={s} index={i + 1} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function StudentRow({ s, index }: { s: Student; index: number }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(s.name);
  const [code, setCode] = useState(s.code);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (editing)
    return (
      <tr className="bg-brand-50/40">
        <td className="text-slate-400">{index}</td>
        <td>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </td>
        <td>
          <input className="input font-mono" value={code} onChange={(e) => setCode(e.target.value)} />
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </td>
        <td></td>
        <td className="whitespace-nowrap text-right">
          <button
            className="btn btn-sm btn-primary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await updateStudent(s.id, name, code);
                if (r.ok) {
                  setEditing(false);
                  setError(null);
                } else setError(r.error);
              })
            }
          >
            Lưu
          </button>{" "}
          <button className="btn btn-sm" onClick={() => setEditing(false)}>
            Huỷ
          </button>
        </td>
      </tr>
    );

  return (
    <tr className="hover:bg-slate-50">
      <td className="text-slate-400">{index}</td>
      <td className="font-medium text-slate-800">{s.name}</td>
      <td className="font-mono text-slate-600">{s.code}</td>
      <td className="text-right text-slate-500">{s.attempts}</td>
      <td className="whitespace-nowrap text-right">
        <button className="btn btn-sm" onClick={() => setEditing(true)}>
          Sửa
        </button>{" "}
        <button
          className="btn btn-sm btn-danger"
          disabled={pending}
          onClick={() => {
            if (confirm(`Xoá học sinh ${s.name}? Kết quả làm bài của em cũng bị xoá.`)) start(() => void deleteStudent(s.id));
          }}
        >
          Xoá
        </button>
      </td>
    </tr>
  );
}

export function AddStudentForm({ classId }: { classId: string }) {
  const [state, action] = useActionState<S, FormData>(addStudent, undefined);
  return (
    <form
      action={async (fd) => {
        await action(fd);
      }}
      className="card space-y-3 p-4"
      key={state?.ok ? state.message : "form"}
    >
      <h2 className="font-semibold text-slate-900">Thêm học sinh</h2>
      <input type="hidden" name="classId" value={classId} />
      <input name="name" className="input" placeholder="Họ và tên" required />
      <input name="code" className="input font-mono" placeholder="Mã học sinh (để trống = tự tạo)" />
      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-600">{state.message}</p>}
      <SubmitButton>Thêm</SubmitButton>
    </form>
  );
}

export function ImportStudentsForm({ classId }: { classId: string }) {
  const [state, action] = useActionState<S, FormData>(importStudents, undefined);
  const [mode, setMode] = useState<"file" | "text">("file");
  return (
    <form action={action} className="card space-y-3 p-4" key={state?.ok ? state.message : "import"}>
      <h2 className="font-semibold text-slate-900">Nhập danh sách</h2>
      <input type="hidden" name="classId" value={classId} />
      <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
        {(["file", "text"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setMode(m)}
            className={`flex-1 rounded-md px-2 py-1 ${mode === m ? "bg-white font-medium shadow-sm" : "text-slate-600"}`}
          >
            {m === "file" ? "File Excel/CSV" : "Dán danh sách"}
          </button>
        ))}
      </div>
      {mode === "file" ? (
        <>
          <input name="file" type="file" accept=".xlsx,.csv" className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border file:border-slate-200 file:bg-white file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-50" required />
          <p className="text-xs text-slate-500">
            Cột <b>Họ và tên</b> và cột <b>Mã HS</b> (không bắt buộc). Có thể có cột STT.{" "}
            <a href="/mau-danh-sach-hoc-sinh.xlsx" className="text-brand-600 hover:underline">
              Tải file mẫu
            </a>
          </p>
        </>
      ) : (
        <>
          <textarea
            name="text"
            className="input min-h-32 font-mono text-xs"
            placeholder={"Mỗi dòng một học sinh: Tên, Mã\nNguyễn Văn An, HS01\nTrần Thị Bình, HS02"}
            required
          />
          <p className="text-xs text-slate-500">Có thể copy 2 cột từ Excel rồi dán vào đây.</p>
        </>
      )}
      {state && !state.ok && <p className="text-sm text-red-600">{state.error}</p>}
      {state?.ok && <p className="text-sm text-emerald-600">{state.message}</p>}
      <SubmitButton pendingText="Đang nhập...">Nhập vào lớp</SubmitButton>
      <p className="text-xs text-slate-400">Học sinh trùng mã sẽ được cập nhật tên, không bị thêm lần hai.</p>
    </form>
  );
}
