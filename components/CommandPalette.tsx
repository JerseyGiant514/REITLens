/**
 * CommandPalette.tsx
 * Ctrl+K command palette for quick navigation across pages and tickers.
 * Also shows keyboard shortcut help via Ctrl+? or F1.
 */

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Search, Command, ArrowRight, CornerDownLeft } from 'lucide-react';
import { useAppStore } from '../stores/useAppStore';
import { REITS } from '../services/mockData';
import { Page, Sector } from '../types';

interface PaletteItem {
  id: string;
  type: 'page' | 'ticker' | 'action';
  label: string;
  description: string;
  icon?: string;
  action: () => void;
}

const PAGE_LABELS: Record<Page, string> = {
  'dashboard': 'Dashboard',
  'valuation': 'Valuation Corridor',
  'operations': 'Operations',
  'balance-sheet': 'Balance Sheet',
  'sector-lens': 'Sector Lens',
  'macro': 'Macro & Rates',
  'watchlist': 'Watchlist',
  'data-guide': 'Data Dictionary',
  'return-decomposition': 'Return Decomposition',
  'portfolio-manager': 'Portfolio Architect',
  'justified-paffo': 'Justified P/AFFO',
  'relative-value': 'Relative Value',
  'nav-sensitivity': 'NAV Sensitivity',
  'analyst-memo': 'Variant Memo (AI)',
  'analyst-perspectives': 'Street Perspectives',
  'expert-knowledge': 'Expert Knowledge',
  'correlation-matrix': 'Correlation Matrix',
  'peer-comp': 'Peer Comp Table',
  'nav-model': 'NAV Model',
  'dividend-safety': 'Dividend Safety',
  'earnings-calendar': 'Earnings Calendar',
  'forward-affo': 'Forward AFFO',
  'debt-stress': 'Debt Stress Test',
  'mgmt-scorecard': 'Management Scorecard',
  'screener': 'Screener',
  'pnav-history': 'P/NAV History',
  'volatility': 'Vol & Drawdown',
  'tenant-lease': 'Tenant & Leasing',
  'geo-exposure': 'Geographic Exposure',
  'consensus': 'Consensus Estimates',
  'alerts': 'Alerts',
};

const CommandPalette: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const setActivePage = useAppStore((s) => s.setActivePage);
  const selectTicker = useAppStore((s) => s.selectTicker);

  // Build items list
  const allItems = useMemo<PaletteItem[]>(() => {
    const pages: PaletteItem[] = Object.entries(PAGE_LABELS).map(([value, label]) => ({
      id: `page-${value}`,
      type: 'page' as const,
      label,
      description: 'Navigate to page',
      action: () => {
        setActivePage(value as Page);
      },
    }));

    const tickers: PaletteItem[] = REITS.map((r) => ({
      id: `ticker-${r.ticker}`,
      type: 'ticker' as const,
      label: r.ticker,
      description: r.name,
      action: () => {
        selectTicker(r.ticker);
        setActivePage('dashboard');
      },
    }));

    return [...pages, ...tickers];
  }, [setActivePage, selectTicker]);

  // Filter items
  const filteredItems = useMemo(() => {
    if (!query.trim()) return allItems.slice(0, 12);
    const q = query.toLowerCase();
    return allItems
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.description.toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [query, allItems]);

  // Reset selection when items change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredItems.length]);

  // Global keyboard listener
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Ctrl+K or Cmd+K to open
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((v) => !v);
        setQuery('');
        setSelectedIndex(0);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const executeItem = useCallback(
    (item: PaletteItem) => {
      item.action();
      setIsOpen(false);
      setQuery('');
    },
    []
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filteredItems.length - 1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        break;
      case 'Enter':
        e.preventDefault();
        if (filteredItems[selectedIndex]) {
          executeItem(filteredItems[selectedIndex]);
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        break;
    }
  };

  // Scroll selected item into view
  useEffect(() => {
    if (listRef.current) {
      const selected = listRef.current.children[selectedIndex] as HTMLElement;
      selected?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[10000] flex items-start justify-center pt-[15vh]"
      onClick={() => setIsOpen(false)}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

      {/* Palette */}
      <div
        className="relative w-[560px] bg-[#0a1929] border border-rain/30 rounded-xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{ animation: 'page-fade-in 0.15s ease-out' }}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-rain/20">
          <Search size={16} className="text-rain/50 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages, tickers..."
            className="flex-1 bg-transparent text-sm text-white placeholder:text-rain/40 outline-none font-primary"
          />
          <kbd className="text-[9px] font-bold text-rain/40 bg-rain/10 px-1.5 py-0.5 rounded border border-rain/20">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="max-h-[340px] overflow-y-auto custom-scrollbar py-1">
          {filteredItems.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-rain/40 font-bold uppercase tracking-widest">
              No results found
            </div>
          ) : (
            filteredItems.map((item, index) => (
              <button
                key={item.id}
                onClick={() => executeItem(item)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  index === selectedIndex
                    ? 'bg-lightBlue/15 text-white'
                    : 'text-slate-300 hover:bg-white/5'
                }`}
              >
                <span
                  className={`text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded ${
                    item.type === 'page'
                      ? 'text-lightBlue bg-lightBlue/10'
                      : 'text-pumpkin bg-pumpkin/10'
                  }`}
                >
                  {item.type === 'page' ? 'PAGE' : 'REIT'}
                </span>
                <span className="text-xs font-bold flex-1 truncate">{item.label}</span>
                <span className="text-[10px] text-rain/50 truncate max-w-[180px]">
                  {item.description}
                </span>
                {index === selectedIndex && (
                  <CornerDownLeft size={12} className="text-rain/40 shrink-0" />
                )}
              </button>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-rain/20 bg-black/30">
          <div className="flex items-center gap-1.5 text-[9px] text-rain/40">
            <kbd className="bg-rain/10 px-1 py-0.5 rounded border border-rain/15 font-bold">↑↓</kbd>
            <span>Navigate</span>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] text-rain/40">
            <kbd className="bg-rain/10 px-1 py-0.5 rounded border border-rain/15 font-bold">↵</kbd>
            <span>Select</span>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] text-rain/40">
            <kbd className="bg-rain/10 px-1 py-0.5 rounded border border-rain/15 font-bold">←→</kbd>
            <span>Cycle Tickers</span>
          </div>
          <div className="flex items-center gap-1.5 text-[9px] text-rain/40 ml-auto">
            <kbd className="bg-rain/10 px-1 py-0.5 rounded border border-rain/15 font-bold">Ctrl+K</kbd>
            <span>Toggle</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CommandPalette;
