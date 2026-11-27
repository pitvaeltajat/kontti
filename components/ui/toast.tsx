'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react';
import { cn } from '@/lib/cn';

export type ToastVariant = 'success' | 'error' | 'info';

export type ToastOptions = {
  description?: string;
  /** ms; 0 = stay until dismissed. Defaults: success/info 5000, error 0. */
  duration?: number;
  /** Same id replaces an existing toast instead of stacking a duplicate. */
  id?: string;
};

export type ToastApi = {
  show: (variant: ToastVariant, title: string, options?: ToastOptions) => string;
  success: (title: string, options?: ToastOptions) => string;
  error: (title: string, options?: ToastOptions) => string;
  info: (title: string, options?: ToastOptions) => string;
  dismiss: (id: string) => void;
};

type ToastRecord = {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration: number;
};

const MAX_TOASTS = 3;

const DEFAULT_DURATION: Record<ToastVariant, number> = {
  success: 5000,
  info: 5000,
  error: 0,
};

const ACCENT: Record<ToastVariant, { border: string; icon: string }> = {
  success: { border: 'border-l-success', icon: 'text-success' },
  error: { border: 'border-l-destructive', icon: 'text-destructive' },
  info: { border: 'border-l-primary', icon: 'text-primary' },
};

const ToastContext = createContext<ToastApi | null>(null);

const subscribe = () => () => {};
const getClientSnapshot = () => true;
const getServerSnapshot = () => false;

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error('useToast must be used within a ToastProvider');
  return api;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastRecord[]>([]);
  // Portals need the DOM, so render the viewport only after hydration.
  const mounted = useSyncExternalStore(subscribe, getClientSnapshot, getServerSnapshot);
  const counter = useRef(0);

  const dismiss = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback((variant: ToastVariant, title: string, options?: ToastOptions) => {
    const id = options?.id ?? `toast-${++counter.current}`;
    const duration = options?.duration ?? DEFAULT_DURATION[variant];
    setToasts((current) => {
      const next = current.filter((toast) => toast.id !== id);
      next.push({ id, variant, title, description: options?.description, duration });
      return next.slice(-MAX_TOASTS);
    });
    return id;
  }, []);

  const api = useMemo<ToastApi>(
    () => ({
      show,
      success: (title, options) => show('success', title, options),
      error: (title, options) => show('error', title, options),
      info: (title, options) => show('info', title, options),
      dismiss,
    }),
    [show, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      {mounted
        ? createPortal(<ToastViewport toasts={toasts} onDismiss={dismiss} />, document.body)
        : null}
    </ToastContext.Provider>
  );
}

/**
 * The viewport keeps two live regions mounted for the whole session. A live
 * region that is created together with its content is not announced reliably,
 * so the regions exist first and toasts are injected into them.
 */
function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ToastRecord[];
  onDismiss: (id: string) => void;
}) {
  const polite = toasts.filter((toast) => toast.variant !== 'error');
  const assertive = toasts.filter((toast) => toast.variant === 'error');

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,22rem)] flex-col gap-2 max-sm:inset-x-3 max-sm:bottom-3 max-sm:w-auto">
      <div role="status" aria-live="polite" className="flex flex-col gap-2">
        {polite.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
      <div role="alert" aria-live="assertive" className="flex flex-col gap-2">
        {assertive.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={onDismiss} />
        ))}
      </div>
    </div>
  );
}

function ToastItem({ toast, onDismiss }: { toast: ToastRecord; onDismiss: (id: string) => void }) {
  const [paused, setPaused] = useState(false);
  const remaining = useRef(toast.duration);

  useEffect(() => {
    if (toast.duration <= 0 || paused) return;
    const startedAt = Date.now();
    const timer = setTimeout(() => onDismiss(toast.id), remaining.current);
    return () => {
      clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - startedAt));
    };
  }, [paused, toast.duration, toast.id, onDismiss]);

  const accent = ACCENT[toast.variant];
  const Icon =
    toast.variant === 'success' ? CheckCircle2 : toast.variant === 'error' ? AlertCircle : Info;

  return (
    <div
      className={cn(
        'pointer-events-auto flex items-start gap-2.5 rounded-lg border border-l-[3px] bg-card p-3 text-foreground shadow-lg animate-in fade-in-0 slide-in-from-bottom motion-reduce:animate-none',
        accent.border,
      )}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <Icon aria-hidden="true" className={cn('mt-0.5 size-4 shrink-0', accent.icon)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold leading-snug">{toast.title}</p>
        {toast.description ? (
          <p className="mt-0.5 text-xs text-muted-foreground break-words">{toast.description}</p>
        ) : null}
      </div>
      <button
        type="button"
        aria-label="Sulje ilmoitus"
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 rounded-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X aria-hidden="true" className="size-4" />
      </button>
    </div>
  );
}
