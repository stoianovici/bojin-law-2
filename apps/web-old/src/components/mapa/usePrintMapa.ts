/**
 * usePrintMapa Hook
 * OPS-103: Mapa Print/Export Functionality
 *
 * Provides print functionality for mape, generating a print window
 * with proper styling and formatting.
 */

import { useCallback } from 'react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import type { Mapa, MapaSlot } from '../../hooks/useMapa';
import type { PrintOptions } from './MapaPrintView';

// ============================================================================
// Types
// ============================================================================

export interface UsePrintMapaResult {
  printMapa: (
    mapa: Mapa,
    caseName: string,
    caseNumber: string,
    options?: Partial<PrintOptions>
  ) => void;
}

// ============================================================================
// Default Options
// ============================================================================

const DEFAULT_PRINT_OPTIONS: PrintOptions = {
  includeTableOfContents: true,
  includeMissingPlaceholders: false,
  pageNumbering: 'none',
  headerFooter: true,
  format: 'a4',
};

// ============================================================================
// Print Styles
// ============================================================================

const PRINT_STYLES = `
/* Reset and base styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Times New Roman', 'Georgia', serif;
  font-size: 12pt;
  line-height: 1.6;
  color: #000;
  background: #fff;
}

/* Print container */
.print-container {
  width: 100%;
}

/* Page styles */
.print-page {
  page-break-after: always;
  min-height: 100vh;
  padding: 2cm;
}

.print-page:last-child {
  page-break-after: avoid;
}

/* Cover page */
.cover-page {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.cover-content {
  max-width: 80%;
}

.cover-title {
  font-size: 28pt;
  font-weight: bold;
  margin-bottom: 1cm;
  border-bottom: 2px solid #000;
  padding-bottom: 0.5cm;
}

.cover-description {
  font-size: 14pt;
  font-style: italic;
  margin-bottom: 2cm;
  color: #444;
}

.cover-details {
  margin-bottom: 2cm;
}

.cover-case {
  font-size: 14pt;
  margin-bottom: 0.3cm;
}

.cover-case-name {
  font-size: 16pt;
  font-weight: 500;
  margin-bottom: 0.5cm;
}

.cover-date {
  font-size: 12pt;
  color: #666;
}

.cover-stats {
  margin-top: 2cm;
  padding: 1cm;
  border: 1px solid #ccc;
  border-radius: 4px;
  background: #f9f9f9;
}

.cover-stats p {
  margin: 0.3cm 0;
}

/* Table of Contents */
.toc-page {
  padding-top: 3cm;
}

.toc-title {
  font-size: 20pt;
  font-weight: bold;
  margin-bottom: 1cm;
  text-align: center;
  border-bottom: 1px solid #000;
  padding-bottom: 0.5cm;
}

.toc-table {
  width: 100%;
  border-collapse: collapse;
  margin: 1cm 0;
}

.toc-table th,
.toc-table td {
  padding: 0.3cm 0.5cm;
  text-align: left;
  border-bottom: 1px solid #ddd;
  vertical-align: top;
}

.toc-table th {
  font-weight: bold;
  background: #f5f5f5;
  border-bottom: 2px solid #999;
}

.toc-col-nr {
  width: 8%;
  text-align: center;
}

.toc-col-name {
  width: 50%;
}

.toc-col-category {
  width: 20%;
}

.toc-col-status {
  width: 22%;
  text-align: center;
}

.toc-row-missing {
  background: #fef2f2;
}

.toc-slot-name {
  display: block;
  font-weight: 500;
}

.toc-document-name {
  display: block;
  font-size: 10pt;
  color: #666;
  margin-top: 0.2cm;
}

.status-present {
  color: #059669;
  font-weight: 500;
}

.status-missing {
  color: #dc2626;
  font-weight: 500;
}

.status-optional {
  color: #6b7280;
}

.toc-summary {
  margin-top: 1cm;
  padding: 0.5cm 1cm;
  background: #f5f5f5;
  border: 1px solid #ddd;
}

.toc-summary-item {
  display: flex;
  justify-content: space-between;
  margin: 0.2cm 0;
}

.toc-summary-label {
  font-weight: 500;
}

.toc-summary-present {
  color: #059669;
  font-weight: bold;
}

.toc-summary-missing {
  color: #dc2626;
  font-weight: bold;
}

/* Missing document pages */
.missing-page {
  display: flex;
  justify-content: center;
  align-items: center;
}

.missing-placeholder {
  width: 80%;
  max-width: 500px;
  border: 3px dashed #ccc;
  padding: 2cm;
  text-align: center;
}

.missing-header {
  margin-bottom: 1cm;
}

.missing-number {
  display: block;
  font-size: 16pt;
  color: #666;
  margin-bottom: 0.3cm;
}

.missing-title {
  font-size: 18pt;
  font-weight: bold;
}

.missing-content {
  margin-top: 1cm;
}

.missing-label {
  font-size: 24pt;
  color: #dc2626;
  font-weight: bold;
  margin-bottom: 1cm;
}

.missing-description {
  font-style: italic;
  color: #666;
  margin-bottom: 0.5cm;
}

.missing-category {
  color: #666;
  margin-bottom: 0.3cm;
}

.missing-required {
  font-size: 10pt;
  color: #999;
  text-transform: uppercase;
}

/* Print media adjustments */
@media print {
  @page {
    size: A4;
    margin: 1.5cm;
  }

  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }

  .print-page {
    padding: 0;
    min-height: auto;
  }

  .cover-page {
    min-height: calc(100vh - 3cm);
  }
}
`;

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Convert a number to Roman numeral
 */
