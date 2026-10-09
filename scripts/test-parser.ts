// Kiểm tra bộ đọc Word: npx tsx scripts/test-parser.ts <file.docx>
import { readFileSync } from "fs";
import { parseDocx } from "../src/lib/docx-parser";

async function main() {
  const file = process.argv[2] ?? "public/mau-de-trac-nghiem.docx";
  const r = await parseDocx(readFileSync(file));
  console.log("Tiêu đề gợi ý:", r.titleSuggestion);
  r.questions.forEach((q, i) => {
    console.log(`\n#${i + 1}`, q.passage ? `[nhóm: ${q.passage.slice(0, 80)}...]` : "");
    console.log("  Q:", q.text);
    q.options.forEach((o, k) => console.log(`  ${k === q.correctIndex ? "*" : " "} ${"ABCD"[k]}. ${o}`));
    if (q.explanation) console.log("  GT:", q.explanation);
  });
  console.log("\nCảnh báo:", r.warnings);
}
main();
