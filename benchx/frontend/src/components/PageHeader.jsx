export default function PageHeader({ eyebrow, title, description, action }) {
  return (
    <div className="flex items-start justify-between gap-4 flex-wrap mb-8">
      <div>
        {eyebrow && (
          <p className="font-mono text-xs tracking-[0.14em] text-accent mb-2.5">{eyebrow}</p>
        )}
        <h1 className="font-display font-bold text-4xl leading-tight text-text-primary tracking-tight">{title}</h1>
        {description && <p className="text-base text-text-secondary mt-3 max-w-2xl leading-relaxed">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
