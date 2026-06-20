/**
 * app/test/setup.js
 *
 * Runs once before all test files.
 * Add global mocks, polyfills, or test environment config here.
 */

// Mock Shopify's server-side modules so tests don't need a real Shopify connection.
// Any file that imports from shopify.server.js will get this mock instead.
vi.mock("../shopify.server", () => ({
  default: {},
  authenticate: {
    admin: vi.fn(),
    public: vi.fn(),
  },
  apiVersion: "2025-10",
  addDocumentResponseHeaders: vi.fn(),
  registerWebhooks: vi.fn(),
  sessionStorage: {},
}));

// Mock Prisma so tests don't need a real database.
vi.mock("../db.server", () => ({
  default: {
    session: {
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      upsert: vi.fn(),
    },
  },
}));

// Polyfill fetch for Node environments (Vitest runs in Node, not a browser).
if (!globalThis.fetch) {
  globalThis.fetch = vi.fn();
}
