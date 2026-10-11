'use client'

export function PrintButton({ label = 'Exporter en PDF', className = 'btn btn-primary' }: { label?: string; className?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.print()}>
      {label}
    </button>
  )
}
