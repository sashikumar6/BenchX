const DOT_COLOR = {
  configured: 'bg-text-muted',
  running: 'bg-accent',
  completed: 'bg-success',
  failed: 'bg-danger',
}

const PULSE = new Set(['running'])

export default function StatusPill({ status, detail }) {
  return (
    <span className="inline-flex items-center gap-2 font-mono text-xs text-text-secondary">
      <span className={`w-[7px] h-[7px] rounded-full ${DOT_COLOR[status] || DOT_COLOR.configured} ${PULSE.has(status) ? 'animate-pulse-dot' : ''}`} />
      {status}
      {detail ? ` · ${detail}` : ''}
    </span>
  )
}
