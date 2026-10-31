/**
 * DEV ONLY — type-scale specimen `/__review/type` (P1 review, DES-057). Shows every text token with its computed
 * pixel size, line height and tracking at the current viewport width, so the user can check it at 375, 768, 1024
 * and 1440 px (resize the window; values update). Registered only when `import.meta.env.DEV` (never in a build).
 */
import { useEffect, useId, useState } from "react";
import { Section } from "@/shared/ui/Section/Section";
import styles from "./TypeSpecimen.module.css";

export interface SpecimenToken {
  token: string;
  role: string;
  className: string;
  sample: string;
}

export const SPECIMEN_TOKENS: SpecimenToken[] = [
  { token: "--text-display-xl", role: "Display (Home hero h1)", className: "displayXl", sample: "Words with a job to do" },
  { token: "--text-display", role: "h1 (inner pages, case-study title)", className: "display", sample: "A plan that grew" },
  { token: "--text-h2", role: "h2", className: "h2", sample: "Selected work" },
  { token: "--text-h3", role: "h3", className: "h3", sample: "Monthly retainer" },
  { token: "--text-cta", role: "Footer call-to-action", className: "cta", sample: "let's talk" },
  { token: "--text-lead", role: "h4 / lead", className: "lead", sample: "Strategy first. Sentences that earn their place." },
  { token: "--text-body", role: "Body", className: "body", sample: "Body copy in Public Sans at the base size." },
  { token: "--text-small", role: "Small", className: "small", sample: "Small print and meta text." },
  { token: "--text-label", role: "Label", className: "label", sample: "Campaign type" },
  { token: "--text-wordmark", role: "Wordmark (header)", className: "wordmark", sample: "MITALI" },
];

interface Measured {
  fontSize: string;
  lineHeight: string;
  letterSpacing: string;
}

function measure(id: string): Measured | null {
  const el = document.getElementById(id);
  if (!el) return null;
  const cs = window.getComputedStyle(el);
  return { fontSize: cs.fontSize, lineHeight: cs.lineHeight, letterSpacing: cs.letterSpacing };
}

export function TypeSpecimen() {
  const baseId = useId();
  const [width, setWidth] = useState<number | null>(null);
  const [values, setValues] = useState<Record<string, Measured | null>>({});

  useEffect(() => {
    const update = () => {
      setWidth(window.innerWidth);
      const next: Record<string, Measured | null> = {};
      SPECIMEN_TOKENS.forEach((t, i) => {
        next[t.token] = measure(`${baseId}-${i}`);
      });
      setValues(next);
    };
    update();
    window.addEventListener("resize", update);
    void document.fonts?.ready.then(update);
    return () => window.removeEventListener("resize", update);
  }, [baseId]);

  return (
    <Section surface="base" aria-labelledby={`${baseId}-title`}>
      <h1 id={`${baseId}-title`} className={styles.title}>
        Type specimen (P1 review, development only)
      </h1>
      <p className={styles.viewport}>Viewport width: {width === null ? "…" : `${width} px`} — check at 375, 768, 1024 and 1440 px.</p>
      <ul className={styles.list}>
        {SPECIMEN_TOKENS.map((t, i) => {
          const v = values[t.token];
          return (
            <li key={t.token} className={styles.row}>
              <p className={styles.meta}>
                <code>{t.token}</code> · {t.role} ·{" "}
                <span data-testid={`size-${t.token}`}>{v ? `${v.fontSize} / line ${v.lineHeight} / tracking ${v.letterSpacing}` : "…"}</span>
              </p>
              <p id={`${baseId}-${i}`} className={styles[t.className]}>
                {t.sample}
              </p>
            </li>
          );
        })}
      </ul>
    </Section>
  );
}
