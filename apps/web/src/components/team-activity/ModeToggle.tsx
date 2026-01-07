'use client';

/**
 * ModeToggle Component
 * Toggle between View Mode and Timesheet Mode
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
      className={clsx('inline-flex items-center rounded-lg bg-linear-bg-tertiary p-1', className)}
    >
      <button
        type="button"
        onClick={() => onChange('view')}
        aria-pressed={value === 'view'}
        className={clsx(
          'flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium',
          'transition-all duration-200',
          'focus:outline-none focus:ring-2 focus:ring-linear-accent focus:ring-offset-2',
          value === 'view'
            ? 'bg-linear-bg-secondary text-linear-text-primary shadow-sm'
            : 'text-linear-text-secondary hover:text-linear-text-primary'
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
          'focus:outline-none focus:ring-2 focus:ring-linear-accent focus:ring-offset-2',
          value === 'timesheet'
            ? 'bg-linear-bg-secondary text-linear-text-primary shadow-sm'
            : 'text-linear-text-secondary hover:text-linear-text-primary'
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
