'use client';

import { Mail, Calendar, Folder, User, Send, Inbox, FileType, Sparkles } from 'lucide-react';
import type { DocumentMetadata } from '@/stores/documentStore';

interface DocumentMetadataPanelProps {
  document: DocumentMetadata;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  return date.toLocaleDateString('ro-RO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function LanguageBadge({
  language,
  confidence,
}: {
  language: string | null;
  confidence: number | null;
}) {
  if (!language) return null;

  const confidencePercent = confidence ? Math.round(confidence * 100) : null;
  const bgColor =
    language === 'Romanian' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700';

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${bgColor}`}
    >
      {language}
      {confidencePercent && <span className="text-[10px] opacity-75">({confidencePercent}%)</span>}
    </span>
  );
}

function TemplateBadge({ potential }: { potential: string | null }) {
  if (!potential) return null;

  const colors: Record<string, string> = {
    High: 'bg-purple-100 text-purple-700',
    Medium: 'bg-amber-100 text-amber-700',
    Low: 'bg-gray-100 text-gray-600',
  };

  const labels: Record<string, string> = {
    High: 'Ridicat',
    Medium: 'Mediu',
    Low: 'Scăzut',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${colors[potential] || colors.Low}`}
    >
      <Sparkles className="h-3 w-3" />
      Potențial șablon: {labels[potential] || potential}
    </span>
  );
}

export function DocumentMetadataPanel({ document }: DocumentMetadataPanelProps) {
  return (
    <div className="space-y-2 text-[11px]">
      {/* File + Status Row */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <FileType className="h-3 w-3 text-gray-400 flex-shrink-0" />
          <span className="text-gray-700 truncate" title={document.fileName}>
            {document.fileName}
          </span>
        </div>
        {document.status === 'Categorized' && (
          <span className="flex-shrink-0 px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-medium">
            ✓ {document.categoryName}
          </span>
        )}
        {document.status === 'Skipped' && (
          <span className="flex-shrink-0 px-1.5 py-0.5 bg-gray-100 text-gray-600 rounded text-[10px] font-medium">
            Sărit
          </span>
        )}
        {document.status === 'Uncategorized' && (
          <span className="flex-shrink-0 px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded text-[10px] font-medium">
            Nou
          </span>
        )}
      </div>

      {/* Type + Size + Direction */}
      <div className="flex items-center gap-2 text-gray-500">
        <span>{document.fileExtension.toUpperCase()}</span>
        <span>•</span>
        <span>{formatFileSize(document.fileSizeBytes)}</span>
        <span>•</span>
        {document.isSent ? (
          <span className="inline-flex items-center gap-0.5 text-amber-600">
            <Send className="h-2.5 w-2.5" />
            Trimis
          </span>
        ) : (
          <span className="inline-flex items-center gap-0.5 text-blue-600">
            <Inbox className="h-2.5 w-2.5" />
            Primit
          </span>
        )}
      </div>

      {/* Folder Path */}
      <div className="flex items-start gap-1.5">
        <Folder className="h-3 w-3 text-gray-400 flex-shrink-0 mt-0.5" />
        <span className="text-gray-600 break-all leading-tight">
          {document.folderPath || 'Rădăcină'}
        </span>
      </div>

      {/* Email Metadata (compact) */}
      {(document.emailSubject || document.emailSender || document.emailDate) && (
        <div className="pt-1.5 mt-1.5 border-t border-gray-100 space-y-1">
          {document.emailSubject && (
            <div className="flex items-start gap-1.5">
              <Mail className="h-3 w-3 text-gray-400 flex-shrink-0 mt-0.5" />
              <span className="text-gray-700 leading-tight">{document.emailSubject}</span>
            </div>
          )}
          <div className="flex items-center gap-3 text-gray-500">
            {document.emailSender && (
              <span className="flex items-center gap-1 truncate">
                <User className="h-3 w-3 text-gray-400" />
                {document.emailSender}
              </span>
            )}
            {document.emailDate && (
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3 text-gray-400" />
                {formatDate(document.emailDate)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* AI Analysis (compact) */}
      {(document.primaryLanguage || document.documentType || document.templatePotential) && (
        <div className="pt-1.5 mt-1.5 border-t border-gray-100 flex flex-wrap items-center gap-1.5">
          {document.primaryLanguage && (
            <LanguageBadge
              language={document.primaryLanguage}
              confidence={document.languageConfidence}
            />
          )}
          {document.secondaryLanguage && (
            <LanguageBadge language={document.secondaryLanguage} confidence={null} />
          )}
          {document.templatePotential && <TemplateBadge potential={document.templatePotential} />}
        </div>
      )}
    </div>
  );
}
