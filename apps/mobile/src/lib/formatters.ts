import { format, isToday, isYesterday, parseISO } from 'date-fns';
import { ro } from 'date-fns/locale';

// ============================================
// Duration Formatting
// ============================================

/**
 * Format hours as a human-readable duration string
 * @example formatDuration(1.5) → "1h 30m"
 * @example formatDuration(0.25) → "15m"
 * @example formatDuration(2) → "2h"
 */
export function formatDuration(hours: number): string {
  if (hours === 0) return '0m';

  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

// ============================================
// Date Formatting
// ============================================

/**
 * Format a time entry date for display
 * @example formatTimeEntryDate("2024-01-27") → "Astăzi"
 * @example formatTimeEntryDate("2024-01-26") → "Ieri"
 * @example formatTimeEntryDate("2024-01-15") → "15 ian"
 */
export function formatTimeEntryDate(dateStr: string): string {
  const date = parseISO(dateStr);

  if (isToday(date)) return 'Astăzi';
  if (isYesterday(date)) return 'Ieri';

  return format(date, 'd MMM', { locale: ro });
}
