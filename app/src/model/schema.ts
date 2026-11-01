/*
 * The Archipen file format (`*.archipen.json`).
 *
 * The `.describe()` texts end up in schema/archipen.schema.json and docs/file-format.md
 * describes the rules around them. When you change this file, update both
 * (`npm run schema` regenerates the JSON Schema; a test fails while it is stale).
 */
import { z } from 'zod'
import { defaultSettings, FILE_VERSION } from './constants'

export { FILE_VERSION }

/* ── Helpers ──────────────────────────────────────────────────────────────── */

const Hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Use a 6-digit hex colour like "#5b7cfa"')
const HexOrEmpty = z.string().regex(/^(#[0-9a-fA-F]{6})?$/, 'Use a 6-digit hex colour like "#5b7cfa", or "" for automatic')

/** Icon reference. The JSON Schema generator expands `x-archipen-icon` into the list of built-in names. */
const IconRef = (description: string, allowEmpty = false) =>
  z
    .string()
    .regex(allowEmpty ? /^((lucide|vendor|custom):.+)?$/ : /^(lucide|vendor|custom):.+$/, 'Icons are "lucide:<name>", "vendor:<name>" or "custom:<assetId>"')
    .meta({ description, 'x-archipen-icon': true })

/**
 * Give every field of an object schema a default, so a file may leave any of them out.
 * Nested objects are merged field by field, so a partial object keeps the defaults for the rest.
 * The output type is unchanged.
 */
function defaulted<O extends z.ZodObject>(obj: O, values: z.output<O>): O {
  const shape: Record<string, z.ZodType> = {}
  for (const [k, field] of Object.entries(obj.shape as Record<string, z.ZodType>)) {
    const v = (values as Record<string, unknown>)[k]
    if (v === undefined) shape[k] = field
    else if (field instanceof z.ZodObject && typeof v === 'object' && v && !Array.isArray(v)) shape[k] = defaulted(field, v as never)
    else shape[k] = (field as z.ZodType & { default: (v: unknown) => z.ZodType }).default(v)
  }
  let out: z.ZodType = z.object(shape)
  if (obj.description) out = out.describe(obj.description)
  return out.prefault({}) as unknown as O
}

/* ── Labels ──────────────────────────────────────────────────────────────── */

export const Side = z.enum(['top', 'bottom', 'left', 'right', 'center'])
export const Align = z.enum(['start', 'middle', 'end'])
export const Orientation = z.enum(['screen', 'ground-x', 'ground-y', 'wall-x', 'wall-y'])

export const LabelStyle = z
  .object({
    side: Side.describe('Which side of the item the label sits on, in the text’s own frame.'),
    align: Align.describe('Position along that side.'),
    orientation: Orientation.describe(
      'How the text is drawn: "screen" faces the viewer; "ground-x"/"ground-y" lie flat on the ground along that axis; "wall-x"/"wall-y" stand upright along that axis.',
    ),
    inside: z.boolean().describe('Place the label just inside the item’s outline instead of outside.'),
    offset: z.number().describe('Distance from the outline, in px.'),
    fontSize: z.number().min(4).max(200).describe('Font size in px.'),
    showDescription: z.boolean().describe('Also show the item’s description under its name.'),
    hidden: z.boolean().describe('Hide the label.'),
  })
  .describe('How an item’s name is drawn.')
export type LabelStyle = z.infer<typeof LabelStyle>

const base = {
  id: z.string().min(1).describe('Unique across all nodes, zones, edges and texts on all pages. Any string works; short readable ids like "api" are fine.'),
  name: z.string().default('').describe('Shown as the item’s label.'),
  description: z.string().default('').describe('Longer text. Shown when a share link is open and, if the label style allows, under the name.'),
  label: LabelStyle.partial().optional().describe('Overrides for this item’s label. Missing fields come from settings.labelDefaults.'),
  locked: z.boolean().optional().describe('Can be selected but not moved or resized on the canvas. A locked zone locks what is inside it.'),
  hidden: z.boolean().optional().describe('Not drawn anywhere, including exports. A hidden zone hides what is inside it, and wires to hidden items are hidden too.'),
}

/* ── Style defaults ──────────────────────────────────────────────────────────
 * Style fields on items are optional overrides. A missing field inherits from
 * `settings.styles[kind]`, so changing a default restyles every item that
 * doesn't override it. Size/icon in the defaults only apply to new items.
 */

export const NodeShape = z.enum(['block', 'cylinder', 'flat', 'icon'])
export type NodeShape = z.infer<typeof NodeShape>
export const IconPlacement = z.enum(['top', 'billboard', 'wall-x', 'wall-y'])
export type IconPlacement = z.infer<typeof IconPlacement>

export const NodeStyle = z.object({
  shape: NodeShape.describe('"block" box, "cylinder" (databases), "flat" tile on the ground, "icon" just the icon.'),
  color: Hex.describe('Fill colour, 6-digit hex.'),
  outline: z.number().min(0).max(6).describe('Outline stroke width, px.'),
  iconPlacement: IconPlacement.describe(
    '"top" flat on the top face, "billboard" standing upright facing the viewer, "wall-x"/"wall-y" on the side face along that axis.',
  ),
  iconScale: z.number().positive().describe('Icon size multiplier.'),
  iconColor: HexOrEmpty.describe('Icon colour; "" = automatic contrast colour.'),
})
export type NodeStyle = z.infer<typeof NodeStyle>

export const ZoneStyle = z.object({
  color: Hex.describe('Tint and border colour, 6-digit hex.'),
  dashed: z.boolean().describe('Dashed border.'),
  border: z.number().min(0).max(8).describe('Border width, px.'),
  fill: z.number().min(0).max(4).describe('Fill strength multiplier (1 = normal tint).'),
})
export type ZoneStyle = z.infer<typeof ZoneStyle>

export const LineStyle = z.enum(['solid', 'dashed', 'dotted'])
export const Arrows = z.enum(['none', 'end', 'start', 'both'])
export const Flow = z
  .object({
    enabled: z.boolean().describe('Animate dots moving along the wire.'),
    direction: z.enum(['forward', 'backward', 'both']).describe('"forward" = from → to.'),
    speed: z.number().positive().describe('Animation speed multiplier; higher is faster.'),
  })
  .describe('Animated flow along the wire.')
export type Flow = z.infer<typeof Flow>

export const EdgeStyle = z.object({
  arrows: Arrows.describe('Which ends get an arrowhead.'),
  style: LineStyle,
  color: Hex.describe('Line colour, 6-digit hex.'),
  width: z.number().positive().describe('Line width, px.'),
  arrowSize: z.number().positive().describe('Arrowhead size multiplier.'),
  flow: Flow,
})
export type EdgeStyle = z.infer<typeof EdgeStyle>

export const TextStyle = z.object({
  color: HexOrEmpty.describe('Text colour (plain text) or paper colour (note); "" = theme default.'),
})
export type TextStyle = z.infer<typeof TextStyle>

export const NODE_STYLE_KEYS = NodeStyle.keyof().options
export const ZONE_STYLE_KEYS = ZoneStyle.keyof().options
export const EDGE_STYLE_KEYS = EdgeStyle.keyof().options

export const StyleDefaults = z
  .object({
    node: NodeStyle.extend({
      w: z.number().positive().describe('Width of newly created nodes.'),
      d: z.number().positive().describe('Depth of newly created nodes.'),
      h: z.number().min(0).describe('Height of newly created nodes.'),
      icon: IconRef('Icon for newly created nodes; "" = none.', true),
    }),
    zone: ZoneStyle,
    edge: EdgeStyle,
    text: TextStyle,
    note: TextStyle.extend({ w: z.number().positive(), d: z.number().positive() }),
  })
  .describe('Diagram-wide style defaults. Items inherit any style field they don’t set themselves.')
export type StyleDefaults = z.infer<typeof StyleDefaults>

/* ── Items ────────────────────────────────────────────────────────────────── */

export const PageLink = z
  .object({
    page: z.string().min(1).describe('Id of the page to open.'),
  })
  .describe('Opens another page when the item is clicked in view or present mode.')
export type PageLink = z.infer<typeof PageLink>

const linkField = PageLink.optional()

const zoneIdField = z
  .string()
  .optional()
  .describe('Derived on load from positions (innermost zone containing the centre). You don’t need to set it.')

export const NodeData = z
  .object({
    ...base,
    x: z.number().describe('Grid x of the corner with the smallest x and y (not the centre).'),
    y: z.number().describe('Grid y of that corner.'),
    w: z.number().positive().default(2).describe('Size along x, in grid units.'),
    d: z.number().positive().default(2).describe('Size along y, in grid units.'),
    h: z.number().min(0).default(1).describe('Height, in grid units. 0 = flat.'),
    icon: IconRef('"lucide:<name>" for a built-in icon, "vendor:<name>" for a product logo, or "custom:<assetId>" for an entry in assets.').optional(),
    zoneId: zoneIdField,
    link: linkField,
    ...NodeStyle.partial().shape,
  })
  .describe('A box, cylinder, tile or icon standing on the ground grid.')
export type NodeData = z.infer<typeof NodeData>
/** A node with every style field resolved. */
export type DiagramNode = NodeData & NodeStyle

export const ZoneData = z
  .object({
    ...base,
    x: z.number().describe('Grid x of the corner with the smallest x and y.'),
    y: z.number().describe('Grid y of that corner.'),
    w: z.number().positive().describe('Size along x, in grid units.'),
    d: z.number().positive().describe('Size along y, in grid units.'),
    parentZoneId: z.string().optional().describe('Derived on load from positions (the smallest larger zone containing this one). You don’t need to set it.'),
    link: linkField,
    ...ZoneStyle.partial().shape,
  })
  .describe('A rectangle on the ground that groups whatever lies inside it. Zones can nest.')
export type ZoneData = z.infer<typeof ZoneData>
export type Zone = ZoneData & ZoneStyle

export const Port = z.enum(['n', 'e', 's', 'w'])
export type Port = z.infer<typeof Port>

export const Endpoint = z
  .object({
    nodeId: z.string().optional().describe('Id of a node. Give either nodeId or zoneId.'),
    zoneId: z.string().optional().describe('Id of a zone; the wire attaches to its border. Give either nodeId or zoneId.'),
    port: Port.optional().describe('Side to attach to: "n" = -y, "s" = +y, "w" = -x, "e" = +x. Omit to pick automatically.'),
  })
  .refine((e) => (e.nodeId === undefined) !== (e.zoneId === undefined), { message: 'Give either "nodeId" or "zoneId", not both.' })
  .meta({ oneOf: [{ required: ['nodeId'] }, { required: ['zoneId'] }] })
export type Endpoint = z.infer<typeof Endpoint>

/** Id of the node or zone a wire end attaches to. */
export const endId = (e: Endpoint): string => e.nodeId ?? e.zoneId ?? ''

export const EdgeData = z
  .object({
    ...base,
    from: Endpoint,
    to: Endpoint,
    waypoints: z
      .array(z.object({ x: z.number(), y: z.number() }))
      .default([])
      .describe('Optional bend points in grid units. Omit to route automatically at right angles.'),
    labelAt: z.number().min(0).max(1).default(0.5).describe('Label position along the path, 0..1.'),
    ...EdgeStyle.omit({ flow: true }).partial().shape,
    flow: Flow.partial().optional(),
  })
  .describe('A wire between two nodes or zones.')
export type EdgeData = z.infer<typeof EdgeData>
export type Edge = Omit<EdgeData, 'flow'> & EdgeStyle

export const TextData = z
  .object({
    ...base,
    kind: z.enum(['text', 'note']).describe('"text" = free text on the ground (name is the text); "note" = a sticky note (name is the title, description the body).'),
    x: z.number().describe('Text: anchor point. Note: grid x of the corner with the smallest x and y.'),
    y: z.number().describe('Text: anchor point. Note: grid y of that corner.'),
    w: z.number().positive().default(3).describe('Note size along x (ignored for plain text).'),
    d: z.number().positive().default(2).describe('Note size along y (ignored for plain text).'),
    color: HexOrEmpty.optional().describe('Overrides the text/note default; "" = theme text colour.'),
    zoneId: zoneIdField,
  })
  .describe('Free text or a sticky note.')
export type TextData = z.infer<typeof TextData>
export type TextItem = TextData & TextStyle

export const Asset = z
  .object({
    id: z.string(),
    name: z.string(),
    viewBox: z.tuple([z.number(), z.number(), z.number(), z.number()]),
    body: z.string().describe('Inner SVG markup (no <svg> wrapper). Sanitized on load.'),
  })
  .describe('A custom SVG icon, referenced as "custom:<id>".')
export type Asset = z.infer<typeof Asset>

/* ── Document ─────────────────────────────────────────────────────────────── */

export const Settings = z.object({
  projection: z.enum(['iso', '2d']).describe('"iso" isometric 3D view or "2d" top-down plan.'),
  crossing: z.enum(['hop', 'gap', 'none']).describe('How crossing wires are drawn.'),
  grid: z.boolean().describe('Show the ground grid.'),
  labelDefaults: z
    .object({
      node: LabelStyle,
      zone: LabelStyle,
      edge: LabelStyle,
      text: LabelStyle,
    })
    .describe('Label style per kind of item. Items can override single fields via `label`.'),
  styles: StyleDefaults,
})
export type Settings = z.infer<typeof Settings>

export const Page = z
  .object({
    id: z.string().min(1).describe('Unique among pages. Links refer to it.'),
    name: z.string().default('').describe('Shown in the page list and next to the diagram name.'),
    description: z.string().default(''),
    nodes: z.array(NodeData).default([]),
    zones: z.array(ZoneData).default([]),
    edges: z.array(EdgeData).default([]),
    texts: z.array(TextData).default([]),
  })
  .describe('One page of the diagram. Wires connect items on the same page.')
export type Page = z.infer<typeof Page>

/** The four item lists of a page. */
export type Layer = Pick<Page, 'nodes' | 'zones' | 'edges' | 'texts'>

export const Doc = z
  .object({
    $schema: z.string().optional().describe('Optional path or URL of the JSON Schema, for editors, e.g. https://archipen.dev/schema/archipen.schema.json.'),
    format: z.literal('archipen').describe('Always "archipen".'),
    version: z.number().int().min(1).default(FILE_VERSION).describe(`File format version. Currently ${FILE_VERSION}; files with a newer version are refused.`),
    id: z.string().default('').describe('Diagram id. Generated on load if missing or empty.'),
    name: z.string().default('Untitled diagram'),
    settings: defaulted(Settings, defaultSettings()).describe('All fields optional; missing ones take the built-in defaults.'),
    pages: z
      .array(Page)
      .min(1, 'A diagram needs at least one page.')
      .default([{ id: 'main', name: 'Main', description: '', nodes: [], zones: [], edges: [], texts: [] }])
      .describe('The pages, in order. The first one opens first.'),
    assets: z.record(z.string(), Asset).default({}).describe('Custom SVG icons by id.'),
  })
  .describe('An Archipen diagram (*.archipen.json).')
export type Doc = z.infer<typeof Doc>

export type EntityKind = 'node' | 'zone' | 'edge' | 'text'
export type Entity = NodeData | ZoneData | EdgeData | TextData

/**
 * One page seen as a document: the diagram's settings and assets with the page's items.
 * Most model, geometry and render code works on this.
 */
export type PageDoc = Omit<Doc, 'pages'> & Layer & { pageId: string; pageName: string }

/** A page with every item's style resolved against the defaults. */
export type ResolvedDoc = Omit<PageDoc, 'nodes' | 'zones' | 'edges' | 'texts'> & { nodes: DiagramNode[]; zones: Zone[]; edges: Edge[]; texts: TextItem[] }
