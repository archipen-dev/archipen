/*
 * The app's Content-Security-Policy. The production build puts it in a <meta> tag (for hosts that can't set
 * headers, like GitHub Pages), and deploy/Caddyfile sends it as a header plus `frame-ancestors 'none'`,
 * which only works as a header. The Caddyfile and the nginx example in docs/hosting.md must send SECURITY_HEADERS;
 * src/securityHeaders.test.ts checks that they do.
 *
 * Only the dev server runs without it: React's hot reload needs an inline script.
 *   style-src 'unsafe-inline'  React sets inline styles
 *   img-src data: blob:        icons embedded in diagrams; PNG export draws the SVG from a blob URL
 *   font-src data:             the font inlined into exported SVGs
 *   connect-src ws:            the local AI bridge on 127.0.0.1 (mcp/), used once a tab is paired
 */
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' ws://127.0.0.1:*",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
].join('; ')

/** The header form: also forbids showing the app inside a frame. */
export const CSP_HEADER = `${CSP}; frame-ancestors 'none'`

/** Every header the hosting configs send with the app. */
export const SECURITY_HEADERS: Record<string, string> = {
  'Content-Security-Policy': CSP_HEADER,
  'X-Frame-Options': 'DENY',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
}
