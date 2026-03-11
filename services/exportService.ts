/**
 * Export Service
 * Excel export via SheetJS (xlsx) and PDF export via browser print
 *
 * DEPENDENCY: xlsx must be installed: npm install xlsx
 * The service gracefully handles the case where xlsx is not yet installed.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ColumnDef {
  key: string;
  header: string;
  format?: (value: any) => string;
  width?: number;
}

export interface ExportOptions {
  filename: string;
  sheetName?: string;
  columns?: ColumnDef[];
  title?: string;
  subtitle?: string;
  includeTimestamp?: boolean;
}

// ─── Excel Export ─────────────────────────────────────────────────────────────

/**
 * Export data to Excel (.xlsx) using SheetJS
 * Falls back to CSV if xlsx library is not available
 */
export const exportToExcel = async (
  data: Record<string, any>[],
  options: ExportOptions
): Promise<boolean> => {
  const {
    filename,
    sheetName = 'Sheet1',
    columns,
    title,
    includeTimestamp = true,
  } = options;

  try {
    // Dynamic import of xlsx (SheetJS)
    const XLSX = await import('xlsx');

    // Determine columns
    const cols: ColumnDef[] = columns || Object.keys(data[0] || {}).map(key => ({
      key,
      header: key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
    }));

    // Build header row
    const headers = cols.map(c => c.header);

    // Build data rows
    const rows = data.map(item =>
      cols.map(col => {
        const value = getNestedValue(item, col.key);
        return col.format ? col.format(value) : value;
      })
    );

    // Create worksheet data
    const wsData: any[][] = [];

    // Optional title row
    if (title) {
      wsData.push([title]);
      wsData.push([]); // Empty row
    }

    // Headers
    wsData.push(headers);

    // Data rows
    rows.forEach(row => wsData.push(row));

    // Timestamp footer
    if (includeTimestamp) {
      wsData.push([]);
      wsData.push([`Generated: ${new Date().toLocaleString()} | REITLens V1.0`]);
    }

    // Create worksheet and workbook
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Set column widths
    const colWidths = cols.map(col => ({
      wch: col.width || Math.max(col.header.length, 12),
    }));
    ws['!cols'] = colWidths;

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // Download
    const safeName = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
    XLSX.writeFile(wb, safeName);

    // Excel file saved
    return true;
  } catch (error: any) {
    // If xlsx is not installed, fall back to CSV
    if (error.message?.includes('Failed to fetch') || error.code === 'MODULE_NOT_FOUND' || error.message?.includes('Cannot find module')) {
      // xlsx library not found, falling back to CSV
      return exportToCSV(data, options);
    }
    // Excel export failed
    return false;
  }
};

// ─── CSV Fallback ─────────────────────────────────────────────────────────────

/**
 * Export data to CSV (fallback when xlsx is not available)
 */
export const exportToCSV = (
  data: Record<string, any>[],
  options: ExportOptions
): boolean => {
  try {
    const { filename, columns } = options;

    const cols: ColumnDef[] = columns || Object.keys(data[0] || {}).map(key => ({
      key,
      header: key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
    }));

    const headers = cols.map(c => escapeCSV(c.header));
    const rows = data.map(item =>
      cols.map(col => {
        const value = getNestedValue(item, col.key);
        const formatted = col.format ? col.format(value) : value;
        return escapeCSV(String(formatted ?? ''));
      })
    );

    const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    downloadBlob(blob, filename.replace('.xlsx', '') + '.csv');
    // CSV file saved
    return true;
  } catch (error) {
    // CSV export failed
    return false;
  }
};

// ─── PDF Export ───────────────────────────────────────────────────────────────

/**
 * Export a DOM element to PDF using the browser's print dialog
 * Creates a new window with print-optimized styling
 */
