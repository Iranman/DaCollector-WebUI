import { ReactNode, createContext, useCallback, useContext, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react';

type ToastTone = 'success' | 'error' | 'warning' | 'info';

interface ToastOptions {
  title?: string;
  message: string;
  tone?: ToastTone;
  timeoutMs?: number;
}

interface ToastItem extends Required<Omit<ToastOptions, 'title'>> {
  id: number;
  title?: string;
}

interface ToastContextValue {
  notify: (options: ToastOptions) => number;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextToastId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setToasts(current => current.filter(toast => toast.id !== id));
  }, []);

  const notify = useCallback((options: ToastOptions) => {
    const id = nextToastId;
    nextToastId += 1;
    const toast: ToastItem = {
      id,
      message: options.message,
      timeoutMs: options.timeoutMs ?? 5000,
      title: options.title,
      tone: options.tone ?? 'info',
    };
    setToasts(current => [...current, toast]);
    if (toast.timeoutMs > 0) {
      window.setTimeout(() => dismiss(id), toast.timeoutMs);
    }
    return id;
  }, [dismiss]);

  const value = useMemo(() => ({ dismiss, notify }), [dismiss, notify]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="pointer-events-none fixed right-4 top-16 z-[70] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2">
        {toasts.map(toast => (
          <ToastCard key={toast.id} toast={toast} onDismiss={dismiss} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used inside ToastProvider.');
  }
  return context;
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const Icon = {
    success: CheckCircle2,
    error: XCircle,
    warning: AlertTriangle,
    info: Info,
  }[toast.tone];

  const toneClasses = {
    success: 'border-emerald-500/50 text-emerald-300',
    error: 'border-red-500/60 text-red-300',
    warning: 'border-yellow-500/60 text-yellow-300',
    info: 'border-shoko-accent/60 text-shoko-accent',
  }[toast.tone];

  return (
    <div className={`pointer-events-auto app-card flex items-start gap-3 rounded-md px-4 py-3 shadow-panel ${toneClasses}`}>
      <Icon size={18} className="mt-0.5 shrink-0" />
      <div className="min-w-0 flex-1">
        {toast.title && <p className="text-sm font-semibold text-white">{toast.title}</p>}
        <p className="text-sm text-gray-300">{toast.message}</p>
      </div>
      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 rounded p-1 text-gray-500 transition-colors hover:text-gray-200"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>
    </div>
  );
}
