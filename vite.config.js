import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// VITEST is set automatically by `npx vitest` — use it to disable plugins that
// enforce server/client module boundaries (which break vi.mock of server files).
const isTest = !!process.env.VITEST;

// Related: https://github.com/remix-run/remix/issues/2835#issuecomment-1144102176
// Replace the HOST env var with SHOPIFY_APP_URL so that it doesn't break the Vite server.
// The CLI will eventually stop passing in HOST,
// so we can remove this workaround after the next major release.
if (
  process.env.HOST &&
  (!process.env.SHOPIFY_APP_URL ||
    process.env.SHOPIFY_APP_URL === process.env.HOST)
) {
  process.env.SHOPIFY_APP_URL = process.env.HOST;
  delete process.env.HOST;
}

const host = new URL(process.env.SHOPIFY_APP_URL || "http://localhost")
  .hostname;
let hmrConfig;

if (host === "localhost") {
  hmrConfig = {
    protocol: "ws",
    host: "localhost",
    port: 64999,
    clientPort: 64999,
  };
} else {
  hmrConfig = {
    protocol: "wss",
    host: host,
    port: parseInt(process.env.FRONTEND_PORT) || 8002,
    clientPort: 443,
  };
}

export default defineConfig({
  server: {
    allowedHosts: [host],
    cors: {
      preflightContinue: true,
    },
    port: Number(process.env.PORT || 3000),
    hmr: hmrConfig,
    fs: {
      // See https://vitejs.dev/config/server-options.html#server-fs-allow for more information
      allow: ["app", "node_modules"],
    },
  },
  // In test mode, drop reactRouter() — it enforces server/client module
  // boundaries and throws when vi.mock() tries to intercept server files.
  // Vite's built-in esbuild handles JSX/TS transforms without it.
  plugins: [
    ...(!isTest ? [reactRouter()] : []),
    tsconfigPaths(),
  ],
  build: {
    assetsInlineLimit: 0,
  },
  optimizeDeps: {
    include: ["@shopify/app-bridge-react"],
  },
  // ---------------------------------------------------------------------------
  // Vitest configuration
  // Run tests with:  npx vitest run
  // Watch mode:      npx vitest
  // UI mode:         npx vitest --ui
  // ---------------------------------------------------------------------------
  test: {
    // Where Vitest looks for test files (co-located with source OR in __tests__)
    include: [
      "app/**/*.test.{js,jsx,ts,tsx}",
      "app/**/__tests__/**/*.{js,jsx,ts,tsx}",
    ],
    exclude: ["node_modules", "build", "extensions"],

    // Use 'node' environment — webhook/server tests run in Node, not a browser.
    // Switch individual test files to jsdom by adding a docblock comment:
    //   // @vitest-environment jsdom
    // at the top of any file that needs a real DOM (e.g. React component tests).
    environment: "node",

    // Global test APIs (describe, it, expect, vi) without importing each time.
    globals: true,

    // Runs once before all test files. Mocks shopify.server + db.server so
    // tests never need a real Shopify connection or database.
    setupFiles: ["./app/test/setup.js"],

    // Inline server-only modules so Vite's module boundary checks are bypassed.
    // These paths are mocked in setup.js; without inline they cause resolution
    // errors even when mocked.
    server: {
      deps: {
        inline: [
          /shopify\.server/,
          /db\.server/,
        ],
      },
    },

    // Coverage via `npx vitest run --coverage`
    coverage: {
      provider: "istanbul",
      reporter: ["text", "json", "html"],
      include: ["app/**/*.{js,jsx,ts,tsx}"],
      exclude: [
        "app/**/*.test.*",
        "app/**/__tests__/**",
        "app/test/**",
        "app/entry.server.*",
      ],
    },
  },
});
