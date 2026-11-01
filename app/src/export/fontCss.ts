/** Family name used inside exported files (matches the first entry of FONT_STACK). */
export const EXPORT_FONT_FAMILY = 'Instrument Sans Variable'

/** `@font-face` rule that inlines the variable Instrument Sans woff2 (base64), so exported SVGs render the same anywhere. */
export const fontFaceRule = (woff2Base64: string) =>
  `@font-face{font-family:'${EXPORT_FONT_FAMILY}';font-style:normal;font-weight:100 900;src:url(data:font/woff2;base64,${woff2Base64}) format('woff2');}`
