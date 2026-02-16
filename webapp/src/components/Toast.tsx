import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

type ToastType = 'success' | 'error';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
  visible: boolean;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

let nextId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'success') => {
    const id = nextId++;
    setToasts((prev) => [...prev, { id, message, type, visible: false }]);

    // Trigger enter animation on next frame
    requestAnimationFrame(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, visible: true } : t)),
      );
    });

    // Auto-hide after 3s
    setTimeout(() => {
      setToasts((prev) =>
        prev.map((t) => (t.id === id ? { ...t, visible: false } : t)),
      );
      // Remove from DOM after exit animation
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 200);
    }, 3000);
  }, []);

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
                <p className={`text-sm ${toast.type === 'error' ? 'text-rose-500' : 'text-text'}`}>{toast.message}</p>
              </div>
            ))}
          </div>,
          document.getElementById('root')!,
        )}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
