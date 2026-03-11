# REITLens V1.0 -- Architecture & Migration Guide

This document covers the new Zustand state management layer, the DataSourceBadge component, and the Sentry error tracking setup introduced in the institutional upgrade.

---

## 1. Zustand State Management

### 1.1 Overview

The application previously stored all state in `App.tsx` via `useState` and passed it down as props through `Layout.tsx` into child components. This caused two problems:

1. **Full re-renders**: Any slider change in JustifiedPAFFO would call `setStrategicModel` on App.tsx, which re-rendered the entire component tree including Layout, Dashboard, etc.
2. **Prop drilling**: State like `activePage`, `selectedTicker`, and `portfolios` had to pass through Layout into every child, even when Layout only needed some of it for the header.

Zustand stores solve both issues by enabling granular subscriptions and direct store access from any component.

### 1.2 Store Structure

Three stores were created in the `stores/` directory:

| Store | File | State Managed |
|-------|------|---------------|
| **useAppStore** | `stores/useAppStore.ts` | `activePage`, `selectedTicker`, `selectedSector`, `isLiveMode`, `isLoading`, `liveFinancials` |
| **usePortfolioStore** | `stores/usePortfolioStore.ts` | `portfolios[]`, `selectedPortfolioId`, CRUD operations (load/save/delete with Supabase persistence) |
| **useStrategicModelStore** | `stores/useStrategicModelStore.ts` | `wacc` params (rf, erp, beta, payout), `growth` params (ss, acqVol, acqSpread, devVol, devSpread, leakage, cap) |

### 1.3 Auth Context

Authentication state (`user`, `signOut`) remains in `contexts/AuthContext.tsx` as a React Context. This is intentional:
- Auth state rarely changes (sign-in/sign-out)
- The AuthProvider wraps the entire app and Supabase session management benefits from React lifecycle hooks
- Zustand stores accept `userId` as a parameter when they need it (e.g. `savePortfolio(portfolio, userId)`)

### 1.4 Current Migration Status (Phase 1 -- Complete)

**App.tsx** has been refactored to use all three Zustand stores. However, it still:
- Reads store state and passes it down as props to child components
- Bridges cross-store operations (e.g. selecting a portfolio also clears ticker/sector in useAppStore)

This is the **transitional architecture** -- child components receive the same props they always have, but the source is now Zustand instead of `useState`.

### 1.5 Component Migration Plan (Phase 2 -- Pending)

The following components should be migrated to consume Zustand stores directly, eliminating prop drilling entirely:

| Component | Props to Remove | Store to Use |
|-----------|----------------|--------------|
| **Layout.tsx** | `activePage`, `setActivePage`, `selectedTicker`, `setSelectedTicker`, `selectedSector`, `setSelectedSector`, `selectedPortfolioId`, `setSelectedPortfolioId`, `portfolios`, `isLiveMode`, `setIsLiveMode` | `useAppStore`, `usePortfolioStore` |
| **JustifiedPAFFO.tsx** | `model`, `onUpdateModel` | `useStrategicModelStore` (biggest performance win -- eliminates re-render cascade from slider changes) |
| **Valuation.tsx** | `strategicModel` | `useStrategicModelStore` |
| **ReturnDecomposition.tsx** | `strategicModel` | `useStrategicModelStore` |
| **AnalystMemo.tsx** | `model` | `useStrategicModelStore` |
| **Dashboard.tsx** | `ticker`, `sector`, `portfolio`, `liveFinancials` | `useAppStore`, `usePortfolioStore` |
| **Operations.tsx** | `ticker`, `sector`, `portfolio` | `useAppStore`, `usePortfolioStore` |
| **BalanceSheet.tsx** | `ticker`, `sector`, `portfolio` | `useAppStore`, `usePortfolioStore` |
| **RelativeValue.tsx** | `ticker`, `sector`, `portfolio` | `useAppStore`, `usePortfolioStore` |
| **NAVSensitivity.tsx** | `ticker` | `useAppStore` |
| **AnalystPerspectives.tsx** | `ticker` | `useAppStore` |
| **PortfolioManager.tsx** | `portfolios`, `onSave`, `onDelete` | `usePortfolioStore` |

