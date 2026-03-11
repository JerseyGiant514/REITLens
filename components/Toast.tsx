import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../contexts/ToastContext';
import type { Toast as ToastType, ToastType as ToastVariant } from '../contexts/ToastContext';

// ============================================================
// Toast Icons (inline SVG to avoid extra dependencies)
// ============================================================

const icons: Record<ToastVariant, React.ReactNode> = {
  success: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#34d399" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  error: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
  warning: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FF9D3C" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  info: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#48A3CC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" />
      <line x1="12" y1="16" x2="12" y2="12" />
      <line x1="12" y1="8" x2="12.01" y2="8" />
    </svg>
  ),
};

// ============================================================
// Toast Styling (matches REITLens dark theme)
// ============================================================

const borderColors: Record<ToastVariant, string> = {
  success: 'rgba(52, 211, 153, 0.4)',
  error: 'rgba(248, 113, 113, 0.4)',
  warning: 'rgba(255, 157, 60, 0.4)',
  info: 'rgba(72, 163, 204, 0.4)',
};

const accentColors: Record<ToastVariant, string> = {
  success: '#34d399',
  error: '#f87171',
  warning: '#FF9D3C',
  info: '#48A3CC',
};

const bgGradients: Record<ToastVariant, string> = {
  success: 'linear-gradient(135deg, rgba(2, 45, 91, 0.85) 0%, rgba(6, 78, 59, 0.3) 100%)',
  error: 'linear-gradient(135deg, rgba(2, 45, 91, 0.85) 0%, rgba(127, 29, 29, 0.3) 100%)',
  warning: 'linear-gradient(135deg, rgba(2, 45, 91, 0.85) 0%, rgba(120, 53, 15, 0.3) 100%)',
  info: 'linear-gradient(135deg, rgba(2, 45, 91, 0.85) 0%, rgba(1, 4, 9, 0.85) 100%)',
};

// ============================================================
// Individual Toast Item
// ============================================================

interface ToastItemProps {
  toast: ToastType;
  onDismiss: (id: string) => void;
}

const ToastItem: React.FC<ToastItemProps> = ({ toast, onDismiss }) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, x: 80, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 80, scale: 0.95 }}
      transition={{
        type: 'spring',
        stiffness: 400,
        damping: 30,
        mass: 0.8,
      }}
      style={{
        background: bgGradients[toast.type],
        border: `1px solid ${borderColors[toast.type]}`,
        borderRadius: '10px',
        padding: '14px 16px',
        minWidth: '300px',
        maxWidth: '420px',
        backdropFilter: 'blur(24px)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        fontFamily: '"Plus Jakarta Sans", sans-serif',
        cursor: 'pointer',
        position: 'relative',
        overflow: 'hidden',
      }}
      onClick={() => onDismiss(toast.id)}
      role="alert"
      aria-live="polite"
    >
      {/* Accent stripe on the left */}
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          bottom: 0,
          width: '3px',
          background: accentColors[toast.type],
          borderRadius: '10px 0 0 10px',
        }}
      />

      {/* Icon */}
      <div
        style={{
          flexShrink: 0,
          marginTop: '1px',
          marginLeft: '4px',
        }}
      >
        {icons[toast.type]}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p
          style={{
            color: '#f1f5f9',
            fontSize: '13px',
            fontWeight: 600,
            margin: 0,
            lineHeight: 1.4,
          }}
        >
          {toast.title}
        </p>
        {toast.message && (
          <p
            style={{
              color: '#94a3b8',
              fontSize: '12px',
              fontWeight: 400,
              margin: '4px 0 0',
              lineHeight: 1.4,
            }}
          >
            {toast.message}
          </p>
        )}
      </div>

      {/* Close button */}
      <button
        onClick={e => {
          e.stopPropagation();
          onDismiss(toast.id);
        }}
        style={{
          flexShrink: 0,
          background: 'none',
          border: 'none',
          color: '#64748b',
          cursor: 'pointer',
          padding: '2px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '4px',
          transition: 'color 0.15s ease',
        }}
        onMouseOver={e => {
          (e.currentTarget as HTMLButtonElement).style.color = '#f1f5f9';
        }}
        onMouseOut={e => {
          (e.currentTarget as HTMLButtonElement).style.color = '#64748b';
        }}
        aria-label="Dismiss notification"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* Auto-dismiss progress bar */}
      {toast.duration && toast.duration > 0 && (
        <motion.div
          initial={{ scaleX: 1 }}
          animate={{ scaleX: 0 }}
          transition={{
            duration: toast.duration / 1000,
            ease: 'linear',
          }}
          style={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            height: '2px',
            background: accentColors[toast.type],
            transformOrigin: 'left',
            opacity: 0.6,
          }}
        />
      )}
    </motion.div>
  );
};

// ============================================================
// Toast Container (renders in bottom-right corner)
// ============================================================

const ToastContainer: React.FC = () => {
  const { toasts, removeToast } = useToast();

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'none',
      }}
    >
      <AnimatePresence mode="popLayout">
        {toasts.map(toast => (
          <div key={toast.id} style={{ pointerEvents: 'auto' }}>
            <ToastItem toast={toast} onDismiss={removeToast} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
};

export default ToastContainer;
