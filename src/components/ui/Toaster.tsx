import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, Info, ShieldAlert, X } from "lucide-react";
import type { Severity } from "../../lib/types";

type Tone = "success" | "info" | "danger";

interface ToastInput {
  title: string;
  message?: string;
  tone?: Tone;
  severity?: Severity;
}

interface Toast extends ToastInput {
  id: number;
}

const ToastContext = createContext<(input: ToastInput) => void>(() => undefined);

export function useToast() {
  return useContext(ToastContext);
}

const icons = {
  success: CheckCircle2,
  info: Info,
  danger: ShieldAlert,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const counter = useRef(0);

  const push = useCallback((input: ToastInput) => {
    const id = ++counter.current;
    setToasts((current) => [...current.slice(-3), { ...input, id }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4200);
  }, []);

  const dismiss = (id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const value = useMemo(() => push, [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toaster" aria-live="polite">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => {
            const tone = toast.tone ?? "info";
            const Icon = icons[tone];
            return (
              <motion.div
                key={toast.id}
                layout
                initial={{ opacity: 0, y: 22, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, x: 30, scale: 0.96 }}
                transition={{ type: "spring", stiffness: 380, damping: 30 }}
                className={`toast toast-${tone}`}
              >
                <span className="toast-icon">
                  <Icon size={18} />
                </span>
                <div className="toast-copy">
                  <strong>{toast.title}</strong>
                  {toast.message && <span>{toast.message}</span>}
                </div>
                <button
                  type="button"
                  className="toast-close"
                  onClick={() => dismiss(toast.id)}
                  aria-label="Dismiss notification"
                >
                  <X size={14} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}
