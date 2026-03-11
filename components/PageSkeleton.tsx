import React from 'react';

/**
 * PageSkeleton - Shimmer loading skeleton for lazy-loaded pages.
 * Matches the dark institutional theme (obsidian bg, lightBlue accent).
 */
const PageSkeleton: React.FC = () => (
  <>
    <style>{`
      @keyframes aegis-shimmer {
        0% { background-position: -400px 0; }
        100% { background-position: 400px 0; }
      }
      .aegis-skeleton-bar {
        background: linear-gradient(
          90deg,
          rgba(72, 163, 204, 0.06) 0%,
          rgba(72, 163, 204, 0.14) 40%,
          rgba(72, 163, 204, 0.06) 80%
        );
        background-size: 800px 100%;
        animation: aegis-shimmer 1.6s ease-in-out infinite;
        border-radius: 8px;
      }
    `}</style>
    <div
      style={{
        background: '#010409',
        minHeight: '100%',
        padding: '32px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      }}
    >
      {/* Header skeleton */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div
          className="aegis-skeleton-bar"
          style={{ width: '220px', height: '28px' }}
        />
        <div
          className="aegis-skeleton-bar"
          style={{ width: '120px', height: '20px', opacity: 0.6 }}
        />
      </div>

      {/* Stat cards row */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {[180, 200, 160, 190].map((w, i) => (
          <div
            key={i}
            style={{
              flex: '1 1 200px',
              border: '1px solid rgba(95, 154, 174, 0.15)',
              borderRadius: '12px',
              padding: '20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              background: 'rgba(2, 45, 91, 0.18)',
            }}
          >
            <div
              className="aegis-skeleton-bar"
              style={{ width: `${w * 0.5}px`, height: '12px', opacity: 0.5 }}
            />
            <div
              className="aegis-skeleton-bar"
              style={{ width: `${w}px`, maxWidth: '100%', height: '24px' }}
            />
          </div>
        ))}
      </div>

      {/* Main content area */}
      <div
        style={{
          border: '1px solid rgba(95, 154, 174, 0.15)',
          borderRadius: '12px',
          padding: '24px',
          background: 'rgba(2, 45, 91, 0.12)',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}
      >
        <div
          className="aegis-skeleton-bar"
          style={{ width: '160px', height: '16px', opacity: 0.5 }}
        />
        <div
          className="aegis-skeleton-bar"
          style={{ width: '100%', height: '180px' }}
        />
      </div>

      {/* Secondary row */}
      <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
        {[1, 2].map((_, i) => (
          <div
            key={i}
            style={{
              flex: '1 1 300px',
              border: '1px solid rgba(95, 154, 174, 0.15)',
              borderRadius: '12px',
              padding: '20px',
              background: 'rgba(2, 45, 91, 0.12)',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <div
              className="aegis-skeleton-bar"
              style={{ width: '140px', height: '14px', opacity: 0.5 }}
            />
            <div
              className="aegis-skeleton-bar"
              style={{ width: '100%', height: '100px' }}
            />
          </div>
        ))}
      </div>
    </div>
  </>
);

export default PageSkeleton;
