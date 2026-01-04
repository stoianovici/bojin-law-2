/**
 * Timesheet PDF Generation
 * OPS-278: Generate professional PDF timesheets for client invoicing
 * OPS-287: Add discount line when manual total is set
 *
 * Uses @react-pdf/renderer for React-based PDF generation
 * PDF is generated client-side and triggered as download
 */

import { Document, Page, Text, View, StyleSheet, pdf, Font } from '@react-pdf/renderer';
import { createElement } from 'react';
import type { TimesheetEntry, TimesheetCase } from '../hooks/useTimesheetData';
import { formatUserName, getBillingTypeLabel } from '../hooks/useTimesheetData';

// ============================================================================
// Font Registration (Romanian diacritics support)
// ============================================================================

// Track if fonts are registered to avoid duplicate registration
let fontsRegistered = false;

function registerFonts() {
  if (fontsRegistered || typeof window === 'undefined') return;

  const baseUrl = window.location.origin;

  Font.register({
    family: 'LiberationSans',
    fonts: [
      {
        src: `${baseUrl}/fonts/LiberationSans-Regular.ttf`,
        fontWeight: 'normal',
      },
      {
        src: `${baseUrl}/fonts/LiberationSans-Bold.ttf`,
        fontWeight: 'bold',
      },
    ],
  });

  fontsRegistered = true;
}

// ============================================================================
// Types
// ============================================================================

export interface TimesheetPDFData {
  entries: TimesheetEntry[];
  case: TimesheetCase;
  totalHours: number;
  totalBillableHours: number;
  totalCost: number;
  totalBillableCost: number;
  period: {
    startDate: Date;
    endDate: Date;
  };
  // OPS-287: Discount for export
  discount?: number;
  finalTotal?: number;
}

export interface TimesheetPDFOptions {
  showTeamMember: boolean;
}

// ============================================================================
// Styles
// ============================================================================

const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#FFFFFF',
    padding: 40,
    fontFamily: 'LiberationSans',
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  metaRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  metaLabel: {
    fontSize: 10,
    color: '#6b7280',
    width: 70,
  },
  metaValue: {
    fontSize: 10,
    color: '#1f2937',
    fontWeight: 'bold',
  },
  contractBadge: {
    marginTop: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: '#fef3c7',
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  contractText: {
    fontSize: 9,
    color: '#92400e',
    fontWeight: 'bold',
  },
  table: {
    width: '100%',
    marginTop: 16,
  },
  tableHeader: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderBottomWidth: 1,
    borderBottomColor: '#d1d5db',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  tableRowNonBillable: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    paddingVertical: 8,
    paddingHorizontal: 8,
    backgroundColor: '#f9fafb',
  },
  tableFooter: {
    flexDirection: 'row',
    backgroundColor: '#fffbeb',
    borderTopWidth: 2,
    borderTopColor: '#d1d5db',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  // OPS-287: Discount row style
  tableSubtotalRow: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: '#d1d5db',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  tableDiscountRow: {
    flexDirection: 'row',
    backgroundColor: '#dcfce7',
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  cellDiscount: {
    fontSize: 10,
    color: '#15803d',
    fontWeight: 'bold',
  },
  // Column widths - adjust based on showTeamMember
  colDate: {
    width: 70,
  },
  colDescription: {
    flex: 1,
    paddingRight: 8,
  },
  colTeamMember: {
    width: 90,
    paddingRight: 8,
  },
  colHours: {
    width: 50,
    textAlign: 'right',
  },
  colCost: {
    width: 80,
    textAlign: 'right',
  },
  headerCell: {
    fontSize: 8,
    fontWeight: 'bold',
    color: '#6b7280',
    textTransform: 'uppercase',
  },
  cell: {
    fontSize: 9,
    color: '#374151',
  },
  cellNonBillable: {
    fontSize: 9,
    color: '#9ca3af',
  },
  cellBold: {
    fontSize: 9,
    color: '#1f2937',
    fontWeight: 'bold',
  },
  cellTotal: {
    fontSize: 10,
    color: '#92400e',
    fontWeight: 'bold',
  },
  nonBillableBadge: {
    fontSize: 7,
    color: '#9ca3af',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 2,
    marginLeft: 4,
  },
  footer: {
    marginTop: 'auto',
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    fontSize: 8,
    color: '#9ca3af',
  },
});

// ============================================================================
// Helpers
// ============================================================================

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('ro-RO', {
    day: '2-digit',
    month: '2-digit',
  });
}

