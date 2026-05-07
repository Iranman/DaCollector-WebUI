import type { ReactNode } from 'react';

interface SettingsRowProps {
  label: string;
  description?: string;
  children: ReactNode;
}

export default function SettingsRow({ label, description, children }: SettingsRowProps) {
  return (
    <div className="flex items-center justify-between gap-6 border-b border-gray-800/50 py-2 last:border-0">
      <div className="min-w-0">
        <div className="text-sm text-gray-200">{label}</div>
        {description && <div className="mt-0.5 text-xs text-gray-500">{description}</div>}
      </div>
      <div className="min-w-[11rem] max-w-xs shrink-0">{children}</div>
    </div>
  );
}
