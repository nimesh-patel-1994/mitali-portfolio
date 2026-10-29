/** Splits plain text into paragraphs on blank lines (FAQ answers, UI-017). */
export function toParagraphs(text: string): string[] {
  return text
    .split(/\r?\n\s*\r?\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
}
