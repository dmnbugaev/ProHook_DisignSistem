import js from "@eslint/js";
import ts from "typescript-eslint";
import vue from "eslint-plugin-vue";

export default [
  {
    ignores: [
      "node_modules/**",
      ".nuxt/**",
      ".output/**",
      "test-results/**",
      "playwright-report/**",
      ".agents/**",
    ],
  },
  js.configs.recommended,
  ...ts.configs.recommended,
  ...vue.configs["flat/essential"],
  {
    files: ["**/*.vue"],
    languageOptions: { parserOptions: { parser: ts.parser } },
  },
  {
    files: ["**/*.ts", "**/*.vue"],
    // TypeScript and Nuxt generated declarations check global identifiers.
    rules: { "no-undef": "off" },
  },
  {
    files: [
      "app/pages/**/*.vue",
      "app/layouts/**/*.vue",
      "app/app.vue",
      "app/error.vue",
    ],
    rules: { "vue/multi-word-component-names": "off" },
  },
];
