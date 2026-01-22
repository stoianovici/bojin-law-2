import type { Mapa, MapaSlot } from '@/types/mapa';

// ============================================================================
// Types
// ============================================================================

interface PrintOptions {
  includeCoverPage?: boolean;
  includeEmptySlots?: boolean;
  showStatusBadges?: boolean;
  /** Include actual document content (images, PDFs) in the print */
  includeDocuments?: boolean;
  /** Only print the cover page (no slots list) */
  coverPageOnly?: boolean;
}

const defaultOptions: PrintOptions = {
  includeCoverPage: true,
  includeEmptySlots: true,
  showStatusBadges: true,
  includeDocuments: false,
  coverPageOnly: false,
};

/** Document URLs for embedding in print */
export interface DocumentUrls {
  [documentId: string]: {
    downloadUrl: string | null;
    thumbnailUrl: string | null;
    fileType: string;
    fileName: string;
  };
}

// File type helpers
const IMAGE_TYPES = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];
const PDF_TYPES = ['pdf'];

function isImageType(fileType: string | undefined): boolean {
  return IMAGE_TYPES.includes((fileType || '').toLowerCase());
}

function isPdfType(fileType: string | undefined): boolean {
  return PDF_TYPES.includes((fileType || '').toLowerCase());
}

/**
 * Extract the actual document from a slot, handling both structures:
 * - GET_MAPA: slot.document is the Document directly
 * - GET_MAPAS: slot.document.document is the nested Document (CaseDocument wrapper)
 */
function getDocumentFromSlot(slot: MapaSlot): {
  id: string;
  fileName: string;
  fileType: string;
  thumbnailUrl: string | null;
} | null {
  if (!slot.document) return null;

  // Check if it's the nested structure (CaseDocument wrapper)
  const doc = slot.document as any;
  if (doc.document && doc.document.id) {
    return {
      id: doc.document.id,
      fileName: doc.document.fileName || '',
      fileType: doc.document.fileType || '',
      thumbnailUrl: doc.document.thumbnailUrl || null,
    };
  }

  // Direct document structure
  if (doc.id && doc.fileName) {
    return {
      id: doc.id,
      fileName: doc.fileName || '',
      fileType: doc.fileType || '',
      thumbnailUrl: doc.thumbnailUrl || null,
    };
  }

  return null;
}

/**
 * Generate print-friendly HTML for a mapa
 * @param documentUrls - Optional map of document IDs to their download/thumbnail URLs for embedding
 */
