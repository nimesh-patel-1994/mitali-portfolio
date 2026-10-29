import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

/** Forbidden HTML-injection / eval-style APIs (SEC-UI-001, UI-REV-021). */
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
];

export default tseslint.config(
  { ignores: ["dist", "dist-ssr", "coverage", "node_modules", "src/api/schema.d.ts", "playwright-report", "test-results"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
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
      "react/no-array-index-key": "off",
      "no-eval": "error",
      "no-implied-eval": "error",
      "no-new-func": "error",
      "no-restricted-syntax": ["error", ...restrictedHtmlApis],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      // The brand constructor may only be used by the typed response mappers (UI-014).
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@/api/sanitized",
              importNames: ["trustApiSanitizedHtml"],
              message: "Only the typed response mappers may create SanitizedHtmlString (UI-014).",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["src/app/content-mappers.ts", "src/**/*.test.{ts,tsx}", "src/test/**"],
    rules: { "no-restricted-imports": "off" },
  },
  {
    files: ["src/**/*.test.{ts,tsx}", "src/test/**", "scripts/**", "e2e/**"],
    rules: { "no-restricted-syntax": ["error", ...restrictedHtmlApis.filter((r) => !r.selector.includes("innerHTML"))] },
  },
);
