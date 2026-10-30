/**
 * Modal dialog (UI-040, UI-042, ui-scope 3.3 rule 5): rendered in a portal on <body> while mounted, labelled by its
 * heading, focus moved inside on open (initial element or first focusable), Tab / Shift+Tab trapped, Escape closes,
 * and focus returns to the element that opened it. Nested dialogs handle their own keys first.
 * `ConfirmDialog` is the `alertdialog` used for every destructive action (UI-REV-018).
 */
import { useEffect, useId, useRef, type KeyboardEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/shared/ui/Button/Button";
import { cx } from "@/shared/utils/cx";
import styles from "./Dialog.module.css";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function focusableIn(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => !el.closest("[hidden]"));
}

export interface DialogProps {
  title: string;
  onClose: () => void;
  role?: "dialog" | "alertdialog";
  initialFocus?: RefObject<HTMLElement | null>;
  describedBy?: string;
  size?: "small" | "large";
  children: ReactNode;
  footer?: ReactNode;
}

export function Dialog({ title, onClose, role = "dialog", initialFocus, describedBy, size = "small", children, footer }: DialogProps) {
  const titleId = useId();
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const target = initialFocus?.current ?? (ref.current ? focusableIn(ref.current)[0] : undefined) ?? ref.current;
    target?.focus();
    return () => {
      if (trigger && trigger.isConnected) trigger.focus();
    };
    // Mount/unmount only: the dialog is mounted while open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      onCloseRef.current();
      return;
    }
    if (event.key !== "Tab" || !ref.current) return;
    const items = focusableIn(ref.current);
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) {
      event.preventDefault();
      return;
    }
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !ref.current.contains(active))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && (active === last || !ref.current.contains(active))) {
      event.preventDefault();
      first.focus();
    }
    event.stopPropagation();
  };

  return createPortal(
    <div className={styles.backdrop}>
      <div
        ref={ref}
        role={role}
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={describedBy}
        tabIndex={-1}
        className={cx(styles.dialog, size === "large" && styles.large)}
        data-surface="white"
        onKeyDown={onKeyDown}
      >
        <h2 id={titleId} className={styles.title}>
          {title}
        </h2>
        <div className={styles.body}>{children}</div>
        {footer && <div className={styles.footer}>{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export interface ConfirmDialogProps {
  title: string;
  message: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = true,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      title={title}
      role="alertdialog"
      onClose={busy ? () => undefined : onCancel}
      initialFocus={cancelRef}
      describedBy={messageId}
      footer={
        <>
          <button ref={cancelRef} type="button" className={styles.cancel} onClick={onCancel} disabled={busy}>
            {cancelLabel}
          </button>
          {destructive ? (
            <button type="button" className={styles.destructive} onClick={onConfirm} disabled={busy} aria-busy={busy || undefined}>
              {confirmLabel}
            </button>
          ) : (
            <Button onClick={onConfirm} loading={busy}>
              {confirmLabel}
            </Button>
          )}
        </>
      }
    >
      <div id={messageId}>{message}</div>
    </Dialog>
  );
}
