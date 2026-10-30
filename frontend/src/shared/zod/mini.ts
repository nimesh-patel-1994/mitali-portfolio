/**
 * The only entry point to `zod/mini` for app code (public contact form). Same CSP reason as `./classic`:
 * `jitless: true` is applied before any schema built from this `z` exists (SEC-010, SEC-UI-003).
 */
import * as z from "zod/mini";

z.config({ jitless: true });

export { z };
