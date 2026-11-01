import { useState, type FormEvent } from 'react'
import { pairWithCode } from '../../io/aiBridge'
import { useUi } from '../../store/uiStore'
import { Button, DialogShell, TextInput } from '../../ui'

/** Pair this tab with a local AI tool (the Archipen MCP server) using the code it gave, without leaving the diagram. */
export function AiConnectDialog() {
  const open = useUi((s) => s.dialog === 'ai')
  const closeDialog = useUi((s) => s.closeDialog)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!pairWithCode(code)) return setError('That isn’t a pairing code. It looks like 7331.Ab3x… or a link containing ?mcp=.')
    setCode('')
    setError('')
    closeDialog()
  }

  return (
    <DialogShell open={open} onOpenChange={(o) => !o && closeDialog()} title="Connect an AI tool" width={460}>
      <form onSubmit={submit} className="flex flex-col gap-3 px-5 py-5 text-[12.5px] leading-relaxed text-ink-muted">
        <p>
          An AI client with the Archipen MCP server (such as Claude Code) can read and edit this diagram. Ask it to connect to Archipen, and paste the pairing
          code or link it gives you.
        </p>
        <TextInput aria-label="Pairing code" placeholder="7331.Ab3x…" value={code} onChange={(e) => (setCode(e.target.value), setError(''))} autoFocus spellCheck={false} />
        {error && <p className="text-red-500">{error}</p>}
        <div className="flex justify-end">
          <Button type="submit" variant="primary" disabled={!code.trim()}>
            Connect
          </Button>
        </div>
      </form>
    </DialogShell>
  )
}
