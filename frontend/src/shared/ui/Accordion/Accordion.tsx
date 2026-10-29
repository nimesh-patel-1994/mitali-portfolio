/**
 * Accordion (UI-011): heading > button[aria-expanded][aria-controls] + region[aria-labelledby].
 * All items start collapsed; panels carry `hidden` (content is in the pre-rendered HTML for indexing).
 * Items open independently. IDs come from `useId`, so server and client render the same markup.
 * Two-column layout keeps DOM order column-by-column (first half, then second half) for reading order.
 */
import { useId, useState, type ReactNode } from "react";
import { cx } from "@/shared/utils/cx";
import { PlusIcon } from "../Icon/Icon";
import styles from "./Accordion.module.css";

export interface AccordionItem {
  /** Stable id (API id). */
  id: string;
  title: ReactNode;
  content: ReactNode;
}

export interface AccordionProps {
  items: AccordionItem[];
  headingLevel?: 2 | 3 | 4;
  /**
   * `2` = two columns from tablet up, filled column by column (one below).
   * `3` = a row-wise grid: one column on mobile, two on tablet, three on desktop; DOM order = reading order.
   */
  columns?: 1 | 2 | 3;
  /** `display` = uppercase display-font titles (services); `body` = sentence case (FAQs). */
  titleVariant?: "body" | "display";
  className?: string;
}

export function Accordion({
  items,
  headingLevel = 3,
  columns = 1,
  titleVariant = "body",
  className,
}: AccordionProps) {
  const baseId = useId();
  const [open, setOpen] = useState<ReadonlySet<string>>(() => new Set());

  const toggle = (id: string) => {
    setOpen((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const Heading = `h${headingLevel}` as const;
  const renderItem = (item: AccordionItem, index: number) => {
    const expanded = open.has(item.id);
    const buttonId = `${baseId}-button-${index}`;
    const panelId = `${baseId}-panel-${index}`;
    return (
      <div key={item.id} className={styles.item} data-expanded={expanded ? "true" : undefined}>
        <Heading className={cx(styles.heading, styles[titleVariant])}>
          <button
            type="button"
            id={buttonId}
            className={styles.trigger}
            aria-expanded={expanded}
            aria-controls={panelId}
            onClick={() => toggle(item.id)}
          >
            <span className={styles.title}>{item.title}</span>
            <PlusIcon className={styles.icon} />
          </button>
        </Heading>
        <div id={panelId} role="region" aria-labelledby={buttonId} className={styles.panel} hidden={!expanded}>
          <div className={styles.panelInner}>{item.content}</div>
        </div>
      </div>
    );
  };

  if (columns === 3) {
    return (
      <div className={cx(styles.accordion, styles.grid, className)}>{items.map((item, i) => renderItem(item, i))}</div>
    );
  }

  if (columns === 2 && items.length > 1) {
    const half = Math.ceil(items.length / 2);
    return (
      <div className={cx(styles.accordion, styles.twoColumns, className)}>
        <div className={styles.column}>{items.slice(0, half).map((item, i) => renderItem(item, i))}</div>
        <div className={styles.column}>{items.slice(half).map((item, i) => renderItem(item, half + i))}</div>
      </div>
    );
  }

  return (
    <div className={cx(styles.accordion, className)}>
      <div className={styles.column}>{items.map((item, i) => renderItem(item, i))}</div>
    </div>
  );
}
