/**
 * Unsaved-changes guard (UI-040): while a form is dirty, in-app navigation to another page asks for confirmation
 * (`useBlocker`) and closing/reloading the tab triggers the browser prompt (`beforeunload`).
 * `bypass()` lets a successful save navigate away without a prompt (the dirty flag updates on the next render).
 *
 * A router supports only one active blocker, so a page with several forms (case-study tabs, list + side panel,
 * inline result/gallery rows) installs one guard with `useUnsavedChangesScope` and its forms report their
 * `formState.isDirty` through `useReportDirty`. `useDiscardConfirm` asks before an in-page action (close a panel,
 * switch item, cancel a row) would throw away a dirty form.
 *
 * Every guard also registers with the admin layout's `GuardRegistry` (when present), so actions outside the page
 * (Log out) can ask before discarding and then bypass all guards: a confirmed logout must never be blocked.
 */
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { useBlocker, type BlockerFunction } from "react-router";
import { ConfirmDialog } from "./Dialog";

interface GuardEntry {
  dirty: boolean;
  bypass: () => void;
}

export interface GuardRegistry {
  register: (key: string, entry: GuardEntry) => () => void;
}

const GuardRegistryContext = createContext<GuardRegistry | null>(null);

/** Layout-level registry of the page's guards: `anyDirty()` and `bypassAll()` read and act on them without renders. */
export function useGuardRegistry() {
  const entries = useRef(new Map<string, GuardEntry>());
  const registry = useMemo<GuardRegistry>(
    () => ({
      register: (key, entry) => {
        entries.current.set(key, entry);
        return () => {
          if (entries.current.get(key) === entry) entries.current.delete(key);
        };
      },
    }),
    [],
  );
  const anyDirty = useCallback(() => Array.from(entries.current.values()).some((e) => e.dirty), []);
  const bypassAll = useCallback(() => {
    for (const entry of entries.current.values()) entry.bypass();
  }, []);
  return { registry, anyDirty, bypassAll };
}

export function GuardRegistryProvider({ value, children }: { value: GuardRegistry; children: ReactNode }) {
  return <GuardRegistryContext.Provider value={value}>{children}</GuardRegistryContext.Provider>;
}

export function useUnsavedChangesGuard(when: boolean) {
  const registry = useContext(GuardRegistryContext);
  const registryKey = useId();
  const whenRef = useRef(when);
  const bypassRef = useRef(false);

  useEffect(() => {
    whenRef.current = when;
    if (!when) bypassRef.current = false;
  }, [when]);

  const shouldBlock = useCallback<BlockerFunction>(
    ({ currentLocation, nextLocation }) =>
      whenRef.current && !bypassRef.current && currentLocation.pathname !== nextLocation.pathname,
    [],
  );
  const blocker = useBlocker(shouldBlock);

  useEffect(() => {
    if (!when) return undefined;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [when]);

  const bypass = useCallback(() => {
    bypassRef.current = true;
  }, []);

  useEffect(() => registry?.register(registryKey, { dirty: when, bypass }), [registry, registryKey, when, bypass]);

  const element =
    blocker.state === "blocked" ? (
      <ConfirmDialog
        title="Leave without saving?"
        message="You have unsaved changes on this page. If you leave now they will be lost."
        confirmLabel="Leave page"
        cancelLabel="Stay on page"
        onConfirm={() => blocker.proceed()}
        onCancel={() => blocker.reset()}
      />
    ) : null;

  return { element, bypass };
}

interface UnsavedChangesContextValue {
  report: (key: string, dirty: boolean) => void;
  bypass: () => void;
}

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(null);

/** One navigation guard for every form below it; wrap them in `<UnsavedChangesProvider value={scope.context}>`. */
export function useUnsavedChangesScope() {
  const [sources, setSources] = useState<ReadonlySet<string>>(() => new Set());
  const anyDirty = sources.size > 0;
  const guard = useUnsavedChangesGuard(anyDirty);
  const report = useCallback((key: string, dirty: boolean) => {
    setSources((prev) => {
      if (prev.has(key) === dirty) return prev;
      const next = new Set(prev);
      if (dirty) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);
  const context = useMemo(() => ({ report, bypass: guard.bypass }), [report, guard.bypass]);
  return { context, anyDirty, element: guard.element, bypass: guard.bypass };
}

export function UnsavedChangesProvider({ value, children }: { value: UnsavedChangesContextValue; children: ReactNode }) {
  return <UnsavedChangesContext.Provider value={value}>{children}</UnsavedChangesContext.Provider>;
}

/**
 * Reports a form's dirty flag to the enclosing scope (no-op without one) and optionally to its parent.
 * On unmount the form counts as clean again.
 */
export function useReportDirty(dirty: boolean, onDirtyChange?: (dirty: boolean) => void): void {
  const scope = useContext(UnsavedChangesContext);
  const key = useId();
  const callbackRef = useRef(onDirtyChange);
  useEffect(() => {
    callbackRef.current = onDirtyChange;
  }, [onDirtyChange]);

  useEffect(() => {
    scope?.report(key, dirty);
    callbackRef.current?.(dirty);
  }, [scope, key, dirty]);

  useEffect(
    () => () => {
      scope?.report(key, false);
      callbackRef.current?.(false);
    },
    [scope, key],
  );
}

/** Lets a form inside a scope skip the navigation prompt after a successful save. */
export function useUnsavedChangesBypass(): () => void {
  const scope = useContext(UnsavedChangesContext);
  return scope?.bypass ?? noop;
}

function noop() {}

/**
 * Confirmation before an in-page action discards a dirty form (UI-040): `confirm(dirty, run)` runs `run` at once when
 * the form is clean, otherwise after the user chooses "Discard changes". Render `element`.
 */
export function useDiscardConfirm() {
  const [pending, setPending] = useState<{ run: () => void } | null>(null);
  const confirm = useCallback((dirty: boolean, run: () => void) => {
    if (dirty) setPending({ run });
    else run();
  }, []);
  const element = pending ? (
    <ConfirmDialog
      title="Discard unsaved changes?"
      message="This form has changes that have not been saved. If you continue they will be lost."
      confirmLabel="Discard changes"
      cancelLabel="Keep editing"
      onConfirm={() => {
        setPending(null);
        pending.run();
      }}
      onCancel={() => setPending(null)}
    />
  ) : null;
  return { confirm, element };
}
