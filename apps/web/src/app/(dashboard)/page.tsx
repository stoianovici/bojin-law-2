'use client';

/**
 * Dashboard Page
 *
 * Displays the BriefingNewspaper as the primary dashboard experience.
 * All users see a briefing tailored to their role.
 */

import { BriefingNewspaper } from '@/components/dashboard';

// ============================================================================
// Main Dashboard Component
// ============================================================================

export default function DashboardPage() {
  return (
    <div className="flex-1 w-full h-full overflow-auto p-4 xl:p-6">
      <BriefingNewspaper />
    </div>
  );
}
