import { Bot, KeyRound, RefreshCw, Unplug } from 'lucide-react'
import { disconnectBridge, retryBridge } from '../../io/aiBridge'
import { cx } from '../../lib/cx'
import { type BridgeStatus, useBridge } from '../../store/bridgeStore'
import { useUi } from '../../store/uiStore'
import { Button, Menu, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Tip } from '../../ui'

const LABEL: Record<Exclude<BridgeStatus, 'off'>, string> = {
  connecting: 'Connecting to the AI…',
  connected: 'AI connected',
  unreachable: 'AI server not reachable',
  unsupported: 'AI connection not supported here',
  rejected: 'AI connection refused',
  replaced: 'AI connected in another tab',
}

const DOT: Record<Exclude<BridgeStatus, 'off'>, string> = {
  connecting: 'bg-amber-500',
  connected: 'bg-emerald-500',
  unreachable: 'bg-amber-500',
  unsupported: 'bg-red-500',
  rejected: 'bg-red-500',
  replaced: 'bg-ink-faint',
}

/** The link to a local AI tool (MCP): a button to pair this tab, then the connection's state. */
export function AiStatus() {
  const { status, message, port } = useBridge()
  const openDialog = useUi((s) => s.openDialog)
  if (status === 'off')
    return (
      <Tip label="Connect an AI tool">
        <Button size="bar" aria-label="Connect an AI tool" data-testid="ai-status" data-status="off" onClick={() => openDialog('ai')}>
          <Bot className="size-[19px]" />
        </Button>
      </Tip>
    )
  return (
    <Menu
      width="w-72"
      trigger={
        <Tip label={LABEL[status]}>
          <MenuTrigger>
            <Button size="bar" aria-label={LABEL[status]} data-testid="ai-status" data-status={status} className="relative">
              <Bot className="size-[19px]" />
              <span className={cx('absolute top-2.5 right-2.5 size-2 rounded-full ring-2 ring-panel-solid', DOT[status], status === 'connecting' && 'animate-pulse')} />
            </Button>
          </MenuTrigger>
        </Tip>
      }
    >
      <AiMenuItems status={status} message={message} port={port} onPair={() => openDialog('ai')} />
    </Menu>
  )
}

/** The start page's badge: the connection's state with the same menu, once a tab is paired. */
export function AiStatusPill() {
  const { status, message, port } = useBridge()
  const pill = 'ml-2 rounded-full border border-line px-2 py-0.5 font-mono text-[10.5px] text-ink-faint'
  if (status === 'off') return null
  return (
    <Menu
      width="w-72"
      align="start"
      trigger={
        <MenuTrigger>
          <button type="button" data-testid="ai-status" data-status={status} className={cx(pill, 'flex items-center gap-1.5 transition-colors hover:border-line-strong hover:text-ink')}>
            <span className={cx('size-1.5 rounded-full', DOT[status], status === 'connecting' && 'animate-pulse')} />
            {LABEL[status]}
          </button>
        </MenuTrigger>
      }
    >
      <AiMenuItems status={status} message={message} port={port} />
    </Menu>
  )
}

function AiMenuItems({ status, message, port, onPair }: { status: Exclude<BridgeStatus, 'off'>; message: string; port: number | null; onPair?: () => void }) {
  const canRetry = status !== 'connected' && status !== 'connecting' && status !== 'rejected'
  return (
    <>
      <MenuLabel>{LABEL[status]}</MenuLabel>
      <p className={cx('px-2.5 pb-2 text-[12px] leading-snug', status === 'connected' ? 'text-ink-muted' : 'text-red-500')}>
        {status === 'connected' ? `Through the Archipen MCP server on port ${port}. Its changes can be undone like yours.` : message}
      </p>
      <MenuSeparator />
      {canRetry && <MenuItem icon={<RefreshCw className="size-4" />} label="Try again" onSelect={retryBridge} />}
      {onPair && <MenuItem icon={<KeyRound className="size-4" />} label="Pair with a new code…" onSelect={onPair} />}
      <MenuItem icon={<Unplug className="size-4" />} label="Disconnect" onSelect={disconnectBridge} />
    </>
  )
}
