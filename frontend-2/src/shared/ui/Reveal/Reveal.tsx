/**
 * Reveal (UI-102, TS-022 step 1): marks a block for the fade-up reveal. Renders the same stable `data-reveal`
 * attribute on server and client (no hydration difference) and registers its element with the shared motion
 * engine through a ref callback, so blocks rendered after client navigation are observed too. Nothing is hidden
 * unless the client entry has turned motion on (html[data-motion="on"], see motion.css): content is visible
 * without JS, before hydration, in print and under reduced motion.
 * `variant="slide"` is the single slide-in-from-left variant (at most once per page).
 */
import { useCallback, type ReactNode } from "react";
import { registerReveal, unregisterReveal } from "@/shared/motion/reveal";

export interface RevealProps {
  children: ReactNode;
  as?: "div" | "li" | "section";
  variant?: "fade" | "slide";
  className?: string;
}

export function Reveal({ children, as: Tag = "div", variant = "fade", className }: RevealProps) {
  const ref = useCallback((element: HTMLElement | null) => {
    if (!element) return undefined;
    registerReveal(element);
    return () => unregisterReveal(element);
  }, []);
  return (
    <Tag ref={ref} className={className} data-reveal={variant === "slide" ? "slide" : ""}>
      {children}
    </Tag>
  );
}
