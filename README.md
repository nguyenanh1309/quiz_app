# Kiểm tra trực tuyến

Web giao bài trắc nghiệm từ file Word, tự chấm điểm, học sinh xem lại lỗi sai kèm giải thích, giáo viên theo dõi kết quả theo lớp.

**Công nghệ:** Next.js 16 (App Router) · TypeScript · Tailwind CSS 4 · Postgres + Drizzle ORM · mammoth (đọc .docx) · exceljs.

## Chức năng

**Giáo viên (`/admin`)**
- Tạo lớp, mỗi lớp một mật khẩu riêng. Thêm / sửa / xoá học sinh, nhập danh sách từ Excel/CSV hoặc dán từ Excel, tải danh sách ra Excel.
- Tạo đề bằng cách kéo thả file Word → web đọc thành câu hỏi, hiện bản xem trước, đánh dấu câu lỗi (thiếu đáp án, nhiều đáp án in đậm...) để sửa trước khi lưu.
- Sửa đề: sửa câu hỏi / phương án / đáp án / giải thích, thêm, xoá, đổi thứ tự câu, thêm câu từ file Word khác, nhân bản đề.
- Mỗi đề tự đặt thời gian, số lần làm tối đa, có cho xem đáp án hay không, mở/đóng đề, giao cho một hoặc nhiều lớp. Đề được lưu để dùng lại nhiều lần.
- Bảng kết quả theo lớp: điểm cao nhất, điểm lần cuối, số lần làm, thời gian làm, ai chưa làm, cảnh báo mở nhiều tab / hết giờ tự nộp; phổ điểm; câu cả lớp sai nhiều nhất; xem chi tiết từng bài; xoá một lượt để cho học sinh làm lại; xuất Excel.

**Học sinh (`/`)**
- Chọn lớp → mật khẩu lớp → chọn tên → mã học sinh. Chỉ thấy đề được giao cho lớp mình.
- Làm bài có đồng hồ đếm ngược, tự lưu đáp án (lỡ tải lại trang vẫn làm tiếp), hết giờ tự nộp.
- Nộp xong thấy ngay điểm, câu đúng/sai, đáp án đúng và giải thích dưới các câu sai.

**Chống mở 2 tab**
- Cùng một trình duyệt: tab thứ hai bị chặn ngay (BroadcastChannel), tab đang làm hiện thông báo và giáo viên thấy ghi chú.
- Khác trình duyệt / thiết bị: máy chủ cấp "token" cho tab đang làm; mở ở nơi khác thì tab cũ bị khoá và lượt làm bị đánh dấu.
- Đáp án đúng không bao giờ được gửi xuống trình duyệt khi đang làm bài; điểm được chấm ở máy chủ.

## Cách soạn file Word

Tải file mẫu trong trang quản trị (**Đề kiểm tra → Tải file Word mẫu**) hoặc `public/mau-de-trac-nghiem.docx`.

```
PART 1. Mark the letter A, B, C, or D ...        ← tiêu đề phần (PART/PHẦN ...)
Câu 1: She ________ to school every day.          ← "Câu 1:", "Question 1." hoặc "1."
A. go        B. goes        C. going    D. gone  ← 1 phương án/dòng hoặc nhiều phương án/dòng
Giải thích: Chủ ngữ số ít → động từ thêm -es.    ← không bắt buộc

[ĐOẠN VĂN]                                        ← đoạn văn đọc hiểu dùng chung
Tom is a student ...
Câu 2: ...
Câu 3: ...
[HẾT ĐOẠN VĂN]
```

- **Bôi đậm phương án đúng** (chỉ phương án đúng được in đậm). Có thể thay bằng dòng `Đáp án: B` dưới các phương án, hoặc bảng `ĐÁP ÁN` ở cuối file (`1.A 2.C 3.B ...`).
- Gạch chân, in nghiêng, chỉ số trên/dưới và hình ảnh được giữ nguyên (phù hợp câu phát âm, trọng âm).
- Gõ số câu bằng tay, không dùng đánh số tự động của Word (vẫn đọc được nhưng kém chắc chắn hơn).
- Chỉ nhận `.docx`. File `.doc` cũ: mở bằng Word → Lưu thành `.docx`.

Kiểm tra nhanh một file: `npm run test:parser -- duong-dan/de.docx`

## Chạy trên máy

Cần Node.js 20+ và một database Postgres.

```bash
npm install
cp .env.example .env      # điền DATABASE_URL, ADMIN_PASSWORD, AUTH_SECRET
npm run db:migrate        # tạo bảng
npm run dev               # http://localhost:3000
```

## Đưa lên mạng miễn phí (Vercel + Neon)

1. Tạo database miễn phí tại **neon.tech** → copy connection string (dạng `postgresql://...?sslmode=require`).
2. Đưa code lên GitHub, vào **vercel.com** → *Add New Project* → chọn repo.
3. Trong *Environment Variables* thêm:
   - `DATABASE_URL` = chuỗi kết nối Neon
   - `ADMIN_PASSWORD` = mật khẩu trang quản trị
   - `AUTH_SECRET` = chuỗi ngẫu nhiên dài (ví dụ chạy `openssl rand -base64 32`)
4. Deploy. Lệnh `vercel-build` sẽ tự tạo bảng database rồi build.
5. Giáo viên vào `https://ten-web.vercel.app/admin`, học sinh vào `https://ten-web.vercel.app`.

> Vercel giới hạn mỗi lần tải lên khoảng 4,5 MB. Đề có nhiều ảnh nặng nên nén ảnh trong Word trước (Picture Format → Compress Pictures).

## Cấu trúc thư mục

```
src/
  app/
    page.tsx                     đăng nhập học sinh
    admin/(panel)/               trang quản trị: tổng quan, lớp, đề, kết quả
    student/                     danh sách bài, làm bài (ExamRunner), xem lại
    api/student/...              bắt đầu / tự lưu / nộp bài
    api/admin/...                xuất Excel
    actions/                     server actions (đăng nhập, CRUD)
  components/                    ExamEditor, AttemptReview, ...
  db/schema.ts                   bảng database
  lib/docx-parser.ts             đọc file Word → câu hỏi
  lib/grading.ts                 chấm điểm, tự nộp bài hết giờ
  lib/tab-lock.ts                chặn mở 2 tab
  proxy.ts                       bảo vệ đường dẫn /admin, /student
drizzle/                         file migration SQL
scripts/                         tạo file mẫu, kiểm tra bộ đọc Word
```

## Ghi chú

- Điểm thang 10, làm tròn 2 chữ số: `số câu đúng / tổng số câu × 10`.
- Mật khẩu lớp được lưu dạng đọc được để giáo viên xem lại và phát cho học sinh; mật khẩu quản trị nằm trong biến môi trường.
- Sửa đáp án sau khi học sinh đã nộp sẽ không chấm lại bài cũ — xoá lượt làm trong bảng kết quả để học sinh làm lại.
