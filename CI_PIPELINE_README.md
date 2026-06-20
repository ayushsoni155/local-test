# Shopify Custom App — CI/CD Pipeline

A production-ready, modular CI/CD pipeline for Shopify custom apps built with React Router, Prisma, and Vitest. Drop this into any Shopify project and change only 4–5 lines to make it yours.

---

## How It Works

The pipeline has **3 workflows** that run in sequence based on git events:

```
Developer pushes code
        │
        ▼
[feature branch] → PR to main
        │
        ▼
  feature-ci.yml ──→ 4 stages run → Gate must pass → Owner reviews → Merge
        │
        ▼
  staging-ci.yml ──→ 5 stages run → Gate must pass → Deploy allowed
        │
        ▼
  production-deploy.yml ──→ Manual trigger → Owner approves → Deployed
```

### Who can do what

| Action | Developer | Owner |
|:-------|:---------:|:-----:|
| Push to feature branch | ✅ | ✅ |
| Open PR to main | ✅ | ✅ |
| Merge PR to main | ❌ | ✅ (only after CI passes) |
| Push directly to main | ❌ | ❌ (enforced by ruleset) |
| Trigger production deploy | ❌ | ✅ |

---

## Pipeline Stages

### Workflow 1 — Feature CI (`feature-ci.yml`)
Triggered on every PR to `main`. All 4 stages run sequentially — a failure in any stage stops the chain.

| Stage | Tool(s) | Blocks merge? |
|:-----:|:--------|:-------------:|
| 1 · Secrets | Gitleaks + TruffleHog + .env check + private key scan | ✅ Yes |
| 2 · Dependencies | npm audit + Trivy (vulns / secrets / misconfigs) | ✅ Yes (critical/high only) |
| 3 · Static analysis | ESLint + TypeScript (`tsc --noEmit`) + Prettier | ✅ Yes (errors only) |
| 4 · Unit tests | Vitest | ✅ Yes |
| Gate | Single required status check | ✅ Required by ruleset |

### Workflow 2 — Staging CI (`staging-ci.yml`)
Triggered on every push to `main` (i.e. after a merge). Adds a 5th stage — the production build.

| Stage | Tool(s) | Blocks deploy? |
|:-----:|:--------|:--------------:|
| 1–4 | Same as Feature CI | ✅ Yes |
| 5 · Build | `npm run build` (Vite) | ✅ Yes |
| Gate | Single required status check | ✅ Required by ruleset |

### Workflow 3 — Production Deploy (`production-deploy.yml`)
Manual trigger only. Nobody can run it from a feature branch.

```
1. Actor types DEPLOY in the confirmation box
2. GitHub pauses → Owner must approve in the environment gate
3. Fresh secret scan + build runs on HEAD of main
4. Deploy command runs (Shopify CLI / Railway / Render / Docker)
5. Audit log written to the job summary permanently
```

---

## What Each Report Shows

Every CI run generates a **Job Summary** that you can read without opening any log files:

- **Stage 1** — table of scanner findings (Gitleaks, TruffleHog, .env files, private keys)
- **Stage 2** — vulnerability table (severity × package × CVE × fix version)
- **Stage 3** — ESLint errors by file:line:col, TypeScript errors, Prettier drift
- **Stage 4** — test results (passed / failed / skipped) with failure details
- **Gate** — final verdict badge table + "Where to Find Errors" debug guide

Errors also appear as **GitHub Annotations** — inline on the PR diff next to the exact line of code.

---

## Setup Guide

### Step 1 — Copy the files

Copy the entire `.github/` folder into your Shopify project:

```
.github/
├── workflows/
│   ├── feature-ci.yml         # PR gate
│   ├── staging-ci.yml         # post-merge validation
│   └── production-deploy.yml  # manual owner-only deploy
├── actions/
│   ├── setup-node/            # Node install + npm ci
│   ├── secret-scan/           # Gitleaks + TruffleHog
│   ├── dependency-scan/       # npm audit + outdated
│   ├── trivy-scan/            # Trivy filesystem scan
│   ├── static-analysis/       # ESLint + tsc + Prettier
│   ├── run-tests/             # Vitest
│   ├── build-app/             # npm run build
│   └── ci-gate/               # report + pass/fail decision
└── rulesets/
    ├── protect-main.json      # import → Settings → Rules
    ├── protect-staging.json
    └── feature-branch-safety.json
```

### Step 2 — Edit the 4 knobs

Open each workflow file and change only the `env:` block at the top:

