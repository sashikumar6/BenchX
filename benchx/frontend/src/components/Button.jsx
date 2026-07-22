const VARIANT_CLASSES = {
  primary:
    'bg-accent text-bg-primary hover:shadow-[0_0_24px_rgba(212,255,79,0.5)] hover:-translate-y-0.5',
  secondary:
    'border border-border bg-bg-card hover:bg-bg-card-hover hover:border-border-hover text-text-primary',
  danger: 'bg-danger text-white hover:shadow-[0_0_24px_rgba(248,113,113,0.4)] hover:-translate-y-0.5',
}

const SIZE_CLASSES = {
  sm: 'px-4 py-2 text-[11px]',
  md: 'px-6 py-3 text-xs',
}

const DISABLED_CLASSES = 'bg-bg-input text-text-muted border border-border cursor-not-allowed'

export default function Button({ variant = 'primary', size = 'md', disabled = false, className = '', children, ...rest }) {
  const styles = disabled ? DISABLED_CLASSES : VARIANT_CLASSES[variant]
  return (
    <button
      disabled={disabled}
      className={`font-mono font-semibold uppercase tracking-[0.08em] transition-all duration-150 cursor-pointer disabled:cursor-not-allowed whitespace-nowrap ${SIZE_CLASSES[size]} ${styles} ${className}`}
      {...rest}
    >
      {children}
    </button>
  )
}

export function textActionClasses(danger = false, extra = '') {
  return `font-mono text-[11px] tracking-wide cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${
    danger ? 'text-danger hover:text-danger/80' : 'text-accent hover:text-accent-hover'
  } ${extra}`
}

export function TextButton({ danger = false, className = '', children, ...rest }) {
  return (
    <button className={textActionClasses(danger, className)} {...rest}>
      {children}
    </button>
  )
}
