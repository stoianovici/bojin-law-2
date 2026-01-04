import type { Mapa } from '@/types/mapa';

interface PrintOptions {
  includeCoverPage?: boolean;
  includeEmptySlots?: boolean;
  showStatusBadges?: boolean;
}

const defaultOptions: PrintOptions = {
  includeCoverPage: true,
  includeEmptySlots: true,
  showStatusBadges: true,
};

/**
 * Generate print-friendly HTML for a mapa
 */
export function generateMapaPrintHtml(
  mapa: Mapa,
  caseName: string,
  firmName: string,
  options: PrintOptions = {}
): string {
  const opts = { ...defaultOptions, ...options };
  const printDate = new Date().toLocaleDateString('ro-RO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Group slots by category
  const groupedSlots: Record<string, typeof mapa.slots> = {};
  mapa.slots.forEach((slot) => {
    if (!opts.includeEmptySlots && !slot.document) return;
    if (!groupedSlots[slot.category]) {
      groupedSlots[slot.category] = [];
    }
    groupedSlots[slot.category].push(slot);
  });

  // Category display names
  const categoryNames: Record<string, string> = {
    acte_procedurale: 'Acte Procedurale',
    dovezi: 'Dovezi',
    corespondenta: 'Corespondență',
    hotarari: 'Hotărâri',
    diverse: 'Diverse',
    acte_constitutive: 'Acte Constitutive',
    acte_identitate: 'Acte de Identitate',
    declaratii: 'Declarații',
    dovezi_sediu: 'Dovezi Sediu',
    taxe: 'Taxe și Tarife',
  };

  // Generate cover page HTML
  const coverPageHtml = opts.includeCoverPage
    ? `
    <div class="cover-page">
      <div class="firm-header">
        <h1 class="firm-name">${firmName}</h1>
      </div>

      <div class="mapa-info">
        <h2 class="mapa-title">${mapa.name}</h2>
        ${mapa.description ? `<p class="mapa-description">${mapa.description}</p>` : ''}
        <div class="case-reference">
          <span class="label">Dosar:</span>
          <span class="value">${caseName}</span>
        </div>
      </div>

      <div class="completion-summary">
        <h3>Sumar Completare</h3>
        <div class="stats">
          <div class="stat">
            <span class="stat-value">${mapa.completionStatus.filledSlots}</span>
            <span class="stat-label">Documente completate</span>
          </div>
          <div class="stat">
            <span class="stat-value">${mapa.completionStatus.totalSlots}</span>
            <span class="stat-label">Total sloturi</span>
          </div>
          <div class="stat">
            <span class="stat-value">${mapa.completionStatus.percentComplete}%</span>
            <span class="stat-label">Progres</span>
          </div>
        </div>
        ${
          mapa.completionStatus.missingRequired.length > 0
            ? `
          <div class="missing-required">
            <span class="warning">Documente obligatorii lipsă:</span>
            <ul>
              ${mapa.completionStatus.missingRequired.map((name) => `<li>${name}</li>`).join('')}
            </ul>
          </div>
        `
            : `
          <div class="complete-notice">
            <span class="success">Toate documentele obligatorii sunt completate</span>
          </div>
        `
        }
      </div>

      <div class="table-of-contents">
        <h3>Cuprins</h3>
        <ol>
          ${Object.entries(groupedSlots)
            .map(
              ([categoryId, slots]) => `
            <li>
              <span class="toc-category">${categoryNames[categoryId] || categoryId}</span>
              <span class="toc-count">(${slots.length} documente)</span>
            </li>
          `
            )
            .join('')}
        </ol>
      </div>

      <div class="print-footer">
        <span>Tipărit la: ${printDate}</span>
      </div>
    </div>
  `
    : '';

  // Generate slots list HTML
  const slotsListHtml = Object.entries(groupedSlots)
    .map(
      ([categoryId, slots]) => `
    <div class="category-section">
      <h2 class="category-title">${categoryNames[categoryId] || categoryId}</h2>
      <table class="slots-table">
        <thead>
          <tr>
            <th class="col-order">#</th>
            <th class="col-name">Document</th>
            <th class="col-status">Status</th>
            <th class="col-file">Fișier</th>
            <th class="col-date">Data</th>
          </tr>
        </thead>
        <tbody>
          ${slots
            .map(
              (slot) => `
            <tr class="${slot.document ? 'filled' : 'empty'} ${slot.required ? 'required' : ''}">
              <td class="col-order">${slot.order}</td>
              <td class="col-name">
                ${slot.name}
                ${slot.required ? '<span class="required-badge">*</span>' : ''}
                ${slot.description ? `<br><small class="slot-description">${slot.description}</small>` : ''}
              </td>
              <td class="col-status">
                ${opts.showStatusBadges ? getStatusBadgeHtml(slot.status) : ''}
              </td>
              <td class="col-file">
                ${slot.document ? slot.document.fileName : '<span class="empty-slot">-</span>'}
              </td>
              <td class="col-date">
                ${slot.assignedAt ? new Date(slot.assignedAt).toLocaleDateString('ro-RO') : '-'}
              </td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    </div>
  `
    )
    .join('');

  // Complete HTML document with print styles
  return `
    <!DOCTYPE html>
    <html lang="ro">
    <head>
      <meta charset="UTF-8">
      <title>${mapa.name} - ${caseName}</title>
      <style>
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }

        body {
          font-family: 'Times New Roman', Times, serif;
          font-size: 12pt;
          line-height: 1.5;
          color: #000;
          background: #fff;
        }

        /* Cover Page */
        .cover-page {
          page-break-after: always;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          padding: 2cm;
        }

        .firm-header {
          text-align: center;
          margin-bottom: 3cm;
          padding-bottom: 1cm;
          border-bottom: 2px solid #000;
        }

        .firm-name {
          font-size: 24pt;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 2px;
        }

        .mapa-info {
          text-align: center;
          margin-bottom: 2cm;
        }

        .mapa-title {
          font-size: 20pt;
          font-weight: bold;
          margin-bottom: 0.5cm;
        }

        .mapa-description {
          font-size: 12pt;
          color: #444;
          margin-bottom: 1cm;
        }

        .case-reference {
          font-size: 14pt;
        }

        .case-reference .label {
          font-weight: bold;
        }

        .completion-summary {
          background: #f5f5f5;
          padding: 1cm;
          margin-bottom: 2cm;
          border-radius: 4px;
        }

        .completion-summary h3 {
          font-size: 14pt;
          margin-bottom: 0.5cm;
          text-align: center;
        }

        .stats {
          display: flex;
          justify-content: space-around;
          margin-bottom: 0.5cm;
        }

        .stat {
          text-align: center;
        }

        .stat-value {
          display: block;
          font-size: 24pt;
          font-weight: bold;
        }

        .stat-label {
          font-size: 10pt;
          color: #666;
        }

        .missing-required {
          margin-top: 1cm;
          padding: 0.5cm;
          background: #fff3cd;
          border-left: 4px solid #ffc107;
        }

        .missing-required .warning {
          font-weight: bold;
          color: #856404;
        }

        .missing-required ul {
          margin-top: 0.3cm;
          margin-left: 1cm;
        }

        .complete-notice {
          margin-top: 1cm;
          padding: 0.5cm;
          background: #d4edda;
          border-left: 4px solid #28a745;
          text-align: center;
        }

        .complete-notice .success {
          color: #155724;
          font-weight: bold;
        }

        .table-of-contents {
          flex-grow: 1;
        }

        .table-of-contents h3 {
          font-size: 14pt;
          margin-bottom: 0.5cm;
        }

        .table-of-contents ol {
          margin-left: 1cm;
        }

        .table-of-contents li {
          margin-bottom: 0.3cm;
        }

        .toc-category {
          font-weight: bold;
        }

        .toc-count {
          color: #666;
          font-size: 10pt;
        }

        .print-footer {
          text-align: center;
          padding-top: 1cm;
          border-top: 1px solid #ccc;
          font-size: 10pt;
          color: #666;
        }

        /* Slots List */
        .category-section {
          margin-bottom: 1cm;
          page-break-inside: avoid;
        }

        .category-title {
          font-size: 14pt;
          font-weight: bold;
          padding: 0.3cm 0;
          border-bottom: 1px solid #000;
          margin-bottom: 0.5cm;
        }

        .slots-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10pt;
        }

        .slots-table th,
        .slots-table td {
          padding: 0.3cm 0.2cm;
          text-align: left;
          border-bottom: 1px solid #ddd;
        }

        .slots-table th {
          font-weight: bold;
          background: #f5f5f5;
          border-bottom: 2px solid #000;
        }

        .col-order {
          width: 5%;
          text-align: center;
        }

        .col-name {
          width: 35%;
        }

        .col-status {
          width: 15%;
        }

        .col-file {
          width: 30%;
        }

        .col-date {
          width: 15%;
        }

        .required-badge {
          color: #dc3545;
          font-weight: bold;
        }

        .slot-description {
          color: #666;
          font-size: 9pt;
        }

        .empty-slot {
          color: #999;
        }

        tr.empty {
          background: #fafafa;
        }

        tr.empty.required {
          background: #fff3cd;
        }

        /* Status Badges */
        .status-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 3px;
          font-size: 9pt;
          font-weight: bold;
        }

        .status-pending {
          background: #e9ecef;
          color: #6c757d;
        }

        .status-requested {
          background: #cce5ff;
          color: #004085;
        }

        .status-received {
          background: #d4edda;
          color: #155724;
        }

        .status-final {
          background: #c3e6cb;
          color: #0d5524;
        }

        /* Print Media Query */
        @media print {
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .cover-page {
            height: 100vh;
          }

          .category-section {
            page-break-inside: avoid;
          }
        }

        /* Page margins for print */
        @page {
          margin: 1.5cm;
        }
      </style>
    </head>
    <body>
      ${coverPageHtml}
      <div class="content">
        ${slotsListHtml}
      </div>
    </body>
    </html>
  `;
}

/**
 * Get status badge HTML
 */
function getStatusBadgeHtml(status: string): string {
  const statusLabels: Record<string, string> = {
    pending: 'În așteptare',
    requested: 'Solicitat',
    received: 'Primit',
    final: 'Finalizat',
  };
  return `<span class="status-badge status-${status}">${statusLabels[status] || status}</span>`;
}

/**
 * Print a mapa by opening a new window with print-formatted content
 */
export function printMapa(
  mapa: Mapa,
  caseName: string,
  firmName: string = 'Cabinet de Avocatură',
  options?: PrintOptions
): void {
  const html = generateMapaPrintHtml(mapa, caseName, firmName, options);

  // Open a new window with the print content
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    console.error('Could not open print window. Please allow pop-ups.');
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();

  // Wait for content to load, then trigger print dialog
  printWindow.onload = () => {
    printWindow.focus();
    printWindow.print();
  };
}

/**
 * Download mapa as HTML file (for PDF conversion via browser)
 */
export function downloadMapaHtml(
  mapa: Mapa,
  caseName: string,
  firmName: string = 'Cabinet de Avocatură',
  options?: PrintOptions
): void {
  const html = generateMapaPrintHtml(mapa, caseName, firmName, options);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${mapa.name.replace(/\s+/g, '_')}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