export const exportToPDF = (
  elementId: string,
  filename: string
): boolean => {
  try {
    const element = document.getElementById(elementId);
    if (!element) {
      // element not found for PDF export
      return false;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      // could not open print window
      return false;
    }

    const styles = `
      <style>
        @page {
          size: A4 landscape;
          margin: 15mm;
        }
        * {
          box-sizing: border-box;
        }
        body {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          color: #1a1a2e;
          background: #ffffff;
          padding: 20px;
          font-size: 11px;
          line-height: 1.4;
        }
        .print-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          border-bottom: 2px solid #1a1a2e;
          padding-bottom: 12px;
          margin-bottom: 20px;
        }
        .print-header h1 {
          font-size: 18px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        .print-header .meta {
          text-align: right;
          font-size: 9px;
          color: #666;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          margin: 10px 0;
        }
        th {
          background: #1a1a2e;
          color: #ffffff;
          padding: 8px 12px;
          text-align: left;
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.1em;
        }
        td {
          padding: 6px 12px;
          border-bottom: 1px solid #e5e7eb;
          font-size: 10px;
        }
        tr:nth-child(even) {
          background: #f8f9fa;
        }
        .positive { color: #059669; }
        .negative { color: #dc2626; }
        .footer {
          margin-top: 30px;
          padding-top: 10px;
          border-top: 1px solid #ccc;
          font-size: 8px;
          color: #999;
          text-align: center;
        }
      </style>
    `;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${filename} - REITLens Export</title>
          ${styles}
        </head>
        <body>
          <div class="print-header">
            <h1>REITLens Analysis Report</h1>
            <div class="meta">
              <div>${filename}</div>
              <div>${new Date().toLocaleString()}</div>
            </div>
          </div>
          ${element.innerHTML}
          <div class="footer">
            Generated by REITLens V1.0 | Institutional REIT Research Terminal | ${new Date().toLocaleDateString()}
          </div>
        </body>
      </html>
    `);

    printWindow.document.close();

    // Wait for content to render, then trigger print
    setTimeout(() => {
      printWindow.print();
      // Close after print dialog is handled
      setTimeout(() => printWindow.close(), 500);
    }, 300);

    // PDF print dialog opened
    return true;
  } catch (error) {
    // PDF export failed
    return false;
  }
};

/**
 * Export tabular data to PDF by building an HTML table
 */
export const exportTableToPDF = (
  data: Record<string, any>[],
  options: ExportOptions
): boolean => {
  const { filename, columns, title } = options;

  const cols: ColumnDef[] = columns || Object.keys(data[0] || {}).map(key => ({
    key,
    header: key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()),
  }));

  // Create a temporary container with the table
  const container = document.createElement('div');
  container.id = '__reitlens_export_temp';
  container.style.position = 'absolute';
  container.style.left = '-9999px';

  if (title) {
    container.innerHTML += `<h2 style="font-size:14px;font-weight:900;margin-bottom:10px;text-transform:uppercase;letter-spacing:0.1em;">${title}</h2>`;
  }

  let tableHTML = '<table><thead><tr>';
  cols.forEach(col => {
    tableHTML += `<th>${col.header}</th>`;
  });
  tableHTML += '</tr></thead><tbody>';

  data.forEach(item => {
    tableHTML += '<tr>';
    cols.forEach(col => {
      const value = getNestedValue(item, col.key);
      const formatted = col.format ? col.format(value) : String(value ?? '');
      const numVal = parseFloat(String(value));
      const cssClass = !isNaN(numVal) ? (numVal > 0 ? 'positive' : numVal < 0 ? 'negative' : '') : '';
      tableHTML += `<td class="${cssClass}">${formatted}</td>`;
    });
    tableHTML += '</tr>';
  });

  tableHTML += '</tbody></table>';
  container.innerHTML += tableHTML;

  document.body.appendChild(container);
  const result = exportToPDF('__reitlens_export_temp', filename);
  document.body.removeChild(container);

  return result;
};

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Get a nested value from an object using dot notation (e.g., "wacc.rf")
 */
const getNestedValue = (obj: any, path: string): any => {
  return path.split('.').reduce((acc, part) => acc?.[part], obj);
};

/**
 * Escape a value for CSV format
 */
const escapeCSV = (value: string): string => {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

/**
 * Trigger a file download from a Blob
 */
const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Export data as JSON (for debugging / data portability)
 */
export const exportToJSON = (
  data: any,
  filename: string
): boolean => {
  try {
    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: 'application/json' });
    downloadBlob(blob, filename.endsWith('.json') ? filename : `${filename}.json`);
    return true;
  } catch (error) {
    // JSON export failed
    return false;
  }
};
