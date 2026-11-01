/** Hint shown on an empty diagram in edit mode. */
export function EmptyState() {
  return (
    <div className="pointer-events-none absolute inset-0 grid place-items-center">
      <div className="ap-empty text-center">
        <div className="font-display text-2xl tracking-tight text-ink">An empty site.</div>
        <div className="mt-2 text-sm text-ink-muted">
          Press <kbd>R</kbd> to place a node, <kbd>F</kbd> to draw a zone, <kbd>C</kbd> to connect.
        </div>
      </div>
    </div>
  )
}