Components that take **no props** (SectorLens, Macro, Watchlist, DataGuide, ExpertKnowledge) require no migration.

### 1.6 Usage Examples

```tsx
// Direct store access (after Phase 2 migration)
import { useAppStore } from '../stores/useAppStore';
import { useStrategicModelStore } from '../stores/useStrategicModelStore';

const MyComponent = () => {
  // Granular subscription -- only re-renders when selectedTicker changes
  const ticker = useAppStore((s) => s.selectedTicker);

  // Granular subscription -- only re-renders when wacc.rf changes
  const rf = useStrategicModelStore((s) => s.wacc.rf);
  const updateWacc = useStrategicModelStore((s) => s.updateWacc);

  return <input value={rf} onChange={(e) => updateWacc('rf', Number(e.target.value))} />;
};
```

### 1.7 Backward Compatibility

The `StrategicModelState` type is re-exported from `App.tsx`:
```tsx
export type { StrategicModelState } from './stores/useStrategicModelStore';
```
This ensures that existing imports like `import { StrategicModelState } from '../App'` continue to work in Valuation, JustifiedPAFFO, ReturnDecomposition, and AnalystMemo without modification.

---

## 2. DataSourceBadge Component

### 2.1 Overview

`components/DataSourceBadge.tsx` is a compact inline badge that communicates data provenance to users. It shows a colored dot and a label, with a tooltip on hover explaining the source.

### 2.2 Source Types

