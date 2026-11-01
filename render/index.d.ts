// Public types of @archipen/render. Keep in sync with src/index.ts.
import type { IncomingMessage, Server, ServerResponse } from 'node:http'

export type Format = 'svg' | 'png' | 'pdf'
export declare const FORMATS: readonly Format[]

export interface Issue {
  /** Errors stop the file from loading; warnings point at things that will look wrong. */
  level: 'error' | 'warning'
  /** Where in the file, e.g. `edges[2].to.nodeId`. Empty for the root. */
  path: string
  message: string
}

export interface RenderOptions {
  /** Colour theme. Default "light". */
  theme?: 'light' | 'dark'
  /**
   * Id of the page to draw. Without it, SVG holds every page (linked items are clickable) and PDF has one PDF page
   * per diagram page; PNG, which can only show one, draws the first page.
   */
  page?: string
  /** "iso" or "2d". Defaults to the projection saved in the file. */
  projection?: 'iso' | '2d'
  /** Fill the background with the theme colour. Default true; false gives a transparent PNG/SVG. */
  background?: boolean
  /** Keep the animated flow on wires (SVG only). Default false. */
  animate?: boolean
  /** Space around the diagram in px. Default 32. */
  padding?: number
  /** Pixel density for PNG. Default 2, at most 8. */
  scale?: number
  /** Embed the font in the SVG (about 40 KB). Default true. */
  embedFont?: boolean
}

/** A diagram: the parsed JSON object, JSON text, or the file's bytes. */
export type DiagramInput = object | string | Uint8Array

/** Thrown when the file can't be loaded. `issues` lists every problem. */
export declare class DiagramError extends Error {
  readonly issues: Issue[]
}

/** Thrown when the diagram is too large to draw (wider or taller than 100 000 px). */
export declare class RenderLimitError extends Error {}

export declare function validateDiagram(input: DiagramInput): Promise<{ doc: object | null; issues: Issue[] }>
export declare function renderSvg(input: DiagramInput, opts?: RenderOptions): Promise<string>
export declare function renderPng(input: DiagramInput, opts?: RenderOptions): Promise<Buffer>
export declare function renderPdf(input: DiagramInput, opts?: RenderOptions): Promise<Buffer>
export declare function render(input: DiagramInput, format: Format, opts?: RenderOptions): Promise<Buffer>
export declare function formatIssueLine(issue: Issue): string
export declare const CONTENT_TYPES: Record<Format, string>