function formatPeriod(startDate: Date, endDate: Date): string {
  const months = [
    'Ianuarie',
    'Februarie',
    'Martie',
    'Aprilie',
    'Mai',
    'Iunie',
    'Iulie',
    'August',
    'Septembrie',
    'Octombrie',
    'Noiembrie',
    'Decembrie',
  ];

  const startMonth = months[startDate.getMonth()];
  const endMonth = months[endDate.getMonth()];
  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  if (startMonth === endMonth && startYear === endYear) {
    return `${startMonth} ${startYear}`;
  }

  if (startYear === endYear) {
    return `${startMonth} - ${endMonth} ${startYear}`;
  }

  return `${startMonth} ${startYear} - ${endMonth} ${endYear}`;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ro-RO', {
    style: 'decimal',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function formatHours(hours: number): string {
  return hours.toFixed(2);
}

function formatGenerationDate(): string {
  return new Date().toLocaleDateString('ro-RO', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ============================================================================
// PDF Document Component
// ============================================================================

interface TimesheetDocumentProps {
  data: TimesheetPDFData;
  options: TimesheetPDFOptions;
}

function TimesheetDocument({ data, options }: TimesheetDocumentProps) {
  const {
    entries,
    case: caseData,
    totalBillableHours,
    totalBillableCost,
    period,
    discount = 0,
    finalTotal,
  } = data;
  const { showTeamMember } = options;
  const isHourly = caseData.billingType === 'Hourly';

  // OPS-287: Calculate display total
  const displayTotal = finalTotal ?? totalBillableCost;
  const hasDiscount = discount > 0;

  // Filter to only billable entries for the main table
  const billableEntries = entries.filter((e) => e.billable);
  const nonBillableEntries = entries.filter((e) => !e.billable);

  return createElement(
    Document,
    {},
    createElement(
      Page,
      { size: 'A4', style: styles.page },
      // Header
      createElement(
        View,
        { style: styles.header },
        createElement(Text, { style: styles.title }, 'FISA DE PONTAJ'),
        createElement(
          View,
          { style: styles.metaRow },
          createElement(Text, { style: styles.metaLabel }, 'Dosar:'),
          createElement(Text, { style: styles.metaValue }, caseData.title)
        ),
        caseData.client &&
          createElement(
            View,
            { style: styles.metaRow },
            createElement(Text, { style: styles.metaLabel }, 'Client:'),
            createElement(Text, { style: styles.metaValue }, caseData.client.name)
          ),
        createElement(
          View,
          { style: styles.metaRow },
          createElement(Text, { style: styles.metaLabel }, 'Perioada:'),
          createElement(
            Text,
            { style: styles.metaValue },
            formatPeriod(period.startDate, period.endDate)
          )
        ),
        createElement(
          View,
          { style: styles.contractBadge },
          createElement(
            Text,
            { style: styles.contractText },
            `${getBillingTypeLabel(caseData.billingType)}${isHourly && caseData.customRates?.partnerRate ? ` · ${caseData.customRates.partnerRate} RON/ora` : ''}`
          )
        )
      ),

      // Table
      createElement(
        View,
        { style: styles.table },
        // Table Header
        createElement(
          View,
          { style: styles.tableHeader },
          createElement(Text, { style: { ...styles.headerCell, ...styles.colDate } }, 'DATA'),
          createElement(
            Text,
            { style: { ...styles.headerCell, ...styles.colDescription } },
            'DESCRIERE'
          ),
          showTeamMember &&
            createElement(
              Text,
              { style: { ...styles.headerCell, ...styles.colTeamMember } },
              'RESPONSABIL'
            ),
          createElement(Text, { style: { ...styles.headerCell, ...styles.colHours } }, 'ORE'),
          isHourly &&
            createElement(Text, { style: { ...styles.headerCell, ...styles.colCost } }, 'COST')
        ),

        // Billable Entries
        ...billableEntries.map((entry) => {
          const description = entry.task
            ? `${entry.task.title}: ${entry.description}`
            : entry.description;
          const truncatedDesc =
            description.length > 80 ? description.substring(0, 77) + '...' : description;

          return createElement(
            View,
            { key: entry.id, style: styles.tableRow },
            createElement(
              Text,
              { style: { ...styles.cell, ...styles.colDate } },
              formatDate(entry.date)
            ),
            createElement(
              Text,
              { style: { ...styles.cell, ...styles.colDescription } },
              truncatedDesc
            ),
            showTeamMember &&
              createElement(
                Text,
                { style: { ...styles.cell, ...styles.colTeamMember } },
                formatUserName(entry.user)
              ),
            createElement(
              Text,
              { style: { ...styles.cell, ...styles.colHours } },
              formatHours(entry.hours)
            ),
            isHourly &&
              createElement(
                Text,
                { style: { ...styles.cell, ...styles.colCost } },
                formatCurrency(entry.hours * entry.hourlyRate)
              )
          );
        }),

        // Non-billable entries (if any, shown with different styling)
        ...nonBillableEntries.map((entry) => {
          const description = entry.task
            ? `${entry.task.title}: ${entry.description}`
            : entry.description;
          const truncatedDesc =
            description.length > 60 ? description.substring(0, 57) + '...' : description;

          return createElement(
            View,
            { key: entry.id, style: styles.tableRowNonBillable },
            createElement(
              Text,
              { style: { ...styles.cellNonBillable, ...styles.colDate } },
              formatDate(entry.date)
            ),
            createElement(
              View,
              { style: { ...styles.colDescription, flexDirection: 'row', alignItems: 'center' } },
              createElement(Text, { style: styles.cellNonBillable }, truncatedDesc),
              createElement(Text, { style: styles.nonBillableBadge }, 'NON-FACT')
            ),
            showTeamMember &&
              createElement(
                Text,
                { style: { ...styles.cellNonBillable, ...styles.colTeamMember } },
                formatUserName(entry.user)
              ),
            createElement(
              Text,
              { style: { ...styles.cellNonBillable, ...styles.colHours } },
              formatHours(entry.hours)
            ),
            isHourly &&
              createElement(
                Text,
                {
                  style: {
                    ...styles.cellNonBillable,
                    ...styles.colCost,
                    textDecoration: 'line-through',
                  },
                },
                formatCurrency(entry.hours * entry.hourlyRate)
              )
          );
        }),

        // OPS-287: Subtotal row (only when discount applies)
        hasDiscount &&
          createElement(
            View,
            { style: styles.tableSubtotalRow },
            createElement(Text, { style: { ...styles.colDate } }, ''),
            createElement(
              Text,
              { style: { ...styles.cellTotal, ...styles.colDescription } },
              'Subtotal'
            ),
            showTeamMember && createElement(Text, { style: { ...styles.colTeamMember } }, ''),
            createElement(
              Text,
              { style: { ...styles.cellTotal, ...styles.colHours } },
              formatHours(totalBillableHours)
            ),
            isHourly &&
              createElement(
                Text,
                { style: { ...styles.cellTotal, ...styles.colCost } },
                `${formatCurrency(totalBillableCost)} RON`
              )
          ),

        // OPS-287: Discount row (only when discount applies)
        hasDiscount &&
          createElement(
            View,
            { style: styles.tableDiscountRow },
            createElement(Text, { style: { ...styles.colDate } }, ''),
            createElement(
              Text,
              { style: { ...styles.cellDiscount, ...styles.colDescription } },
              'Discount'
            ),
            showTeamMember && createElement(Text, { style: { ...styles.colTeamMember } }, ''),
            createElement(Text, { style: { ...styles.colHours } }, ''),
            isHourly &&
              createElement(
                Text,
                { style: { ...styles.cellDiscount, ...styles.colCost } },
                `-${formatCurrency(discount)} RON`
              )
          ),

        // Totals Footer
        createElement(
          View,
          { style: styles.tableFooter },
          createElement(Text, { style: { ...styles.colDate } }, ''),
          createElement(
            Text,
            { style: { ...styles.cellTotal, ...styles.colDescription } },
            hasDiscount ? 'TOTAL' : 'TOTAL FACTURABIL'
          ),
          showTeamMember && createElement(Text, { style: { ...styles.colTeamMember } }, ''),
          createElement(
            Text,
            { style: { ...styles.cellTotal, ...styles.colHours } },
            formatHours(totalBillableHours)
          ),
          isHourly &&
            createElement(
              Text,
              { style: { ...styles.cellTotal, ...styles.colCost } },
              `${formatCurrency(displayTotal)} RON`
            )
        )
      ),

      // Footer
      createElement(
        View,
        { style: styles.footer },
        createElement(Text, { style: styles.footerText }, `Generat: ${formatGenerationDate()}`),
        createElement(Text, { style: styles.footerText }, 'Pagina 1')
      )
    )
  );
}

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Generate PDF blob from timesheet data
 */
export async function generateTimesheetPDF(
  data: TimesheetPDFData,
  options: TimesheetPDFOptions
): Promise<Blob> {
  // Register fonts before generating PDF
  registerFonts();

  const doc = createElement(TimesheetDocument, { data, options });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return await pdf(doc as any).toBlob();
}

/**
 * Generate and download PDF
 */
export async function downloadTimesheetPDF(
  data: TimesheetPDFData,
  options: TimesheetPDFOptions
): Promise<boolean> {
  try {
    const blob = await generateTimesheetPDF(data, options);

    // Create filename: Fisa-pontaj-{CaseName}-{Month-Year}.pdf
    const caseName = data.case.title
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 30);
    const monthYear = formatPeriodShort(data.period.startDate, data.period.endDate);
    const filename = `Fisa-pontaj-${caseName}-${monthYear}.pdf`;

    // Trigger download
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error('Failed to generate PDF:', error);
    return false;
  }
}

function formatPeriodShort(startDate: Date, endDate: Date): string {
  const startMonth = (startDate.getMonth() + 1).toString().padStart(2, '0');
  const endMonth = (endDate.getMonth() + 1).toString().padStart(2, '0');
  const year = endDate.getFullYear();

  if (startMonth === endMonth) {
    return `${startMonth}-${year}`;
  }
  return `${startMonth}-${endMonth}-${year}`;
}
