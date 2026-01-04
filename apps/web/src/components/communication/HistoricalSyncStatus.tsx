'use client';

import { useQuery } from '@apollo/client/react';
import { GET_HISTORICAL_EMAIL_SYNC_STATUS } from '@/graphql/queries';
import { AlertCircle, CheckCircle, Clock, Loader2 } from 'lucide-react';

interface HistoricalSyncStatusProps {
  caseId: string;
}

interface SyncJob {
  id: string;
  contactEmail: string;
  contactRole: string;
  status: 'Pending' | 'InProgress' | 'Completed' | 'Failed';
  totalEmails: number | null;
  syncedEmails: number;
  errorMessage: string | null;
}

interface HistoricalEmailSyncStatusData {
  historicalEmailSyncStatus: SyncJob[];
}

export function HistoricalSyncStatus({ caseId }: HistoricalSyncStatusProps) {
  const { data, loading, error } = useQuery<HistoricalEmailSyncStatusData>(
    GET_HISTORICAL_EMAIL_SYNC_STATUS,
    {
      variables: { caseId },
      // Poll every 5 seconds when there are active jobs
      pollInterval: 5000,
      skip: !caseId,
    }
  );

  if (loading || error || !data?.historicalEmailSyncStatus) {
    return null;
  }

  const jobs = data.historicalEmailSyncStatus;

  // Filter to only show active or recent jobs (completed within last hour)
  const relevantJobs = jobs.filter(
    (job) => job.status === 'Pending' || job.status === 'InProgress' || job.status === 'Failed'
  );

  if (relevantJobs.length === 0) {
    return null;
  }

  return (
    <div className="mb-4 space-y-2">
      {relevantJobs.map((job) => (
        <SyncJobCard key={job.id} job={job} />
      ))}
    </div>
  );
}

function SyncJobCard({ job }: { job: SyncJob }) {
  const progress = job.totalEmails ? Math.round((job.syncedEmails / job.totalEmails) * 100) : 0;

  return (
    <div className="rounded-lg border border-linear-border-subtle bg-linear-bg-elevated p-3 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <StatusIcon status={job.status} />
          <span className="font-medium text-linear-text-primary">
            Syncing emails from {job.contactEmail}
          </span>
        </div>
        <span className="text-xs text-linear-text-tertiary">{job.contactRole}</span>
      </div>

      {job.status === 'InProgress' && job.totalEmails && (
        <div className="mt-2">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-linear-bg-tertiary">
            <div
              className="h-full rounded-full bg-blue-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-linear-text-secondary">
            {job.syncedEmails} / {job.totalEmails} emails processed
          </p>
        </div>
      )}

      {job.status === 'Pending' && (
        <p className="mt-1 text-xs text-linear-text-secondary">Waiting to start...</p>
      )}

      {job.status === 'Failed' && job.errorMessage && (
        <p className="mt-1 text-xs text-red-500">{job.errorMessage}</p>
      )}
    </div>
  );
}

function StatusIcon({ status }: { status: SyncJob['status'] }) {
  switch (status) {
    case 'Pending':
      return <Clock className="h-4 w-4 text-linear-text-tertiary" />;
    case 'InProgress':
      return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
    case 'Completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case 'Failed':
      return <AlertCircle className="h-4 w-4 text-red-500" />;
    default:
      return null;
  }
}

export default HistoricalSyncStatus;
