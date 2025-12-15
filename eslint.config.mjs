import js from "@eslint/js";
import tseslint from "typescript-eslint";
import globals from "globals";
import reactRefresh from "eslint-plugin-react-refresh";
import prettier from "eslint-plugin-prettier/recommended";
import jsxA11y from "eslint-plugin-jsx-a11y";

const TS_GLOB = ["resources/**/*.{ts,tsx}", "vite.config.mts"];

export default tseslint.config(
  { ignores: ["cache"] },
  { name: "Prettier", extends: [prettier], files: TS_GLOB },
  {
    name: "JSX A11y",
    files: TS_GLOB,
    ...jsxA11y.flatConfigs.strict,
    languageOptions: {
      ...jsxA11y.flatConfigs.strict.languageOptions,
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    name: "Typescript",
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommendedTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
      reactRefresh.configs.recommended,
    ],
    files: TS_GLOB,
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/explicit-function-return-type": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          // Ignore just one underscore
          // https://stackoverflow.com/a/78734642
          argsIgnorePattern: "^_[^_].*$|^_$",
          varsIgnorePattern: "^_[^_].*$|^_$",
          caughtErrorsIgnorePattern: "^_[^_].*$|^_$",
        },
      ],
    },
  },
  {
    // Catch console.log used for debugging, but allow deliberate logging
    name: "no console.log in browser",
    files: TS_GLOB,
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "no-console": ["error", { allow: ["warn", "error", "info", "groupCollapsed", "groupEnd"] }],
    },
  },
);
