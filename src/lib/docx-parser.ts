/**
 * Bộ đọc đề trắc nghiệm từ file Word (.docx).
 *
 * Quy ước (xem file mẫu trong trang quản trị):
 *  - Câu hỏi bắt đầu bằng "Câu 1:", "Question 1." hoặc "1."
 *  - Phương án bắt đầu bằng "A.", "B.", "C.", "D." (có thể nằm chung một dòng)
 *  - Đáp án đúng: BÔI ĐẬM phương án đúng (hoặc viết dòng "Đáp án: B")
 *  - Giải thích: dòng bắt đầu bằng "Giải thích:" ngay dưới các phương án
 *  - Đoạn văn đọc hiểu: bắt đầu bằng [ĐOẠN VĂN], kết thúc bằng [HẾT ĐOẠN VĂN]
 *  - Tiêu đề phần: dòng bắt đầu bằng "PART 1", "PHẦN 1", "Mark the letter...", ...
 */
import { parseDocument } from "htmlparser2";
import type { ChildNode, Element } from "domhandler";
import { sanitizeRichHtml } from "./sanitize";

export type ParsedQuestion = {
  passage: string | null;
  text: string;
  options: string[];
  /** -1 nếu không xác định được đáp án đúng */
  correctIndex: number;
  explanation: string | null;
};

export type ParsedExam = {
  titleSuggestion: string | null;
  questions: ParsedQuestion[];
  warnings: string[];
};

/* ------------------------------------------------------------------ */
/* Token hoá nội dung một dòng (giữ định dạng đậm/nghiêng/gạch chân)    */
/* ------------------------------------------------------------------ */

type Fmt = { b: boolean; i: boolean; u: boolean; sup: boolean; sub: boolean };
type Tok = { kind: "text"; text: string; f: Fmt } | { kind: "img"; src: string; f: Fmt };
type Line = { toks: Tok[]; listDepth: number; ordered: boolean };

const IMG_CHAR = "￼";
const NO_FMT: Fmt = { b: false, i: false, u: false, sup: false, sub: false };

function lineText(toks: Tok[]) {
  return toks.map((t) => (t.kind === "text" ? t.text : IMG_CHAR)).join("");
}

/** Cắt token theo vị trí ký tự [start, end). */
function sliceToks(toks: Tok[], start: number, end: number): Tok[] {
  const out: Tok[] = [];
  let pos = 0;
  for (const t of toks) {
    const len = t.kind === "text" ? t.text.length : 1;
    const s = Math.max(start, pos);
    const e = Math.min(end, pos + len);
    if (s < e) {
      if (t.kind === "text") out.push({ kind: "text", text: t.text.slice(s - pos, e - pos), f: t.f });
      else out.push(t);
    }
    pos += len;
  }
  return out;
}

/** Tỉ lệ ký tự (không phải khoảng trắng) được in đậm. */
function boldRatio(toks: Tok[]) {
  let total = 0;
  let bold = 0;
  for (const t of toks) {
    if (t.kind !== "text") continue;
    for (const ch of t.text) {
      if (/\s/.test(ch)) continue;
      total++;
      if (t.f.b) bold++;
    }
  }
  return total === 0 ? 0 : bold / total;
}

function trimToks(toks: Tok[]): Tok[] {
  const text = lineText(toks);
  const start = text.length - text.trimStart().length;
  const end = text.trimEnd().length;
  return sliceToks(toks, start, end);
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** Chuyển token thành HTML. dropBold = true để xoá in đậm (tránh lộ đáp án). */
function toksToHtml(toks: Tok[], dropBold = false): string {
  let html = "";
  for (const t of trimToks(toks)) {
    let inner = t.kind === "text" ? escapeHtml(t.text) : `<img src="${escapeHtml(t.src)}" alt="" />`;
    if (t.kind === "text" && inner.length === 0) continue;
    if (t.f.sub) inner = `<sub>${inner}</sub>`;
    if (t.f.sup) inner = `<sup>${inner}</sup>`;
    if (t.f.u) inner = `<u>${inner}</u>`;
    if (t.f.i) inner = `<em>${inner}</em>`;
    if (t.f.b && !dropBold) inner = `<strong>${inner}</strong>`;
    html += inner;
  }
  // gộp thẻ liền kề giống nhau: </u><u> ...
  html = html.replace(/<\/(strong|em|u|sub|sup)><\1>/g, "");
  return html.replace(/\t/g, " ").replace(/ {2,}/g, " ");
}

/* ------------------------------------------------------------------ */
/* Đọc HTML do mammoth sinh ra thành danh sách dòng                     */
/* ------------------------------------------------------------------ */

const BLOCK_TAGS = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "td", "th", "blockquote", "pre", "div"]);

