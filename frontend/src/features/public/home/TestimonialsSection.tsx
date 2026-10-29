/** Home: testimonials (UI-026, REQ-015). Dark-olive section with a heading and the carousel; empty → hidden. */
import { useId } from "react";
import type { Testimonial } from "@/api/types";
import { homeSections } from "@/features/public/content/copy";
import { Carousel } from "@/shared/ui/Carousel/Carousel";
import { Section } from "@/shared/ui/Section/Section";
import { SectionHeading } from "@/shared/ui/SectionHeading/SectionHeading";

export interface TestimonialsSectionProps {
  testimonials: Testimonial[];
}

export function TestimonialsSection({ testimonials }: TestimonialsSectionProps) {
  const headingId = useId();
  if (testimonials.length === 0) return null;
  return (
    <Section surface="dark" aria-labelledby={headingId}>
      <SectionHeading level={2} id={headingId}>
        {homeSections.testimonials}
      </SectionHeading>
      <Carousel testimonials={testimonials} />
    </Section>
  );
}
