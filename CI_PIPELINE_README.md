# Shopify Custom App — PR CI Gate

A modular CI gate for Shopify custom apps built with React Router, Prisma, and Vitest. It runs on every pull request to `main` and produces a single required status check that blocks the merge until everything passes.

---

## How It Works

```
Developer pushes to a feature branch
        │
        ▼
   Opens PR → main
        │
        ▼
  pr-to-main.yml ──→ 5 stages run → Gate must pass → Owner reviews → Merge
```

### Who can do what

| Action | Developer | Owner |
|:-------|:---------:|:-----:|
| Push to feature branch | ✅ | ✅ |
| Open PR to main | ✅ | ✅ |
| Merge PR to main | ❌ | ✅ (only after CI passes) |
| Push directly to main | ❌ | ❌ (enforced by ruleset) |

---

## Pipeline Stages

### `pr-to-main.yml` — PR CI Gate
Triggered on every PR to `main`. The 5 stages run sequentially — a critical finding in any stage stops the chain, and the gate reports it.

| Stage | Tool(s) | Blocks merge? |
|:-----:|:--------|:-------------:|
| 1 · Secrets | Gitleaks + TruffleHog + .env check + private key scan | ✅ Yes |
| 2 · Dependencies | npm audit + Trivy (vulns / secrets / misconfigs) | ✅ Yes (critical/high only) |
| 3 · Static analysis | ESLint + TypeScript (`tsc --noEmit`) + Prettier | ✅ Yes (errors only) |
| 4 · Unit tests | Vitest | ✅ Yes |
| 5 · Production build | `npm run build` (Prisma generate + React Router build) | ✅ Yes |
| Gate | Single required status check | ✅ Required by ruleset |

> The gate also fails if any stage **crashes** (infra/setup error such as a failed `npm ci`), so a stage that never ran can't slip through as green.

---

## What Each Report Shows

Every CI run generates a **Job Summary** you can read without opening any log files:

- **Stage 1** — table of scanner findings (Gitleaks, TruffleHog, .env files, private keys)
- **Stage 2** — vulnerability table (severity × package × CVE × fix version)
- **Stage 3** — ESLint errors by file:line:col, TypeScript errors, Prettier drift
- **Stage 4** — test results (passed / failed / skipped) with failure details
- **Stage 5** — production build result (pass/fail) with an error excerpt on failure
- **Gate** — final verdict badge table + "Where to Find Errors" debug guide

Errors also appear as **GitHub Annotations** — inline on the PR diff next to the exact line of code.

---

## Setup Guide

### Step 1 — Copy the files

Copy the entire `.github/` folder into your Shopify project:

```
.github/
├── workflows/
│   └── pr-to-main.yml         # PR gate
├── actions/
│   ├── setup-node/            # Node install + npm ci
│   ├── secret-scan/           # Gitleaks + TruffleHog
│   ├── dependency-scan/       # npm audit + outdated
│   ├── trivy-scan/            # Trivy filesystem scan
│   ├── static-analysis/       # ESLint + tsc + Prettier
│   ├── run-tests/             # Vitest
│   ├── build-app/             # Prisma generate + production build
│   └── ci-gate/               # report + pass/fail decision
└── rulesets/
    └── protect-main.json      # import → Settings → Rules
```

### Step 2 — Edit the knobs

Open `pr-to-main.yml` and change only the `env:` block at the top:

```yaml
env:
  NODE_VERSION: "20"                                 # ← your Node version
  VITEST_CMD:   "npx vitest run --reporter=verbose"  # ← your test command
  BUILD_CMD:    "npm run build"                      # ← your build command
  USE_PRISMA:   "true"                               # ← "false" if no Prisma
  SKIP_TESTS:   ${{ vars.SKIP_TESTS || 'false' }}    # ← repo variable toggle
```

### Step 3 — Import the branch protection ruleset

Go to **Settings → Rules → Rulesets → ▼ New ruleset → Import a ruleset** and import `.github/rulesets/protect-main.json`.

| File | Protects | Key rules |
|:-----|:---------|:----------|
| `protect-main.json` | `main` branch | No direct push · PR required · CI gate must pass · 1 review |

> **After importing**, open the ruleset and confirm the required status check name is exactly:
> `CI Gate · Feature → Main`

### Step 4 — Set up Vitest (if you haven't)

Add to `package.json`:
```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  },
  "devDependencies": {
    "vitest": "^3.2.4",
    "@vitest/coverage-istanbul": "^3.2.4",
    "jsdom": "^26.0.0"
  }
}
```

Add to `vite.config.js`:
```js
const isTest = !!process.env.VITEST;

export default defineConfig({
  plugins: [
    ...(!isTest ? [reactRouter()] : []),  // disable React Router plugin in tests
    tsconfigPaths(),
  ],
  test: {
    include: ["app/**/*.test.{js,jsx,ts,tsx}"],
    environment: "node",    // use "jsdom" for React component tests
    globals: true,
    setupFiles: ["./app/test/setup.js"],
  },
});
```

Write tests in `app/test/` or co-locate them as `*.test.js` next to source files.

### Step 5 — Skip tests while you write them

