import { resolveZone } from '../../../model/defaults'
import { ZONE_STYLE_KEYS, type Doc, type ZoneData, type ZoneStyle } from '../../../model/schema'
import { customCount } from '../../../model/styles'
import { SizeField, ZONE_SIZE, ZoneStyleFields } from '../../style-fields'
import { StyleBadge } from '../StyleBadge'
import { patchItem, resetKeys, styleOps } from '../styleOps'
import { SavedSection } from '../SavedSection'

export function ZoneAppearance({ z, doc }: { z: ZoneData; doc: Doc }) {
  return (
    <SavedSection
      id="props.appearance"
      title="Appearance"
      aside={<StyleBadge count={customCount(z, ZONE_STYLE_KEYS)} onReset={() => resetKeys<ZoneData>(z.id, ZONE_STYLE_KEYS)} />}
    >
      <ZoneStyleFields value={resolveZone(doc.settings.styles, z)} over={z} {...styleOps<ZoneStyle>(z.id)} />
      <SizeField {...ZONE_SIZE} value={z} onChange={(p) => patchItem<ZoneData>(z.id, p)} />
    </SavedSection>
  )
}
