import type { ReactNode } from 'react';

interface SettingsRowProps {
  label: string;
  description?: string;
  children: ReactNode;
}

export default function SettingsRow({ label, description, children }: SettingsRowProps) {
  return (
    <div className="flex flex-col items-stretch gap-2 border-b border-gray-800/50 py-2 last:border-0 sm:flex-row sm:items-center sm:justify-between sm:gap-6">
      <div className="min-w-0">
        <div className="text-sm text-gray-200">{label}</div>
        {description && <div className="mt-0.5 text-xs text-gray-500">{description}</div>}
      </div>
      <div className="w-full sm:min-w-[11rem] sm:max-w-xs sm:shrink-0">{children}</div>
    </div>
  );
}