function htmlToLines(html: string): Line[] {
  const doc = parseDocument(html);
  const lines: Line[] = [];

  const walkInline = (nodes: ChildNode[], f: Fmt, cur: { toks: Tok[] }, push: () => void) => {
    for (const n of nodes) {
      if (n.type === "text") {
        cur.toks.push({ kind: "text", text: decodeEntities((n as unknown as { data: string }).data), f });
      } else if (n.type === "tag") {
        const el = n as Element;
        const name = el.name.toLowerCase();
        if (name === "br") {
          push();
          continue;
        }
        if (name === "img") {
          const src = el.attribs.src ?? "";
          if (src.startsWith("data:image/")) cur.toks.push({ kind: "img", src, f });
          continue;
        }
        if (name === "ol" || name === "ul") continue; // danh sách con xử lý ở cấp block
        if (BLOCK_TAGS.has(name)) {
          // đoạn văn lồng trong li/td
          push();
          walkInline(el.children, f, cur, push);
          push();
          continue;
        }
        const nf: Fmt = {
          b: f.b || name === "strong" || name === "b",
          i: f.i || name === "em" || name === "i",
          u: f.u || name === "u",
          sup: f.sup || name === "sup",
          sub: f.sub || name === "sub",
        };
        walkInline(el.children, nf, cur, push);
      }
    }
  };

  const emitBlock = (el: Element, listDepth: number, ordered: boolean) => {
    const cur = { toks: [] as Tok[] };
    let first = true;
    const push = () => {
      if (lineText(cur.toks).trim().length > 0) {
        // chỉ dòng đầu tiên của <li> mang thông tin danh sách
        lines.push({ toks: cur.toks, listDepth: first ? listDepth : 0, ordered });
        first = false;
      }
      cur.toks = [];
    };
    walkInline(el.children, NO_FMT, cur, push);
    push();
  };

  const walkBlocks = (nodes: ChildNode[], listDepth: number, ordered: boolean) => {
    for (const n of nodes) {
      if (n.type !== "tag") continue;
      const el = n as Element;
      const name = el.name.toLowerCase();
      if (name === "ol" || name === "ul") {
        walkBlocks(el.children, listDepth + 1, name === "ol");
      } else if (name === "li") {
        emitBlock(el, listDepth, ordered);
        const nested = el.children.filter(
          (c): c is Element => c.type === "tag" && ["ol", "ul"].includes((c as Element).name),
        );
        for (const nl of nested) walkBlocks(nl.children, listDepth + 1, nl.name === "ol");
      } else if (["table", "thead", "tbody", "tfoot", "tr"].includes(name)) {
        walkBlocks(el.children, listDepth, ordered);
      } else if (name === "td" || name === "th") {
        // ô bảng có thể chứa nhiều đoạn
        const hasBlocks = el.children.some((c) => c.type === "tag" && BLOCK_TAGS.has((c as Element).name));
        if (hasBlocks) walkBlocks(el.children, listDepth, ordered);
        else emitBlock(el, 0, false);
      } else if (BLOCK_TAGS.has(name)) {
        emitBlock(el, 0, false);
      } else {
        walkBlocks(el.children, listDepth, ordered);
      }
    }
  };

  walkBlocks(doc.children, 0, false);
  return lines;
}

function decodeEntities(s: string) {
  return s
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&amp;/g, "&")
    .replace(/ /g, " ");
}

/* ------------------------------------------------------------------ */
/* Nhận dạng loại dòng                                                 */
/* ------------------------------------------------------------------ */

