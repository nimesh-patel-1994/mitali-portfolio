/**
 * DEV ONLY — P1 review panel (PH-2). Mounted in its own root on <body> by review-switch.ts. Lets the reviewer
 * compare the cream and white base surfaces, switch route view transitions off and on, and open the type specimen.
 * Removed after the P1 decision.
 */
import { useSyncExternalStore } from "react";
import { createRoot } from "react-dom/client";
import { applyBase } from "./review-switch";
import { getReviewState, setViewTransitionsEnabled, subscribeReview } from "./review-state";
import styles from "./ReviewPanel.module.css";

export function ReviewPanel() {
  const state = useSyncExternalStore(subscribeReview, getReviewState, getReviewState);
  return (
    <aside className={styles.panel} data-surface="deep" aria-label="P1 review (development only)">
      <p className={styles.title}>P1 review</p>
      <button
        type="button"
        className={styles.button}
        aria-pressed={state.base === "white"}
        onClick={() => applyBase(state.base === "white" ? "cream" : "white", document, true)}
      >
        Base: {state.base === "white" ? "white #FFFFFF" : "cream #FFFDE9"}
      </button>
      <button
        type="button"
        className={styles.button}
        aria-pressed={state.viewTransitions}
        onClick={() => setViewTransitionsEnabled(!state.viewTransitions)}
      >
        View transitions: {state.viewTransitions ? "on" : "off"}
      </button>
      <a className={styles.link} href={`/__review/type${state.base === "white" ? "?base=white" : ""}`}>
        Type specimen
      </a>
    </aside>
  );
}

export function mountReviewPanel(doc: Document = document): void {
  const node = doc.createElement("div");
  node.setAttribute("data-review-panel", "");
  doc.body.appendChild(node);
  createRoot(node).render(<ReviewPanel />);
}
