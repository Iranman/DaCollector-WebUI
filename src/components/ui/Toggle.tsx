interface ToggleProps {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  title?: string;
}

export default function Toggle({ checked, onChange, disabled = false, title }: ToggleProps) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`grid h-7 w-7 place-items-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'text-blue-500 hover:text-blue-400' : 'text-gray-500 hover:text-gray-300'
      }`}
    >
      <span className="sr-only">{checked ? 'Enabled' : 'Disabled'}</span>
      {checked ? (
        <span className="grid h-5 w-5 place-items-center rounded-full border-2 border-blue-500 text-[11px] leading-none text-blue-500">✓</span>
      ) : (
        <span className="h-5 w-5 rounded-full border-2 border-current" />
      )}
    </button>
  );
}
