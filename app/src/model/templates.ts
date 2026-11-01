/*
 * Starter diagrams for the home page. The files live in examples/ so they double as
 * format examples and are checked by `npm run validate`.
 */
import ciCd from '../../../examples/ci-cd.archipen.json'
import dataPipeline from '../../../examples/data-pipeline.archipen.json'
import eventDriven from '../../../examples/event-driven.archipen.json'
import kubernetes from '../../../examples/kubernetes-cluster.archipen.json'
import webShop from '../../../examples/web-shop.archipen.json'
import { newId } from './ids'
import { parseDoc } from './parse'
import type { Doc } from './schema'

export interface Template {
  id: string
  name: string
  description: string
  raw: unknown
}

export const TEMPLATES: Template[] = [
  { id: 'web-app', name: 'Web app', description: 'Load balancer, API, worker, database and queue in a cloud network.', raw: webShop },
  { id: 'kubernetes', name: 'Kubernetes cluster', description: 'Ingress, namespaces, stateful data and monitoring.', raw: kubernetes },
  { id: 'event-driven', name: 'Event-driven services', description: 'Producers and consumers decoupled by an event bus.', raw: eventDriven },
  { id: 'data-pipeline', name: 'Data pipeline', description: 'Sources, ingestion, lake, transform, warehouse and BI.', raw: dataPipeline },
  { id: 'ci-cd', name: 'CI/CD pipeline', description: 'From git push through CI and GitOps to staging and production.', raw: ciCd },
]

/** A fresh, editable copy of a template with its own diagram id. */
export function templateDoc(t: Template): Doc {
  const doc = parseDoc(structuredClone(t.raw))
  doc.id = newId('d')
  return doc
}
