/**
 * ExportButton.tsx
 * Dropdown button with options to export data to Excel, CSV, PDF, or JSON
 * Matches existing dark theme styling with Lucide React icons
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, FileSpreadsheet, FileText, FileJson, ChevronDown } from 'lucide-react';
import {
  exportToExcel,
  exportToCSV,
  exportToPDF,
  exportTableToPDF,
  exportToJSON,
  ColumnDef,
  ExportOptions,
} from '../services/exportService';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ExportButtonProps {
  /** Data array to export */
  data: Record<string, any>[];
  /** Base filename (without extension) */
  filename: string;
  /** Column definitions for structured export */
  columns?: ColumnDef[];
  /** Sheet name for Excel export */
  sheetName?: string;
  /** Title for PDF header */
  title?: string;
  /** Element ID for DOM-based PDF export (overrides table-based PDF) */
  pdfElementId?: string;
  /** Additional CSS class */
  className?: string;
  /** Compact mode (icon-only on small screens) */
  compact?: boolean;
  /** Raw data object for JSON export (defaults to data prop) */
  rawData?: any;
  /** Callback after successful export */
  onExport?: (format: string) => void;
}

// ─── Export Format Definitions ────────────────────────────────────────────────

interface ExportFormat {
  id: string;
  label: string;
  sublabel: string;
  icon: React.ReactNode;
  action: () => Promise<boolean> | boolean;
  color: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

const ExportButton: React.FC<ExportButtonProps> = ({
  data,
  filename,
  columns,
  sheetName = 'Analysis',
  title,
  pdfElementId,
  className = '',
  compact = false,
  rawData,
  onExport,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [exporting, setExporting] = useState<string | null>(null);
  const [lastExport, setLastExport] = useState<{ format: string; success: boolean } | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Clear success indicator after delay
  useEffect(() => {
    if (lastExport) {
      const timer = setTimeout(() => setLastExport(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [lastExport]);

  const options: ExportOptions = {
    filename,
    sheetName,
    columns,
    title,
    includeTimestamp: true,
  };

  // ─── Export Handlers ────────────────────────────────────────────────────

  const handleExport = useCallback(async (format: ExportFormat) => {
    setExporting(format.id);
    try {
      const success = await format.action();
      setLastExport({ format: format.id, success });
      if (success && onExport) {
        onExport(format.id);
      }
    } catch (error) {
      setLastExport({ format: format.id, success: false });
    } finally {
      setExporting(null);
      setIsOpen(false);
    }
  }, [onExport]);

  // ─── Format Definitions ────────────────────────────────────────────────

  const formats: ExportFormat[] = [
    {
      id: 'excel',
      label: 'Excel (.xlsx)',
      sublabel: 'Full spreadsheet with formatting',
      icon: <FileSpreadsheet className="w-3.5 h-3.5" />,
      action: () => exportToExcel(data, options),
      color: 'text-emerald-400',
    },
    {
      id: 'csv',
      label: 'CSV (.csv)',
      sublabel: 'Universal compatibility',
      icon: <FileText className="w-3.5 h-3.5" />,
      action: () => exportToCSV(data, options),
      color: 'text-lightBlue',
    },
    {
      id: 'pdf',
      label: 'PDF (Print)',
      sublabel: 'Print-optimized report',
      icon: <FileText className="w-3.5 h-3.5" />,
      action: () => {
        if (pdfElementId) {
          return exportToPDF(pdfElementId, filename);
        }
        return exportTableToPDF(data, options);
      },
      color: 'text-rose-400',
    },
    {
      id: 'json',
      label: 'JSON (.json)',
      sublabel: 'Raw data export',
      icon: <FileJson className="w-3.5 h-3.5" />,
      action: () => exportToJSON(rawData || data, filename),
      color: 'text-pumpkin',
    },
  ];

  // ─── Render ─────────────────────────────────────────────────────────────

  const hasData = data && data.length > 0;

  return (
    <div ref={dropdownRef} className={`relative inline-block ${className}`}>
      {/* Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={!hasData}
        className={`
          flex items-center gap-2 px-3 py-2 rounded-lg border transition-all duration-200
          ${hasData
            ? 'bg-white/5 border-white/10 text-white hover:bg-white/10 hover:border-white/20'
            : 'bg-white/3 border-white/5 text-rain/50 cursor-not-allowed'
          }
          ${lastExport?.success ? 'border-emerald-500/40 bg-emerald-500/10' : ''}
          ${isOpen ? 'border-gold/40 bg-gold/10' : ''}
        `}
        title={hasData ? 'Export data' : 'No data to export'}
      >
        {exporting ? (
          <div className="w-3.5 h-3.5 border-2 border-gold border-t-transparent rounded-full animate-spin" />
        ) : lastExport?.success ? (
          <svg className="w-3.5 h-3.5 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        ) : (
          <Download className="w-3.5 h-3.5" />
        )}

        {!compact && (
          <span className="text-[9px] font-black uppercase tracking-widest">
            {exporting ? 'Exporting...' : lastExport?.success ? 'Exported' : 'Export'}
          </span>
        )}

        <ChevronDown className={`w-3 h-3 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1 z-50 w-56 bg-obsidian border border-white/15 rounded-lg shadow-2xl shadow-black/50 overflow-hidden"
          >
            {/* Header */}
            <div className="px-3 py-2 border-b border-white/10">
              <span className="text-[8px] font-black text-rain uppercase tracking-[0.3em]">
                Export Format
              </span>
              <span className="text-[7px] text-rain/50 block mt-0.5">
                {data.length} row{data.length !== 1 ? 's' : ''}
              </span>
            </div>

            {/* Format Options */}
            <div className="py-1">
              {formats.map((format) => (
                <button
                  key={format.id}
                  onClick={() => handleExport(format)}
                  disabled={!!exporting}
                  className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors disabled:opacity-50 text-left"
                >
                  <span className={format.color}>{format.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="text-[10px] font-bold text-white block">{format.label}</span>
                    <span className="text-[7px] text-rain block">{format.sublabel}</span>
                  </div>
                  {exporting === format.id && (
                    <div className="w-3 h-3 border-2 border-gold border-t-transparent rounded-full animate-spin" />
                  )}
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="px-3 py-1.5 border-t border-white/5">
              <span className="text-[6px] text-rain/40 uppercase tracking-widest">
                REITLens V1.0 Institutional Export
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExportButton;
