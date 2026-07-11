// Whitelist sanitizer for notebook `text/html` outputs (pandas tables etc.).
// A notebook is untrusted content: its html output can carry <script> tags or
// event-handler attributes that would run as OUR origin. Browser-only (uses
// DOMParser) — callers render a text/plain fallback until after mount.

const ALLOWED_TAGS = new Set([
  "a", "abbr", "b", "blockquote", "br", "caption", "code", "col", "colgroup",
  "dd", "details", "div", "dl", "dt", "em", "figcaption", "figure",
  "h1", "h2", "h3", "h4", "h5", "h6", "hr", "i", "img", "li", "mark", "ol",
  "p", "pre", "s", "small", "span", "strong", "sub", "summary", "sup",
  "table", "tbody", "td", "tfoot", "th", "thead", "tr", "u", "ul",
])

const ALLOWED_ATTRS = new Set([
  "class", "colspan", "rowspan", "scope", "alt", "title",
  "width", "height", "align", "valign", "border",
])

const SAFE_HREF = /^(https?:|mailto:|#)/i
const SAFE_IMG_SRC = /^(https?:|data:image\/(png|jpeg|gif|webp|svg\+xml);base64,)/i

function sanitizeElement(el: Element): void {
  // Snapshot: children mutate as we remove nodes.
  for (const child of Array.from(el.children)) {
    if (!ALLOWED_TAGS.has(child.tagName.toLowerCase())) {
      // Drop the whole subtree — safest for script/style/iframe/object/etc.
      child.remove()
      continue
    }
    for (const attr of Array.from(child.attributes)) {
      const name = attr.name.toLowerCase()
      if (name === "href") {
        if (
          child.tagName.toLowerCase() === "a" &&
          SAFE_HREF.test(attr.value.trim())
        ) {
          child.setAttribute("target", "_blank")
          child.setAttribute("rel", "noopener noreferrer")
          continue
        }
        child.removeAttribute(attr.name)
      } else if (name === "src") {
        if (
          child.tagName.toLowerCase() === "img" &&
          SAFE_IMG_SRC.test(attr.value.trim())
        ) {
          continue
        }
        child.removeAttribute(attr.name)
      } else if (!ALLOWED_ATTRS.has(name)) {
        child.removeAttribute(attr.name)
      }
    }
    sanitizeElement(child)
  }
}

/** Sanitize an untrusted html fragment. Returns "" outside the browser. */
export function sanitizeHtml(html: string): string {
  if (typeof DOMParser === "undefined") return ""
  const doc = new DOMParser().parseFromString(html, "text/html")
  sanitizeElement(doc.body)
  return doc.body.innerHTML
}
