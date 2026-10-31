import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

/** Forbidden HTML-injection / eval-style APIs (SEC-UI-001, UI-REV-021; inherited via SEC-UI-013). */
const restrictedHtmlApis = [
  { selector: "MemberExpression[property.name='innerHTML']", message: "innerHTML is forbidden (SEC-UI-001)." },
  { selector: "MemberExpression[property.name='outerHTML']", message: "outerHTML is forbidden (SEC-UI-001)." },
  {
    selector: "CallExpression[callee.property.name='insertAdjacentHTML']",
    message: "insertAdjacentHTML is forbidden (SEC-UI-001).",
  },
  {
    selector: "CallExpression[callee.object.name='document'][callee.property.name=/^write(ln)?$/]",
    message: "document.write is forbidden (SEC-UI-001).",
  },
  {
    selector: "JSXAttribute[name.name='style']",
    message: "Inline styles are forbidden (CSP style-src 'self', SEC-UI-015, UI-REV-031).",
  },
  {
    selector: "MemberExpression[object.name='localStorage'], MemberExpression[object.name='sessionStorage']",
    message: "No browser storage (SEC-UI-018, UI-REV-014).",
  },
];

/**
 * Self-containment (SD-111, UI-REV-026, UI-T-127): no specifier or relative path may resolve into `frontend/`.
 * The pattern matches a `frontend` path segment and never `frontend-2`.
 */
export const FRONTEND_PATH_PATTERN = String.raw`(^|[\\/])frontend([\\/]|$)`;

const frontendImportPattern = {
  regex: FRONTEND_PATH_PATTERN,
  message: "frontend-2 is self-contained: never import from frontend/ (SD-111, UI-REV-026).",
};

const zodPattern = {
  regex: "^zod(?:/.*)?$",
  message: "Import z from @/shared/zod/classic or @/shared/zod/mini (jitless, CSP; SEC-010).",
};

const devOriginPattern = {
  regex: String.raw`(^|[\\/])vite[\\/]dev-origin`,
  message: "src/ never imports vite/dev-origin (SEC-UI-014, UI-REV-029).",
};

const sanitizedPath = {
  name: "@/api/sanitized",
  importNames: ["trustApiSanitizedHtml"],
  message: "Only the typed response mappers may create SanitizedHtmlString (UI-014).",
};

export default tseslint.config(
  { ignores: ["dist", "dist-ssr", "coverage", "node_modules", "src/api/schema.d.ts", "playwright-report", "test-results", "public"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx,js}"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.browser, ...globals.node },
    },
    plugins: { react, "react-hooks": reactHooks, "jsx-a11y": jsxA11y },
    settings: { react: { version: "19.0" } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.flatConfigs.recommended.rules,
      "react/no-danger": "error",
      "react/jsx-key": "error",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-restricted-syntax": ["error", ...restrictedHtmlApis],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "no-restricted-imports": ["error", { paths: [sanitizedPath], patterns: [zodPattern, frontendImportPattern] }],
    },
  },
  {
    // Nothing in src/ may import the dev-server tooling: the Origin rewrite never reaches a build (SEC-UI-014).
    files: ["src/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { paths: [sanitizedPath], patterns: [zodPattern, frontendImportPattern, devOriginPattern] }],
    },
  },
  {
    // The jitless Zod wrappers are the only modules allowed to import Zod itself (SEC-010).
    files: ["src/shared/zod/classic.ts", "src/shared/zod/mini.ts"],
    rules: { "no-restricted-imports": ["error", { patterns: [frontendImportPattern, devOriginPattern] }] },
  },
  {
    // Typed response mappers (and tests) may brand backend-sanitized HTML (UI-014, SEC-UI-001).
    files: ["src/app/content-mappers.ts", "src/**/*.test.{ts,tsx}", "src/test/**"],
    rules: { "no-restricted-imports": ["error", { patterns: [zodPattern, frontendImportPattern, devOriginPattern] }] },
  },
  {
    files: ["src/**/*.test.{ts,tsx}", "src/test/**", "scripts/**", "e2e/**", "vite/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        ...restrictedHtmlApis.filter((r) => !r.selector.includes("innerHTML") && !r.selector.includes("Storage")),
      ],
    },
  },
);
