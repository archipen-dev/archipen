import regularUrl from '../assets/fonts/InstrumentSans-Regular.ttf?url'
import semiBoldUrl from '../assets/fonts/InstrumentSans-SemiBold.ttf?url'
import { fetchBase64 } from './fonts'

/** Font family the SVG must be drawn with (renderSvgString's `pdfFont`); registered below with both cuts. */
export const PDF_FONT = 'InstrumentSans'

let fontData: Promise<[string, string]> | null = null
const loadFonts = () => {
  fontData ??= Promise.all([fetchBase64(regularUrl), fetchBase64(semiBoldUrl)]).catch((err) => {
    fontData = null
    throw err
  })
  return fontData
}

export interface PdfPage {
  /** SVG drawn with `pdfFont: PDF_FONT`. */
  svg: string
  width: number
  height: number
}

const orientation = (w: number, h: number) => (w >= h ? 'landscape' : 'portrait')

/** Vector PDF via jsPDF + svg2pdf.js (loaded on demand): one PDF page per drawing, each its own size. */
export async function exportPdf(pages: PdfPage[]): Promise<Blob> {
  if (!pages.length) throw new Error('Nothing to export')
  const [{ jsPDF }, { svg2pdf }, [regular, semiBold]] = await Promise.all([import('jspdf'), import('svg2pdf.js'), loadFonts()])
  const first = pages[0]
  const pdf = new jsPDF({ orientation: orientation(first.width, first.height), unit: 'pt', format: [first.width, first.height], compress: true })
  // Static Instrument Sans cuts: SemiBold is registered as "bold".
  pdf.addFileToVFS('InstrumentSans-Regular.ttf', regular)
  pdf.addFont('InstrumentSans-Regular.ttf', PDF_FONT, 'normal')
  pdf.addFileToVFS('InstrumentSans-SemiBold.ttf', semiBold)
  pdf.addFont('InstrumentSans-SemiBold.ttf', PDF_FONT, 'bold')
  // svg2pdf needs the element in the DOM to resolve styles.
  const host = document.createElement('div')
  host.style.cssText = 'position:fixed;left:-99999px;top:0;visibility:hidden'
  document.body.appendChild(host)
  try {
    for (const [i, { svg: text, width: w, height: h }] of pages.entries()) {
      const parsed = new DOMParser().parseFromString(text, 'image/svg+xml')
      if (parsed.querySelector('parsererror')) throw new Error('Could not prepare the PDF')
      const svg = document.importNode(parsed.documentElement, true)
      host.replaceChildren(svg)
      if (i > 0) pdf.addPage([w, h], orientation(w, h))
      await svg2pdf(svg, pdf, { x: 0, y: 0, width: w, height: h })
    }
    return pdf.output('blob')
  } finally {
    host.remove()
  }
}
