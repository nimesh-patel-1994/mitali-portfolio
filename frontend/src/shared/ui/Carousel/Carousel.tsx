/**
 * Testimonial carousel (UI-012, REQ-015). APG carousel pattern without autoplay:
 * - all slides are in the pre-rendered HTML; inactive ones are `hidden`;
 * - prev/next buttons wrap around; indicator buttons with `aria-current` on the active one;
 * - a polite live region announces the new quote and author after a user action (not on first render);
 * - horizontal swipe via pointer events (threshold 40 px; vertical scrolling is not blocked).
 * One testimonial → no controls; zero → nothing rendered.
 */
import { useRef, useState, type PointerEvent } from "react";
import { Link } from "react-router";
import type { Testimonial } from "@/api/types";
import { a11y, actions } from "@/features/public/content/copy";
import { cx } from "@/shared/utils/cx";
import { ArrowLeftIcon, ArrowRightIcon } from "../Icon/Icon";
import styles from "./Carousel.module.css";

export const SWIPE_THRESHOLD_PX = 40;

export interface CarouselProps {
  testimonials: Testimonial[];
  className?: string;
}

export function Carousel({ testimonials, className }: CarouselProps) {
  const [active, setActive] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const pointerStart = useRef<{ x: number; y: number; id: number } | null>(null);
  const total = testimonials.length;

  if (total === 0) return null;

  const goTo = (target: number) => {
    const next = ((target % total) + total) % total;
    setActive(next);
    const t = testimonials[next];
    if (t) setAnnouncement(`${t.quote} — ${t.author_name}, ${t.author_role}, ${t.company}`);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (total < 2) return;
    pointerStart.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = pointerStart.current;
    pointerStart.current = null;
    if (!start || start.id !== event.pointerId) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX || Math.abs(dx) <= Math.abs(dy)) return;
    goTo(dx < 0 ? active + 1 : active - 1);
  };

  const multiple = total > 1;

  return (
    <section
      className={cx(styles.carousel, multiple && styles.multiple, className)}
      aria-roledescription="carousel"
      aria-label={a11y.testimonialsLabel}
    >
      {multiple && (
        <button
          type="button"
          className={cx(styles.arrow, styles.prev)}
          aria-label={a11y.previousTestimonial}
          onClick={() => goTo(active - 1)}
        >
          <ArrowLeftIcon />
        </button>
      )}

      <div
        className={styles.viewport}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => {
          pointerStart.current = null;
        }}
      >
        {testimonials.map((t, i) => (
          <div
            key={t.id}
            role="group"
            aria-roledescription="slide"
            aria-label={a11y.slideLabel(i + 1, total)}
            className={styles.slide}
            hidden={i !== active}
          >
            <figure className={styles.figure}>
              <blockquote className={styles.quote}>
                <p>{t.quote}</p>
              </blockquote>
              <figcaption className={styles.caption}>
                <span className={styles.author}>{t.author_name}</span>
                <span className={styles.role}>
                  {t.author_role}, {t.company}
                </span>
              </figcaption>
            </figure>
            {t.case_study_slug && (
              <Link to={`/work/${t.case_study_slug}`} className={styles.caseLink}>
                {actions.readCaseStudy}
              </Link>
            )}
          </div>
        ))}
      </div>

      {multiple && (
        <button
          type="button"
          className={cx(styles.arrow, styles.next)}
          aria-label={a11y.nextTestimonial}
          onClick={() => goTo(active + 1)}
        >
          <ArrowRightIcon />
        </button>
      )}

      {multiple && (
        <div className={styles.indicators}>
          {testimonials.map((t, i) => (
            <button
              key={t.id}
              type="button"
              className={styles.dot}
              aria-label={a11y.showTestimonial(i + 1, total)}
              aria-current={i === active ? "true" : undefined}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
      )}

      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </section>
  );
}
