/**
 * This is intended to be a basic starting point for linting in your app.
 * It relies on recommended configs out of the box for simplicity, but you can
 * and should modify this configuration to best suit your team's needs.
 */

/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  env: {
    browser: true,
    commonjs: true,
    es6: true,
  },
  ignorePatterns: ["!**/.server", "!**/.client"],

  // Base config
  extends: ["eslint:recommended"],

  overrides: [
    // React
    {
      files: ["**/*.{js,jsx,ts,tsx}"],
      plugins: ["react", "jsx-a11y"],
      extends: [
        "plugin:react/recommended",
        "plugin:react/jsx-runtime",
        "plugin:react-hooks/recommended",
        "plugin:jsx-a11y/recommended",
      ],
      settings: {
        react: {
          version: "detect",
        },
        formComponents: ["Form"],
        linkComponents: [
          { name: "Link", linkAttribute: "to" },
          { name: "NavLink", linkAttribute: "to" },
        ],
        "import/resolver": {
          typescript: {},
        },
      },
      rules: {
        "react/no-unknown-property": ["error", { ignore: ["variant"] }],
      },
    },

    // Typescript
    {
      files: ["**/*.{ts,tsx}"],
      plugins: ["@typescript-eslint", "import"],
      parser: "@typescript-eslint/parser",
      settings: {
        "import/internal-regex": "^~/",
        "import/resolver": {
          node: {
            extensions: [".ts", ".tsx"],
          },
          typescript: {
            alwaysTryTypes: true,
          },
        },
      },
      extends: [
        "plugin:@typescript-eslint/recommended",
        "plugin:import/recommended",
        "plugin:import/typescript",
      ],
    },

    // Node
    {
      files: [
        ".eslintrc.cjs",
        "vite.config.{js,ts}",
        ".graphqlrc.{js,ts}",
        "shopify.server.{js,ts}",
        "**/*.server.{js,ts}",
      ],
      env: {
        node: true,
      },
    },

    // ── Vitest test files ──────────────────────────────────────────────────
    // Declares all Vitest globals (describe, it, expect, vi, beforeEach …)
    // so ESLint doesn't report them as `no-undef`. Also enables ES2022 so
    // `globalThis` is recognised as a standard language global.
    {
      files: [
        "**/*.test.{js,jsx,ts,tsx}",
        "**/*.spec.{js,jsx,ts,tsx}",
        "app/test/**/*.{js,jsx,ts,tsx}",
      ],
      parserOptions: {
        ecmaVersion: 2022,
      },
      env: {
        es2022: true,      // includes globalThis, structuredClone, etc.
        node: true,        // test runner is Node
      },
      globals: {
        // ── Vitest test globals (injected when globals:true in vite.config) ──
        describe:   "readonly",
        it:         "readonly",
        test:       "readonly",
        expect:     "readonly",
        vi:         "readonly",
        beforeAll:  "readonly",
        afterAll:   "readonly",
        beforeEach: "readonly",
        afterEach:  "readonly",
        // ── Standard ES2020+ globals ─────────────────────────────────────────
        globalThis: "readonly",
      },
      rules: {
        // Allow top-level vi.mock() calls without an explicit import — Vitest
        // hoists them automatically via a Vite plugin.
        "no-undef": "error",        // keep the rule but globals above satisfy it
        "@typescript-eslint/no-explicit-any": "off",  // relaxed in tests
      },
    },
  ],
  globals: {
    shopify: "readonly",
  },
};
