
import React, { useEffect, useMemo, lazy, Suspense } from 'react';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import ToastContainer from './components/Toast';
import PageSkeleton from './components/PageSkeleton';
import CommandPalette from './components/CommandPalette';
import { Portfolio } from './types';

// Lazy load heavy components for better initial load performance
const Dashboard = lazy(() => import('./components/Dashboard'));
const BalanceSheet = lazy(() => import('./components/BalanceSheet'));
const Valuation = lazy(() => import('./components/Valuation'));
const Operations = lazy(() => import('./components/Operations'));
const SectorLens = lazy(() => import('./components/SectorLens'));
const Macro = lazy(() => import('./components/Macro'));
const Watchlist = lazy(() => import('./components/Watchlist'));
const DataGuide = lazy(() => import('./components/DataGuide'));
const ReturnDecomposition = lazy(() => import('./components/ReturnDecomposition'));
const PortfolioManager = lazy(() => import('./components/PortfolioManager'));
const JustifiedPAFFO = lazy(() => import('./components/JustifiedPAFFO'));
const RelativeValue = lazy(() => import('./components/RelativeValue'));
const NAVSensitivity = lazy(() => import('./components/NAVSensitivity'));
const AnalystMemo = lazy(() => import('./components/AnalystMemo'));
const AnalystPerspectives = lazy(() => import('./components/AnalystPerspectives'));
const ExpertKnowledge = lazy(() => import('./components/ExpertKnowledge'));
const CorrelationMatrix = lazy(() => import('./components/CorrelationMatrix'));
const PeerCompTable = lazy(() => import('./components/PeerCompTable'));
const NAVModel = lazy(() => import('./components/NAVModel'));
const DividendSafety = lazy(() => import('./components/DividendSafety'));
const EarningsCalendar = lazy(() => import('./components/EarningsCalendar'));
const ForwardAFFO = lazy(() => import('./components/ForwardAFFO'));
const DebtStressTest = lazy(() => import('./components/DebtStressTest'));
const MgmtScorecard = lazy(() => import('./components/MgmtScorecard'));
const Screener = lazy(() => import('./components/Screener'));
const PNAVHistory = lazy(() => import('./components/PNAVHistory'));
const Volatility = lazy(() => import('./components/Volatility'));
const TenantLease = lazy(() => import('./components/TenantLease'));
const GeoExposure = lazy(() => import('./components/GeoExposure'));
const ConsensusEstimates = lazy(() => import('./components/ConsensusEstimates'));
const Alerts = lazy(() => import('./components/Alerts'));
import { REITS } from './services/mockData';
import { fetchSECData, normalizeSECData } from './services/dataService';
import { useAuth } from './contexts/AuthContext';

// ---------- Keyboard Shortcuts ----------
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';

// ---------- Zustand Stores ----------
import { useAppStore } from './stores/useAppStore';
import { usePortfolioStore } from './stores/usePortfolioStore';
import { useStrategicModelStore } from './stores/useStrategicModelStore';

// ---------- Re-export for backward compatibility ----------
// Several components (Valuation, JustifiedPAFFO, ReturnDecomposition, AnalystMemo)
// import { StrategicModelState } from '../App'.  Re-export from the store so
// those imports continue to resolve without modifying those files.
export type { StrategicModelState } from './stores/useStrategicModelStore';

