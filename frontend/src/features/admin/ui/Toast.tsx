/**
 * Toasts (UI-037, UI-040): one polite `role="status"` region for success messages and one `role="alert"` region
 * for errors. Both regions are always in the DOM so screen readers announce inserted messages. Messages dismiss
 * themselves after a few seconds; errors also have a Dismiss button.
 */
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import styles from "./Toast.module.css";

type Tone = "success" | "error";

interface ToastItem {
  id: number;
  tone: Tone;
  message: string;
}

export interface ToastApi {
  success: (message: string) => void;
  error: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export const TOAST_TIMEOUT_MS = 6000;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);

  const push = useCallback(
    (tone: Tone, message: string) => {
      const id = nextId.current;
      nextId.current += 1;
      setItems((current) => [...current.filter((item) => item.message !== message), { id, tone, message }]);
      setTimeout(() => dismiss(id), TOAST_TIMEOUT_MS);
    },
    [dismiss],
  );

  const api = useMemo<ToastApi>(
    () => ({ success: (m) => push("success", m), error: (m) => push("error", m) }),
    [push],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div className={styles.region}>
        <div role="status" aria-live="polite" className={styles.stack}>
          {items
            .filter((item) => item.tone === "success")
            .map((item) => (
              <p key={item.id} className={styles.toast} data-tone="success">
                {item.message}
              </p>
            ))}
        </div>
        <div role="alert" className={styles.stack}>
          {items
            .filter((item) => item.tone === "error")
            .map((item) => (
              <div key={item.id} className={styles.toast} data-tone="error">
                <p>{item.message}</p>
                <button type="button" className={styles.dismiss} onClick={() => dismiss(item.id)}>
                  Dismiss
                </button>
              </div>
            ))}
        </div>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const api = useContext(ToastContext);
  if (!api) throw new Error("useToast must be used inside ToastProvider");
  return api;
}
