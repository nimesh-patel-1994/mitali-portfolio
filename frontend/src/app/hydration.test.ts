import { isRouteErrorResponse } from "react-router";
import { describe, expect, it } from "vitest";
import { createRoutes } from "./routes";
import {
  escapeJsonForHtml,
  readHydrationPayload,
  serializeErrors,
  serializeHydrationScript,
  toHydrationState,
  type HydrationPayload,
} from "./hydration";
import { createFixtureSource } from "@/test/fixture-source";

const LS = String.fromCharCode(0x2028);
const PS = String.fromCharCode(0x2029);

describe("UI-T-010 hydration data serializer (SEC-UI-002)", () => {
  const tricky = { title: `</script><script>alert(1)</script> & more ${LS}${PS} <!--` };

  it("escapes <, >, &, U+2028 and U+2029", () => {
    const out = escapeJsonForHtml(JSON.stringify(tricky));
    expect(out).not.toMatch(/[<>&]/);
    expect(out).not.toContain(LS);
    expect(out).not.toContain(PS);
    expect(out).toContain("\\u003c/script\\u003e");
    expect(out).toContain("\\u0026");
    expect(out).toContain("\\u2028");
  });

  it("round-trips through the JSON script block", () => {
    const payload: HydrationPayload = { loaderData: { root: tricky }, actionData: null, errors: null };
    const script = serializeHydrationScript(payload);
    expect(script.startsWith('<script type="application/json" id="__ROUTER_DATA__">')).toBe(true);
    expect(script.match(/<\/script>/g)).toHaveLength(1);
    document.body.innerHTML = script;
    expect(readHydrationPayload(document)).toEqual(payload);
  });

  it("returns null when the block is absent (admin shell, dev)", () => {
    document.body.innerHTML = "<div id='root'></div>";
    expect(readHydrationPayload(document)).toBeNull();
  });

  it("serializes route errors without internals", () => {
    const errors = serializeErrors({
      a: new Response(null, { status: 404 }) as unknown,
      b: new Error("secret stack details"),
    });
    expect(errors?.b).toEqual({ __type: "Error", message: "Unexpected error" });
  });

  it("404 document: marks the deepest loader route as a 404 for unknown slugs", () => {
    const routes = createRoutes(createFixtureSource());
    const state = toHydrationState(
      { loaderData: { root: {} }, actionData: null, errors: null, notFound: true },
      routes,
      "/work/does-not-exist",
    );
    const error = state.errors?.["case-study"];
    expect(isRouteErrorResponse(error) && error.status).toBe(404);
  });

  it("404 document: a URL matched by * needs no synthetic error", () => {
    const routes = createRoutes(createFixtureSource());
    const state = toHydrationState(
      { loaderData: { root: {} }, actionData: null, errors: null, notFound: true },
      routes,
      "/no/such/page",
    );
    expect(state.errors).toBeNull();
  });
});
