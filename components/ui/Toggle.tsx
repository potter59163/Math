interface ToggleProps {
  label: string;
  /** What the choice means as it stands, under the label. */
  help?: string;
  checked: boolean;
  onChange(next: boolean): void;
}

/** An on/off switch with its label. The whole row is the touch target. */
export function Toggle({ label, help, checked, onChange }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-11 w-full items-center justify-between gap-3 text-left focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <span className="min-w-0">
        <span className="block font-medium">{label}</span>
        {help && <span className="block text-sm text-muted">{help}</span>}
      </span>
      <span
        className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${checked ? 'bg-brand' : 'bg-edge'}`}
      >
        <span
          className={`absolute top-0.5 left-0.5 size-6 rounded-full bg-surface transition-transform ${checked ? 'translate-x-5' : ''}`}
        />
      </span>
    </button>
  );
}
