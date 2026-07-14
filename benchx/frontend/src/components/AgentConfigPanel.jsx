export default function AgentConfigPanel({
  title,
  subtitle,
  config,
  onChange,
  colorClass,
  badgeText
}) {
  const models = [
    { value: 'gpt-4o-mini', label: 'GPT-4o-Mini (Fast, Cheap)' },
    { value: 'gpt-4o', label: 'GPT-4o (Powerful)' },
    { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
  ]

  const handleChange = (field, value) => {
    onChange({ ...config, [field]: value })
  }

  return (
    <div className="bg-bg-card border border-border rounded-2xl p-6 flex flex-col h-full animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
            {title}
            {badgeText && (
              <span className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${colorClass}`}>
                {badgeText}
              </span>
            )}
          </h2>
          {subtitle && (
            <p className="text-sm text-text-secondary mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-5 flex-1">
        {/* Model Selection */}
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            Model
          </label>
          <select
            value={config.model}
            onChange={(e) => handleChange('model', e.target.value)}
            className="w-full bg-bg-input border border-border rounded-xl px-4 py-2.5 text-sm text-text-primary focus:outline-none focus:border-accent transition-colors appearance-none cursor-pointer"
          >
            {models.map(m => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
        </div>

        {/* Temperature Slider */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-text-secondary">
              Temperature
            </label>
            <span className="text-xs font-mono text-accent bg-accent-muted px-2 py-0.5 rounded">
              {config.temperature.toFixed(2)}
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="2"
            step="0.05"
            value={config.temperature}
            onChange={(e) => handleChange('temperature', parseFloat(e.target.value))}
            className="w-full accent-accent cursor-pointer"
          />
          <div className="flex justify-between mt-1 text-[10px] text-text-muted">
            <span>Deterministic (0.0)</span>
            <span>Creative (2.0)</span>
          </div>
        </div>

        {/* System Prompt */}
        <div className="flex-1 flex flex-col">
          <label className="block text-sm font-medium text-text-secondary mb-1.5">
            System Prompt
          </label>
          <textarea
            value={config.system_prompt}
            onChange={(e) => handleChange('system_prompt', e.target.value)}
            placeholder="You are a helpful assistant..."
            className="w-full flex-1 min-h-[120px] bg-bg-input border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all resize-none font-mono"
          />
        </div>
      </div>
    </div>
  )
}
