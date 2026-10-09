import sanitizeHtml from "sanitize-html";

/** Chỉ giữ các thẻ định dạng cơ bản; ảnh chỉ cho phép dạng data: (ảnh nhúng trong file Word). */
export function sanitizeRichHtml(html: string): string {
  return sanitizeHtml(html, {
    allowedTags: ["b", "strong", "i", "em", "u", "s", "sub", "sup", "br", "p", "img"],
    allowedAttributes: { img: ["src", "alt"] },
    allowedSchemes: [],
    allowedSchemesByTag: { img: ["data"] },
    allowProtocolRelative: false,
  }).trim();
}

/** Chuyển văn bản thường người dùng nhập (trong trình sửa câu hỏi) thành HTML an toàn. */
export function plainOrHtml(input: string): string {
  return sanitizeRichHtml(input.replace(/\r\n/g, "\n").replace(/\n/g, "<br />"));
}

export function stripHtml(html: string): string {
  return sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} }).replace(/\s+/g, " ").trim();
}
