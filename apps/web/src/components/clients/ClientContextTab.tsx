'use client';

import * as React from 'react';
import { Lock } from 'lucide-react';
import { UnifiedContextTabs } from '@/components/context/UnifiedContextTabs';
import { useAuthStore, isAssociateOrAbove } from '@/store/authStore';

interface ClientContextTabProps {
  clientId: string;
  className?: string;
}

/**
 * Client context tab that displays the unified context viewer.
 * This is a thin wrapper around UnifiedContextTabs configured for clients.
 * Associates and above - includes permission check.
 */
export function ClientContextTab({ clientId, className }: ClientContextTabProps) {
  const { user } = useAuthStore();
  const hasPermission = isAssociateOrAbove(user?.dbRole);

  // Permission denied state (shown here for quick rejection without loading UnifiedContextTabs)
  if (!hasPermission) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center px-8">
          <div className="w-14 h-14 rounded-full bg-linear-warning/10 flex items-center justify-center mx-auto mb-5">
            <Lock className="w-7 h-7 text-linear-warning" />
          </div>
          <h3 className="text-base font-medium text-linear-text-primary mb-2">
            Acces restrictionat
          </h3>
          <p className="text-sm text-linear-text-tertiary max-w-sm mx-auto">
            Doar asociatii si partenerii pot vizualiza si edita contextul AI al clientilor.
          </p>
        </div>
      </div>
    );
  }

  return <UnifiedContextTabs entityType="CLIENT" entityId={clientId} className={className} />;
}

export default ClientContextTab;
