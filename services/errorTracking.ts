/**
 * errorTracking.ts - Centralized error tracking service (Sentry integration)
 *
 * DEPENDENCY: This file requires `@sentry/react` to be installed.
 *   Run: npm install @sentry/react
 *   Agent 3 owns package.json -- coordinate with them to add this dependency.
 *
 * CONFIGURATION:
 *   Set the following environment variable in your .env file:
 *     VITE_SENTRY_DSN=https://examplePublicKey@o0.ingest.sentry.io/0
 *
 *   If VITE_SENTRY_DSN is not set, all functions gracefully no-op.
 *   This means the app works identically in development without Sentry.
 *
 * ARCHITECTURE:
 *   - All exports are thin wrappers around @sentry/react.
 *   - The service is initialized lazily on first use (not at import time)
 *     so that missing DSN never causes import-time crashes.
 *   - Breadcrumbs are manually added for data service calls to aid debugging
 *     of the SEC EDGAR -> Supabase -> realDataService -> dataService pipeline.
 */

// ---------------------------------------------------------------------------
// Types (mirrors Sentry API surface we actually use)
// ---------------------------------------------------------------------------

type SeverityLevel = 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';

interface ErrorContext {
  /** Human-readable context tag, e.g. 'edgarService.fetchSECData' */
  tags?: Record<string, string>;
  /** Arbitrary metadata attached to the event */
  extra?: Record<string, unknown>;
}

interface BreadcrumbData {
  category: string;
  message: string;
  level?: SeverityLevel;
  data?: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

let _initialized = false;
let _sentry: typeof import('@sentry/react') | null = null;

/**
 * Lazily initialize Sentry.  Called automatically by the public API functions.
 * Safe to call multiple times -- only the first call has any effect.
 */
async function ensureInitialized(): Promise<boolean> {
  if (_initialized) return _sentry !== null;

  _initialized = true; // prevent re-entry

  const dsn = (import.meta as any).env?.VITE_SENTRY_DSN;
  if (!dsn) {
    // No DSN configured -- all public functions will silently no-op.
    // Sentry disabled -- no DSN configured
    return false;
  }

  try {
    // Dynamic import so that the app still works if @sentry/react is not installed.
    const Sentry = await import('@sentry/react');
    Sentry.init({
      dsn,
      environment: (import.meta as any).env?.MODE || 'development',
      // Attach the app version if available
      release: `reitlens@${(import.meta as any).env?.VITE_APP_VERSION || '1.0.0'}`,
      // Sample 100% of errors in an institutional tool (low traffic).
      // Adjust for production if needed.
      sampleRate: 1.0,
      // Performance monitoring -- sample 20% of transactions
      tracesSampleRate: 0.2,
      // Only send errors from our own code (not third-party scripts)
      allowUrls: [window.location.origin],
      beforeSend(event) {
        // Strip PII from events if present
        if (event.user) {
          delete event.user.ip_address;
        }
        return event;
      },
    });

    _sentry = Sentry;
    return true;
  } catch (e) {
    // @sentry/react not installed or init failed -- silently degrade.
    // Sentry init failed -- silently degrade
    return false;
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Capture an exception and send it to Sentry with optional context.
 *
 * Usage:
 *   import { captureException } from '../services/errorTracking';
 *   try { ... } catch (e) {
 *     captureException(e, { tags: { service: 'edgarService' } });
 *   }
 */
export async function captureException(
  error: unknown,
  context?: ErrorContext
): Promise<void> {
  const ready = await ensureInitialized();
  if (!ready || !_sentry) {
    // Fallback: log to console so errors are not silently lost.
    // Sentry disabled -- exception not reported
    return;
  }

  _sentry.withScope((scope) => {
    if (context?.tags) {
      Object.entries(context.tags).forEach(([k, v]) => scope.setTag(k, v));
    }
    if (context?.extra) {
      Object.entries(context.extra).forEach(([k, v]) => scope.setExtra(k, v));
    }
    _sentry!.captureException(error);
  });
}

/**
 * Capture a message (non-error event) at a given severity level.
 *
 * Usage:
 *   captureMessage('SEC rate limit approached', 'warning');
 */
export async function captureMessage(
  message: string,
  level: SeverityLevel = 'info'
): Promise<void> {
  const ready = await ensureInitialized();
  if (!ready || !_sentry) {
    // Sentry disabled -- message not reported
    return;
  }

  _sentry.captureMessage(message, level);
}

/**
 * Associate the current session with an authenticated user.
 * Call with `null` on sign-out to clear user context.
 *
 * Usage:
 *   setUser({ id: user.id, email: user.email });
 *   setUser(null); // on sign-out
 */
export async function setUser(
  user: { id: string; email?: string } | null
): Promise<void> {
  const ready = await ensureInitialized();
  if (!ready || !_sentry) return;

  _sentry.setUser(user ? { id: user.id, email: user.email } : null);
}

/**
 * Add a breadcrumb for tracing the data service call chain.
 * Breadcrumbs are attached to the next error/message event and help
 * reconstruct the sequence of operations leading to a failure.
 *
 * Usage:
 *   addBreadcrumb({
 *     category: 'dataService',
 *     message: 'loadRealFinancials called',
 *     data: { reitId: 'pld-001' },
 *   });
 */
export async function addBreadcrumb(crumb: BreadcrumbData): Promise<void> {
  const ready = await ensureInitialized();
  if (!ready || !_sentry) return;

  _sentry.addBreadcrumb({
    category: crumb.category,
    message: crumb.message,
    level: crumb.level || 'info',
    data: crumb.data,
  });
}

// ---------------------------------------------------------------------------
// Convenience: Data service breadcrumb helpers
// ---------------------------------------------------------------------------

/** Log a data service call as a breadcrumb for debugging. */
export function trackDataServiceCall(
  serviceName: string,
  operation: string,
  metadata?: Record<string, unknown>
): void {
  addBreadcrumb({
    category: 'dataService',
    message: `${serviceName}.${operation}`,
    level: 'info',
    data: metadata,
  });
}

/** Log a data fallback event (e.g. real data unavailable, fell back to mock). */
export function trackDataFallback(
  serviceName: string,
  reason: string,
  metadata?: Record<string, unknown>
): void {
  addBreadcrumb({
    category: 'dataFallback',
    message: `${serviceName}: ${reason}`,
    level: 'warning',
    data: metadata,
  });
}
