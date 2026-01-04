'use client';

/**
 * ModeToggle Component
 * OPS-271: Toggle between View Mode and Timesheet Mode
 *
 * Uses simple button group for accessible toggle behavior.
 * - Vizualizare: Read-only team activity view grouped by time/member
 * - Fișă de pontaj: Editable timesheet table for invoicing
 */

import { Eye, Table2 } from 'lucide-react';
import { clsx } from 'clsx';
import type { ActivityViewMode } from '../../hooks/useTeamActivity';

// ============================================================================
// Types
// ============================================================================

export interface ModeToggleProps {
  /** Current view mode */
  value: ActivityViewMode;
  /** Called when mode changes */
  onChange: (mode: ActivityViewMode) => void;
  /** Additional CSS classes */
  className?: string;
}

// ============================================================================
// Component
// ============================================================================

export function ModeToggle({ value, onChange, className }: ModeToggleProps) {
  return (
    <div
      role="group"
      aria-label="Mod de vizualizare"
      className={clsx('inline-flex items-center rounded-lg bg-gray-100 p-1', className)}
    >
      <button
        type="button"
        onClick={() => onChange('view')}
        aria-pressed={value === 'view'}
        className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium',
          'transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2',
          value === 'view'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        )}
      >
        <Eye className="h-4 w-4" />
        <span>Vizualizare</span>
      </button>

      <button
        type="button"
        onClick={() => onChange('timesheet')}
        aria-pressed={value === 'timesheet'}
        className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium',
          'transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-amber-500 focus:ring-offset-2',
          value === 'timesheet'
            ? 'bg-white text-gray-900 shadow-sm'
            : 'text-gray-600 hover:text-gray-900'
        )}
      >
        <Table2 className="h-4 w-4" />
        <span>Fișă de pontaj</span>
      </button>
    </div>
  );
}

ModeToggle.displayName = 'ModeToggle';

export default ModeToggle;
