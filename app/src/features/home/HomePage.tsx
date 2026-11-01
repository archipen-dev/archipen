import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { deleteStoredDoc, listStoredDocs } from '../../io/autosave'
import { openDiagramFile, readDiagramFile } from '../../io/fileIO'
import { emptyDoc } from '../../model/defaults'
import type { Doc } from '../../model/schema'
import { templateDoc, type Template } from '../../model/templates'
import { Logo } from '../../ui'
import { RECENT_KEY, reportError, useOpenDocument } from '../documents'
import { AiStatusPill } from '../topbar'
import { Hero } from './Hero'
import { RecentGrid } from './RecentGrid'
import { TemplateGrid } from './TemplateGrid'

const DRAFTING_PAPER = {
  backgroundImage: 'linear-gradient(30deg, var(--line) 1px, transparent 1px), linear-gradient(150deg, var(--line) 1px, transparent 1px)',
  backgroundSize: '56px 32.33px',
  maskImage: 'radial-gradient(ellipse 80% 70% at 70% 30%, black, transparent)',
}

/** Start page: create, open, templates, and the diagrams kept in this browser. */
export function HomePage() {
  const qc = useQueryClient()
  const openDocument = useOpenDocument()
  const recent = useQuery({ queryKey: RECENT_KEY, queryFn: listStoredDocs })
  const [drag, setDrag] = useState(false)

  const edit = (doc: Doc, dirty: boolean) => openDocument(doc, { dirty, mode: 'edit' })
  // The doc is built inside the mutation: a broken template reports an error instead of throwing.
  const create = useMutation({ mutationFn: (make: () => Doc) => edit(make(), true), onError: reportError })
  const openFile = useMutation({ mutationFn: async () => edit(await openDiagramFile(), false), onError: reportError })
  const remove = useMutation({ mutationFn: deleteStoredDoc, onSuccess: () => qc.invalidateQueries({ queryKey: RECENT_KEY }) })

  const onDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setDrag(false)
    const file = Array.from(e.dataTransfer.files).find((x) => x.name.endsWith('.json'))
    if (file) await edit(await readDiagramFile(file), false).catch(reportError)
  }

  return (
    <div
      className="ap-scroll relative h-full overflow-y-auto"
      onDragOver={(e) => (e.preventDefault(), setDrag(true))}
      onDragLeave={(e) => e.currentTarget === e.target && setDrag(false)}
      onDrop={onDrop}
    >
      <div className="pointer-events-none fixed inset-0 opacity-70" style={DRAFTING_PAPER} />
      <div className="relative mx-auto max-w-[1180px] px-6 pt-8 pb-16 sm:px-10">
        <header className="flex items-center gap-2.5">
          <Logo className="size-7 text-ink" />
          <span className="font-display text-[19px] font-bold tracking-tight">Archipen</span>
          <AiStatusPill />
        </header>
        <Hero onNew={() => create.mutate(() => emptyDoc())} onOpen={() => openFile.mutate()} />
        <TemplateGrid onPick={(t: Template) => create.mutate(() => templateDoc(t))} />
        <RecentGrid
          docs={recent.data}
          loading={recent.isPending}
          onOpen={(doc, dirty) => void edit(doc, dirty)}
          onRemove={(doc) => confirm(`Remove “${doc.name}” from this browser? Files on disk are not affected.`) && remove.mutate(doc.id)}
        />
      </div>
      {drag && <div className="pointer-events-none fixed inset-3 rounded-3xl border-2 border-dashed border-accent bg-accent-soft" />}
    </div>
  )
}
