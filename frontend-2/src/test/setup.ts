import "@testing-library/jest-dom/vitest";
import { cleanup, configure } from "@testing-library/react";
import { afterEach } from "vitest";

// Route navigations render whole pages; under parallel coverage runs 1 s is too tight for findBy/waitFor.
configure({ asyncUtilTimeout: 5000 });

// jsdom does not implement scrolling; layouts scroll to the top after navigations (tests spy on this stub).
if (typeof window !== "undefined") {
  Object.defineProperty(window, "scrollTo", { value: () => undefined, writable: true, configurable: true });
}

afterEach(() => {
  cleanup();
});
