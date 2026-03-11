# Security Audit & Remediation -- REITLens V1.0

This document covers the security issues identified during the institutional upgrade audit, what was fixed, and guidance for remaining hardening items.

---

## 1. Issues Found and Fixed

### 1a. Client-Side API Key Exposure (CRITICAL -- Fixed)

**Problem:** The Gemini API key was embedded directly into the client-side JavaScript bundle via Vite's `define` configuration:

```ts
// vite.config.ts (BEFORE -- REMOVED)
define: {
  'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
  'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
}
```

Both `components/AnalystMemo.tsx` and `components/AnalystPerspectives.tsx` used `process.env.API_KEY` which, after Vite bundling, became a hardcoded string in the production JS. Anyone could open DevTools and extract the key.

**Fix:** Created a Supabase Edge Function (`supabase/functions/gemini-proxy/index.ts`) that acts as a server-side proxy. The Gemini API key is stored as a Supabase secret and never reaches the browser. Both components now call the Edge Function via `fetch()` instead of importing the Google GenAI SDK directly. The `define` block and `loadEnv` import were removed from `vite.config.ts`.

### 1b. Filesystem Traversal (MODERATE -- Fixed)

**Problem:** `vite.config.ts` had `server.fs.strict: false`, which disables Vite's filesystem access restrictions during development. This could allow malicious dependencies or requests to read arbitrary files on the developer's machine.

**Fix:** Removed the entire `fs` configuration block. Vite's default `strict: true` is now in effect.

### 1c. Production Market Data Proxy (HIGH -- Fixed)

**Problem:** `services/marketDataService.ts` used `/yahoo-api/v8/finance/chart/{ticker}` which relied on a Vite dev-server proxy. In production builds, there is no proxy server -- all market data requests would fail silently, returning empty arrays.

**Fix:** Created a Supabase Edge Function (`supabase/functions/market-data/index.ts`) that proxies Yahoo Finance requests with proper headers. Updated `marketDataService.ts` to detect the environment (`import.meta.env.DEV`) and route through the Edge Function in production while keeping the Vite proxy for local development.

---

## 2. Edge Function Architecture

```
Browser (React App)
  |
  |-- POST /functions/v1/gemini-proxy   (AI features)
  |-- GET  /functions/v1/market-data    (Yahoo Finance data)
  |
  v
Supabase Edge Functions (Deno runtime)
  |
  |-- gemini-proxy --> Google Gemini API  (uses GEMINI_API_KEY secret)
  |-- market-data  --> Yahoo Finance API  (no key required)
```

**Key design decisions:**

- Edge Functions run on Deno (Supabase's edge runtime). They use the Web Fetch API and `Deno.serve()`.
- CORS headers are set to `*` by default. Tighten `Access-Control-Allow-Origin` to your production domain before launch.
- The `gemini-proxy` function accepts a `config` object to pass through Gemini-specific options like `tools` (Google Search grounding) and `responseMimeType`.
- The `market-data` function adds a `User-Agent` header (required by Yahoo Finance) and sets a 5-minute cache header.

---

## 3. How to Deploy Edge Functions

### Prerequisites
- [Supabase CLI](https://supabase.com/docs/guides/cli) installed
- A Supabase project with the project ref and access token

### Manual deployment

```bash
# Login to Supabase
supabase login

# Link your project
supabase link --project-ref YOUR_PROJECT_REF

# Set the Gemini API key as a secret
supabase secrets set GEMINI_API_KEY=your-key-here

# Deploy both functions
supabase functions deploy gemini-proxy
supabase functions deploy market-data
```

### Automated deployment (CI/CD)

The GitHub Actions workflow at `.github/workflows/deploy.yml` handles automatic deployment when files under `supabase/functions/` change on the `main` branch.

**Required GitHub Secrets:**

| Secret | Description |
|--------|-------------|
| `SUPABASE_ACCESS_TOKEN` | Personal access token from https://supabase.com/dashboard/account/tokens |
| `SUPABASE_PROJECT_REF` | Your project ref (subdomain of your Supabase URL) |

**Required Supabase Secrets (set in Dashboard > Edge Functions > Secrets):**

| Secret | Description |
|--------|-------------|
| `GEMINI_API_KEY` | Your Google Gemini API key |

---

## 4. CI/CD Pipeline Structure

### `.github/workflows/ci.yml` -- Continuous Integration

Runs on every push to `main` and on pull requests:

1. **Checkout** -- Clones the repository
2. **Node.js 20 setup** -- Installs Node.js with npm cache
3. **Install** -- `npm ci` for deterministic installs
4. **Type check** -- `tsc --noEmit` catches type errors without emitting files
5. **Lint** -- Runs the project's lint script (currently `tsc --noEmit`)
6. **Build** -- `vite build` to verify production bundle compiles
7. **Test** -- Runs `vitest` if configured, otherwise passes gracefully

### `.github/workflows/deploy.yml` -- Edge Function Deployment

Runs on pushes to `main` that modify files under `supabase/functions/`, or manually via `workflow_dispatch`:

1. **Checkout** -- Clones the repository
2. **Supabase CLI setup** -- Installs the latest Supabase CLI
3. **Deploy functions** -- Deploys each Edge Function individually

### Extending the pipeline

To add new checks:

- **ESLint:** Add `eslint . --ext .ts,.tsx` as a step after type checking once ESLint is configured.
- **Vitest:** Add a `vitest.config.ts` and test files; the CI workflow already attempts to run `vitest`.
- **E2E tests:** Add a Playwright or Cypress job as a separate workflow.
- **Preview deployments:** Add Vercel/Netlify preview deploy integration on PR events.

---

## 5. Remaining Security Items

These items were not addressed in this pass and should be prioritized for hardening:

### High Priority

- **Rate limiting on Edge Functions:** Supabase Edge Functions do not have built-in rate limiting. Consider adding a simple in-memory counter or using Supabase's database to track request counts per IP/time window. Alternatively, use Cloudflare or an API gateway in front.

- **Auth on Edge Functions:** Currently the Edge Functions accept requests authenticated only with the Supabase anon key (public). For sensitive operations like the Gemini proxy, consider requiring a user JWT by validating `Authorization: Bearer <jwt>` against Supabase Auth.

- **CORS origin restriction:** The `Access-Control-Allow-Origin: *` header in both Edge Functions should be tightened to the production domain (e.g., `https://reitlens.com`) before public launch.

### Medium Priority

- **Content Security Policy (CSP) headers:** Add CSP headers to the HTML response to prevent XSS attacks. Recommended policy:
  ```
  default-src 'self';
  script-src 'self';
  connect-src 'self' https://*.supabase.co https://data.sec.gov;
  style-src 'self' 'unsafe-inline';
  img-src 'self' data:;
  ```

- **Dependency auditing:** Add `npm audit` as a CI step. Pin major dependency versions. Consider using Dependabot or Renovate for automated dependency updates.

- **Source maps in production:** Source maps are correctly disabled for production (`sourcemap: mode === 'development'`). Verify this remains the case.

### Low Priority

- **Supabase Row Level Security (RLS):** Ensure all Supabase tables have RLS policies enabled. Public-facing tables (like `reits`) should have read-only policies. The `historical_financials` table should only be writable by service-role key.

- **Environment variable validation:** Add a startup check that validates required environment variables (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) are set and well-formed before the app renders.

- **Security headers (HSTS, X-Frame-Options):** Configure these at the hosting layer (Vercel/Netlify/Cloudflare). They are not application-level concerns but should be verified before launch.
