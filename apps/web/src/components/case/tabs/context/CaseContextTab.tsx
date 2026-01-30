'use client';

import * as React from 'react';
import { UnifiedContextTabs } from '@/components/context/UnifiedContextTabs';

interface CaseContextTabProps {
  caseId: string;
  className?: string;
}

/**
 * Case context tab that displays the unified context viewer.
 * This is a thin wrapper around UnifiedContextTabs configured for cases.
 */
export function CaseContextTab({ caseId, className }: CaseContextTabProps) {
  return <UnifiedContextTabs entityType="CASE" entityId={caseId} className={className} />;
}

export default CaseContextTab;
