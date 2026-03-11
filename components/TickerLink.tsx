import React from 'react';
import { useNavigateToTicker } from '../hooks/useNavigateToTicker';
import { Page } from '../types';

interface TickerLinkProps {
  ticker: string;
  targetPage?: Page;
  className?: string;
}

/**
 * A clickable ticker badge that navigates to a specific ticker's view on
 * the target page. Defaults to 'dashboard'.
 */
const TickerLink: React.FC<TickerLinkProps> = ({ ticker, targetPage = 'dashboard', className }) => {
  const navigateToTicker = useNavigateToTicker();

  return (
    <button
      type="button"
      onClick={() => navigateToTicker(ticker, targetPage)}
      className={
        className ??
        'text-xs font-bold text-lightBlue hover:text-white cursor-pointer underline decoration-dotted transition-colors'
      }
      title={`Go to ${ticker} dashboard`}
    >
      {ticker}
    </button>
  );
};

export default TickerLink;