const RE_QUESTION = /^\s*(?:(?:câu|cau|question|q)\s*(\d+)\s*[:.)\-–]?|(\d{1,3})\s*[.)]\s)\s*/i;
const RE_OPTION_START = /^\s*([A-Da-d])\s*[.)]\s*/;
const RE_EXPLAIN = /^\s*(?:giải thích|giai thich|lời giải|loi giai|hướng dẫn giải|explanation|explain)\s*[:.\-–]\s*/i;
const RE_ANSWER = /^\s*(?:đáp án|dap an|answer|key)\s*(?:đúng|dung)?\s*[:.\-–]?\s*\(?([A-Da-d])\)?\s*[.)]?\s*$/i;
const RE_ANSWER_KEY_HEADER = /^\s*(?:bảng đáp án|bang dap an|đáp án|dap an|answer key|answers)\s*:?\s*$/i;
const RE_PASSAGE_START = /^\s*\[\s*(?:đoạn văn|doan van|passage|reading)\s*\]\s*/i;
const RE_PASSAGE_END = /^\s*\[\s*(?:hết đoạn văn|het doan van|\/\s*đoạn văn|\/\s*passage|end passage|end)\s*\]\s*$/i;
const RE_SECTION =
  /^\s*(?:(?:part|phần|phan|section|exercise|bài tập)\s+[0-9IVXivx]+\b|mark the letter|read the following|choose the (?:best|correct|word|option|letter)|chọn đáp án|đọc đoạn văn)/i;

/** Tách các phương án A–D trong một dòng (có thể có nhiều phương án/dòng). */
function splitOptions(text: string): { letter: number; start: number; contentStart: number }[] | null {
  const first = text.match(RE_OPTION_START);
  if (!first) return null;
  const lower = first[1] === first[1].toLowerCase();
  const letters = lower ? "abcd" : "ABCD";
  const startLetter = letters.indexOf(first[1]);
  const marks: { letter: number; start: number; contentStart: number }[] = [];
  const firstStart = text.indexOf(first[1]);
  marks.push({ letter: startLetter, start: firstStart, contentStart: first[0].length });
  let from = first[0].length;
  for (let l = startLetter + 1; l < 4; l++) {
    const re = new RegExp(`(^|\\s)(${letters[l]})\\s*[.)]\\s*`, "g");
    re.lastIndex = from;
    const m = re.exec(text);
    if (!m) break;
    const start = m.index + m[1].length;
    marks.push({ letter: l, start, contentStart: m.index + m[0].length });
    from = m.index + m[0].length;
  }
  return marks;
}

/* ------------------------------------------------------------------ */
/* Máy trạng thái                                                      */
/* ------------------------------------------------------------------ */

type Draft = {
  number: number;
  textLines: Tok[][];
  options: { letter: number; toks: Tok[]; markerBold?: boolean }[];
  explanation: Tok[][];
  answerLetter: number | null;
  passage: string | null;
};

