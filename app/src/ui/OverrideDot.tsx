/** Accent dot marking a value that overrides the diagram default; clicking it resets the value. */
export function OverrideDot({ onReset, title = 'Overrides the global default — click to reset' }: { onReset?: () => void; title?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => {
        e.preventDefault()
        onReset?.()
      }}
      className="size-1.5 rounded-full bg-accent hover:ring-2 hover:ring-accent/30"
    />
  )
}