const App: React.FC = () => {
  // ---- Global keyboard shortcuts (Escape, Ctrl+1-9, Arrow keys) ----
  useKeyboardShortcuts();

  // ---- Auth (stays as React Context -- not migrated to Zustand) ----
  const { user } = useAuth();

  // ---- App Store (navigation, selection, live mode) ----
  const activePage = useAppStore((s) => s.activePage);
  const selectedTicker = useAppStore((s) => s.selectedTicker);
  const selectedSector = useAppStore((s) => s.selectedSector);
  const isLiveMode = useAppStore((s) => s.isLiveMode);
  const isLoading = useAppStore((s) => s.isLoading);
  const liveFinancials = useAppStore((s) => s.liveFinancials);
  const setActivePage = useAppStore((s) => s.setActivePage);
  const selectTicker = useAppStore((s) => s.selectTicker);
  const selectSector = useAppStore((s) => s.selectSector);
  const setIsLiveMode = useAppStore((s) => s.setIsLiveMode);
  const setIsLoading = useAppStore((s) => s.setIsLoading);
  const setLiveFinancials = useAppStore((s) => s.setLiveFinancials);

  // ---- Portfolio Store ----
  const portfolios = usePortfolioStore((s) => s.portfolios);
  const selectedPortfolioId = usePortfolioStore((s) => s.selectedPortfolioId);
  const loadPortfolios = usePortfolioStore((s) => s.loadPortfolios);
  const clearPortfolios = usePortfolioStore((s) => s.clearPortfolios);
  const savePortfolio = usePortfolioStore((s) => s.savePortfolio);
  const deletePortfolio = usePortfolioStore((s) => s.deletePortfolio);
  const selectPortfolio = usePortfolioStore((s) => s.selectPortfolio);

  // ---- Strategic Model Store ----
  const strategicWacc = useStrategicModelStore((s) => s.wacc);
  const strategicGrowth = useStrategicModelStore((s) => s.growth);
  const setStrategicModel = useStrategicModelStore((s) => s.setModel);
  const strategicModel = useMemo(() => ({ wacc: strategicWacc, growth: strategicGrowth }), [strategicWacc, strategicGrowth]);

  // ===================================================================
  // Side-effects
  // ===================================================================

  // Fetch portfolios on load or auth change
  useEffect(() => {
    if (!user) {
      clearPortfolios();
      return;
    }
    loadPortfolios(user.id);
  }, [user, loadPortfolios, clearPortfolios]);

  // Live data sync with SEC EDGAR
  useEffect(() => {
    if (isLiveMode && selectedTicker) {
      const loadLiveData = async () => {
        setIsLoading(true);
        const reit = REITS.find(r => r.ticker === selectedTicker);
        if (reit) {
          const raw = await fetchSECData(reit.cik);
          if (raw) {
            const financials = normalizeSECData(raw, reit.id);
            setLiveFinancials(financials);
          }
        }
        setIsLoading(false);
      };
      loadLiveData();
    } else {
      setLiveFinancials(null);
    }
  }, [isLiveMode, selectedTicker, setIsLoading, setLiveFinancials]);

  // ===================================================================
  // Handlers that coordinate across stores
  // (These bridge the gap while child components still receive props.
  //  After full migration, components will call stores directly.)
  // ===================================================================

  const handleTickerChange = (ticker: string) => {
    selectTicker(ticker);
    selectPortfolio('none');
  };

  const handleSectorChange = (sector: string) => {
    selectSector(sector as any);
    selectPortfolio('none');
  };

  const handlePortfolioChange = (id: string | 'none') => {
    if (id === 'none') {
      selectPortfolio('none');
      selectTicker('PLD');
      selectSector('all');
    } else {
      selectPortfolio(id);
      // Clear ticker and sector so we show portfolio view
      useAppStore.setState({ selectedTicker: null, selectedSector: null });
    }
  };

  const onSavePortfolio = async (p: Portfolio) => {
    if (!user) return;
    await savePortfolio(p, user.id);
  };

  const onDeletePortfolio = async (id: string) => {
    if (!user) return;
    await deletePortfolio(id, user.id);
    // If the deleted portfolio was selected, reset to default ticker
    if (selectedPortfolioId === id) {
      selectTicker('PLD');
    }
  };

  // ===================================================================
  // Page Renderer
  // ===================================================================

  const renderPage = () => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center justify-center h-full space-y-4">
          <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest animate-pulse">Syncing SEC EDGAR Core Facts...</p>
        </div>
      );
    }

    const currentTicker = selectedTicker || 'PLD';
    const currentPortfolio = portfolios.find(p => p.id === selectedPortfolioId) || null;

    switch (activePage) {
      case 'dashboard':
        return <ErrorBoundary section="Dashboard"><Dashboard ticker={currentTicker} sector={selectedSector} portfolio={currentPortfolio} liveFinancials={liveFinancials} /></ErrorBoundary>;
      case 'valuation':
        return <ErrorBoundary section="Valuation"><Valuation ticker={currentTicker} sector={selectedSector} portfolio={currentPortfolio} liveFinancials={liveFinancials} strategicModel={strategicModel} /></ErrorBoundary>;
      case 'justified-paffo':
        return (
          <ErrorBoundary section="Justified P/AFFO">
            <JustifiedPAFFO
              ticker={currentTicker}
              sector={selectedSector}
              portfolio={currentPortfolio}
              model={strategicModel}
              onUpdateModel={setStrategicModel}
            />
          </ErrorBoundary>
        );
      case 'operations':
        return <ErrorBoundary section="Operations"><Operations ticker={currentTicker} sector={selectedSector} portfolio={currentPortfolio} /></ErrorBoundary>;
      case 'balance-sheet':
        return <ErrorBoundary section="Balance Sheet"><BalanceSheet ticker={currentTicker} /></ErrorBoundary>;
      case 'sector-lens':
        return <ErrorBoundary section="Sector Lens"><SectorLens /></ErrorBoundary>;
      case 'macro':
        return <ErrorBoundary section="Macro"><Macro /></ErrorBoundary>;
      case 'watchlist':
        return <ErrorBoundary section="Watchlist"><Watchlist /></ErrorBoundary>;
      case 'data-guide':
        return <ErrorBoundary section="Data Guide"><DataGuide /></ErrorBoundary>;
      case 'return-decomposition':
        return (
          <ErrorBoundary section="Return Decomposition">
            <ReturnDecomposition
              ticker={currentTicker}
              sector={selectedSector}
              portfolio={currentPortfolio}
              strategicModel={strategicModel}
            />
          </ErrorBoundary>
        );
      case 'portfolio-manager':
        return <ErrorBoundary section="Portfolio Manager"><PortfolioManager portfolios={portfolios} onSave={onSavePortfolio} onDelete={onDeletePortfolio} /></ErrorBoundary>;
      case 'relative-value':
        return <ErrorBoundary section="Relative Value"><RelativeValue ticker={currentTicker} sector={selectedSector} portfolio={currentPortfolio} /></ErrorBoundary>;
      case 'nav-sensitivity':
        return <ErrorBoundary section="NAV Sensitivity"><NAVSensitivity ticker={currentTicker} /></ErrorBoundary>;
      case 'analyst-memo':
        return <ErrorBoundary section="Analyst Memo"><AnalystMemo ticker={currentTicker} model={strategicModel} /></ErrorBoundary>;
      case 'analyst-perspectives':
        return <ErrorBoundary section="Analyst Perspectives"><AnalystPerspectives ticker={currentTicker} /></ErrorBoundary>;
      case 'expert-knowledge':
        return <ErrorBoundary section="Expert Knowledge"><ExpertKnowledge /></ErrorBoundary>;
      case 'correlation-matrix':
        return <ErrorBoundary section="Correlation Matrix"><CorrelationMatrix portfolio={currentPortfolio} ticker={currentTicker} /></ErrorBoundary>;
      case 'peer-comp':
        return <ErrorBoundary section="Peer Comp Table"><PeerCompTable /></ErrorBoundary>;
      case 'nav-model':
        return <ErrorBoundary section="NAV Model"><NAVModel ticker={currentTicker} /></ErrorBoundary>;
      case 'dividend-safety':
        return <ErrorBoundary section="Dividend Safety"><DividendSafety ticker={currentTicker} /></ErrorBoundary>;
      case 'earnings-calendar':
        return <ErrorBoundary section="Earnings Calendar"><EarningsCalendar /></ErrorBoundary>;
      case 'forward-affo':
        return <ErrorBoundary section="Forward AFFO"><ForwardAFFO ticker={currentTicker} /></ErrorBoundary>;
      case 'debt-stress':
        return <ErrorBoundary section="Debt Stress Test"><DebtStressTest ticker={currentTicker} /></ErrorBoundary>;
      case 'mgmt-scorecard':
        return <ErrorBoundary section="Management Scorecard"><MgmtScorecard ticker={currentTicker} /></ErrorBoundary>;
      case 'screener':
        return <ErrorBoundary section="Screener"><Screener /></ErrorBoundary>;
      case 'pnav-history':
        return <ErrorBoundary section="P/NAV History"><PNAVHistory ticker={currentTicker} /></ErrorBoundary>;
      case 'volatility':
        return <ErrorBoundary section="Volatility"><Volatility ticker={currentTicker} /></ErrorBoundary>;
      case 'tenant-lease':
        return <ErrorBoundary section="Tenant & Lease"><TenantLease ticker={currentTicker} /></ErrorBoundary>;
      case 'geo-exposure':
        return <ErrorBoundary section="Geographic Exposure"><GeoExposure ticker={currentTicker} /></ErrorBoundary>;
      case 'consensus':
        return <ErrorBoundary section="Consensus Estimates"><ConsensusEstimates ticker={currentTicker} /></ErrorBoundary>;
      case 'alerts':
        return <ErrorBoundary section="Alerts"><Alerts /></ErrorBoundary>;
      default:
        return <ErrorBoundary section="Dashboard"><Dashboard ticker={currentTicker} sector={selectedSector} portfolio={currentPortfolio} liveFinancials={liveFinancials} /></ErrorBoundary>;
    }
  };

  return (
    <>
      <Layout
        activePage={activePage}
        setActivePage={setActivePage}
        selectedTicker={selectedTicker}
        setSelectedTicker={handleTickerChange}
        selectedSector={selectedSector}
        setSelectedSector={handleSectorChange}
        selectedPortfolioId={selectedPortfolioId}
        setSelectedPortfolioId={handlePortfolioChange}
        portfolios={portfolios}
        isLiveMode={isLiveMode}
        setIsLiveMode={setIsLiveMode}
      >
        <Suspense fallback={<PageSkeleton />}>
          {renderPage()}
        </Suspense>
      </Layout>
      <ToastContainer />
      <CommandPalette />
    </>
  );
};

export default App;
