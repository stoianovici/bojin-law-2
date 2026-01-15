'use client';

import { Building2, User, Briefcase } from 'lucide-react';
import { cn } from '@/lib/utils';
import { type ClientListData } from './ClientListPanel';

interface ClientListItemProps {
  client: ClientListData;
  isSelected: boolean;
  onClick: () => void;
}

export function ClientListItem({ client, isSelected, onClick }: ClientListItemProps) {
  const isCompany = client.clientType === 'company';

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2.5 rounded-md transition-colors',
        'hover:bg-linear-bg-subtle',
        isSelected && 'bg-linear-bg-subtle ring-1 ring-linear-accent/30'
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div
          className={cn(
            'w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0',
            isCompany ? 'bg-blue-500/10 text-blue-400' : 'bg-purple-500/10 text-purple-400'
          )}
        >
          {isCompany ? <Building2 className="w-4 h-4" /> : <User className="w-4 h-4" />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-linear-text-primary truncate">{client.name}</span>
            {client.companyType && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-linear-bg-tertiary text-linear-text-secondary">
                {client.companyType}
              </span>
            )}
          </div>

          {/* Contact info */}
          {(client.email || client.phone) && (
            <div className="text-xs text-linear-text-tertiary truncate mt-0.5">
              {client.email || client.phone}
            </div>
          )}

          {/* Case count badge */}
          <div className="flex items-center gap-1 mt-1">
            <Briefcase className="w-3 h-3 text-linear-text-tertiary" />
            <span className="text-xs text-linear-text-tertiary">
              {client.caseCount} {client.caseCount === 1 ? 'dosar' : 'dosare'}
              {client.activeCaseCount > 0 && ` (${client.activeCaseCount} active)`}
            </span>
          </div>
        </div>
      </div>
    </button>
  );
}

export default ClientListItem;
