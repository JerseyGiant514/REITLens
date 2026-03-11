import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

// ============================================================
// Types
// ============================================================

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
  duration?: number; // ms, defaults to 5000
}

export interface ToastContextType {
  toasts: Toast[];
  addToast: (toast: Omit<Toast, 'id'>) => string;
  removeToast: (id: string) => void;
  clearAll: () => void;
}

// ============================================================
// Context
// ============================================================

const ToastContext = createContext<ToastContextType | undefined>(undefined);

// ============================================================
// Provider
// ============================================================

let toastCounter = 0;

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const removeToast = useCallback((id: string) => {
    // Clear the auto-dismiss timer if it exists
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const addToast = useCallback(
    (toast: Omit<Toast, 'id'>): string => {
      const id = `toast-${++toastCounter}-${Date.now()}`;
      const duration = toast.duration ?? 5000;

      const newToast: Toast = { ...toast, id, duration };
      setToasts(prev => [...prev, newToast]);

      // Auto-dismiss after duration
      if (duration > 0) {
        const timer = setTimeout(() => {
          removeToast(id);
        }, duration);
        timersRef.current.set(id, timer);
      }

      return id;
    },
    [removeToast]
  );

  const clearAll = useCallback(() => {
    // Clear all timers
    timersRef.current.forEach(timer => clearTimeout(timer));
    timersRef.current.clear();
    setToasts([]);
  }, []);

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast, clearAll }}>
      {children}
    </ToastContext.Provider>
  );
};

// ============================================================
// Hook
// ============================================================

/**
 * useToast hook - Access the toast notification system.
 *
 * Usage:
 *   const { addToast, removeToast, clearAll } = useToast();
 *
 *   // Show a success toast
 *   addToast({ type: 'success', title: 'Data saved' });
 *
 *   // Show an error toast with details
 *   addToast({
 *     type: 'error',
 *     title: 'Failed to fetch data',
 *     message: 'SEC EDGAR API returned a 503 error',
 *     duration: 8000, // 8 seconds
 *   });
 *
 *   // Show a warning toast
 *   addToast({ type: 'warning', title: 'Using cached data (stale)' });
 *
 *   // Show an info toast
 *   addToast({ type: 'info', title: 'Live mode enabled' });
 *
 *   // Manually dismiss
 *   const id = addToast({ type: 'info', title: 'Processing...' });
 *   removeToast(id);
 *
 *   // Clear all toasts
 *   clearAll();
 */
export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export default ToastContext;
