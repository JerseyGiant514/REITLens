import React, { useState, useCallback } from 'react';
import { RefreshCw, Minus, Square, X, Copy } from 'lucide-react';

declare global {
  interface Window {
    electronAPI?: {
      hardRefresh: () => void;
      minimize: () => void;
      maximize: () => void;
      close: () => void;
      isElectron: boolean;
    };
  }
}

const TitleBar: React.FC = () => {
  const [isSpinning, setIsSpinning] = useState(false);

  const handleRefresh = useCallback(() => {
    setIsSpinning(true);
    window.electronAPI?.hardRefresh();
    // Reset animation after spin completes
    setTimeout(() => setIsSpinning(false), 800);
  }, []);

  return (
    <div style={styles.titleBar}>
      {/* Draggable region */}
      <div style={styles.dragRegion}>
        {/* App branding */}
        <div style={styles.branding}>
          <div style={styles.logoMark}>R</div>
          <span style={styles.appName}>REITLENS</span>
          <span style={styles.badge}>TERMINAL</span>
        </div>
      </div>

      {/* Action buttons (non-draggable) */}
      <div style={styles.controls}>
        {/* Hard Refresh Button */}
        <button
          onClick={handleRefresh}
          style={styles.refreshButton}
          title="Hard Refresh (Ctrl+Shift+R)"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(72, 163, 204, 0.2)';
            e.currentTarget.style.borderColor = '#48A3CC';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'rgba(72, 163, 204, 0.08)';
            e.currentTarget.style.borderColor = 'rgba(72, 163, 204, 0.3)';
          }}
        >
          <RefreshCw
            size={13}
            style={{
              transition: 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
              transform: isSpinning ? 'rotate(360deg)' : 'rotate(0deg)',
            }}
          />
          <span style={styles.refreshLabel}>REFRESH</span>
        </button>

        {/* Separator */}
        <div style={styles.separator} />

        {/* Window Controls */}
        <button
          onClick={() => window.electronAPI?.minimize()}
          style={styles.windowButton}
          title="Minimize"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <Minus size={14} />
        </button>

        <button
          onClick={() => window.electronAPI?.maximize()}
          style={styles.windowButton}
          title="Maximize / Restore"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <Copy size={12} style={{ transform: 'rotate(180deg)' }} />
        </button>

        <button
          onClick={() => window.electronAPI?.close()}
          style={{ ...styles.windowButton, ...styles.closeButton }}
          title="Close"
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#e81123';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent';
          }}
        >
          <X size={14} />
        </button>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  titleBar: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    height: 38,
    zIndex: 9999,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'linear-gradient(180deg, rgba(2, 20, 40, 0.98) 0%, rgba(1, 4, 9, 0.95) 100%)',
    borderBottom: '1px solid rgba(72, 163, 204, 0.15)',
    userSelect: 'none',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
  },
  dragRegion: {
    flex: 1,
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    paddingLeft: 12,
    // @ts-expect-error -- Electron-specific CSS property
    WebkitAppRegion: 'drag',
  },
  branding: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  logoMark: {
    width: 22,
    height: 22,
    borderRadius: 4,
    background: 'linear-gradient(135deg, #48A3CC 0%, #022D5B 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 800,
    color: '#fff',
    letterSpacing: -0.5,
    fontFamily: "'Playfair Display', serif",
  },
  appName: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: 2.5,
    color: '#e2e8f0',
  },
  badge: {
    fontSize: 8,
    fontWeight: 600,
    letterSpacing: 1.5,
    color: '#FF9D3C',
    background: 'rgba(255, 157, 60, 0.1)',
    border: '1px solid rgba(255, 157, 60, 0.25)',
    padding: '2px 6px',
    borderRadius: 3,
  },
  controls: {
    display: 'flex',
    alignItems: 'center',
    height: '100%',
    // @ts-expect-error -- Electron-specific CSS property
    WebkitAppRegion: 'no-drag',
  },
  refreshButton: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    height: 26,
    padding: '0 10px',
    marginRight: 8,
    border: '1px solid rgba(72, 163, 204, 0.3)',
    borderRadius: 4,
    background: 'rgba(72, 163, 204, 0.08)',
    color: '#48A3CC',
    cursor: 'pointer',
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 1,
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    transition: 'all 0.2s ease',
  },
  refreshLabel: {
    marginTop: 1,
  },
  separator: {
    width: 1,
    height: 20,
    background: 'rgba(95, 154, 174, 0.2)',
    marginRight: 4,
  },
  windowButton: {
    width: 40,
    height: 38,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: 'transparent',
    color: '#94a3b8',
    cursor: 'pointer',
    transition: 'background 0.15s ease',
  },
  closeButton: {
    color: '#94a3b8',
  },
};

export default TitleBar;