function toRomanNumeral(num: number): string {
  const romanNumerals: [number, string][] = [
    [1000, 'M'],
    [900, 'CM'],
    [500, 'D'],
    [400, 'CD'],
    [100, 'C'],
    [90, 'XC'],
    [50, 'L'],
    [40, 'XL'],
    [10, 'X'],
    [9, 'IX'],
    [5, 'V'],
    [4, 'IV'],
    [1, 'I'],
  ];

  let result = '';
  let remaining = num;

  for (const [value, symbol] of romanNumerals) {
    while (remaining >= value) {
      result += symbol;
      remaining -= value;
    }
  }

  return result;
}

/**
 * Escape HTML special characters
 */
function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (char) => map[char] || char);
}

/**
 * Get file type icon for print
 */
function getFileTypeIcon(fileType: string): string {
  const type = fileType.toLowerCase();
  if (type.includes('pdf')) return '[PDF]';
  if (type.includes('word') || type.includes('doc')) return '[DOC]';
  if (type.includes('excel') || type.includes('xls')) return '[XLS]';
  if (type.includes('image') || type.includes('jpg') || type.includes('png')) return '[IMG]';
  return '[FILE]';
}

// ============================================================================
// HTML Generation
// ============================================================================

function generateCoverPageHtml(mapa: Mapa, caseName: string, caseNumber: string): string {
  return `
    <section class="print-page cover-page">
      <div class="cover-content">
        <h1 class="cover-title">${escapeHtml(mapa.name)}</h1>
        ${mapa.description ? `<p class="cover-description">${escapeHtml(mapa.description)}</p>` : ''}
        <div class="cover-details">
          <p class="cover-case"><strong>Dosar:</strong> ${escapeHtml(caseNumber)}</p>
          <p class="cover-case-name">${escapeHtml(caseName)}</p>
          <p class="cover-date"><strong>Data generării:</strong> ${format(new Date(), 'dd MMMM yyyy, HH:mm', { locale: ro })}</p>
        </div>
        <div class="cover-stats">
          <p><strong>Total poziții:</strong> ${mapa.completionStatus.totalSlots}</p>
          <p><strong>Documente prezente:</strong> ${mapa.completionStatus.filledSlots}</p>
          <p><strong>Documente lipsă:</strong> ${mapa.completionStatus.totalSlots - mapa.completionStatus.filledSlots}</p>
          <p><strong>Completare:</strong> ${mapa.completionStatus.percentComplete}%</p>
        </div>
      </div>
    </section>
  `;
}

function generateTocRowHtml(slot: MapaSlot, index: number): string {
  const statusHtml = slot.document
    ? '<span class="status-present">✓ Prezent</span>'
    : slot.required
      ? '<span class="status-missing">✗ Lipsă</span>'
      : '<span class="status-optional">— Opțional</span>';

  const documentInfo = slot.document
    ? `<span class="toc-document-name">${getFileTypeIcon(slot.document.document.fileType)} ${escapeHtml(slot.document.document.fileName)}</span>`
    : '';

  return `
    <tr class="${slot.document ? 'toc-row' : 'toc-row toc-row-missing'}">
      <td class="toc-col-nr">${toRomanNumeral(index + 1)}</td>
      <td class="toc-col-name">
        <span class="toc-slot-name">${escapeHtml(slot.name)}</span>
        ${documentInfo}
      </td>
      <td class="toc-col-category">${slot.category ? escapeHtml(slot.category) : '—'}</td>
      <td class="toc-col-status">${statusHtml}</td>
    </tr>
  `;
}

