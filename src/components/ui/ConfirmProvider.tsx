import { ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';
import Button from './Button';

type ConfirmTone = 'default' | 'danger' | 'warning';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: ConfirmTone;
}

interface PendingConfirm extends Required<ConfirmOptions> {
  resolve: (confirmed: boolean) => void;
}

const ConfirmContext = createContext<((options: ConfirmOptions) => Promise<boolean>) | null>(null);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const confirm = useCallback((options: ConfirmOptions) =>
    new Promise<boolean>(resolve => {
      setPending({
        cancelLabel: options.cancelLabel ?? 'Cancel',
        confirmLabel: options.confirmLabel ?? 'Confirm',
        message: options.message,
        resolve,
        title: options.title,
        tone: options.tone ?? 'default',
      });
    }), []);

  const value = useMemo(() => confirm, [confirm]);

  function close(confirmed: boolean) {
    if (!pending) return;
    pending.resolve(confirmed);
    setPending(null);
  }

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {pending && (
        <div className="fixed inset-0 z-[80] grid place-items-center bg-black/70 px-4 backdrop-blur-sm">
          <div className="app-surface w-full max-w-md rounded-md p-6 shadow-panel">
            <h2 className="text-lg font-semibold text-white">{pending.title}</h2>
            <p className="mt-3 text-sm leading-6 text-gray-300">{pending.message}</p>
            <div className="mt-6 flex justify-end gap-3">
              <Button type="button" variant="secondary" onClick={() => close(false)}>
                {pending.cancelLabel}
              </Button>
              <Button type="button" variant={pending.tone === 'danger' ? 'destructive' : 'primary'} onClick={() => close(true)}>
                {pending.confirmLabel}
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used inside ConfirmProvider.');
  }
  return context;
}
