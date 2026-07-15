"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type PropsWithChildren,
  type ReactNode,
} from "react";

type Toast = { id: number; message: string };
type Notify = (message: string) => void;

const ToastContext = createContext<Notify | null>(null);
let nextToastId = 0;

export function ToastProvider({ children }: PropsWithChildren) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timeouts = useRef(new Set<ReturnType<typeof setTimeout>>());

  useEffect(() => () => {
    timeouts.current.forEach(clearTimeout);
    timeouts.current.clear();
  }, []);

  const notify = useCallback((message: string) => {
    const id = ++nextToastId;
    setToasts((items) => [...items, { id, message }]);
    const timeout = setTimeout(() => {
      timeouts.current.delete(timeout);
      setToasts((items) => items.filter((toast) => toast.id !== id));
    }, 4_000);
    timeouts.current.add(timeout);
  }, []);

  return (
    <ToastContext.Provider value={notify}>
      {children}
      <div className="toast-region" aria-live="polite">
        {toasts.map((toast) => <p className="toast" key={toast.id}>{toast.message}</p>)}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): Notify {
  const notify = useContext(ToastContext);
  if (!notify) throw new Error("useToast must be used within a ToastProvider");
  return notify;
}

export function Modal({ open, title, children, onClose }: { open: boolean; title: string; children?: ReactNode; onClose(): void }) {
  if (!open) return null;
  return <div className="modal-backdrop" role="presentation"><section className="modal" role="dialog" aria-modal="true" aria-label={title}><button className="close" onClick={onClose} aria-label="Đóng">×</button><h2>{title}</h2>{children}</section></div>;
}
