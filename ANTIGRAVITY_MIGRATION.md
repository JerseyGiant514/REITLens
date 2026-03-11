# Antigravity Migration Guide: REIT Lens

## 1. Project Overview
REIT Lens is an institutional-grade research terminal for U.S. Public REITs. It features advanced financial modeling (Justified P/AFFO, NAV Sensitivity), AI-driven research synthesis (Analyst Memo), and real-time data grounding (Analyst Perspectives).

## 2. Current Technical State
- **Frontend**: React 18, Vite, Tailwind CSS, Motion (framer-motion).
- **Styling**: "Alethia" Aesthetic (Dark mode, high-density, institutional typography).
- **Data**: 
  - Primarily driven by `services/mockData.ts` (High-fidelity synthetic data).
  - Experimental SEC EDGAR integration in `services/dataService.ts` (Live Mode).
- **AI**: 
  - `AnalystMemo.tsx`: Uses Gemini 3 Flash for research synthesis.
  - `AnalystPerspectives.tsx`: Uses Gemini 3 Pro with Google Search grounding for real-time analyst consensus.
- **State Management**: Lifted state in `App.tsx` for strategic modeling inputs.

## 3. Production Readiness & Limitations

### Data Layer (Critical Gap)
- **Limitation**: The app relies heavily on `mockData.ts`. While the logic is sound, it needs a robust backend to fetch and cache real-time financials.
- **Antigravity Focus**: Implement the Medallion Architecture outlined in `DATA_STRATEGY.md`. Bridge the gap between the SEC EDGAR API and the UI components.

### API Key Management & Location
- **Where to find it**: In the Antigravity/AI Studio preview environment, the API key is injected automatically into the runtime environment after the user selects it via the `window.aistudio.openSelectKey()` dialog.
- **Access in Code**: It is accessible via `process.env.API_KEY`.
- **User Management**: Users can find and manage their selected keys in the AI Studio interface (usually in the top-right or via the key selection prompt triggered by the app).
- **Production Transition**: For a full production deployment, this should be moved to a secure server-side environment variable (e.g., `GEMINI_API_KEY`) and managed via a secret manager.

### Authentication & Multi-Tenancy
- **Limitation**: No user authentication. Portfolios are saved to `localStorage`.
- **Antigravity Focus**: Implement OAuth/JWT authentication and a database (PostgreSQL/Supabase) to persist user portfolios and watchlists.

### Performance
- **Limitation**: Large components (e.g., `Valuation.tsx`) could benefit from further decomposition and memoization if data sizes increase.
- **Antigravity Focus**: Optimize heavy calculations and implement data virtualization for large sector lists.

## 4. Immediate Focus Areas for Antigravity
1. **Real Data Bridge**: Replace `mockData.ts` calls with a unified `dataService` that fetches from a production API.
2. **AI Grounding**: Refine the prompt engineering in `AnalystMemo.tsx` to ensure it uses the most recent SEC filings fetched via the data layer.
3. **Production Build**: Ensure the `npm run build` output is optimized for the target environment.

## 5. Documentation Suite
Refer to the following files for deep context:
- `blueprint.md`: Core vision and roadmap.
- `FORMULAS.md`: Mathematical source of truth.
- `DATA_STRATEGY.md`: Data pipeline architecture.
- `DESIGN_SYSTEM.md`: UI/UX guidelines.
- `EXPECTATIONS_FRAMEWORK.md`: Valuation logic details.
- `SECTOR_PROFILES.md`: Sector-specific nuances.