| Source | Dot Color | Label | When to Use |
|--------|-----------|-------|-------------|
| `SEC` | Green (#10b981) | Verified | Data from SEC EDGAR XBRL filings |
| `Yahoo` | Green (#10b981) | Verified | Market data from Yahoo Finance |
| `Computed` | Gold (#d4af37) | Derived | Values calculated from verified inputs (implied cap rate, justified P/AFFO) |
| `Mock` | Red (#f43f5e) | Estimated | Synthetic/mock data from `mockData.ts` generators |
| `AI` | Blue (#48A3CC) | AI-Generated | Content from LLM (Gemini) -- AnalystMemo, AnalystPerspectives |

### 2.3 Placement Recommendations

| Component | Where to Place Badge | Source Value |
|-----------|---------------------|-------------|
| **Dashboard** KPI cards | Next to each KPI label | `SEC` if `aggregatedData.isLive`, otherwise `Mock` |
| **Dashboard** chart headers | After subtitle text "EOD Adjusted Close" | `Yahoo` if live performance data, otherwise `Mock` |
| **Valuation** metrics (P/FFO, Cap Rate, etc.) | Next to each metric label | `Computed` (derived from verified inputs) |
| **Valuation** NAV Proxy Corridor chart | In chart header area | `Computed` |
| **JustifiedPAFFO** justified multiple | Below the large multiple display | `Computed` |
| **Operations** KPIs (Occupancy, Leasing Spread) | Next to each KPI label | `Mock` (until REIT-specific supplemental data is available) |
| **BalanceSheet** debt metrics | Next to each KPI label | `SEC` if data from EDGAR cache, otherwise `Mock` |
| **ReturnDecomposition** bars | In chart header | `Computed` (forward) or `Yahoo` (historical) |
| **Watchlist** table prices | In table header | `Mock` |
| **AnalystMemo** generated text | At top of memo output | `AI` |
| **AnalystPerspectives** ratings | At top of ratings panel | `AI` |
| **SectorLens** sector metrics | Per sector card | `Mock` |
| **Macro** rate data | Chart headers | `Mock` (until FRED integration is live) |

### 2.4 Usage

```tsx
import { DataSourceBadge } from './DataSourceBadge';

// Basic
<DataSourceBadge source="SEC" />

// With explicit confidence override
<DataSourceBadge source="Computed" confidence="high" />

// With custom positioning class
<DataSourceBadge source="Mock" className="ml-2" />
```

### 2.5 Accessibility

The badge includes:
- `role="status"` for screen reader announcement
- `aria-label` with full source, label, and confidence text
- `tabIndex={0}` for keyboard focusability
- `onFocus`/`onBlur` handlers for tooltip display via keyboard

---

## 3. Error Tracking (Sentry)

### 3.1 Overview

`services/errorTracking.ts` provides a centralized error tracking service that wraps `@sentry/react`. It is designed to gracefully no-op when Sentry is not configured.

### 3.2 Configuration

Add the following to your `.env` file:

```
VITE_SENTRY_DSN=https://<your-public-key>@o<org-id>.ingest.sentry.io/<project-id>
```

If `VITE_SENTRY_DSN` is not set, all error tracking functions silently fall back to `console.error` / `console.warn`. The application runs identically without Sentry.

### 3.3 API

| Function | Purpose |
|----------|---------|
| `captureException(error, context?)` | Send an error to Sentry with optional tags/extra data |
| `captureMessage(message, level?)` | Send a non-error message at a given severity level |
| `setUser(user?)` | Associate the current session with an authenticated user |
| `addBreadcrumb(crumb)` | Add a breadcrumb for debugging the event trail |
| `trackDataServiceCall(service, operation, meta?)` | Convenience: log a data service call as a breadcrumb |
| `trackDataFallback(service, reason, meta?)` | Convenience: log a data fallback event as a breadcrumb |

### 3.4 Integration Points

The error tracking service should be integrated at these points (not yet done -- requires coordinating with other agents):

1. **AuthContext.tsx**: Call `setUser()` on sign-in and `setUser(null)` on sign-out.
2. **dataService.ts**: Wrap `loadRealFinancials` and `getMarketData` catch blocks with `captureException`.
3. **edgarService.ts**: Use `trackDataServiceCall` before each SEC fetch, and `captureException` on failures.
4. **realDataService.ts**: Use `trackDataFallback` when falling back from DB data to mock.
5. **App.tsx**: Wrap the Suspense fallback with Sentry's `ErrorBoundary` component.

### 3.5 Architecture Notes

- **Lazy initialization**: Sentry is initialized on first use of any public function, not at import time. This prevents crashes if the SDK is missing.
- **Dynamic import**: The `@sentry/react` package is loaded via `await import(...)` so the app works even if the package is not installed.
- **PII handling**: The `beforeSend` hook strips IP addresses from events.

---

## 4. Dependencies to Add

The following packages need to be added to `package.json` by Agent 3:

| Package | Version | Purpose |
|---------|---------|---------|
| `zustand` | `^4.5.0` or `^5.0.0` | State management for stores |
| `@sentry/react` | `^8.0.0` | Error tracking and performance monitoring |

Both are used via dynamic imports, so the app will not crash if they are not yet installed -- but features will be degraded:
- Without `zustand`: Store files will fail to import (app will not start)
- Without `@sentry/react`: Error tracking silently no-ops (app works normally)

---

## 5. File Inventory

### New Files Created

| File | Owner | Purpose |
|------|-------|---------|
| `stores/useAppStore.ts` | Architecture Agent | Navigation, selection, live mode state |
| `stores/usePortfolioStore.ts` | Architecture Agent | Portfolio CRUD with Supabase persistence |
| `stores/useStrategicModelStore.ts` | Architecture Agent | WACC + Growth model parameters |
| `components/DataSourceBadge.tsx` | Architecture Agent | Data provenance badge component |
| `services/errorTracking.ts` | Architecture Agent | Sentry error tracking service |
| `ARCHITECTURE.md` | Architecture Agent | This document |
| `ACCESSIBILITY_AUDIT.md` | Architecture Agent | Accessibility audit results |

### Modified Files

| File | Changes |
|------|---------|
| `App.tsx` | Refactored to use Zustand stores; removed all `useState` calls; re-exports `StrategicModelState` from store |
| `components/Layout.tsx` | Added ARIA attributes to SearchableSelect (combobox pattern), navigation, live mode toggle, main content area; added keyboard navigation (Arrow keys, Enter, Escape, Home, End) |
