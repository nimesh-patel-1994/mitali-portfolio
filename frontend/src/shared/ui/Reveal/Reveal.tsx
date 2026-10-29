/**
 * Reveal (UI-003): fades/translates content up 16 px once when it enters the viewport.
 * Content is visible by default (pre-rendered HTML, no JS, reduced motion, no IntersectionObserver).
 * After hydration, and only when motion is allowed, elements that start below the fold are hidden and revealed
 * on entry; elements already in view at hydration are left untouched (no flash). One shared observer.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx } from "@/shared/utils/cx";
import styles from "./Reveal.module.css";

export type RevealState = "static" | "hidden" | "shown";

type Listener = (entry: IntersectionObserverEntry) => void;

let sharedObserver: IntersectionObserver | null = null;
const listeners = new Map<Element, Listener>();

function getObserver(): IntersectionObserver {
  if (!sharedObserver) {
    sharedObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) listeners.get(entry.target)?.(entry);
      },
      { rootMargin: "0px 0px -10% 0px" },
    );
  }
  return sharedObserver;
}

function observe(element: Element, listener: Listener): () => void {
  const observer = getObserver();
  listeners.set(element, listener);
  observer.observe(element);
  return () => {
    observer.unobserve(element);
    listeners.delete(element);
  };
}

/** Test helper: forget the shared observer (a new one is created on next use). */
export function resetRevealObserverForTests(): void {
  sharedObserver?.disconnect();
  sharedObserver = null;
  listeners.clear();
}

export function motionAllowed(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(prefers-reduced-motion: no-preference)").matches;
}

export interface RevealProps {
  children: ReactNode;
  as?: "div" | "section" | "li";
  className?: string;
}

export function Reveal({ children, as: Tag = "div", className }: RevealProps) {
  const ref = useRef<HTMLDivElement & HTMLLIElement>(null);
  const [state, setState] = useState<RevealState>("static");

  useEffect(() => {
    const element = ref.current;
    if (!element || typeof IntersectionObserver === "undefined" || !motionAllowed()) return undefined;
    let first = true;
    let stop: (() => void) | null = null;
    stop = observe(element, (entry) => {
      if (first) {
        first = false;
        if (entry.isIntersecting) {
          stop?.();
          return;
        }
        setState("hidden");
        return;
      }
      if (entry.isIntersecting) {
        setState("shown");
        stop?.();
      }
    });
    return () => stop?.();
  }, []);

  return (
    <Tag ref={ref} className={cx(styles.reveal, className)} data-reveal={state}>
      {children}
    </Tag>
  );
}
