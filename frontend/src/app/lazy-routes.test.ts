import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createFixtureSource } from "@/test/fixture-source";
import { FRONTEND_DIR, SRC_DIR } from "@/test/paths";
import { resolveLazyMatches } from "./lazy-routes";
import { createRoutes, LAZY_ROUTE_MODULES, ROUTE_IDS } from "./routes";

describe("REQ-NFR-004 lazy public routes", () => {
  it("LAZY_ROUTE_MODULES matches the import() of each lazy public route", () => {
    const source = readFileSync(resolve(SRC_DIR, "app", "routes.tsx"), "utf8");
    expect(Object.keys(LAZY_ROUTE_MODULES)).toEqual([ROUTE_IDS.contact]);
    for (const modulePath of Object.values(LAZY_ROUTE_MODULES)) {
      expect(existsSync(resolve(FRONTEND_DIR, modulePath))).toBe(true);
      const specifier = modulePath.replace(/^src\//, "@/").replace(/\.tsx?$/, "");
      expect(source).toContain(`import("${specifier}")`);
    }
  });

  it("the Contact route is lazy until resolved; resolving fills in its component", async () => {
    const routes = createRoutes(createFixtureSource());
    const contact = routes[0]!.children!.find((r) => r.id === ROUTE_IDS.contact)!;
    expect(typeof contact.lazy).toBe("function");
    expect(contact.Component).toBeUndefined();

    await resolveLazyMatches(routes, "/work");
    expect(typeof contact.lazy).toBe("function");

    await resolveLazyMatches(routes, "/contact");
    expect(contact.lazy).toBeUndefined();
    expect(typeof contact.Component).toBe("function");
    // Static properties stay as defined.
    expect(typeof contact.loader).toBe("function");
    expect(contact.id).toBe(ROUTE_IDS.contact);
  });
});
