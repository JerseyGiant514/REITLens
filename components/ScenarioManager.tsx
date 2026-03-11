/**
 * ScenarioManager.tsx
 * Panel/modal for saving, loading, and comparing P/AFFO model scenarios
 * Supports Bull/Base/Bear case comparison with side-by-side delta table
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Save, FolderOpen, GitCompareArrows, Trash2, X, Plus, Tag, ChevronDown, ChevronUp } from 'lucide-react';
import { StrategicModelState } from '../App';
import { useAuth } from '../contexts/AuthContext';
import {
  Scenario,
  ScenarioComparison,
  saveScenario,
  getAllScenarios,
  deleteScenario,
  compareScenarios,
  calculateScenarioMetrics,
  generatePresetScenarios,
  syncScenarioToSupabase,
  deleteScenarioFromSupabase,
} from '../services/scenarioService';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ScenarioManagerProps {
  ticker: string;
  model: StrategicModelState;
  onLoadScenario: (model: StrategicModelState) => void;
  impliedCapRate?: number;
  currentAFFO?: number;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const ScenarioCard: React.FC<{
  scenario: Scenario;
  isSelected: boolean;
  onSelect: () => void;
  onLoad: () => void;
  onDelete: () => void;
}> = ({ scenario, isSelected, onSelect, onLoad, onDelete }) => {
  const tagColor = (tag: string) => {
    switch (tag) {
      case 'bull': return 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10';
      case 'bear': return 'text-rose-400 border-rose-500/30 bg-rose-500/10';
      case 'base': return 'text-lightBlue border-lightBlue/30 bg-lightBlue/10';
      case 'preset': return 'text-gold border-gold/30 bg-gold/10';
      default: return 'text-rain border-rain/30 bg-rain/10';
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className={`p-4 rounded-lg border transition-all cursor-pointer ${
        isSelected
          ? 'border-lightBlue/50 bg-lightBlue/10 shadow-lg shadow-lightBlue/5'
          : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/8'
      }`}
      onClick={onSelect}
    >
      <div className="flex justify-between items-start mb-2">
        <div className="flex-1 min-w-0">
          <h4 className="text-[11px] font-black text-white uppercase tracking-wider truncate">
            {scenario.name}
          </h4>
          <p className="text-[8px] text-rain uppercase tracking-widest mt-0.5">
            {scenario.ticker} | {new Date(scenario.updatedAt).toLocaleDateString()}
          </p>
        </div>
        <div className="flex gap-1 ml-2 flex-shrink-0">
          <button
            onClick={(e) => { e.stopPropagation(); onLoad(); }}
            className="p-1.5 rounded hover:bg-lightBlue/20 text-rain hover:text-lightBlue transition-colors"
            title="Load scenario"
          >
            <FolderOpen className="w-3 h-3" />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded hover:bg-rose-500/20 text-rain hover:text-rose-400 transition-colors"
            title="Delete scenario"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Tags */}
      {scenario.tags && scenario.tags.length > 0 && (
        <div className="flex gap-1 mb-2">
          {scenario.tags.map((tag, i) => (
            <span key={i} className={`text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border ${tagColor(tag)}`}>
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Key Metrics */}
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div className="text-center">
          <span className="text-[7px] text-rain uppercase font-bold block">Ke</span>
          <span className="text-[11px] text-lightBlue font-black mono">{scenario.metrics.costOfEquity.toFixed(1)}%</span>
        </div>
        <div className="text-center">
          <span className="text-[7px] text-rain uppercase font-bold block">g</span>
          <span className="text-[11px] text-pumpkin font-black mono">{scenario.metrics.sustainableG.toFixed(1)}%</span>
        </div>
        <div className="text-center">
          <span className="text-[7px] text-rain uppercase font-bold block">P/AFFO</span>
          <span className="text-[11px] text-white font-black mono">{scenario.metrics.justifiedMultiple.toFixed(1)}x</span>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

const ScenarioManager: React.FC<ScenarioManagerProps> = ({
  ticker,
  model,
  onLoadScenario,
  impliedCapRate = 5.0,
  currentAFFO = 1.0,
}) => {
  const { user } = useAuth();
  const [scenarios, setScenarios] = useState<Scenario[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [saveName, setSaveName] = useState('');
  const [saveTags, setSaveTags] = useState('');
  const [showSaveForm, setShowSaveForm] = useState(false);
  const [showCompare, setShowCompare] = useState(false);
  const [expandedSection, setExpandedSection] = useState<'save' | 'load' | 'compare' | null>('load');

  // Load scenarios on mount and when ticker changes
  useEffect(() => {
    refreshScenarios();
  }, [ticker]);

  const refreshScenarios = useCallback(() => {
    const loaded = getAllScenarios(ticker);
    setScenarios(loaded);
  }, [ticker]);

  // ─── Save Handler ─────────────────────────────────────────────────────────

  const handleSave = useCallback(() => {
    if (!saveName.trim()) return;

    const metrics = calculateScenarioMetrics(model.wacc, model.growth, impliedCapRate, currentAFFO);
    const tags = saveTags
      .split(',')
      .map(t => t.trim().toLowerCase())
      .filter(Boolean);

    const saved = saveScenario({
      name: saveName.trim(),
      ticker,
      wacc: { ...model.wacc },
      growth: { ...model.growth },
      metrics,
      tags,
    });

    // Sync to Supabase if authenticated
    if (user) {
      syncScenarioToSupabase(saved, user.id).catch(() => {});
    }

    setSaveName('');
    setSaveTags('');
    setShowSaveForm(false);
    refreshScenarios();
  }, [saveName, saveTags, model, ticker, impliedCapRate, currentAFFO, user, refreshScenarios]);

  // ─── Generate Presets ─────────────────────────────────────────────────────

  const handleGeneratePresets = useCallback(() => {
    const presets = generatePresetScenarios(ticker, model.wacc, model.growth, impliedCapRate, currentAFFO);
    presets.forEach(preset => {
      const saved = saveScenario(preset);
      if (user) {
        syncScenarioToSupabase(saved, user.id).catch(() => {});
      }
    });
    refreshScenarios();
  }, [ticker, model, impliedCapRate, currentAFFO, user, refreshScenarios]);

  // ─── Load Handler ─────────────────────────────────────────────────────────

  const handleLoad = useCallback((scenario: Scenario) => {
    onLoadScenario({
      wacc: { ...scenario.wacc },
      growth: { ...scenario.growth },
    });
  }, [onLoadScenario]);

  // ─── Delete Handler ───────────────────────────────────────────────────────

  const handleDelete = useCallback((id: string) => {
    deleteScenario(id);
    if (user) {
      deleteScenarioFromSupabase(id, user.id).catch(() => {});
    }
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    refreshScenarios();
  }, [user, refreshScenarios]);

  // ─── Selection Toggle ─────────────────────────────────────────────────────

  const toggleSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else if (next.size < 3) {
        next.add(id);
      }
      return next;
    });
  }, []);

  // ─── Comparison Data ──────────────────────────────────────────────────────

  const comparison: ScenarioComparison | null = useMemo(() => {
    if (selectedIds.size < 2) return null;
    const selected = scenarios.filter(s => selectedIds.has(s.id));
    return compareScenarios(selected);
  }, [selectedIds, scenarios]);

  // ─── Section Toggle ───────────────────────────────────────────────────────

  const toggleSection = (section: 'save' | 'load' | 'compare') => {
    setExpandedSection(prev => prev === section ? null : section);
  };

  return (
    <div className="space-y-4">
      {/* ─── Header ────────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h3 className="text-[11px] font-black text-gold uppercase tracking-[0.3em]">
          Scenario Manager
        </h3>
        <span className="text-[8px] text-rain uppercase tracking-widest">
          {scenarios.length} saved
        </span>
      </div>

      {/* ─── Save Section ──────────────────────────────────────────────────── */}
      <div className="aegis-card border-gold/20">
        <button
          onClick={() => toggleSection('save')}
          className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Save className="w-3.5 h-3.5 text-gold" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">Save Current</span>
          </div>
          {expandedSection === 'save' ? (
            <ChevronUp className="w-3.5 h-3.5 text-rain" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-rain" />
          )}
        </button>

        <AnimatePresence>
          {expandedSection === 'save' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-3">
                {/* Current Model Summary */}
                <div className="grid grid-cols-3 gap-2 p-3 bg-darkBlue/40 rounded border border-white/5">
                  <div className="text-center">
                    <span className="text-[7px] text-rain uppercase font-bold block">Ke</span>
                    <span className="text-[10px] text-lightBlue font-black mono">
                      {(model.wacc.rf + model.wacc.beta * model.wacc.erp).toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-[7px] text-rain uppercase font-bold block">g</span>
                    <span className="text-[10px] text-pumpkin font-black mono">
                      {(model.growth.ss +
                        (model.growth.acqVol * (model.growth.acqSpread / 100)) / impliedCapRate +
                        (model.growth.devVol * (model.growth.devSpread / 100)) / impliedCapRate +
                        model.growth.leakage + model.growth.cap).toFixed(1)}%
                    </span>
                  </div>
                  <div className="text-center">
                    <span className="text-[7px] text-rain uppercase font-bold block">P/AFFO</span>
                    <span className="text-[10px] text-white font-black mono">
                      {calculateScenarioMetrics(model.wacc, model.growth, impliedCapRate, currentAFFO).justifiedMultiple.toFixed(1)}x
                    </span>
                  </div>
                </div>

                {/* Save Form */}
                <div className="space-y-2">
                  <input
                    type="text"
                    value={saveName}
                    onChange={(e) => setSaveName(e.target.value)}
                    placeholder="Scenario name (e.g., Base Case Q1 2026)"
                    className="w-full bg-obsidian border border-white/10 rounded px-3 py-2 text-[10px] text-white placeholder-rain/50 focus:border-gold/50 focus:outline-none transition-colors"
                    onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  />
                  <div className="flex items-center gap-1">
                    <Tag className="w-3 h-3 text-rain flex-shrink-0" />
                    <input
                      type="text"
                      value={saveTags}
                      onChange={(e) => setSaveTags(e.target.value)}
                      placeholder="Tags (comma-separated): bull, base, bear"
                      className="w-full bg-obsidian border border-white/10 rounded px-3 py-1.5 text-[9px] text-white placeholder-rain/50 focus:border-gold/50 focus:outline-none transition-colors"
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSave}
                    disabled={!saveName.trim()}
                    className="flex-1 py-2 rounded text-[9px] font-black uppercase tracking-widest bg-gold/20 text-gold border border-gold/30 hover:bg-gold/30 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  >
                    Save Scenario
                  </button>
                  <button
                    onClick={handleGeneratePresets}
                    className="py-2 px-3 rounded text-[9px] font-black uppercase tracking-widest bg-lightBlue/10 text-lightBlue border border-lightBlue/20 hover:bg-lightBlue/20 transition-all"
                    title="Generate Bull/Base/Bear presets"
                  >
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Load Section ──────────────────────────────────────────────────── */}
      <div className="aegis-card border-lightBlue/20">
        <button
          onClick={() => toggleSection('load')}
          className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <FolderOpen className="w-3.5 h-3.5 text-lightBlue" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">
              Saved Scenarios ({scenarios.length})
            </span>
          </div>
          {expandedSection === 'load' ? (
            <ChevronUp className="w-3.5 h-3.5 text-rain" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-rain" />
          )}
        </button>

        <AnimatePresence>
          {expandedSection === 'load' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4 space-y-2 max-h-80 overflow-y-auto">
                {scenarios.length === 0 ? (
                  <div className="text-center py-8">
                    <p className="text-[10px] text-rain uppercase tracking-widest">No saved scenarios</p>
                    <p className="text-[8px] text-rain/60 mt-1">Save your current model or generate presets</p>
                  </div>
                ) : (
                  <AnimatePresence>
                    {scenarios.map(scenario => (
                      <ScenarioCard
                        key={scenario.id}
                        scenario={scenario}
                        isSelected={selectedIds.has(scenario.id)}
                        onSelect={() => toggleSelection(scenario.id)}
                        onLoad={() => handleLoad(scenario)}
                        onDelete={() => handleDelete(scenario.id)}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Compare Section ───────────────────────────────────────────────── */}
      <div className="aegis-card border-pumpkin/20">
        <button
          onClick={() => toggleSection('compare')}
          className="w-full p-4 flex items-center justify-between hover:bg-white/5 transition-colors"
        >
          <div className="flex items-center gap-2">
            <GitCompareArrows className="w-3.5 h-3.5 text-pumpkin" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">
              Compare ({selectedIds.size}/3 selected)
            </span>
          </div>
          {expandedSection === 'compare' ? (
            <ChevronUp className="w-3.5 h-3.5 text-rain" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-rain" />
          )}
        </button>

        <AnimatePresence>
          {expandedSection === 'compare' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="px-4 pb-4">
                {selectedIds.size < 2 ? (
                  <div className="text-center py-6">
                    <p className="text-[10px] text-rain uppercase tracking-widest">
                      Select 2-3 scenarios above to compare
                    </p>
                    <p className="text-[8px] text-rain/60 mt-1">
                      Click scenario cards to toggle selection
                    </p>
                  </div>
                ) : comparison ? (
                  <div className="space-y-4">
                    {/* Scenario Headers */}
                    <div className="grid gap-2" style={{ gridTemplateColumns: `140px repeat(${comparison.scenarios.length}, 1fr)` }}>
                      <div className="text-[8px] text-rain uppercase font-bold tracking-widest">Metric</div>
                      {comparison.scenarios.map((s, i) => (
                        <div key={s.id} className="text-center">
                          <span className={`text-[9px] font-black uppercase tracking-wider ${
                            i === 0 ? 'text-lightBlue' : i === 1 ? 'text-pumpkin' : 'text-emerald-400'
                          }`}>
                            {s.name}
                          </span>
                        </div>
                      ))}
                    </div>

                    {/* Output Metrics (first 5 rows are metrics) */}
                    <div className="border-t border-gold/20 pt-2">
                      <span className="text-[7px] text-gold uppercase font-black tracking-[0.3em]">Output Metrics</span>
                    </div>
                    {comparison.deltas.slice(0, 5).map((delta) => (
                      <div
                        key={delta.metric}
                        className="grid gap-2 py-1.5 border-b border-white/5"
                        style={{ gridTemplateColumns: `140px repeat(${comparison.scenarios.length}, 1fr)` }}
                      >
                        <span className="text-[9px] text-slate-400 font-bold">{delta.label}</span>
                        {delta.values.map((val, i) => (
                          <div key={i} className="text-center">
                            <span className="text-[10px] text-white font-black mono">
                              {delta.unit === '$' ? `$${val.toFixed(2)}` :
                               delta.unit === 'x' ? `${val.toFixed(1)}x` :
                               `${val.toFixed(1)}${delta.unit}`}
                            </span>
                            {i > 0 && delta.deltas[i] !== 0 && (
                              <span className={`block text-[7px] font-bold mono ${
                                delta.deltas[i] > 0 ? 'text-emerald-400' : 'text-rose-400'
                              }`}>
                                {delta.deltas[i] > 0 ? '+' : ''}{delta.deltas[i].toFixed(1)}{delta.unit}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    ))}

                    {/* Input Parameters */}
                    <div className="border-t border-lightBlue/20 pt-2 mt-3">
                      <span className="text-[7px] text-lightBlue uppercase font-black tracking-[0.3em]">Input Parameters</span>
                    </div>
                    {comparison.deltas.slice(5).map((delta) => (
                      <div
                        key={delta.metric}
                        className="grid gap-2 py-1 border-b border-white/5"
                        style={{ gridTemplateColumns: `140px repeat(${comparison.scenarios.length}, 1fr)` }}
                      >
                        <span className="text-[8px] text-slate-500 font-bold">{delta.label}</span>
                        {delta.values.map((val, i) => (
                          <div key={i} className="text-center">
                            <span className="text-[9px] text-slate-300 font-bold mono">
                              {delta.unit === 'bps' ? `${val.toFixed(0)}${delta.unit}` :
                               delta.unit === '%' ? `${val.toFixed(1)}%` :
                               val.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── Persistence Indicator ─────────────────────────────────────────── */}
      <div className="text-center">
        <span className="text-[7px] text-rain/50 uppercase tracking-widest">
          {user ? 'Synced to Cloud + Local Storage' : 'Local Storage Only'}
        </span>
      </div>
    </div>
  );
};

export default ScenarioManager;
