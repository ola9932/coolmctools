import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  { files: ["src/**/*.js"], languageOptions: { globals: globals.browser } },
  {
    files: ["tests/**/*.js", "e2e/**/*.js", "playwright.config.js"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
