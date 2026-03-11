
import React, { useState, useEffect, useRef } from 'react';
import { Page, Sector, Portfolio } from '../types';
import { REITS } from '../services/mockData';
import { useAuth } from '../contexts/AuthContext';
import AuthModal from './AuthModal';

interface NavItem {
  label: string;
  value: Page;
  icon: string;
}

interface NavCategory {
  category: string;
  items: NavItem[];
}

interface LayoutProps {
  children: React.ReactNode;
  activePage: Page;
  setActivePage: (p: Page) => void;
  selectedTicker: string | null;
  setSelectedTicker: (t: string) => void;
  selectedSector: Sector | null;
  setSelectedSector: (s: Sector | 'all') => void;
  selectedPortfolioId: string | null;
  setSelectedPortfolioId: (id: string | 'none') => void;
  portfolios: Portfolio[];
  isLiveMode: boolean;
  setIsLiveMode: (v: boolean) => void;
}

const SearchableSelect = ({
  options,
  value,
  onChange,
  label,
  placeholder,
  accentColor = "lightBlue"
}: {
  options: { value: string, label: string, sub?: string }[],
  value: string,
  onChange: (val: string) => void,
  label: string,
  placeholder: string,
  accentColor?: "gold" | "lightBlue" | "emerald" | "pumpkin"
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = `listbox-${label.toLowerCase().replace(/\s+/g, '-')}`;
  const labelId = `label-${label.toLowerCase().replace(/\s+/g, '-')}`;

  const filteredOptions = options.filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (opt.sub && opt.sub.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset highlighted index when filtered options change
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [searchTerm]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
      case ' ':
        if (!isOpen) {
          e.preventDefault();
          setIsOpen(true);
        } else if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
          e.preventDefault();
          onChange(filteredOptions[highlightedIndex].value);
          setIsOpen(false);
          setSearchTerm("");
        }
        break;
      case 'Escape':
        e.preventDefault();
        setIsOpen(false);
        setSearchTerm("");
        break;
      case 'ArrowDown':
        e.preventDefault();
        if (!isOpen) {
          setIsOpen(true);
        } else {
          setHighlightedIndex(prev =>
            prev < filteredOptions.length - 1 ? prev + 1 : 0
          );
        }
        break;
      case 'ArrowUp':
        e.preventDefault();
        if (isOpen) {
          setHighlightedIndex(prev =>
            prev > 0 ? prev - 1 : filteredOptions.length - 1
          );
        }
        break;
      case 'Home':
        if (isOpen) {
          e.preventDefault();
          setHighlightedIndex(0);
        }
        break;
      case 'End':
        if (isOpen) {
          e.preventDefault();
          setHighlightedIndex(filteredOptions.length - 1);
        }
        break;
    }
  };

  const selectedOption = options.find(o => o.value === value);

  return (
    <div className="flex flex-col gap-0.5 min-w-[140px] md:min-w-[160px] relative font-primary" ref={containerRef}>
      <span
        id={labelId}
        className={`text-[9px] font-bold uppercase tracking-[0.15em] ml-1 ${accentColor === 'gold' ? 'text-gold' : accentColor === 'emerald' ? 'text-emerald-400' : accentColor === 'pumpkin' ? 'text-pumpkin' : 'text-lightBlue'
        }`}
      >
        {label}
      </span>
      <div
        role="combobox"
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-owns={listboxId}
        aria-labelledby={labelId}
        aria-activedescendant={highlightedIndex >= 0 ? `${listboxId}-option-${highlightedIndex}` : undefined}
        tabIndex={0}
        onClick={() => setIsOpen(!isOpen)}
        onKeyDown={handleKeyDown}
        className={`flex items-center justify-between bg-darkBlue/40 border px-3 py-1.5 rounded transition-all group ${isOpen ? 'border-lightBlue/60 ring-1 ring-lightBlue/20 bg-darkBlue/60 shadow-lg' : 'border-rain/20 hover:border-rain/50 hover:bg-darkBlue/50'
          }`}
      >
        <div className="flex items-baseline gap-2 truncate">
          <span className="text-xs font-bold text-white tracking-wide">
            {selectedOption?.label || placeholder}
          </span>
          {selectedOption?.sub && (
            <span className="text-[9px] font-medium text-rain uppercase truncate opacity-70">
              {selectedOption.sub}
            </span>
          )}
        </div>
        <svg className={`w-3 h-3 text-rain transition-transform duration-300 ${isOpen ? 'rotate-180 text-lightBlue' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isOpen && (
        <div className="absolute top-[calc(100%+4px)] left-0 right-0 bg-darkBlue border border-rain/30 rounded shadow-[0_20px_60px_rgba(0,0,0,0.8)] z-[100] overflow-hidden backdrop-blur-3xl animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="p-2 border-b border-rain/20 bg-black/20">
            <input
              autoFocus
              type="text"
              role="searchbox"
              aria-label={`Search ${label} options`}
              placeholder={`Search...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              className="w-full bg-darkBlue/40 text-[11px] font-medium text-white px-3 py-2 rounded-sm border border-rain/20 focus:border-lightBlue outline-none placeholder:text-rain/40"
            />
          </div>
          <ul
            id={listboxId}
            role="listbox"
            aria-labelledby={labelId}
            className="h-64 overflow-y-auto custom-scrollbar"
          >
            {filteredOptions.length > 0 ? (
              filteredOptions.map((opt, index) => (
                <li
                  key={opt.value}
                  id={`${listboxId}-option-${index}`}
                  role="option"
                  aria-selected={value === opt.value}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearchTerm("");
                  }}
                  className={`px-4 py-2.5 cursor-pointer transition-all hover:bg-lightBlue/10 flex flex-col group/opt ${value === opt.value ? 'bg-lightBlue/5 border-l-4 border-l-lightBlue' : 'border-l-4 border-l-transparent'
                    } ${highlightedIndex === index ? 'bg-lightBlue/15 outline outline-1 outline-lightBlue/40' : ''}`}
                >
                  <span className={`text-[11px] font-bold ${value === opt.value ? 'text-lightBlue' : 'text-slate-300 group-hover/opt:text-white'}`}>
                    {opt.label}
                  </span>
                  {opt.sub && <span className="text-[9px] font-medium text-rain uppercase mt-0.5">{opt.sub}</span>}
                </li>
              ))
            ) : (
              <li className="px-4 py-6 text-center text-[10px] font-bold text-rain uppercase tracking-widest italic" aria-live="polite">No Results</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

const isElectron = typeof window !== 'undefined' && !!(window as { electronAPI?: unknown }).electronAPI;
const TITLEBAR_HEIGHT = isElectron ? 38 : 0;

const Layout: React.FC<LayoutProps> = ({
  children,
  activePage,
  setActivePage,
  selectedTicker,
  setSelectedTicker,
  selectedSector,
  setSelectedSector,
  selectedPortfolioId,
  setSelectedPortfolioId,
  portfolios,
  isLiveMode,
  setIsLiveMode
}) => {
  const { user, signOut } = useAuth();
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [collapsedCategories, setCollapsedCategories] = useState<Set<number>>(new Set());

  const toggleCategory = (idx: number) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  // Auto-expand the category containing the active page
  useEffect(() => {
    const activeIdx = navCategories.findIndex((cat) =>
      cat.items.some((item) => item.value === activePage)
    );
    if (activeIdx >= 0 && collapsedCategories.has(activeIdx)) {
      setCollapsedCategories((prev) => {
        const next = new Set(prev);
        next.delete(activeIdx);
        return next;
      });
    }
  }, [activePage]); // eslint-disable-line react-hooks/exhaustive-deps

  const navCategories: NavCategory[] = [
    {
      category: "Overview",
      items: [
        { label: 'DASHBOARD', value: 'dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6' },
      ]
    },
    {
      category: "Valuation & Forward Returns",
      items: [
        { label: 'VALUATION CORRIDOR', value: 'valuation', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
        { label: 'JUSTIFIED P/AFFO', value: 'justified-paffo', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
        { label: 'RELATIVE VALUE', value: 'relative-value', icon: 'M16 8v8m-4-5v5m-4-2v2m-2 4h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z' },
        { label: 'NAV MODEL', value: 'nav-model', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4' },
        { label: 'P/NAV HISTORY', value: 'pnav-history', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6' },
        { label: 'NAV SENSITIVITY', value: 'nav-sensitivity', icon: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
        { label: 'FORWARD AFFO', value: 'forward-affo', icon: 'M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
        { label: 'CONSENSUS EST.', value: 'consensus', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z' },
        { label: 'RETURN DECOMP.', value: 'return-decomposition', icon: 'M11 3.055A9.001 9.001 0 1020.945 13H11V3.055z M20.488 9H15V3.512A9.025 9.025 0 0120.488 9z' },
      ]
    },
    {
      category: "Operating Metrics",
      items: [
        { label: 'OPERATIONS', value: 'operations', icon: 'M13 10V3L4 14h7v7l9-11h-7z' },
        { label: 'PEER COMP TABLE', value: 'peer-comp', icon: 'M3 10h18M3 14h18M3 18h18M3 6h18' },
        { label: 'MGMT SCORECARD', value: 'mgmt-scorecard', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4' },
        { label: 'TENANT & LEASING', value: 'tenant-lease', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z' },
        { label: 'GEO EXPOSURE', value: 'geo-exposure', icon: 'M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
        { label: 'SECTOR LENS', value: 'sector-lens', icon: 'M4 6h16M4 10h16M4 14h16M4 18h16' },
      ]
    },
    {
      category: "Research & Context",
      items: [
        { label: 'STREET PERSPECTIVES', value: 'analyst-perspectives', icon: 'M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.175 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.382-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z' },
        { label: 'VARIANT MEMO (AI)', value: 'analyst-memo', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z' },
        { label: 'EXPERT KNOWLEDGE', value: 'expert-knowledge', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
      ]
    },
    {
      category: "Risk & Macro",
      items: [
        { label: 'BALANCE SHEET', value: 'balance-sheet', icon: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z' },
        { label: 'DIVIDEND SAFETY', value: 'dividend-safety', icon: 'M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z' },
        { label: 'DEBT STRESS TEST', value: 'debt-stress', icon: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z' },
        { label: 'VOL & DRAWDOWN', value: 'volatility', icon: 'M13 17h8m0 0V9m0 8l-8-8-4 4-6-6' },
        { label: 'MACRO & RATES', value: 'macro', icon: 'M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z' },
      ]
    },
    {
      category: "Portfolio & System",
      items: [
        { label: 'ALERTS', value: 'alerts', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9' },
        { label: 'SCREENER', value: 'screener', icon: 'M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z' },
        { label: 'EARNINGS CALENDAR', value: 'earnings-calendar', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
        { label: 'WATCHLIST', value: 'watchlist', icon: 'M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z' },
        { label: 'PORTFOLIO ARCHITECT', value: 'portfolio-manager', icon: 'M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z' },
        { label: 'CORRELATION MATRIX', value: 'correlation-matrix', icon: 'M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10 0a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z' },
        { label: 'DATA DICTIONARY', value: 'data-guide', icon: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253' },
      ]
    }
  ];

  const currentReit = REITS.find(r => r.ticker === selectedTicker);
  const currentPortfolio = portfolios.find(p => p.id === selectedPortfolioId);
  const sectors = Object.values(Sector);

  const tickerOptions = REITS.map(r => ({ value: r.ticker, label: r.ticker, sub: r.name }));
  const sectorOptions = [
    { value: 'all', label: 'INDIVIDUAL', sub: 'Single Asset' },
    ...sectors.map(s => ({ value: s, label: s.toUpperCase(), sub: 'Sector Median' }))
  ];
  const portfolioOptions = [
    { value: 'none', label: 'OFF', sub: 'Standard View' },
    ...portfolios.map(p => ({ value: p.id, label: p.name.toUpperCase(), sub: `${p.holdings.length} Assets` }))
  ];

  return (
    <div className="flex h-screen bg-obsidian text-slate-200 overflow-hidden relative font-primary" style={{ paddingTop: TITLEBAR_HEIGHT }}>
      <aside className="w-64 bg-[#02152b] border-r border-rain/20 flex flex-col z-20 shadow-2xl" role="complementary" aria-label="Application sidebar" style={{ height: `calc(100vh - ${TITLEBAR_HEIGHT}px)` }}>
        <div className="p-8 border-b border-rain/10 flex flex-col items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-lightBlue to-darkBlue rounded-lg flex items-center justify-center font-secondary text-2xl font-bold text-white shadow-lg border border-white/10">
            RL
          </div>
          <div className="text-center">
            <h1 className="font-secondary text-xl font-bold text-white tracking-wide">REIT LENS</h1>
            <p className="text-[9px] font-bold text-rain uppercase tracking-[0.3em] mt-1">Institutional v1.3 &middot; 31 Modules</p>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-6 custom-scrollbar px-2" aria-label="Main navigation">
          {navCategories.map((cat, catIdx) => {
            const isCollapsed = collapsedCategories.has(catIdx);
            const hasActivePage = cat.items.some((item) => item.value === activePage);
            return (
              <div key={catIdx} className="mb-4">
                <button
                  onClick={() => toggleCategory(catIdx)}
                  className="w-full flex items-center justify-between px-4 py-1.5 group/cat cursor-pointer"
                  aria-expanded={!isCollapsed}
                >
                  <h3 className={`text-[9px] font-black uppercase tracking-[0.3em] transition-colors flex items-center gap-2 ${hasActivePage ? 'text-lightBlue/60' : 'text-rain/40 group-hover/cat:text-rain/60'}`}>
                    {cat.category}
                    {isCollapsed && <span className="text-[7px] font-bold text-rain/25 bg-rain/8 px-1 py-0.5 rounded">{cat.items.length}</span>}
                  </h3>
                  <svg
                    className={`w-2.5 h-2.5 text-rain/30 transition-transform duration-200 ${isCollapsed ? '-rotate-90' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div
                  className={`space-y-1 overflow-hidden transition-all duration-200 ${isCollapsed ? 'max-h-0 opacity-0' : 'max-h-[600px] opacity-100 mt-2'}`}
                >
                  {cat.items.map((item) => (
                    <button
                      key={item.value}
                      onClick={() => setActivePage(item.value)}
                      aria-current={activePage === item.value ? 'page' : undefined}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-bold transition-all duration-300 group relative uppercase tracking-wider rounded-md ${activePage === item.value
                        ? 'text-white bg-lightBlue/10'
                        : 'text-rain/60 hover:text-white hover:bg-white/[0.03]'
                        }`}
                    >
                      {activePage === item.value && (
                        <div className="absolute left-0 w-1 h-4 bg-pumpkin rounded-r shadow-[0_0_10px_#FF9D3C]" aria-hidden="true"></div>
                      )}
                      <svg className={`w-3.5 h-3.5 transition-transform group-hover:scale-110 ${activePage === item.value ? 'text-lightBlue' : 'text-rain/40'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={item.icon} />
                      </svg>
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>

        <div className="p-5 border-t border-rain/10 bg-[#010e1d] flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 shadow-[0_0_8px_#10b981]"></div>
              <span className="text-[8px] font-bold text-rain uppercase tracking-widest">Real-Time Sync</span>
            </div>
            <p className="text-[7px] font-medium text-rain/40 uppercase tracking-tighter">SEC Gateway</p>
          </div>

          <div className="h-px w-full bg-rain/10"></div>

          <div className="flex flex-col gap-2">
            <span className="text-[8px] font-bold text-rain/40 uppercase tracking-[0.2em]">Auth Layer</span>
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className={`text-[10px] font-bold uppercase tracking-wider truncate max-w-[120px] ${user ? 'text-white' : 'text-slate-400'}`}>
                  {user ? user.email?.split('@')[0] : 'GUEST ACCESS'}
                </span>
                <span className="text-[8px] font-medium text-rain/50 uppercase tracking-widest mt-0.5">
                  {user ? 'Authenticated' : 'Local Only'}
                </span>
              </div>

              {user ? (
                <button onClick={signOut} className="text-[9px] text-pumpkin hover:text-white font-bold uppercase transition-colors tracking-wider px-2 py-1 bg-pumpkin/10 rounded">
                  Log Out
                </button>
              ) : (
                <button onClick={() => setIsAuthModalOpen(true)} className="text-[9px] text-lightBlue hover:text-white font-bold uppercase transition-colors tracking-wider px-2 py-1 bg-lightBlue/10 rounded">
                  Log In
                </button>
              )}
            </div>
          </div>
        </div>
      </aside>

      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 z-10">
        <header className="h-20 bg-darkBlue/20 border-b border-rain/10 flex items-center justify-between px-10 glass-modal shadow-lg relative z-[60]">
          <div className="flex items-center gap-6">
            <div className="flex items-center bg-darkBlue/40 border border-rain/20 p-1 rounded gap-1 shadow-inner">
              <SearchableSelect
                label="Ticker"
                placeholder="Asset..."
                options={tickerOptions}
                value={selectedTicker || ""}
                onChange={setSelectedTicker}
                accentColor="pumpkin"
              />
              <div className="w-px h-8 bg-rain/20 mx-1"></div>
              <SearchableSelect
                label="Sector"
                placeholder="All..."
                options={sectorOptions}
                value={selectedSector || "all"}
                onChange={(v) => setSelectedSector(v as Sector | 'all')}
                accentColor="lightBlue"
              />
              <div className="w-px h-8 bg-rain/20 mx-1"></div>
              <SearchableSelect
                label="Custom Port"
                placeholder="None..."
                options={portfolioOptions}
                value={selectedPortfolioId || "none"}
                onChange={setSelectedPortfolioId}
                accentColor="emerald"
              />
            </div>

            <div className="hidden xl:flex flex-col border-l border-rain/20 pl-6">
              <h2 className="header-noe text-sm text-white uppercase tracking-tight truncate max-w-[280px]">
                {selectedPortfolioId && selectedPortfolioId !== 'none'
                  ? currentPortfolio?.name
                  : selectedSector
                    ? `Sector: ${selectedSector}`
                    : currentReit?.name}
              </h2>
              <span className="text-[10px] font-medium text-rain uppercase tracking-widest mt-0.5">
                {selectedTicker ? `CIK: ${currentReit?.cik}` : 'Macro Strategic Analysis'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Command Palette Trigger */}
            <button
              onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))}
              className="hidden lg:flex items-center gap-2 bg-darkBlue/30 border border-rain/15 px-3 py-1.5 rounded hover:border-rain/40 hover:bg-darkBlue/50 transition-all group"
              title="Quick Navigation (Ctrl+K)"
            >
              <svg className="w-3 h-3 text-rain/40 group-hover:text-rain/60" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
              <span className="text-[10px] text-rain/40 group-hover:text-rain/60 font-medium">Search...</span>
              <kbd className="text-[8px] font-bold text-rain/30 bg-rain/8 px-1.5 py-0.5 rounded border border-rain/15 ml-3">Ctrl+K</kbd>
            </button>

            <div className="flex items-center gap-4 bg-darkBlue/40 border border-rain/20 px-4 py-2 rounded shadow-sm">
              <div className="flex flex-col items-end">
                <span className={`text-[9px] font-bold uppercase tracking-widest transition-colors ${isLiveMode ? 'text-pumpkin' : 'text-rain/50'}`}>
                  {isLiveMode ? 'EDGAR Live' : 'Sandbox'}
                </span>
                <span className="text-[7px] font-bold text-rain/30 uppercase tracking-tighter">Gateway V5.0</span>
              </div>
              <button
                onClick={() => setIsLiveMode(!isLiveMode)}
                role="switch"
                aria-checked={isLiveMode}
                aria-label={`Data mode: ${isLiveMode ? 'EDGAR Live' : 'Sandbox'}. Click to toggle.`}
                className={`w-10 h-5 rounded-full relative transition-all duration-300 ${isLiveMode ? 'bg-pumpkin shadow-[0_0_12px_rgba(255,157,60,0.4)]' : 'bg-slate-800'}`}
              >
                <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all duration-300 ${isLiveMode ? 'right-0.5' : 'left-0.5'}`} aria-hidden="true"></div>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-10 custom-scrollbar bg-gradient-to-b from-transparent to-black/30 relative z-10" role="main" aria-label="Page content">
          {children}
        </main>
      </div>
    </div>
  );
};

export default Layout;
