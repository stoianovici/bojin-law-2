/**
 * Formatting Utilities for Analytics Dashboard
 * Story 2.11.4: Financial Dashboard UI
 *
 * Common formatters for currency, percentages, and numbers.
 * Localized for Romanian (ro-RO).
 */

/**
 * Format a number as currency (no symbol, Romanian locale)
 * Assumes input is in base currency units
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Format a number as currency with decimals (no symbol)
 */
export function formatCurrencyWithCents(value: number): string {
  return new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

/**
 * Format a number as percentage
 * Input should be 0-100
 */
export function formatPercent(value: number): string {
  return new Intl.NumberFormat('ro-RO', {
    style: 'percent',
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(value / 100);
}

/**
 * Format a number with thousand separators
 */
export function formatNumber(value: number): string {
  return new Intl.NumberFormat('ro-RO', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Format hours with 1 decimal place
 */
export function formatHours(hours: number): string {
  return `${formatNumber(hours)}h`;
}

/**
 * Format a compact number (e.g., 1,2K, 45M)
 */
export function formatCompact(value: number): string {
  return new Intl.NumberFormat('ro-RO', {
    notation: 'compact',
    compactDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(value);
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('ro-RO', {
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format date range for display
 */
export function formatDateRange(start: Date | string, end: Date | string): string {
  return `${formatDate(start)} - ${formatDate(end)}`;
}
