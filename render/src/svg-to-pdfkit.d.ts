declare module 'svg-to-pdfkit' {
  interface Options {
    width?: number
    height?: number
    assumePt?: boolean
    preserveAspectRatio?: string
    fontCallback?: (family: string, bold: boolean, italic: boolean, options: { fauxBold: boolean; fauxItalic: boolean }) => string
    warningCallback?: (message: string) => void
  }
  export default function SVGtoPDF(doc: PDFKit.PDFDocument, svg: string | Element, x?: number, y?: number, options?: Options): void
}
