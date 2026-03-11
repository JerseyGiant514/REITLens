# REITLens V1.0 - Testing & Code Quality Guide

## Table of Contents
1. [Running Tests](#running-tests)
2. [Running Linting](#running-linting)
3. [Running Code Formatting](#running-code-formatting)
4. [TypeScript Strict Mode](#typescript-strict-mode)
5. [Test Coverage Strategy](#test-coverage-strategy)
6. [Error Boundary Guide](#error-boundary-guide)
7. [Toast Notification System](#toast-notification-system)

---

## Running Tests

REITLens uses [Vitest](https://vitest.dev/) for testing with jsdom environment for React component support.

### Commands

```bash
# Run all tests once
npm test

# Run tests in watch mode (re-runs on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run a specific test file
npx vitest run tests/services/financialCalculations.test.ts

# Run tests matching a pattern
npx vitest run --reporter=verbose -t "FFO"
```

### Configuration

Vitest config is in `vitest.config.ts`. Key settings:
- **environment**: `jsdom` (for React component testing)
- **globals**: `true` (describe/it/expect available without imports)
- **include**: `tests/**/*.test.{ts,tsx}`
- **coverage provider**: `v8`

### Test File Locations

| File | What it tests |
|------|--------------|
| `tests/services/financialCalculations.test.ts` | FFO, AFFO, NOI, payout ratios, interest coverage, growth decomposition, expectations analysis |
| `tests/services/dataService.test.ts` | SEC data normalization, fallback pattern (DB > Live > Mock), cache behavior, sync/async access |
| `tests/services/mockData.test.ts` | Mock generator data shapes, cross-REIT consistency, interface compliance |

---

## Running Linting

REITLens uses [ESLint](https://eslint.org/) with TypeScript and React Hooks plugins.

### Commands

```bash
# Run linting (report errors)
npm run lint

# Run linting and auto-fix what's possible
npm run lint:fix

# Run TypeScript type checking only
npm run typecheck
```

### ESLint Configuration

Config file: `.eslintrc.cjs`

**Key rules:**
- `@typescript-eslint/no-unused-vars`: **warn** (unused vars prefixed with `_` are ignored)
- `@typescript-eslint/no-explicit-any`: **warn** (explicit `any` should be replaced gradually)
- `@typescript-eslint/no-non-null-assertion`: **warn**
- `@typescript-eslint/consistent-type-imports`: **warn** (prefer `import type`)
- `no-console`: **warn** (except `console.warn` and `console.error`)
- `react-hooks/rules-of-hooks`: **error**
- `react-hooks/exhaustive-deps`: **warn**

**Ignored paths:** `node_modules/`, `dist/`, `build/`, `*.config.js`, `*.config.ts`, `scripts/`

---

## Running Code Formatting

REITLens uses [Prettier](https://prettier.io/) for consistent code formatting.

### Commands

```bash
# Format all files
npm run format

# Check formatting without modifying files
npm run format:check
```

### Prettier Configuration

Config file: `.prettierrc`

| Setting | Value |
|---------|-------|
| `semi` | `true` |
| `singleQuote` | `true` |
| `tabWidth` | `2` |
| `trailingComma` | `es5` |
| `printWidth` | `100` |
| `bracketSpacing` | `true` |
| `arrowParens` | `avoid` |
| `endOfLine` | `auto` |

---

## TypeScript Strict Mode

TypeScript strict mode has been enabled in `tsconfig.json` (`"strict": true`). This enables:
- `strictNullChecks`
- `strictFunctionTypes`
- `strictBindCallApply`
- `strictPropertyInitialization`
- `noImplicitAny`
- `noImplicitThis`
- `alwaysStrict`

### Strict Mode Errors Found

Below is the catalog of TypeScript strict mode errors found when running `tsc --noEmit`. These are documented for manual resolution.

#### Category 1: Implicit `any` Parameters (TS7006)

These occur where function parameters lack type annotations. Most are in the zustand stores and App.tsx.

| File | Line(s) | Description | Fix |
|------|---------|-------------|-----|
| `App.tsx` | 43-67 | Switch statement callbacks have `s` parameter with no type | Add `(s: Sector)` type annotation |
| `App.tsx` | 160 | Portfolio map callback `p` has no type | Add `(p: Portfolio)` |
| `stores/useAppStore.ts` | 52-89 | Store creator params (`set`, `page`, `ticker`, `sector`, etc.) | Add zustand types: `set: StoreApi<AppState>['setState']`, etc. |
| `stores/usePortfolioStore.ts` | 50-117 | Store creator params and callbacks | Add zustand types |
| `stores/useStrategicModelStore.ts` | 113-131 | Store creator params | Add zustand types |

**How to fix:** Add explicit parameter type annotations matching the expected types.

#### Category 2: Missing Module Declarations (TS2307, TS7016)

| File | Line | Error | Fix |
|------|------|-------|-----|
| `stores/useAppStore.ts` | 17 | Cannot find module 'zustand' | `npm install zustand` or add to dependencies |
| `stores/usePortfolioStore.ts` | 19 | Cannot find module 'zustand' | Same as above |
| `stores/useStrategicModelStore.ts` | 21 | Cannot find module 'zustand' | Same as above |
| `index.tsx` | 3 | No declaration for 'react-dom/client' | `npm install @types/react-dom` |
| `components/Macro.tsx` | 13 | Cannot find module './StalenessIndicator' | Create the missing component or remove the import |

#### Category 3: Type Incompatibilities (TS2322, TS2769)

| File | Line | Error | Fix |
|------|------|-------|-----|
| `App.tsx` | 180 | BalanceSheet props mismatch: `sector` not in props | Update BalanceSheet interface or remove `sector` prop |
| `components/Macro.tsx` | 275, 307 | Recharts Formatter type mismatch (`number \| undefined` vs `number`) | Change callback to `(val: number \| undefined) => string[]` |
| `components/SectorLens.tsx` | 131, 136 | textTransform not in SVG props; Formatter type mismatch | Use custom tick component; fix Formatter signature |
| `components/Valuation.tsx` | 353 | Recharts Formatter type mismatch | Same Formatter fix |

#### Category 4: Missing Properties (TS2339)

| File | Line | Error | Fix |
|------|------|-------|-----|
| `components/JustifiedPAFFO.tsx` | 312 | `ssLabel` does not exist on `GrowthParams` | Add `ssLabel` to GrowthParams interface or use correct property name |
| `scripts/verifyHistoricalReturns.ts` | 72 | `data` not on PostgrestFilterBuilder | Await the query chain properly |

#### Category 5: Deno-specific Errors (TS2304)

| File | Line | Error | Fix |
|------|------|-------|-----|
| `supabase/functions/gemini-proxy/index.ts` | 30, 44 | Cannot find name 'Deno' | Add `/// <reference types="@types/deno" />` or exclude from tsconfig |
| `supabase/functions/market-data/index.ts` | 22 | Cannot find name 'Deno' | Same as above |

**Recommendation:** Exclude `supabase/functions/` from the root tsconfig and give it its own tsconfig with Deno types.

### Priority for Fixing

1. **P0 (Critical):** Install missing dependencies (`zustand`, `@types/react-dom`) and fix missing module errors
2. **P1 (High):** Fix implicit `any` types in store files and App.tsx
3. **P2 (Medium):** Fix Recharts Formatter type mismatches
4. **P3 (Low):** Fix Deno edge function types (separate tsconfig), fix missing component imports

---

## Test Coverage Strategy

### Current Coverage

| Layer | Status | Files Tested |
|-------|--------|-------------|
| Financial Calculations | Covered | FFO, AFFO, NOI, payout, interest coverage, G&A/GAV |
| Growth Decomposition | Covered | Component sums, sector-specific decomposition |
| Expectations Analysis | Covered | Lookbacks, percentiles, status classification, value traps |
| Data Service | Covered | SEC normalization, fallback pattern, cache behavior |
| Mock Generators | Covered | Data shape validation, interface compliance, cross-REIT consistency |
| Components | Not yet | UI rendering tests pending |
| E2E | Not yet | Full flow tests pending |

### Goals

| Milestone | Target |
|-----------|--------|
| Phase 1 (current) | Core financial calculations 100% covered |
| Phase 2 | Component rendering tests for Dashboard, Valuation, BalanceSheet |
| Phase 3 | Integration tests with mock Supabase |
| Phase 4 | E2E tests with Playwright |

### Writing New Tests

Place test files in `tests/` mirroring the source structure:
```
tests/
  services/
    financialCalculations.test.ts
    dataService.test.ts
    mockData.test.ts
  components/     (future)
    Dashboard.test.tsx
  contexts/       (future)
    ToastContext.test.tsx
```

---

## Error Boundary Guide

### What It Does

`ErrorBoundary` is a React class component that catches JavaScript errors in its child component tree, logs the error, and renders a fallback UI instead of crashing the entire application.

### Location

`components/ErrorBoundary.tsx`

### Usage

#### Basic usage (wrapping a page section)

```tsx
import ErrorBoundary from './components/ErrorBoundary';

<ErrorBoundary section="Dashboard">
  <Dashboard ticker={ticker} />
</ErrorBoundary>
```

#### With custom error callback (for Sentry, analytics, etc.)

```tsx
<ErrorBoundary
  section="Valuation"
  onError={(error, errorInfo) => {
    Sentry.captureException(error, { extra: errorInfo });
  }}
>
  <Valuation ticker={ticker} />
</ErrorBoundary>
```

#### With custom fallback UI

```tsx
<ErrorBoundary
  section="Charts"
  fallback={<div className="text-rain p-4">Charts temporarily unavailable</div>}
>
  <ChartComponent />
</ErrorBoundary>
```

### Props

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `children` | `React.ReactNode` | Yes | Components to protect |
| `section` | `string` | No | Label shown in error UI (e.g., "Dashboard") |
| `onError` | `(error, errorInfo) => void` | No | Callback for error reporting |
| `fallback` | `React.ReactNode` | No | Custom fallback UI |

### Where to Place Error Boundaries

Recommended placement strategy:

1. **Root level** (already exists in `index.tsx`) - catches fatal app crashes
2. **Around each lazy-loaded page** in `App.tsx` `renderPage()` - isolates page crashes
3. **Around heavy charting components** - Recharts can crash on bad data
4. **Around third-party integrations** - AI/Gemini features, Supabase auth

### How It Works

- Uses `getDerivedStateFromError` to set error state
- Uses `componentDidCatch` to log error details and fire the `onError` callback
- **Retry button**: Clears the error state and re-renders children
- **Reload button**: Full page reload as last resort

---

## Toast Notification System

### What It Does

Provides non-intrusive toast notifications for success, error, warning, and info messages. Toasts appear in the bottom-right corner with enter/exit animations and auto-dismiss after 5 seconds.

### Files

| File | Purpose |
|------|---------|
| `contexts/ToastContext.tsx` | State management, ToastProvider, useToast hook |
| `components/Toast.tsx` | Visual toast component with motion animations |

### Setup

The `ToastProvider` must wrap your app, and `ToastContainer` must be rendered:

```tsx
// In your root (e.g., index.tsx)
import { ToastProvider } from './contexts/ToastContext';
import ToastContainer from './components/Toast';

<ToastProvider>
  <App />
  <ToastContainer />
</ToastProvider>
```

### useToast() Hook API

```tsx
import { useToast } from '../contexts/ToastContext';

const MyComponent = () => {
  const { addToast, removeToast, clearAll } = useToast();

  // Success notification
  addToast({
    type: 'success',
    title: 'Portfolio saved successfully',
  });

  // Error with details
  addToast({
    type: 'error',
    title: 'Failed to fetch SEC data',
    message: 'EDGAR API returned 503 - try again later',
    duration: 8000, // 8 seconds instead of default 5
  });

  // Warning
  addToast({
    type: 'warning',
    title: 'Using cached data',
    message: 'Last updated 15 minutes ago',
  });

  // Info
  addToast({
    type: 'info',
    title: 'Live mode enabled',
  });

  // Persistent toast (duration: 0 = no auto-dismiss)
  const id = addToast({
    type: 'info',
    title: 'Processing...',
    duration: 0,
  });
  // Later: manually dismiss
  removeToast(id);

  // Clear all toasts
  clearAll();
};
```

### Toast Types

| Type | Color | Use Case |
|------|-------|----------|
| `success` | Green (#34d399) | Data saved, export complete, connection established |
| `error` | Red (#f87171) | API failures, data fetch errors, validation failures |
| `warning` | Pumpkin (#FF9D3C) | Stale data, rate limits approaching, deprecated features |
| `info` | LightBlue (#48A3CC) | Mode changes, background updates, informational messages |

### Features

- **Auto-dismiss**: 5 seconds default (configurable per toast via `duration`)
- **Progress bar**: Visual countdown showing remaining time
- **Click to dismiss**: Click anywhere on the toast to dismiss
- **Close button**: Explicit close button (X) in top-right
- **Animations**: Spring-based enter/exit animations using motion/react
- **Stacking**: Multiple toasts stack vertically in bottom-right corner
- **Accessibility**: Uses `role="alert"` and `aria-live="polite"`
