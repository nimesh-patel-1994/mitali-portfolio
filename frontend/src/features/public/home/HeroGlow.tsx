/**
 * Hero glow (UI-003, REQ-010): a blurred green radial gradient rising from the bottom of the dark hero, drifting
 * slowly over `--glow-loop` (transform/opacity only). Decorative (`aria-hidden`); static under reduced motion.
 * The parent hero must be `position: relative` and clip overflow.
 */
import styles from "./HeroGlow.module.css";

export function HeroGlow() {
  return <div className={styles.glow} aria-hidden="true" />;
}