function generateTocHtml(mapa: Mapa): string {
  const sortedSlots = [...mapa.slots].sort((a, b) => a.order - b.order);
  const rowsHtml = sortedSlots.map((slot, index) => generateTocRowHtml(slot, index)).join('');
  const missingRequired =
    mapa.completionStatus.requiredSlots - mapa.completionStatus.filledRequiredSlots;

  return `
    <section class="print-page toc-page">
      <h2 class="toc-title">Cuprins</h2>
      <table class="toc-table">
        <thead>
          <tr>
            <th class="toc-col-nr">Nr.</th>
            <th class="toc-col-name">Denumire Document</th>
            <th class="toc-col-category">Categorie</th>
            <th class="toc-col-status">Status</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
      </table>
      <div class="toc-summary">
        <div class="toc-summary-item">
          <span class="toc-summary-label">Total poziții:</span>
          <span class="toc-summary-value">${mapa.completionStatus.totalSlots}</span>
        </div>
        <div class="toc-summary-item">
          <span class="toc-summary-label">Documente prezente:</span>
          <span class="toc-summary-value toc-summary-present">${mapa.completionStatus.filledSlots}</span>
        </div>
        <div class="toc-summary-item">
          <span class="toc-summary-label">Documente obligatorii lipsă:</span>
          <span class="toc-summary-value toc-summary-missing">${missingRequired}</span>
        </div>
      </div>
    </section>
  `;
}

function generateMissingPageHtml(slot: MapaSlot, index: number): string {
  return `
    <section class="print-page missing-page">
      <div class="missing-placeholder">
        <div class="missing-header">
          <span class="missing-number">${toRomanNumeral(index + 1)}</span>
          <h3 class="missing-title">${escapeHtml(slot.name)}</h3>
        </div>
        <div class="missing-content">
          <p class="missing-label">DOCUMENT LIPSĂ</p>
          ${slot.description ? `<p class="missing-description">${escapeHtml(slot.description)}</p>` : ''}
          ${slot.category ? `<p class="missing-category">Categorie: ${escapeHtml(slot.category)}</p>` : ''}
          <p class="missing-required">${slot.required ? 'Obligatoriu' : 'Opțional'}</p>
        </div>
      </div>
    </section>
  `;
}

function generatePrintHtml(
  mapa: Mapa,
  caseName: string,
  caseNumber: string,
  options: PrintOptions
): string {
  const coverHtml = generateCoverPageHtml(mapa, caseName, caseNumber);
  const tocHtml = options.includeTableOfContents ? generateTocHtml(mapa) : '';

  let missingPagesHtml = '';
  if (options.includeMissingPlaceholders) {
    const sortedSlots = [...mapa.slots].sort((a, b) => a.order - b.order);
    const missingRequired = sortedSlots.filter((slot) => !slot.document && slot.required);
    missingPagesHtml = missingRequired
      .map((slot) => {
        const index = sortedSlots.findIndex((s) => s.id === slot.id);
        return generateMissingPageHtml(slot, index);
      })
      .join('');
  }

  return `
<!DOCTYPE html>
<html lang="ro">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(mapa.name)} - Tipărire</title>
  <style>${PRINT_STYLES}</style>
</head>
<body>
  <div class="print-container">
    ${coverHtml}
    ${tocHtml}
    ${missingPagesHtml}
  </div>
  <script>
    // Auto-print when ready
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 500);
    };
  </script>
</body>
</html>
  `;
}

// ============================================================================
// Hook
// ============================================================================

/**
 * Hook to print a mapa
 */
export function usePrintMapa(): UsePrintMapaResult {
  const printMapa = useCallback(
    (mapa: Mapa, caseName: string, caseNumber: string, options?: Partial<PrintOptions>) => {
      const mergedOptions: PrintOptions = {
        ...DEFAULT_PRINT_OPTIONS,
        ...options,
      };

      // Generate HTML
      const printHtml = generatePrintHtml(mapa, caseName, caseNumber, mergedOptions);

      // Open print window
      const printWindow = window.open('', '_blank', 'width=800,height=600');
      if (!printWindow) {
        alert('Nu s-a putut deschide fereastra de tipărire. Verificați setările de pop-up.');
        return;
      }

      // Write content to print window
      printWindow.document.write(printHtml);
      printWindow.document.close();
    },
    []
  );

  return { printMapa };
}

export default usePrintMapa;
