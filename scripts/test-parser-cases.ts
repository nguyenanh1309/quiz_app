// Các trường hợp định dạng Word khác nhau: npx tsx scripts/test-parser-cases.ts
import { parseHtmlToExam } from "../src/lib/docx-parser";

const cases: Record<string, string> = {
  "Câu + phương án cùng dòng, đáp án in đậm chữ cái":
    "<p>Question 1. She ___ to school. A. go <strong>B.</strong> goes C. going D. gone</p><p>Explanation: present simple</p>",
  "Đánh số tự động + phương án dạng danh sách con":
    "<ol><li>What is 2+2?<ol><li>3</li><li><strong>4</strong></li><li>5</li></ol></li><li>Capital of France?<ol><li><strong>Paris</strong></li><li>Rome</li></ol></li></ol>",
  "Bảng đáp án cuối file":
    "<p>Câu 1: Hello?</p><p>A. hi</p><p>B. bye</p><p>Câu 2: Yes?</p><p>A) no</p><p>B) yes</p><p>ĐÁP ÁN</p><p>1.A 2.B</p>",
  "Cả câu bị in đậm (lỗi soạn đề)":
    "<p>Câu 1: Test</p><p><strong>A. one</strong></p><p><strong>B. two</strong></p>",
  "Phương án trong bảng 2x2":
    "<p>Câu 1: Pick</p><table><tr><td><p>A. red</p></td><td><p><strong>B. blue</strong></p></td></tr><tr><td><p>C. green</p></td><td><p>D. pink</p></td></tr></table><p>Đáp án: B</p>",
};

for (const [name, html] of Object.entries(cases)) {
  const r = parseHtmlToExam(html);
  console.log(`\n=== ${name}`);
  for (const q of r.questions)
    console.log(" Q:", q.text, "|", q.options.map((o, i) => (i === q.correctIndex ? `*${o}` : o)).join(" / "), q.explanation ? `| GT: ${q.explanation}` : "");
  if (r.warnings.length) console.log(" ⚠", r.warnings);
}
