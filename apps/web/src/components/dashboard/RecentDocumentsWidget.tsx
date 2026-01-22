'use client';

import Link from 'next/link';
import { FileText, File, FileSpreadsheet, FileImage, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui';

// ============================================================================
// Types
// ============================================================================

interface RecentDocument {
  id: string;
  fileName: string;
  fileType: string;
  uploadedAt: string;
  case: {
    id: string;
    caseNumber: string;
    title: string;
  };
}

interface RecentDocumentsWidgetProps {
  documents: RecentDocument[];
  loading?: boolean;
}

// ============================================================================
// Utilities
// ============================================================================

function getFileIcon(fileType: string) {
  const type = fileType.toLowerCase();

  if (type.includes('pdf')) {
    return <FileText className="h-4 w-4 text-red-400" />;
  }
  if (type.includes('word') || type.includes('doc')) {
    return <FileText className="h-4 w-4 text-blue-400" />;
  }
  if (type.includes('excel') || type.includes('sheet') || type.includes('xls')) {
    return <FileSpreadsheet className="h-4 w-4 text-green-400" />;
  }
  if (type.includes('image') || type.includes('png') || type.includes('jpg') || type.includes('jpeg')) {
    return <FileImage className="h-4 w-4 text-purple-400" />;
  }
  return <File className="h-4 w-4 text-linear-text-muted" />;
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 60) {
    return `acum ${diffMins} min`;
  }
  if (diffHours < 24) {
    return `acum ${diffHours} ore`;
  }
  if (diffDays === 1) {
    return 'ieri';
  }
  if (diffDays < 7) {
    return `acum ${diffDays} zile`;
  }
  return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}

// ============================================================================
// Skeleton Component
// ============================================================================

function DocumentsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 animate-pulse">
          <div className="h-8 w-8 rounded bg-linear-bg-tertiary" />
          <div className="flex-1">
            <div className="h-4 w-32 bg-linear-bg-tertiary rounded mb-1" />
            <div className="h-3 w-24 bg-linear-bg-tertiary rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Component
// ============================================================================

export function RecentDocumentsWidget({ documents, loading }: RecentDocumentsWidgetProps) {
  return (
    <Card className="bg-linear-bg-secondary border-linear-border-subtle">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded-md bg-cyan-500/10 flex items-center justify-center">
            <FileText className="h-4 w-4 text-cyan-400" />
          </div>
          <CardTitle className="text-sm font-semibold tracking-tight">
            Documente Recente
          </CardTitle>
        </div>
        <Link
          href="/documents"
          className="text-xs text-linear-text-muted hover:text-linear-accent transition-colors font-medium"
        >
          Vezi toate \u2192
        </Link>
      </CardHeader>
      <CardContent>
        {loading ? (
          <DocumentsSkeleton />
        ) : documents.length > 0 ? (
          <div className="space-y-1">
            {documents.map((doc) => (
              <Link
                key={doc.id}
                href={`/cases/${doc.case.id}/documents`}
                className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-linear-bg-tertiary/50 transition-colors group"
              >
                <div className="h-8 w-8 rounded-lg bg-linear-bg-tertiary flex items-center justify-center group-hover:bg-linear-bg-elevated">
                  {getFileIcon(doc.fileType)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-linear-text-primary group-hover:text-linear-accent transition-colors truncate">
                    {doc.fileName}
                  </p>
                  <div className="flex items-center gap-1.5 text-xs text-linear-text-muted">
                    <span className="truncate max-w-[120px]">{doc.case.title}</span>
                    <span className="text-linear-text-muted/50">\u00b7</span>
                    <Clock className="h-3 w-3" />
                    <span>{formatTimeAgo(doc.uploadedAt)}</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center">
            <FileText className="h-8 w-8 text-linear-text-muted/30 mx-auto mb-2" />
            <p className="text-sm text-linear-text-muted">Nu ai documente recente.</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
