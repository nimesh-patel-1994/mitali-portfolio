/** Home: testimonials (UI-111, REQ-015) on the deepest band; carousel without autoplay; empty → hidden. */
import { useId } from "react";
import type { Testimonial } from "@/api/types";
import { homeSections } from "@/features/public/content/copy";
import { Carousel } from "@/shared/ui/Carousel/Carousel";
import { Reveal } from "@/shared/ui/Reveal/Reveal";
import { Section } from "@/shared/ui/Section/Section";
import { SectionHeading } from "@/shared/ui/SectionHeading/SectionHeading";

export interface TestimonialsSectionProps {
  testimonials: Testimonial[];
}

export function TestimonialsSection({ testimonials }: TestimonialsSectionProps) {
  const headingId = useId();
  if (testimonials.length === 0) return null;
  return (
    <Section surface="deep" aria-labelledby={headingId}>
      <SectionHeading level={2} id={headingId} reveal="fade">
        {homeSections.testimonials}
      </SectionHeading>
      <Reveal>
        <Carousel testimonials={testimonials} />
      </Reveal>
    </Section>
  );
}