**`feature-ci.yml`** and **`staging-ci.yml`**:
```yaml
env:
  NODE_VERSION: "20"                          # ← your Node version
  VITEST_CMD:   "npx vitest run --reporter=verbose"  # ← your test command
  BUILD_CMD:    "npm run build"               # ← your build command (staging only)
  USE_PRISMA:   "true"                        # ← "false" if no Prisma
```

**`production-deploy.yml`**:
```yaml
env:
  NODE_VERSION: "20"        # ← your Node version
  BUILD_CMD:    "npm run build"
  USE_PRISMA:   "true"
```

### Step 3 — Add your deploy command

In `production-deploy.yml`, find the `# Deploy` job and uncomment **one** option:

```yaml
# Option A — Shopify CLI
- name: Shopify deploy
  env:
    SHOPIFY_CLI_PARTNERS_TOKEN: ${{ secrets.SHOPIFY_CLI_PARTNERS_TOKEN }}
  run: npx shopify app deploy --force

# Option B — Railway
# Option C — Render deploy hook
# Option D — Docker
```

### Step 4 — Create the GitHub Environment

Go to **Settings → Environments → New environment** → name it `production`.

- ✅ **Required reviewers** — add your GitHub username
- ✅ **Deployment branches** — restrict to `main` only

This is the gate that blocks production deploys until an owner approves.

### Step 5 — Add secrets

Go to **Settings → Secrets and variables → Actions** and add the secret for your deploy method:

| Deploy method | Secret name |
|:-------------|:------------|
| Shopify CLI | `SHOPIFY_CLI_PARTNERS_TOKEN` |
| Railway | `RAILWAY_TOKEN` |
| Render | `RENDER_DEPLOY_HOOK_URL` |
| Docker Hub | `DOCKER_USERNAME` + `DOCKER_PASSWORD` |

### Step 6 — Import branch protection rulesets

Go to **Settings → Rules → Rulesets → ▼ New ruleset → Import a ruleset**.

Import these files one by one from `.github/rulesets/`:

| File | Protects | Key rules |
|:-----|:---------|:----------|
| `protect-main.json` | `main` branch | No direct push · PR required · CI gate must pass · 1 review |
| `protect-staging.json` | `staging` branch | Same + staging CI gate |
| `feature-branch-safety.json` | `feature/**`, `fix/**`, etc. | No force push |

> **After importing `protect-main.json`**, go into the ruleset and set the required status check name exactly to:
> `CI Gate · Feature → Main`

### Step 7 — Set up Vitest (if you haven't)

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

### Step 8 — Skip tests while you write them

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

The workflow tokens need these permissions (already set in the workflow files):

| Workflow | `contents` | `pull-requests` | `id-token` |
|:---------|:----------:|:---------------:|:----------:|
| feature-ci.yml | read | write | — |
| staging-ci.yml | read | — | — |
| production-deploy.yml | read | — | write |

---

## File Reference

```
.github/
├── workflows/
│   ├── feature-ci.yml          PR gate — runs on pull_request to main
│   ├── staging-ci.yml          Post-merge validation — runs on push to main
│   └── production-deploy.yml   Manual deploy — runs on workflow_dispatch
│
├── actions/
│   ├── setup-node/             Installs Node + runs npm ci
│   ├── secret-scan/            Gitleaks + TruffleHog + .env + key scan
│   ├── dependency-scan/        npm audit + outdated + deprecated
│   ├── trivy-scan/             Trivy filesystem (vuln / secret / misconfig)
│   ├── static-analysis/        ESLint + tsc + Prettier + annotations
│   ├── run-tests/              Vitest + JSON report + annotations
│   ├── build-app/              Prisma generate + npm run build
│   └── ci-gate/                Aggregates all stage results, writes summary, exits 1 on failure
│
└── rulesets/
    ├── protect-main.json        Import → protects main branch
    ├── protect-staging.json     Import → protects staging branch
    └── feature-branch-safety.json  Import → prevents force-push on feature branches
```

---

## Quick Checklist

- [ ] Copy `.github/` folder into your repo
- [ ] Set `NODE_VERSION`, `VITEST_CMD`, `BUILD_CMD`, `USE_PRISMA` in each workflow
- [ ] Uncomment your deploy method in `production-deploy.yml`
- [ ] Create `production` GitHub Environment with required reviewers
- [ ] Add deploy secret (e.g. `SHOPIFY_CLI_PARTNERS_TOKEN`)
- [ ] Import the 3 ruleset JSON files in GitHub Settings
- [ ] Set required status check name in `protect-main` ruleset: `CI Gate · Feature → Main`
- [ ] (Optional) Set `SKIP_TESTS=true` repo variable while writing tests
- [ ] Add Vitest globals override to `.eslintrc.cjs`
- [ ] Run `npm install` and commit `package-lock.json` — never use `--legacy-peer-deps`
