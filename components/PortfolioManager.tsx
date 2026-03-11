
import React, { useState } from 'react';
import { REITS } from '../services/mockData';
import { Portfolio, PortfolioHolding } from '../types';

interface PortfolioManagerProps {
  portfolios: Portfolio[];
  onSave: (p: Portfolio) => void;
  onDelete: (id: string) => void;
}

const PortfolioManager: React.FC<PortfolioManagerProps> = ({ portfolios, onSave, onDelete }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [holdings, setHoldings] = useState<PortfolioHolding[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  const totalWeight = holdings.reduce((sum, h) => sum + h.weight, 0);

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setHoldings([]);
    setIsAdding(false);
  };

  const handleEdit = (p: Portfolio) => {
    setEditingId(p.id);
    setName(p.name);
    setHoldings([...p.holdings]);
    setIsAdding(true);
  };

  const addTicker = (ticker: string) => {
    if (holdings.find(h => h.ticker === ticker)) return;
    setHoldings([...holdings, { ticker, weight: 0 }]);
  };

  const removeTicker = (ticker: string) => {
    setHoldings(holdings.filter(h => h.ticker !== ticker));
  };

  const updateWeight = (ticker: string, weight: number) => {
    setHoldings(holdings.map(h => h.ticker === ticker ? { ...h, weight: Math.max(0, Math.min(100, weight)) } : h));
  };

  const handleSave = () => {
    if (!name || holdings.length === 0) return;
    
    const newPortfolio: Portfolio = {
      id: editingId || Date.now().toString(),
      name,
      holdings: holdings.filter(h => h.weight > 0)
    };
    
    onSave(newPortfolio);
    resetForm();
  };

  const redistributeEqually = () => {
    if (holdings.length === 0) return;
    const equalWeight = parseFloat((100 / holdings.length).toFixed(2));
    setHoldings(holdings.map(h => ({ ...h, weight: equalWeight })));
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-700 max-w-5xl mx-auto">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-6 aegis-card gold-braiding p-10">
        <div>
          <h2 className="header-noe text-2xl text-white uppercase tracking-tight">Portfolio Architect</h2>
          <p className="text-[10px] text-rain font-bold uppercase tracking-[0.3em] mt-2">Custom Strategy Permutations & Weighted Allocation</p>
        </div>
        {!isAdding && (
          <button 
            onClick={() => setIsAdding(true)}
            className="px-8 py-3 bg-pumpkin text-white text-[10px] font-bold uppercase tracking-widest rounded hover:brightness-110 transition-all shadow-xl"
          >
            Initiate New Strategy
          </button>
        )}
      </header>

      {isAdding ? (
        <div className="aegis-card p-10 space-y-10 animate-in slide-in-from-top-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
            <div className="space-y-8">
              <div className="space-y-3">
                <label className="text-[10px] font-bold text-rain uppercase tracking-widest ml-1">Strategy Identity</label>
                <input 
                  type="text" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., Growth Alpha 2025"
                  className="w-full bg-darkBlue/40 border border-rain/20 px-5 py-3 rounded text-sm font-bold text-white outline-none focus:border-pumpkin/50 transition-all placeholder:text-rain/30"
                />
              </div>

              <div className="space-y-4">
                <label className="text-[10px] font-bold text-rain uppercase tracking-widest ml-1">Security Universe</label>
                <div className="grid grid-cols-3 gap-2 max-h-72 overflow-y-auto custom-scrollbar pr-2">
                  {REITS.map(reit => {
                    const isSelected = holdings.find(h => h.ticker === reit.ticker);
                    return (
                      <button
                        key={reit.ticker}
                        onClick={() => addTicker(reit.ticker)}
                        disabled={!!isSelected}
                        className={`p-3 text-center rounded border transition-all flex flex-col items-center gap-1.5 ${
                          isSelected 
                            ? 'bg-lightBlue/10 border-lightBlue/30 opacity-40 cursor-not-allowed' 
                            : 'bg-darkBlue/20 border-rain/20 hover:border-pumpkin/50 hover:bg-darkBlue/40'
                        }`}
                      >
                        <span className="text-xs font-bold text-white font-tertiary">{reit.ticker}</span>
                        <span className="text-[8px] text-rain uppercase font-bold truncate w-full">{reit.sector}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-8 flex flex-col">
               <div className="flex justify-between items-center ml-1">
                  <label className="text-[10px] font-bold text-rain uppercase tracking-widest">Allocation Matrix</label>
                  <button onClick={redistributeEqually} className="text-[9px] font-bold text-pumpkin hover:text-white uppercase tracking-widest transition-colors">Equalize Weights</button>
               </div>
               
               <div className="flex-1 bg-black/20 border border-rain/10 rounded-lg p-6 space-y-4 overflow-y-auto max-h-[440px] custom-scrollbar">
                  {holdings.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-rain/40 italic py-24 text-center">
                      <svg className="w-12 h-12 mb-4 opacity-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M12 9v3m0 0v3m0-3h3m-3 0H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                      <span className="text-[10px] font-bold uppercase tracking-widest leading-relaxed">Add securities from the universe<br/>to begin weighting</span>
                    </div>
                  ) : (
                    holdings.map(h => (
                      <div key={h.ticker} className="flex items-center gap-4 bg-darkBlue/20 p-4 rounded border border-rain/10 group/item">
                        <div className="w-16 flex flex-col">
                          <span className="text-xs font-bold text-pumpkin font-tertiary">{h.ticker}</span>
                        </div>
                        <input 
                          type="range" min="0" max="100" step="1" value={h.weight}
                          onChange={(e) => updateWeight(h.ticker, parseFloat(e.target.value))}
                          className="flex-1 accent-pumpkin h-1.5 bg-slate-800 rounded-full"
                        />
                        <div className="relative w-20">
                          <input 
                            type="number" value={h.weight}
                            onChange={(e) => updateWeight(h.ticker, parseFloat(e.target.value))}
                            className="w-full bg-black/40 border border-rain/20 px-3 py-1.5 rounded text-right text-xs font-bold text-white pr-7 font-tertiary"
                          />
                          <span className="absolute right-2 top-2 text-[8px] text-rain font-bold">%</span>
                        </div>
                        <button onClick={() => removeTicker(h.ticker)} className="text-rain/40 hover:text-rose-500 transition-colors opacity-0 group-hover/item:opacity-100">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                      </div>
                    ))
                  )}
               </div>

               <div className={`p-5 rounded border transition-all flex justify-between items-center ${totalWeight === 100 ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-rose-500/5 border-rose-500/20'}`}>
                  <span className="text-[10px] font-bold text-rain uppercase tracking-widest">Weight Integrity Check:</span>
                  <span className={`text-xl font-bold font-tertiary ${totalWeight === 100 ? 'text-emerald-400' : 'text-rose-400'}`}>{totalWeight.toFixed(1)}%</span>
               </div>
            </div>
          </div>

          <div className="pt-8 border-t border-rain/10 flex justify-end gap-6">
             <button onClick={resetForm} className="px-8 py-3 text-[10px] font-bold text-rain hover:text-white uppercase tracking-widest transition-all">Discard Changes</button>
             <button 
              onClick={handleSave} 
              disabled={!name || holdings.length === 0}
              className="px-10 py-3 bg-pumpkin text-white text-[10px] font-bold uppercase tracking-widest rounded hover:brightness-110 transition-all disabled:opacity-20 shadow-xl"
             >
              Verify & Commit Strategy
             </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
           {portfolios.length === 0 ? (
             <div className="col-span-full py-32 text-center bg-darkBlue/10 border border-dashed border-rain/20 rounded-xl">
               <span className="text-xs font-bold text-rain/40 uppercase tracking-[0.4em]">No Optimized Strategies Stored</span>
             </div>
           ) : (
             portfolios.map(p => (
               <div key={p.id} className="aegis-card p-8 group flex flex-col justify-between hover:border-pumpkin/40">
                  <div>
                    <div className="flex justify-between items-start mb-6">
                      <h3 className="header-noe text-lg text-white uppercase tracking-tight">{p.name}</h3>
                      <span className="text-[9px] font-bold text-emerald-400 bg-emerald-400/10 px-2 py-0.5 rounded border border-emerald-400/20 uppercase tracking-widest">Active</span>
                    </div>
                    <div className="space-y-4 mb-8">
                       {p.holdings.slice(0, 4).map(h => (
                         <div key={h.ticker} className="flex justify-between items-center">
                            <span className="text-[10px] font-bold text-rain uppercase font-tertiary">{h.ticker}</span>
                            <div className="flex-1 mx-4 h-px bg-rain/10"></div>
                            <span className="text-[10px] font-bold text-white font-tertiary">{h.weight.toFixed(1)}%</span>
                         </div>
                       ))}
                       {p.holdings.length > 4 && (
                         <div className="text-[9px] font-bold text-rain/40 uppercase tracking-widest text-center mt-2 border-t border-rain/5 pt-3">+{p.holdings.length - 4} Additional Assets</div>
                       )}
                    </div>
                  </div>
                  <div className="pt-6 border-t border-rain/10 flex gap-4">
                     <button onClick={() => handleEdit(p)} className="flex-1 py-2.5 text-[10px] font-bold text-pumpkin border border-pumpkin/30 rounded hover:bg-pumpkin/5 transition-all uppercase tracking-widest">Edit Allocation</button>
                     <button onClick={() => onDelete(p.id)} className="p-2.5 text-rain/40 hover:text-rose-500 transition-colors">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                     </button>
                  </div>
               </div>
             ))
           )}
        </div>
      )}
    </div>
  );
};

export default PortfolioManager;
