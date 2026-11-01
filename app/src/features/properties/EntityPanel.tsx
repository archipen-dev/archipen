import { clearSelection } from '../../commands/selection'
import type { AnyEntity } from '../../model/entities'
import { entityLabel } from '../../model/kinds'
import type { Doc } from '../../model/schema'
import { KindIcon, PanelShell } from '../../ui'
import { ItemActions } from './ItemActions'
import { DescriptionSection, NameField } from './sections/ContentSection'
import { EdgeAppearance, EdgeFlow, EdgeRoute } from './sections/EdgeSections'
import { LabelSection } from './sections/LabelSection'
import { LinkSection } from './sections/LinkSection'
import { NodeAppearance } from './sections/NodeAppearance'
import { TextAppearance } from './sections/TextAppearance'
import { ZoneAppearance } from './sections/ZoneAppearance'

/** The sections specific to each kind of item. */
function KindSections({ ent, doc }: { ent: AnyEntity; doc: Doc }) {
  switch (ent.kind) {
    case 'node':
      return <NodeAppearance n={ent.item} doc={doc} />
    case 'zone':
      return <ZoneAppearance z={ent.item} doc={doc} />
    case 'edge':
      return (
        <>
          <EdgeRoute e={ent.item} doc={doc} />
          <EdgeAppearance e={ent.item} doc={doc} />
          <EdgeFlow e={ent.item} doc={doc} />
        </>
      )
    case 'text':
      return <TextAppearance t={ent.item} doc={doc} />
  }
}

/** One item selected: everything about it. */
export function EntityPanel({ doc, ent }: { doc: Doc; ent: AnyEntity }) {
  const { id } = ent.item
  return (
    <PanelShell title={entityLabel(ent)} icon={<KindIcon kind={ent.kind} />} onClose={clearSelection} top={<NameField ent={ent} />} footer={<ItemActions ids={[id]} />}>
      <DescriptionSection ent={ent} />
      <KindSections ent={ent} doc={doc} />
      {(ent.kind === 'node' || ent.kind === 'zone') && <LinkSection item={ent.item} />}
      <LabelSection doc={doc} ent={ent} />
    </PanelShell>
  )
}