export function parseHtmlToExam(html: string): ParsedExam {
  const lines = htmlToLines(html);
  const warnings: string[] = [];
  const drafts: Draft[] = [];
  const headerLines: string[] = [];
  const answerKey = new Map<number, number>();

  const st = { mode: "header" as "header" | "question" | "options" | "explanation" | "group" | "answerKey" };
  let cur: Draft | null = null;
  let groupLines: Tok[][] = [];
  let groupHasQuestions = false;
  let autoNumber = 0;

  const addOptionLine = (d: Draft, toks: Tok[]) => {
    const text = lineText(toks);
    const marks = splitOptions(text) ?? [];
    for (let k = 0; k < marks.length; k++) {
      const m = marks[k];
      const end = k + 1 < marks.length ? marks[k + 1].start : text.length;
      // giữ ký tự "B." để xét in đậm, nội dung chỉ lấy sau dấu chấm
      const markerBold = sliceToks(toks, m.start, m.start + 1).some((t) => t.kind === "text" && t.f.b);
      d.options.push({ letter: m.letter, toks: sliceToks(toks, m.contentStart, end), markerBold });
    }
    st.mode = "options";
  };

  const groupHtml = () => {
    const parts = groupLines.map((l) => toksToHtml(l)).filter(Boolean);
    return parts.length ? parts.map((p) => `<p>${p}</p>`).join("") : null;
  };

  const startGroup = (toks: Tok[] | null) => {
    if (groupHasQuestions) {
      groupLines = [];
      groupHasQuestions = false;
    }
    if (toks && lineText(toks).trim()) groupLines.push(toks);
    st.mode = "group";
  };

  for (const line of lines) {
    const text = lineText(line.toks);
    const trimmed = text.trim();
    if (!trimmed) continue;

    // Bảng đáp án cuối file: "1.A 2.B 3-C ..."
    if (st.mode === "answerKey") {
      const pairs = [...trimmed.matchAll(/(\d{1,3})\s*[.:\-)]?\s*([A-Da-d])\b/g)];
      if (pairs.length) {
        for (const p of pairs) answerKey.set(Number(p[1]), "abcd".indexOf(p[2].toLowerCase()));
        continue;
      }
    }
    if (RE_ANSWER_KEY_HEADER.test(trimmed) && drafts.length + (cur ? 1 : 0) > 0) {
      st.mode = "answerKey";
      continue;
    }

    if (RE_PASSAGE_END.test(trimmed)) {
      groupLines = [];
      groupHasQuestions = false;
      if (st.mode === "group") st.mode = "header";
      continue;
    }
    const passageStart = trimmed.match(RE_PASSAGE_START);
    if (passageStart) {
      const rest = sliceToks(line.toks, text.indexOf(trimmed) + passageStart[0].length, text.length);
      if (cur) drafts.push(cur);
      cur = null;
      startGroup(rest);
      continue;
    }

    const qMatch = trimmed.match(RE_QUESTION);
    const isAutoQuestion = !qMatch && line.listDepth === 1 && line.ordered && !RE_OPTION_START.test(trimmed);
    if (qMatch || isAutoQuestion) {
      if (cur) drafts.push(cur);
      const number = qMatch ? Number(qMatch[1] ?? qMatch[2]) : ++autoNumber;
      if (qMatch) autoNumber = number;
      const offset = text.indexOf(trimmed) + (qMatch ? qMatch[0].length : 0);
      let rest = sliceToks(line.toks, offset, text.length);
      // Phương án nằm chung dòng với câu hỏi: "Câu 1: She ___ . A. go B. goes C. ... D. ..."
      let inlineOptions: Tok[] | null = null;
      const restText = lineText(rest);
      const inl = restText.match(/(^|\s)A\s*[.)]\s+\S[\s\S]*?\sB\s*[.)]\s+\S/);
      if (inl && inl.index !== undefined) {
        const cut = inl.index + inl[1].length;
        inlineOptions = sliceToks(rest, cut, restText.length);
        rest = sliceToks(rest, 0, cut);
      }
      cur = {
        number,
        textLines: lineText(rest).trim() ? [rest] : [],
        options: [],
        explanation: [],
        answerLetter: null,
        passage: groupHtml(),
      };
      if (groupLines.length) groupHasQuestions = true;
      st.mode = "question";
      if (inlineOptions) addOptionLine(cur, inlineOptions);
      continue;
    }

    if (!cur && RE_SECTION.test(trimmed)) {
      startGroup(line.toks);
      continue;
    }

    if (cur) {
      const ans = trimmed.match(RE_ANSWER);
      if (ans) {
        cur.answerLetter = "abcd".indexOf(ans[1].toLowerCase());
        continue;
      }
      const exp = trimmed.match(RE_EXPLAIN);
      if (exp) {
        const rest = sliceToks(line.toks, text.indexOf(trimmed) + exp[0].length, text.length);
        if (lineText(rest).trim()) cur.explanation.push(rest);
        st.mode = "explanation";
        continue;
      }

      // Phương án
      const marks = st.mode !== "explanation" ? splitOptions(text) : null;
      const isListOption = !marks && line.listDepth >= 2 && (st.mode === "question" || st.mode === "options");
      if (marks && (st.mode === "question" || st.mode === "options")) {
        addOptionLine(cur, line.toks);
        continue;
      }
      if (isListOption) {
        cur.options.push({ letter: cur.options.length, toks: line.toks });
        st.mode = "options";
        continue;
      }

      // Tiêu đề phần / hướng dẫn mới sau khi đã có câu hỏi
      if (RE_SECTION.test(trimmed) && (st.mode === "options" || st.mode === "explanation")) {
        drafts.push(cur);
        cur = null;
        startGroup(line.toks);
        continue;
      }

      if (st.mode === "question") {
        cur.textLines.push(line.toks);
        continue;
      }
      if (st.mode === "explanation") {
        cur.explanation.push(line.toks);
        continue;
      }
      // Dòng không rõ sau phương án
      warnings.push(`Câu ${cur.number}: bỏ qua dòng không nhận dạng được: "${trimmed.slice(0, 60)}"`);
      continue;
    }

    if (st.mode === "group") {
      groupLines.push(line.toks);
      continue;
    }
    // Trước câu hỏi đầu tiên → phần tiêu đề
    headerLines.push(trimmed);
  }
  if (cur) drafts.push(cur);

  /* ---------- Chuyển bản nháp thành câu hỏi ---------- */
  const questions: ParsedQuestion[] = drafts.map((d) => {
    const label = `Câu ${d.number}`;
    const text = d.textLines.map((l) => toksToHtml(l)).filter(Boolean).join("<br />");
    if (!text && !d.passage) warnings.push(`${label}: thiếu nội dung câu hỏi`);

    // Sắp xếp phương án theo chữ cái, bỏ trùng
    const opts = [...d.options].sort((a, b) => a.letter - b.letter);
    const options = opts.map((o) => sanitizeRichHtml(toksToHtml(o.toks, true)));
    if (options.length < 2) warnings.push(`${label}: chỉ có ${options.length} phương án`);

    let correctIndex = -1;
    if (d.answerLetter !== null && d.answerLetter < opts.length) {
      correctIndex = d.answerLetter;
    } else {
      const scores = opts.map((o) => {
        return Math.max(boldRatio(o.toks), o.markerBold ? 1 : 0);
      });
      const boldIdx = scores.map((s, i) => (s >= 0.6 ? i : -1)).filter((i) => i >= 0);
      if (boldIdx.length === 1) correctIndex = boldIdx[0];
      else if (boldIdx.length > 1) {
        // Có thể cả dòng bị in đậm → chọn phương án đậm "nhất" nếu khác biệt rõ
        const max = Math.max(...scores);
        const top = scores.filter((s) => s === max).length;
        if (top === 1 && max - Math.min(...scores) > 0.3) correctIndex = scores.indexOf(max);
        else warnings.push(`${label}: có nhiều phương án được in đậm – hãy chọn lại đáp án đúng`);
      } else if (answerKey.has(d.number)) {
        const k = answerKey.get(d.number)!;
        if (k < opts.length) correctIndex = k;
      }
    }
    if (correctIndex === -1 && answerKey.has(d.number) && d.answerLetter === null) {
      const k = answerKey.get(d.number)!;
      if (k < opts.length) correctIndex = k;
    }
    if (correctIndex === -1 && !warnings.some((w) => w.startsWith(`${label}: có nhiều`)))
      warnings.push(`${label}: chưa xác định được đáp án đúng (hãy bôi đậm phương án đúng)`);

    const explanation = d.explanation.map((l) => toksToHtml(l)).filter(Boolean).join("<br />");
    return {
      passage: d.passage ? sanitizeRichHtml(d.passage) : null,
      text: sanitizeRichHtml(text),
      options,
      correctIndex,
      explanation: explanation ? sanitizeRichHtml(explanation) : null,
    };
  });

  if (questions.length === 0) warnings.push("Không tìm thấy câu hỏi nào. Hãy kiểm tra file có theo đúng mẫu không.");

  // Câu bị đánh số trùng / nhảy cóc
  const nums = drafts.map((d) => d.number);
  const dup = nums.filter((n, i) => nums.indexOf(n) !== i);
  if (dup.length) warnings.push(`Số thứ tự câu bị trùng: ${[...new Set(dup)].join(", ")}`);

  return {
    titleSuggestion: headerLines.find((l) => l.length > 3 && l.length < 150) ?? null,
    questions,
    warnings,
  };
}

export async function parseDocx(buffer: Buffer): Promise<ParsedExam> {
  const mammoth = await import("mammoth");
  const { value: html } = await mammoth.convertToHtml(
    { buffer },
    {
      styleMap: ["u => u", "strike => s"],
      includeDefaultStyleMap: true,
    },
  );
  return parseHtmlToExam(html);
}
