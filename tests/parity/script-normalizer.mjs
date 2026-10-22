/**
 * Normalize inline scripts in trusted build output for parity comparison.
 * This is a test helper, not an HTML sanitizer. RSC is compared separately.
 */
export function normalizeInlineScripts(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script\b[^>]*>/gi, "<script/>");
}
