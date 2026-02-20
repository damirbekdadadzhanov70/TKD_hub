import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ToastType = 'success' | 'error';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  visible: boolean;
  persistent: boolean;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType, persistent?: boolean) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, visible: false } : t)),
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 200);
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'success', persistent = false) => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type, visible: false, persistent }]);

    // Trigger enter animation on next frame
    requestAnimationFrame(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, visible: true } : t)),
      );
    });

    // Auto-hide after 3s (only for non-persistent toasts)
    if (!persistent) {
      setTimeout(() => {
        dismissToast(id);
      }, 3000);
    }
  }, [dismissToast]);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.length > 0 &&
        createPortal(
          <div className="fixed top-0 left-0 right-0 z-[100] flex flex-col items-center pt-[env(safe-area-inset-top,12px)] px-4 pointer-events-none">
            {toasts.map((toast) => (
              <div
                key={toast.id}
                className={`w-full max-w-sm bg-bg-secondary border-l-4 shadow-sm rounded-lg px-4 py-3 mb-2 pointer-events-auto transition-transform duration-200 ease-out ${toast.type === 'error' ? 'border-rose-500' : 'border-accent'}`}
                style={{
                  transform: toast.visible ? 'translateY(0)' : 'translateY(-100%)',
                  opacity: toast.visible ? 1 : 0,
                }}
              >
                <p className={`text-sm whitespace-pre-line ${toast.type === 'error' ? 'text-rose-500' : 'text-text'}`}>{toast.message}</p>
                {toast.persistent && (
                  <button
                    onClick={() => dismissToast(toast.id)}
                    className="mt-2 text-xs font-medium text-accent cursor-pointer hover:opacity-80 active:opacity-60"
                  >
                    OK
                  </button>
                )}
              </div>
            ))}
          </div>,
          document.getElementById('root')!,
        )}
    </ToastContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