export function generateMapaPrintHtml(
  mapa: Mapa,
  caseName: string,
  firmName: string,
  options: PrintOptions = {},
  documentUrls: DocumentUrls = {}
): string {
  const opts = { ...defaultOptions, ...options };
  const printDate = new Date().toLocaleDateString('ro-RO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Get the base URL for assets (needed for print window which opens as about:blank)
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';

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

  // Get list of filled slots for cover page (show slot names, not doc names)
  const filledSlots = mapa.slots.filter((slot) => getDocumentFromSlot(slot) !== null);

  // Generate cover page HTML with firm branding
  const coverPageHtml = opts.includeCoverPage
    ? `
    <div class="cover-page">
      <header class="firm-header">
        <img src="${baseUrl}/branding/header.png" alt="${firmName}" class="header-image" />
      </header>

      <main class="cover-main">
        <div class="mapa-title-section">
          <div class="mapa-label">MAPĂ DOCUMENTE</div>
          <h1 class="mapa-title">${mapa.name}</h1>
          ${mapa.description ? `<p class="mapa-description">${mapa.description}</p>` : ''}
        </div>

        <div class="case-info-section">
          <div class="case-info-row">
            <span class="info-label">Dosar:</span>
            <span class="info-value">${caseName}</span>
          </div>
          <div class="case-info-row">
            <span class="info-label">Data:</span>
            <span class="info-value">${printDate}</span>
          </div>
        </div>

        ${
          filledSlots.length > 0
            ? `
          <div class="slot-list-section">
            <h3 class="slot-list-title">Cuprins</h3>
            <ol class="slot-list">
              ${filledSlots.map((slot, index) => `<li><span class="slot-number">${index + 1}.</span> ${slot.name}</li>`).join('')}
            </ol>
          </div>
        `
            : ''
        }
      </main>

      <footer class="cover-footer">
        <img src="${baseUrl}/branding/footer.png" alt="Contact" class="footer-image" />
      </footer>
    </div>
  `
    : '';

  // Helper to generate document content HTML for a slot
  const generateDocumentContentHtml = (slot: MapaSlot): string => {
    if (!opts.includeDocuments) return '';

    const doc = getDocumentFromSlot(slot);
    if (!doc) return '';

    const docInfo = documentUrls[doc.id];
    const fileType = doc.fileType?.toLowerCase() || '';

    // Use download URL for images, or thumbnail for other types
    const imageUrl = docInfo?.downloadUrl || docInfo?.thumbnailUrl || doc.thumbnailUrl;

    if (!imageUrl) {
      return `
        <div class="document-content document-unavailable">
          <p class="unavailable-text">Document indisponibil pentru previzualizare</p>
        </div>
      `;
    }

    if (isImageType(fileType)) {
      return `
        <div class="document-content">
          <div class="document-header">
            <span class="document-label">${slot.name}</span>
            <span class="document-filename">${doc.fileName}</span>
          </div>
          <img src="${imageUrl}" alt="${doc.fileName}" class="document-image" />
        </div>
      `;
    }

    if (isPdfType(fileType)) {
      // For PDFs, show a thumbnail/preview image if available
      const previewUrl = docInfo?.thumbnailUrl || doc.thumbnailUrl;
      if (previewUrl) {
        return `
          <div class="document-content">
            <div class="document-header">
              <span class="document-label">${slot.name}</span>
              <span class="document-filename">${doc.fileName}</span>
            </div>
            <img src="${previewUrl}" alt="${doc.fileName}" class="document-image document-pdf-preview" />
            <p class="pdf-notice">Previzualizare PDF - documentul complet disponibil digital</p>
          </div>
        `;
      }
      return `
        <div class="document-content document-pdf-placeholder">
          <div class="document-header">
            <span class="document-label">${slot.name}</span>
            <span class="document-filename">${doc.fileName}</span>
          </div>
          <div class="pdf-placeholder">
            <span class="pdf-icon">📄</span>
            <span class="pdf-text">Document PDF</span>
          </div>
        </div>
      `;
    }

    // For other document types (Office, etc.), show thumbnail if available
    const thumbnailUrl = docInfo?.thumbnailUrl || doc.thumbnailUrl;
    if (thumbnailUrl) {
      return `
        <div class="document-content">
          <div class="document-header">
            <span class="document-label">${slot.name}</span>
            <span class="document-filename">${doc.fileName}</span>
          </div>
          <img src="${thumbnailUrl}" alt="${doc.fileName}" class="document-image document-thumbnail" />
        </div>
      `;
    }

    return `
      <div class="document-content document-no-preview">
        <div class="document-header">
          <span class="document-label">${slot.name}</span>
          <span class="document-filename">${doc.fileName}</span>
        </div>
        <div class="no-preview-placeholder">
          <span class="no-preview-text">Previzualizare indisponibilă pentru acest tip de document</span>
        </div>
      </div>
    `;
  };

  // Helper to generate slot row HTML
  const generateSlotRowHtml = (slot: MapaSlot): string => {
    const doc = getDocumentFromSlot(slot);
    return `
      <tr class="${doc ? 'filled' : 'empty'} ${slot.required ? 'required' : ''}">
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
          ${doc ? doc.fileName : '<span class="empty-slot">-</span>'}
        </td>
        <td class="col-date">
          ${slot.assignedAt ? new Date(slot.assignedAt).toLocaleDateString('ro-RO') : '-'}
        </td>
      </tr>
    `;
  };

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
          ${slots.map(generateSlotRowHtml).join('')}
        </tbody>
      </table>
      ${
        opts.includeDocuments
          ? slots
              .filter((s) => getDocumentFromSlot(s))
              .map(generateDocumentContentHtml)
              .join('')
          : ''
      }
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

        /* Cover Page - Branded Template */
        .cover-page {
          page-break-after: always;
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          padding: 0;
          position: relative;
        }

        .firm-header {
          width: 100%;
          padding: 0;
          margin: 0;
        }

        .header-image {
          width: 100%;
          height: auto;
          display: block;
        }

        .cover-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: flex-start;
          padding: 1.5cm 2.5cm;
        }

        .mapa-title-section {
          text-align: center;
          margin-bottom: 1.5cm;
        }

        .mapa-label {
          font-size: 11pt;
          letter-spacing: 3px;
          color: #666;
          margin-bottom: 0.5cm;
          text-transform: uppercase;
        }

        .mapa-title {
          font-size: 20pt;
          font-weight: bold;
          color: #2d2d2d;
          margin-bottom: 0.3cm;
        }

        .mapa-description {
          font-size: 11pt;
          color: #666;
          font-style: italic;
          margin-top: 0.3cm;
        }

        .case-info-section {
          background: #f8f8f8;
          border: 1px solid #e0e0e0;
          border-left: 4px solid #8b2332;
          padding: 0.8cm 1cm;
          margin-bottom: 1.5cm;
        }

        .case-info-row {
          display: flex;
          justify-content: space-between;
          padding: 0.2cm 0;
          font-size: 11pt;
        }

        .case-info-row:not(:last-child) {
          border-bottom: 1px solid #e0e0e0;
        }

        .info-label {
          font-weight: 600;
          color: #2d2d2d;
        }

        .info-value {
          color: #333;
        }

        .slot-list-section {
          margin-top: 0.5cm;
        }

        .slot-list-title {
          font-size: 12pt;
          font-weight: 600;
          color: #2d2d2d;
          margin-bottom: 0.5cm;
          padding-bottom: 0.3cm;
          border-bottom: 2px solid #8b2332;
        }

        .slot-list {
          list-style: none;
          margin: 0;
          padding: 0;
          columns: 1;
        }

        .slot-list li {
          font-size: 10pt;
          padding: 0.25cm 0;
          border-bottom: 1px dotted #ccc;
          color: #333;
        }

        .slot-list li:last-child {
          border-bottom: none;
        }

        .slot-number {
          display: inline-block;
          width: 1.2cm;
          color: #8b2332;
          font-weight: 600;
        }

        .cover-footer {
          width: 100%;
          margin-top: auto;
          padding: 0;
        }

        .footer-image {
          width: 100%;
          height: auto;
          display: block;
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

        /* Embedded Document Content */
        .document-content {
          margin-top: 1cm;
          margin-bottom: 1cm;
          padding: 0.5cm;
          border: 1px solid #ddd;
          border-radius: 4px;
          background: #fafafa;
          page-break-inside: avoid;
          page-break-before: auto;
        }

        .document-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 0.5cm;
          padding-bottom: 0.3cm;
          border-bottom: 1px solid #ddd;
        }

        .document-label {
          font-weight: bold;
          font-size: 11pt;
        }

        .document-filename {
          font-size: 9pt;
          color: #666;
          font-style: italic;
        }

        .document-image {
          max-width: 100%;
          max-height: 25cm;
          display: block;
          margin: 0 auto;
          border: 1px solid #ddd;
        }

        .document-thumbnail {
          max-height: 15cm;
        }

        .document-pdf-preview {
          max-height: 20cm;
        }

        .pdf-notice {
          text-align: center;
          font-size: 9pt;
          color: #666;
          font-style: italic;
          margin-top: 0.3cm;
        }

        .pdf-placeholder,
        .no-preview-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 2cm;
          background: #f0f0f0;
          border: 2px dashed #ccc;
          border-radius: 4px;
        }

        .pdf-icon {
          font-size: 48pt;
          margin-bottom: 0.5cm;
        }

        .pdf-text,
        .no-preview-text {
          font-size: 10pt;
          color: #666;
        }

        .document-unavailable {
          background: #fff3cd;
          border-color: #ffc107;
        }

        .unavailable-text {
          text-align: center;
          padding: 1cm;
          color: #856404;
          font-style: italic;
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

          .header-image,
          .footer-image {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }

          .case-info-section {
            background: #f8f8f8 !important;
            border-left-color: #8b2332 !important;
          }

          .category-section {
            page-break-inside: avoid;
          }

          .document-content {
            page-break-inside: avoid;
            page-break-before: auto;
          }

          .document-image {
            max-height: 22cm;
          }
        }

        /* Page margins for print */
        @page {
          margin: 0;
        }

        @page :first {
          margin: 0;
        }
      </style>
    </head>
    <body>
      ${coverPageHtml}
      ${!opts.coverPageOnly ? `<div class="content">${slotsListHtml}</div>` : ''}
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
 * @param documentUrls - Optional map of document URLs for embedding (required if options.includeDocuments is true)
 */
export function printMapa(
  mapa: Mapa,
  caseName: string,
  firmName: string = 'Cabinet de Avocatură',
  options?: PrintOptions,
  documentUrls?: DocumentUrls
): void {
  const html = generateMapaPrintHtml(mapa, caseName, firmName, options, documentUrls);

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
 * @param documentUrls - Optional map of document URLs for embedding (required if options.includeDocuments is true)
 */
export function downloadMapaHtml(
  mapa: Mapa,
  caseName: string,
  firmName: string = 'Cabinet de Avocatură',
  options?: PrintOptions,
  documentUrls?: DocumentUrls
): void {
  const html = generateMapaPrintHtml(mapa, caseName, firmName, options, documentUrls);
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
