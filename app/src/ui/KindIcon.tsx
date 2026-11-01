import { Box, MessageSquare, Square, Waypoints, type LucideIcon } from 'lucide-react'
import type { EntityKind } from '../model/schema'

const ICONS: Record<EntityKind, LucideIcon> = { node: Box, zone: Square, edge: Waypoints, text: MessageSquare }

export function KindIcon({ kind }: { kind: EntityKind }) {
  const Icon = ICONS[kind]
  return <Icon className="size-3.5" />
}
