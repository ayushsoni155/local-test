/**
 * app/test/examples/webhook.test.js
 *
 * EXAMPLE: How to test a webhook handler.
 *
 * Convention:
 *   - Test files live next to the source file they test,  OR
 *   - In a __tests__/ folder,                             OR
 *   - In app/test/examples/ for cross-cutting tests
 *
 * File naming: *.test.js | *.test.jsx | *.test.ts | *.test.tsx
 */

// ─── Simple utility function test ────────────────────────────────────────────
// This is the most basic kind of test — pure logic, no React, no Shopify API.

function buildWebhookPayload(shopDomain, topic) {
  return {
    shop: shopDomain,
    topic,
    timestamp: new Date().toISOString(),
  };
}

describe("buildWebhookPayload", () => {
  it("returns an object with shop, topic, and timestamp", () => {
    const payload = buildWebhookPayload("myshop.myshopify.com", "APP_UNINSTALLED");

    expect(payload.shop).toBe("myshop.myshopify.com");
    expect(payload.topic).toBe("APP_UNINSTALLED");
    expect(payload.timestamp).toBeDefined();
  });

  it("timestamp is a valid ISO date string", () => {
    const payload = buildWebhookPayload("myshop.myshopify.com", "APP_UNINSTALLED");
    expect(() => new Date(payload.timestamp)).not.toThrow();
  });
});

// ─── Prisma mock test (uses the mock from setup.js) ──────────────────────────
// Shows how to test a function that talks to the database.

import prisma from "../../db.server.js";

async function findSessionForShop(shopDomain) {
  return prisma.session.findFirst({
    where: { shop: shopDomain },
  });
}

describe("findSessionForShop", () => {
  it("calls prisma.session.findFirst with the correct shop", async () => {
    const mockSession = { id: "abc123", shop: "myshop.myshopify.com" };
    prisma.session.findFirst.mockResolvedValue(mockSession);

    const result = await findSessionForShop("myshop.myshopify.com");

    expect(prisma.session.findFirst).toHaveBeenCalledWith({
      where: { shop: "myshop.myshopify.com" },
    });
    expect(result).toEqual(mockSession);
  });

  it("returns null when no session exists", async () => {
    prisma.session.findFirst.mockResolvedValue(null);

    const result = await findSessionForShop("unknown.myshopify.com");

    expect(result).toBeNull();
  });
});
