'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';

type CaseSyncStatus = 'Pending' | 'Syncing' | 'Completed' | 'Failed';

interface CaseSyncProgressProps {
  syncStatus: CaseSyncStatus | null;
  syncError?: string | null;
  onRetry?: () => Promise<void>;
  className?: string;
  compact?: boolean; // For use in list rows
}

export function CaseSyncProgress({
  syncStatus,
  syncError,
  onRetry,
  className = '',
  compact = false,
}: CaseSyncProgressProps) {
  const [retryError, setRetryError] = useState<string | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  // Don't render anything if completed or no status
  if (!syncStatus || syncStatus === 'Completed') {
    return null;
  }

  // Failed state with retry
  if (syncStatus === 'Failed') {
    const handleRetry = async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (!onRetry || isRetrying) return;

      setRetryError(null);
      setIsRetrying(true);
      try {
        await onRetry();
      } catch (err: any) {
        setRetryError(err.message || 'Eroare necunoscută');
      } finally {
        setIsRetrying(false);
      }
    };

    return (
      <div className={`flex flex-col gap-1 ${className}`}>
        <div className="flex items-center gap-2">
          <span className={`text-red-400 ${compact ? 'text-xs' : 'text-sm'}`}>
            Eroare sincronizare
          </span>
          {onRetry && (
            <button
              type="button"
              onClick={handleRetry}
              disabled={isRetrying}
              className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${isRetrying ? 'animate-spin' : ''}`} />
              <span>{isRetrying ? 'Se reîncearcă...' : 'Reîncearcă'}</span>
            </button>
          )}
        </div>
        {retryError && <span className="text-xs text-red-400">{retryError}</span>}
      </div>
    );
  }

  // Pending or Syncing state - show animated progress bar
  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {!compact && <span className="text-xs text-neutral-400">Sincronizare în curs...</span>}
      <div className="relative h-1 w-full overflow-hidden rounded-full bg-neutral-700">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: 'linear-gradient(90deg, transparent, #3b82f6, transparent)',
            animation: 'shimmer 1.5s infinite',
          }}
        />
      </div>
      <style jsx>{`
        @keyframes shimmer {
          0% {
            transform: translateX(-100%);
          }
          100% {
            transform: translateX(100%);
          }
        }
      `}</style>
    </div>
  );
}
