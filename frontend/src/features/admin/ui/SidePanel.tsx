/**
 * `SidePanel` (UI-040): list + panel editing for small types. Docked beside the list on desktop, a full-screen sheet
 * below 810 px (CSS). Labelled by its heading, which receives focus when the panel opens.
 * Screens open/close panels through `useGuardedPanel`, which asks before a dirty panel form is closed or replaced
 * and keeps one navigation guard for the screen (UI-040).
 */
import { useCallback, useEffect, useId, useRef, useState, type ReactNode } from "react";
import { useDiscardConfirm, useUnsavedChangesGuard } from "./UnsavedChangesGuard";
import kit from "./Kit.module.css";

export function SidePanel({ title, onClose, children }: { title: string; onClose: () => void; children: (headingId: string) => ReactNode }) {
  const headingId = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    headingRef.current?.focus();
  }, []);
  return (
    <section className={kit.sidePanel} aria-labelledby={headingId}>
      <div className={kit.sidePanelHeader}>
        <h2 id={headingId} ref={headingRef} tabIndex={-1} className={kit.sectionTitle}>
          {title}
        </h2>
        <button type="button" className={kit.smallButton} onClick={onClose}>
          Close
        </button>
      </div>
      {children(headingId)}
    </section>
  );
}

/** Remembers the element that opened a panel and returns focus to it on close. */
export function usePanelFocusReturn() {
  const trigger = useRef<HTMLElement | null>(null);
  return {
    /** Stores `el` (default: the focused element) as the element to return focus to. */
    remember: (el: Element | null = document.activeElement) => {
      trigger.current = el instanceof HTMLElement ? el : null;
    },
    restore: () => {
      const el = trigger.current;
      trigger.current = null;
      if (el?.isConnected) setTimeout(() => el.focus(), 0);
    },
  };
}

/**
 * Panel state for list + side-panel screens: `open(target)` / `close()` ask "Discard unsaved changes?" while the open
 * panel's form is dirty (reported through `onDirtyChange`); every open remounts the form (key `panelKey`), `closeSaved()` closes without asking after a save, and
 * navigating away while dirty triggers the leave-page guard. Focus returns to the opening control on close.
 */
export function useGuardedPanel<P>() {
  const [panel, setPanel] = useState<P | null>(null);
  const [dirty, setDirty] = useState(false);
  // Bumped on every open: part of the panel's key, so re-opening the same target ("New …" again, Edit on the same
  // item) after "Discard changes" remounts the form with its defaults instead of keeping the discarded values.
  const [generation, setGeneration] = useState(0);
  const focusReturn = usePanelFocusReturn();
  const discard = useDiscardConfirm();
  const guard = useUnsavedChangesGuard(panel !== null && dirty);
  const isDirty = panel !== null && dirty;

  const open = (next: P) => {
    const trigger = document.activeElement;
    discard.confirm(isDirty, () => {
      focusReturn.remember(trigger);
      setDirty(false);
      setGeneration((g) => g + 1);
      setPanel(next);
    });
  };
  const closeSaved = () => {
    setDirty(false);
    setPanel(null);
    focusReturn.restore();
  };
  const close = () => discard.confirm(isDirty, closeSaved);
  const onDirtyChange = useCallback((value: boolean) => setDirty(value), []);

  const element = (
    <>
      {guard.element}
      {discard.element}
    </>
  );
  /** Key for the panel form: `${panelKey}:${identity}`. */
  const panelKey = String(generation);
  return { panel, setPanel, open, close, closeSaved, onDirtyChange, element, panelKey };
}
