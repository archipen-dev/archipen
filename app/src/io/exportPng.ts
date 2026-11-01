import { rasterScale } from '../export/limits'

/** Raster export: an SVG file (with the font embedded) drawn onto a canvas at `scale`. */
export async function exportPng(svg: string, width: number, height: number, scale: number): Promise<Blob> {
  const k = rasterScale(width, height, scale) // stay within canvas limits
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }))
  try {
    const img = new Image()
    img.decoding = 'async'
    img.src = url
    await img.decode()
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(width * k)
    canvas.height = Math.round(height * k)
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('Canvas is not available')
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png'))
  } finally {
    URL.revokeObjectURL(url)
  }
}
