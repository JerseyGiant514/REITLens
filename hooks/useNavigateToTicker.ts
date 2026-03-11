import { useAppStore } from '../stores/useAppStore';
import { Page } from '../types';

export function useNavigateToTicker() {
  const setActivePage = useAppStore((s) => s.setActivePage);
  const selectTicker = useAppStore((s) => s.selectTicker);

  return (ticker: string, page: Page = 'dashboard') => {
    selectTicker(ticker);
    setActivePage(page);
  };
}
