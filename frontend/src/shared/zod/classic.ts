/**
 * The only entry point to Zod (classic API) for app code (SEC-010, SEC-UI-003). `jitless: true` is set in this
 * module's body, so it runs before any schema module that imports `z` from here is evaluated: Zod then never
 * compiles parsers with `new Function` and never runs its `new Function("")` eval probe, which a strict
 * `script-src 'self'` CSP reports as a violation even though Zod swallows the error.
 * ESLint forbids importing `zod` directly elsewhere.
 */
import { z } from "zod";

z.config({ jitless: true });

export { z };
