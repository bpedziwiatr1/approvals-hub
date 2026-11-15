import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "coverage", "playwright-report", "test-results", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  {
    files: ["**/*.mjs", "*.config.{js,ts}"],
    languageOptions: { globals: globals.node },
  },
  {
    // Reason-to-change boundaries: no sprawling source files; the data layer knows nothing of the UI.
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: { "max-lines": ["error", { max: 250, skipBlankLines: true, skipComments: true }] },
  },
  {
    files: ["src/data/**/*.{ts,tsx}"],
    ignores: ["**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [{ group: ["**/grid/*", "**/detail/*", "**/filters/*", "**/page/*", "**/summary/*", "**/App", "**/App.tsx"], message: "src/data must not import UI modules." }] }],
    },
  },
  {
    // No focused or skipped tests.
    files: ["**/*.test.{ts,tsx,mjs}", "e2e/**/*.ts"],
    rules: {
      "no-restricted-syntax": [
        "error",
        { selector: "MemberExpression[property.name=/^(only|skip)$/][object.name=/^(it|test|describe|suite)$/]", message: "No .only or .skip in tests." },
        { selector: "MemberExpression[property.name=/^(only|skip)$/][object.property.name=/^(each|concurrent)$/]", message: "No .only or .skip in tests." },
        { selector: "CallExpression[callee.name=/^(xit|xtest|xdescribe|fit|fdescribe)$/]", message: "No focused or skipped tests." },
      ],
    },
  },
);