If you're not ready with tests yet, set a repository variable:

**Settings → Secrets and variables → Actions → Variables → New repository variable**

```
Name:  SKIP_TESTS
Value: true
```

Change it to `false` when you're ready. Tests will run automatically on the next PR.

---

## ESLint Setup for Test Files

Add this override to `.eslintrc.cjs` so ESLint doesn't flag Vitest globals as undefined:

```js
// .eslintrc.cjs
overrides: [
  // ... your existing overrides ...

  // Vitest test files — declare globals injected by Vitest
  {
    files: ["**/*.test.{js,jsx,ts,tsx}", "app/test/**/*.{js,jsx,ts,tsx}"],
    env: { es2022: true, node: true },
    globals: {
      describe: "readonly", it: "readonly", test: "readonly",
      expect: "readonly", vi: "readonly",
      beforeAll: "readonly", afterAll: "readonly",
      beforeEach: "readonly", afterEach: "readonly",
      globalThis: "readonly",
    },
  },
]
```

---

## Writing Tests

### Example structure

```
app/
├── routes/
│   └── webhooks.jsx
├── test/
│   ├── setup.js              ← global mocks (Shopify + Prisma)
│   └── examples/
│       └── webhook.test.js   ← example tests
```

### `app/test/setup.js` — global mocks

```js
// Mock Shopify server modules (no real Shopify connection needed in tests)
vi.mock("../shopify.server", () => ({
  default: {},
  authenticate: { admin: vi.fn(), public: vi.fn() },
  apiVersion: "2025-10",
  addDocumentResponseHeaders: vi.fn(),
  registerWebhooks: vi.fn(),
  sessionStorage: {},
}));

// Mock Prisma (no real database needed in tests)
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
```

### Example test

```js
// app/test/examples/webhook.test.js
import db from "../db.server";

describe("findSessionForShop", () => {
  it("calls prisma with the correct shop", async () => {
    db.session.findFirst.mockResolvedValue({ shop: "test.myshopify.com" });
    const result = await db.session.findFirst({ where: { shop: "test.myshopify.com" } });
    expect(result.shop).toBe("test.myshopify.com");
  });
});
```

Add `// @vitest-environment jsdom` at the top of any file that needs a real DOM (React component tests).

---

## Troubleshooting

### `npm ci` fails with "Missing: X from lock file"
The lockfile is out of sync. Fix it:
```bash
rm package-lock.json
npm install          # never use --legacy-peer-deps on tracked projects
git add package-lock.json
git commit -m "fix: regenerate lockfile"
git push
```

### Stage 4 shows SKIP when SKIP_TESTS is false
- Check **Settings → Secrets and variables → Variables** — `SKIP_TESTS` repo variable must be unset or set to `false`.
- Stage 4 also skips if Stage 3 had errors. Fix Stage 3 first.

### "Server-only module referenced by client" in Vitest
Your `vite.config.js` has `reactRouter()` active during tests. Fix:
```js
const isTest = !!process.env.VITEST;
plugins: [
  ...(!isTest ? [reactRouter()] : []),
  tsconfigPaths(),
]
```

### "invalid actor" when importing ruleset
The `RepositoryRole` actor IDs are: **Write = 4**, **Maintain = 2**, **Admin = 5**.
Do not use `actor_id: 3` — it will error on import.

### ESLint reports `no-undef` for `describe`, `vi`, `expect`
Add the Vitest override block to `.eslintrc.cjs` as shown in the ESLint section above.

---

## Required GitHub Permissions

The workflow token only needs read access (already set in the workflow file):

| Workflow | `contents` |
|:---------|:----------:|
| pr-to-main.yml | read |

---

## File Reference

```
.github/
├── workflows/
│   └── pr-to-main.yml           PR gate — runs on pull_request to main
│
├── actions/
│   ├── setup-node/             Installs Node + runs npm ci
│   ├── secret-scan/            Gitleaks + TruffleHog + .env + key scan
│   ├── dependency-scan/        npm audit + outdated + deprecated
│   ├── trivy-scan/             Trivy filesystem (vuln / secret / misconfig)
│   ├── static-analysis/        ESLint + tsc + Prettier + annotations
│   ├── run-tests/              Vitest + JSON report + annotations
│   ├── build-app/              Prisma generate + production build
│   └── ci-gate/                Aggregates all stage results, writes summary, exits 1 on failure
│
└── rulesets/
    └── protect-main.json        Import → protects main branch
```

---

## Quick Checklist

- [ ] Copy `.github/` folder into your repo
- [ ] Set `NODE_VERSION`, `VITEST_CMD`, `BUILD_CMD`, `USE_PRISMA` in `pr-to-main.yml`
- [ ] Import `protect-main.json` in GitHub Settings → Rules
- [ ] Set required status check name in `protect-main` ruleset: `CI Gate · Feature → Main`
- [ ] (Optional) Set `SKIP_TESTS=true` repo variable while writing tests
- [ ] Add Vitest globals override to `.eslintrc.cjs`
- [ ] Run `npm install` and commit `package-lock.json` — never use `--legacy-peer-deps`
