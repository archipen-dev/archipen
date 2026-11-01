/*
 * Changes to one item's content: name, label overrides, wire route.
 */
import { endpointFor, withEntity } from '../model/entities'
import { insertWaypoint } from '../model/ops'
import type { EdgeData, LabelStyle } from '../model/schema'
import { mutate, mutateEntity, mutatePage } from './mutate'

type Labelled = { label?: Partial<LabelStyle> }

export const renameEntity = (id: string, name: string) => mutate((d) => withEntity(d, id, (item) => void (item.name = name)))

export const setEntityLabel = (id: string, patch: Partial<LabelStyle>) =>
  mutateEntity<Labelled>(id, (it) => {
    it.label = { ...it.label, ...patch }
  })

/** Follow the label default again: for one key, or all of them. */
export const resetEntityLabel = (id: string, key?: keyof LabelStyle) =>
  mutateEntity<Labelled>(id, (it) => {
    if (!key) it.label = undefined
    else if (it.label) {
      delete it.label[key]
      if (!Object.keys(it.label).length) it.label = undefined
    }
  })

// ---- wires ----------------------------------------------------------------------

export const swapEdgeDirection = (id: string) =>
  mutateEntity<EdgeData>(id, (it) => {
    const f = it.from
    it.from = it.to
    it.to = f
    it.waypoints.reverse()
  })

export const insertBend = (edgeId: string, pt: { x: number; y: number }) => mutatePage((d) => insertWaypoint(d, edgeId, pt))

export const removeBend = (edgeId: string, index: number) =>
  mutatePage((d) => {
    d.edges.find((x) => x.id === edgeId)?.waypoints.splice(index, 1)
  })

/** Attach one end of a wire to another node or zone. Old bends rarely fit the new route, so they go. */
export const reconnectEdge = (edgeId: string, end: 'from' | 'to', targetId: string) =>
  mutatePage((d) => {
    const edge = d.edges.find((x) => x.id === edgeId)
    if (!edge) return
    const other = end === 'from' ? edge.to : edge.from
    if ((other.nodeId ?? other.zoneId) === targetId) return
    edge[end] = endpointFor(d, targetId)
    edge.waypoints = []
  })
