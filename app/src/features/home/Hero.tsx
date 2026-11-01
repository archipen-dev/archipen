import { FolderOpen, Plus } from 'lucide-react'
import { useMemo } from 'react'
import { sampleDoc } from '../../model/defaults'
import { Button } from '../../ui'
import { DiagramPreview } from './DiagramPreview'

const BIG = 'h-10 rounded-xl px-4 text-[13.5px]'

export function Hero({ onNew, onOpen }: { onNew: () => void; onOpen: () => void }) {
  const sample = useMemo(() => sampleDoc(), [])
  return (
    <section className="mt-10 grid items-center gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
      <div className="ap-enter">
        <h1 className="font-display text-[clamp(40px,6vw,72px)] leading-[0.95] font-bold tracking-[-0.035em]">
          Draw systems
          <br />
          <span className="text-accent">in three</span> dimensions.
        </h1>
        <p className="mt-5 max-w-[440px] text-[15px] leading-relaxed text-ink-muted">
          Isometric architecture diagrams with live, flowing connections. Everything runs in your browser, and files are saved straight to your disk.
        </p>
        <div className="mt-7 flex flex-wrap gap-2">
          <Button variant="primary" className={BIG} onClick={onNew}>
            <Plus className="size-4" /> New diagram
          </Button>
          <Button variant="subtle" className={BIG} onClick={onOpen}>
            <FolderOpen className="size-4" /> Open file…
          </Button>
        </div>
      </div>
      <div className="ap-enter relative aspect-[16/10] [animation-delay:120ms]">
        <DiagramPreview doc={sample} animate pad={8} />
      </div>
    </section>
  )
}
