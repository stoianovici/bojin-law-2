/**
 * MapaPrintView Component
 * OPS-103: Mapa Print/Export Functionality
 *
 * Renders a print-ready view of a mapa with cover page, table of contents,
 * and optional placeholder pages for missing documents.
 */

'use client';

import React, { forwardRef } from 'react';
import { clsx } from 'clsx';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import type { Mapa, MapaSlot } from '../../hooks/useMapa';

// ============================================================================
// Types
// ============================================================================

export interface PrintOptions {
  includeTableOfContents: boolean;
  includeMissingPlaceholders: boolean;
  pageNumbering: 'continuous' | 'per-document' | 'none';
  headerFooter: boolean;
  format: 'a4' | 'letter';
}

export interface MapaPrintViewProps {
  mapa: Mapa;
  caseName: string;
  caseNumber: string;
  options: PrintOptions;
  className?: string;
}

// ============================================================================
// Utilities
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
 * Get file type icon character for print
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
// Sub-components
// ============================================================================

interface CoverPageProps {
  mapa: Mapa;
  caseName: string;
  caseNumber: string;
}

function CoverPage({ mapa, caseName, caseNumber }: CoverPageProps) {
  return (
    <section className="print-page cover-page">
      <div className="cover-content">
        <h1 className="cover-title">{mapa.name}</h1>
        {mapa.description && <p className="cover-description">{mapa.description}</p>}
        <div className="cover-details">
          <p className="cover-case">
            <strong>Dosar:</strong> {caseNumber}
          </p>
          <p className="cover-case-name">{caseName}</p>
          <p className="cover-date">
            <strong>Data generării:</strong>{' '}
            {format(new Date(), 'dd MMMM yyyy, HH:mm', { locale: ro })}
          </p>
        </div>
        <div className="cover-stats">
          <p>
            <strong>Total poziții:</strong> {mapa.completionStatus.totalSlots}
          </p>
          <p>
            <strong>Documente prezente:</strong> {mapa.completionStatus.filledSlots}
          </p>
          <p>
            <strong>Documente lipsă:</strong>{' '}
            {mapa.completionStatus.totalSlots - mapa.completionStatus.filledSlots}
          </p>
          <p>
            <strong>Completare:</strong> {mapa.completionStatus.percentComplete}%
          </p>
        </div>
      </div>
    </section>
  );
}

interface TableOfContentsProps {
  mapa: Mapa;
}

function TableOfContents({ mapa }: TableOfContentsProps) {
  const sortedSlots = [...mapa.slots].sort((a, b) => a.order - b.order);

  return (
    <section className="print-page toc-page">
      <h2 className="toc-title">Cuprins</h2>
      <table className="toc-table">
        <thead>
          <tr>
            <th className="toc-col-nr">Nr.</th>
            <th className="toc-col-name">Denumire Document</th>
            <th className="toc-col-category">Categorie</th>
            <th className="toc-col-status">Status</th>
          </tr>
        </thead>
        <tbody>
          {sortedSlots.map((slot, index) => (
            <tr key={slot.id} className={clsx('toc-row', !slot.document && 'toc-row-missing')}>
              <td className="toc-col-nr">{toRomanNumeral(index + 1)}</td>
              <td className="toc-col-name">
                <span className="toc-slot-name">{slot.name}</span>
                {slot.document && (
                  <span className="toc-document-name">
                    {getFileTypeIcon(slot.document.document.fileType)}{' '}
                    {slot.document.document.fileName}
                  </span>
                )}
              </td>
              <td className="toc-col-category">{slot.category || '—'}</td>
              <td className="toc-col-status">
                {slot.document ? (
                  <span className="status-present">✓ Prezent</span>
                ) : slot.required ? (
                  <span className="status-missing">✗ Lipsă</span>
                ) : (
                  <span className="status-optional">— Opțional</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="toc-summary">
        <div className="toc-summary-item">
          <span className="toc-summary-label">Total poziții:</span>
          <span className="toc-summary-value">{mapa.completionStatus.totalSlots}</span>
        </div>
        <div className="toc-summary-item">
          <span className="toc-summary-label">Documente prezente:</span>
          <span className="toc-summary-value toc-summary-present">
            {mapa.completionStatus.filledSlots}
          </span>
        </div>
        <div className="toc-summary-item">
          <span className="toc-summary-label">Documente obligatorii lipsă:</span>
          <span className="toc-summary-value toc-summary-missing">
            {mapa.completionStatus.requiredSlots - mapa.completionStatus.filledRequiredSlots}
          </span>
        </div>
      </div>
    </section>
  );
}

interface MissingDocumentPageProps {
  slot: MapaSlot;
  index: number;
}

function MissingDocumentPage({ slot, index }: MissingDocumentPageProps) {
  return (
    <section className="print-page missing-page">
      <div className="missing-placeholder">
        <div className="missing-header">
          <span className="missing-number">{toRomanNumeral(index + 1)}</span>
          <h3 className="missing-title">{slot.name}</h3>
        </div>
        <div className="missing-content">
          <p className="missing-label">DOCUMENT LIPSĂ</p>
          {slot.description && <p className="missing-description">{slot.description}</p>}
          {slot.category && <p className="missing-category">Categorie: {slot.category}</p>}
          <p className="missing-required">{slot.required ? 'Obligatoriu' : 'Opțional'}</p>
        </div>
      </div>
    </section>
  );
}

// ============================================================================
// Main Component
// ============================================================================

/**
 * MapaPrintView - print-ready view of a mapa
 */
export const MapaPrintView = forwardRef<HTMLDivElement, MapaPrintViewProps>(function MapaPrintView(
  { mapa, caseName, caseNumber, options, className },
  ref
) {
  const sortedSlots = [...mapa.slots].sort((a, b) => a.order - b.order);
  const missingRequiredSlots = sortedSlots.filter((slot) => !slot.document && slot.required);

  return (
    <div ref={ref} className={clsx('print-container', className)}>
      {/* Cover Page */}
      <CoverPage mapa={mapa} caseName={caseName} caseNumber={caseNumber} />

      {/* Table of Contents */}
      {options.includeTableOfContents && <TableOfContents mapa={mapa} />}

      {/* Missing Document Placeholders */}
      {options.includeMissingPlaceholders &&
        missingRequiredSlots.map((slot) => {
          const index = sortedSlots.findIndex((s) => s.id === slot.id);
          return <MissingDocumentPage key={slot.id} slot={slot} index={index} />;
        })}
    </div>
  );
});

MapaPrintView.displayName = 'MapaPrintView';
