import 'server-only'
import sanitizeHtml from 'sanitize-html'

/** Strip all markup from untrusted external content (vendor feeds) and collapse whitespace. */
export function toPlainText(input: string | null | undefined, maxLength = 20000) {
  if (!input) return null
  const text = sanitizeHtml(input, { allowedTags: [], allowedAttributes: {} })
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text
}

/** Rich-text engineering notes: allow basic formatting only. */
export function sanitizeNotes(input: string | null | undefined) {
  if (!input) return null
  return sanitizeHtml(input, {
    allowedTags: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 'ul', 'ol', 'li', 'h3', 'h4', 'blockquote', 'code', 'pre', 'a'],
    allowedAttributes: { a: ['href', 'target', 'rel'] },
    allowedSchemes: ['https', 'http', 'mailto'],
    transformTags: { a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener noreferrer' }) },
  })
}

/** Email body HTML: table-based, inline-styled markup compatible with Outlook. No scripts, forms or event handlers. */
export function sanitizeEmailHtml(input: string) {
  return sanitizeHtml(input, {
    allowedTags: [
      'html', 'head', 'body', 'meta', 'title', 'style', 'div', 'span', 'p', 'br', 'hr', 'b', 'strong', 'i', 'em', 'u', 'small',
      'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'a', 'img', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td',
      'center', 'font', 'blockquote', 'code', 'pre',
    ],
    allowVulnerableTags: true,
    allowedAttributes: {
      '*': ['style', 'align', 'valign', 'width', 'height', 'bgcolor', 'class', 'dir', 'role', 'lang'],
      a: ['href', 'target', 'rel', 'title', 'style'],
      img: ['src', 'alt', 'width', 'height', 'style', 'border'],
      table: ['cellpadding', 'cellspacing', 'border', 'width', 'style', 'bgcolor', 'align', 'role'],
      td: ['colspan', 'rowspan', 'width', 'style', 'bgcolor', 'align', 'valign'],
      th: ['colspan', 'rowspan', 'width', 'style', 'bgcolor', 'align', 'valign', 'scope'],
      meta: ['charset', 'name', 'content', 'http-equiv'],
      font: ['color', 'face', 'size'],
    },
    allowedSchemes: ['https', 'http', 'mailto', 'cid', 'data'],
    allowedSchemesByTag: { img: ['https', 'http', 'cid', 'data'] },
  })
}

export function escapeHtml(value: unknown) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
