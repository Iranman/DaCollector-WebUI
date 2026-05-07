import type { SelectHTMLAttributes } from 'react';

export default function Select({ className = '', children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`w-full rounded-md border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-gray-100 app-focus ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
