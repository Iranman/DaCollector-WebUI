import type { InputHTMLAttributes } from 'react';

export default function TextInput({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full rounded-md border border-gray-700 bg-gray-900/70 px-3 py-2 text-sm text-gray-100 placeholder:text-gray-500 app-focus ${className}`}
      {...props}
    />
  );
}
