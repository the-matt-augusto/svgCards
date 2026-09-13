// Matches characters forbidden in XML 1.0 documents (excluding \t, \n, \r)
const XML_ILLEGAL_CHARS = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g;

/**
 * Escapes special XML characters and strips illegal control characters
 * to ensure rendered SVG text is always well-formed and secure.
 */
export function escapeXml(str: string | null | undefined): string {
  if (!str) return '';
  
  return str
    .replace(XML_ILLEGAL_CHARS, '')
    .replace(/[<>&'"]/g, (c) => {
      switch (c) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '&': return '&amp;';
        case '\'': return '&apos;';
        case '"': return '&quot;';
        default: return c;
      }
    });
}
