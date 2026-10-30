/** Status chips for admin rows (UI-009 `StatusChip`): always text, never colour alone. */
import { StatusChip } from "@/shared/ui/Chip/Chip";
import kit from "./Kit.module.css";

export function PublishChips({ published, featured, sample }: { published: boolean; featured?: boolean; sample?: boolean }) {
  return (
    <span className={kit.chips}>
      <StatusChip tone={published ? "success" : "neutral"}>{published ? "Published" : "Draft"}</StatusChip>
      {featured && <StatusChip tone="neutral">Featured</StatusChip>}
      {sample && <StatusChip tone="warning">Sample</StatusChip>}
    </span>
  );
}
