// Tạo file Word mẫu: node scripts/make-template.mjs  → public/mau-de-trac-nghiem.docx
import { writeFileSync } from "fs";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
  ShadingType,
  TabStopType,
} from "docx";

const FONT = "Times New Roman";
const t = (text, o = {}) => new TextRun({ text, font: FONT, size: 26, ...o });
const p = (runs, o = {}) =>
  new Paragraph({ children: Array.isArray(runs) ? runs : [runs], spacing: { after: 60 }, ...o });

// Ghi chú hướng dẫn (đóng khung xám) – web sẽ bỏ qua phần này vì nằm trước câu hỏi đầu tiên
const note = (text, bold = false) =>
  new Paragraph({
    children: [new TextRun({ text, font: FONT, size: 22, bold, color: "444444" })],
    shading: { type: ShadingType.CLEAR, fill: "F2F2F2", color: "auto" },
    spacing: { after: 0 },
    indent: { left: 120, right: 120 },
  });

// Phương án 4 cột trên một dòng (dùng tab)
const tabStops = [2400, 4800, 7200].map((pos) => ({ type: TabStopType.LEFT, position: pos }));

const children = [
  p(t("ĐỀ KIỂM TRA TIẾNG ANH – UNIT 1", { bold: true, size: 30 }), { alignment: AlignmentType.CENTER }),
  p(t("(Dòng đầu tiên sẽ được gợi ý làm tên đề trên web)", { italics: true, size: 20, color: "777777" }), {
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
  }),

  note("CÁCH SOẠN ĐỀ ĐỂ WEB ĐỌC ĐƯỢC (có thể xoá khung này):", true),
  note("• Mỗi câu bắt đầu bằng  Câu 1:  hoặc  Question 1.  (tự gõ số, không dùng đánh số tự động)."),
  note("• Mỗi phương án bắt đầu bằng chữ cái in hoa và dấu chấm. Có thể để 4 phương án trên 1 dòng."),
  note("• BÔI ĐẬM phương án đúng. Các phần khác của phương án không được in đậm."),
  note("   Nếu không muốn bôi đậm, viết thêm một dòng  Đáp án: B  ngay dưới các phương án."),
  note("• Giải thích (không bắt buộc): dòng bắt đầu bằng  Giải thích:  ngay dưới phương án."),
  note("• Đoạn văn đọc hiểu: mở bằng dòng [ĐOẠN VĂN], các câu hỏi của đoạn văn đặt ngay sau,"),
  note("   cuối cùng đóng bằng dòng [HẾT ĐOẠN VĂN]."),
  note("• Tiêu đề phần bắt đầu bằng PART 1, PHẦN 2, ... Gạch chân, in nghiêng và hình ảnh được giữ nguyên."),
  p(t(""), { spacing: { after: 120 } }),

  // ---- PART 1: phát âm, phương án cùng dòng
  p(
    t(
      "PART 1. Mark the letter A, B, C, or D to indicate the word whose underlined part differs from the other three in pronunciation.",
      { bold: true },
    ),
  ),
  p([t("Câu 1:")]),
  p(
    [
      t("A. h"),
      t("a", { underline: {} }),
      t("t\t"),
      t("B. c"),
      t("a", { underline: {} }),
      t("t\t"),
      t("C. n", { bold: true }),
      t("a", { bold: true, underline: {} }),
      t("me", { bold: true }),
      t("\tD. m"),
      t("a", { underline: {} }),
      t("p"),
    ],
    { tabStops },
  ),
  p(t("Giải thích: “name” đọc là /eɪ/, các từ còn lại đọc là /æ/.")),

  p(
    [
      t("Câu 2:"),
    ],
  ),
  p(
    [
      t("A. b"),
      t("oo", { underline: {} }),
      t("k\t"),
      t("B. l"),
      t("oo", { underline: {} }),
      t("k\t"),
      t("C. f"),
      t("oo", { underline: {} }),
      t("d\t", {}),
      t("D. g"),
      t("oo", { underline: {} }),
      t("d"),
    ],
    { tabStops },
  ),
  p(t("Đáp án: C")),
  p(t("Giải thích: “food” đọc là /uː/, các từ còn lại đọc là /ʊ/.")),

  // ---- PART 2: mỗi phương án một dòng
  p(t("PART 2. Choose the best answer to complete each sentence.", { bold: true }), { spacing: { before: 200, after: 60 } }),
  p(t("Câu 3: She ________ to school by bike every day.")),
  p(t("A. go")),
  p(t("B. goes", { bold: true })),
  p(t("C. going")),
  p(t("D. gone")),
  p(t("Giải thích: Chủ ngữ “She” là ngôi thứ ba số ít, thì hiện tại đơn nên động từ thêm -es.")),

  p(t("Câu 4: I have lived here ________ 2015.")),
  p([t("A. for\t\t"), t("B. since", { bold: true })], { tabStops }),
  p([t("C. in\t\t"), t("D. at")], { tabStops }),
  p(t("Giải thích: “since” + mốc thời gian; “for” + khoảng thời gian.")),

  // ---- PART 3: đọc hiểu
  p(t("PART 3. Read the passage and choose the correct answer.", { bold: true }), { spacing: { before: 200, after: 60 } }),
  p(t("[ĐOẠN VĂN]")),
  p(
    t(
      "Tom is a student at Green Valley School. Every morning, he gets up at six o’clock and has breakfast with his family. Then he walks to school with his best friend, Lisa. After school, Tom often plays football in the park.",
    ),
  ),
  p(t("Câu 5: What time does Tom get up?")),
  p([t("A. At five o’clock\t\t"), t("B. At six o’clock", { bold: true })], { tabStops }),
  p([t("C. At seven o’clock\t\t"), t("D. At eight o’clock")], { tabStops }),
  p(t("Giải thích: Đoạn văn viết “he gets up at six o’clock”.")),

  p(t("Câu 6: How does Tom go to school?")),
  p(t("A. By bus")),
  p(t("B. By bike")),
  p(t("C. On foot", { bold: true })),
  p(t("D. By car")),
  p(t("Giải thích: “he walks to school” nghĩa là đi bộ (on foot).")),
  p(t("[HẾT ĐOẠN VĂN]")),

  // ---- câu hỏi thường sau đoạn văn
  p(t("Câu 7: Which word is the OPPOSITE of “happy”?"), { spacing: { before: 200, after: 60 } }),
  p([t("A. glad\t"), t("B. sad", { bold: true }), t("\tC. joyful\tD. pleased")], { tabStops }),
  p(t("Giải thích: “sad” (buồn) trái nghĩa với “happy” (vui).")),
];

const doc = new Document({
  styles: { default: { document: { run: { font: FONT, size: 26 } } } },
  sections: [
    {
      properties: { page: { margin: { top: 1000, bottom: 1000, left: 1100, right: 1000 } } },
      children,
    },
  ],
});

const buf = await Packer.toBuffer(doc);
writeFileSync(new URL("../public/mau-de-trac-nghiem.docx", import.meta.url), buf);
console.log("Đã tạo public/mau-de-trac-nghiem.docx");
// tránh cảnh báo biến không dùng
