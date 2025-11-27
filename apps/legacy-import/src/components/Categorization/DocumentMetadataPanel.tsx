'use client';

import { Mail, Calendar, Folder, User, Send, Inbox, FileType, Languages, Sparkles } from 'lucide-react';
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

function LanguageBadge({ language, confidence }: { language: string | null; confidence: number | null }) {
  if (!language) return null;

  const confidencePercent = confidence ? Math.round(confidence * 100) : null;
  const bgColor = language === 'Romanian' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700';

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${bgColor}`}>
      {language}
      {confidencePercent && (
        <span className="text-[10px] opacity-75">({confidencePercent}%)</span>
      )}
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
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${colors[potential] || colors.Low}`}>
      <Sparkles className="h-3 w-3" />
      Potențial șablon: {labels[potential] || potential}
    </span>
  );
}

export function DocumentMetadataPanel({ document }: DocumentMetadataPanelProps) {
  return (
    <div className="space-y-4">
      {/* File Info */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Informații fișier
        </h4>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <FileType className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <span className="text-gray-700 truncate" title={document.fileName}>
              {document.fileName}
            </span>
          </div>
          <div className="text-xs text-gray-500 pl-6">
            {document.fileExtension.toUpperCase()} • {formatFileSize(document.fileSizeBytes)}
          </div>
        </div>
      </div>

      {/* Folder Path */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Locație PST
        </h4>
        <div className="flex items-start gap-2 text-sm">
          <Folder className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
          <span className="text-gray-700 break-all">{document.folderPath || 'Rădăcină'}</span>
        </div>
        <div className="pl-6">
          {document.isSent ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-700 rounded text-xs font-medium">
              <Send className="h-3 w-3" />
              Trimis
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-medium">
              <Inbox className="h-3 w-3" />
              Primit
            </span>
          )}
        </div>
      </div>

      {/* Email Metadata */}
      {(document.emailSubject || document.emailSender || document.emailDate) && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Detalii email
          </h4>
          <div className="space-y-1.5">
            {document.emailSubject && (
              <div className="flex items-start gap-2 text-sm">
                <Mail className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">{document.emailSubject}</span>
              </div>
            )}
            {document.emailSender && (
              <div className="flex items-center gap-2 text-sm">
                <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-700">{document.emailSender}</span>
              </div>
            )}
            {document.emailDate && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="text-gray-700">{formatDate(document.emailDate)}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* AI Analysis */}
      {(document.primaryLanguage || document.documentType || document.templatePotential) && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Analiză AI
          </h4>
          <div className="space-y-2">
            {/* Language */}
            {document.primaryLanguage && (
              <div className="flex items-center gap-2">
                <Languages className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <div className="flex items-center gap-1.5">
                  <LanguageBadge
                    language={document.primaryLanguage}
                    confidence={document.languageConfidence}
                  />
                  {document.secondaryLanguage && (
                    <>
                      <span className="text-gray-400">+</span>
                      <LanguageBadge language={document.secondaryLanguage} confidence={null} />
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Document Type */}
            {document.documentType && (
              <div className="flex items-start gap-2 text-sm">
                <FileType className="h-4 w-4 text-gray-400 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700">
                  {document.documentType}
                  {document.documentTypeConfidence && (
                    <span className="text-xs text-gray-400 ml-1">
                      ({Math.round(document.documentTypeConfidence * 100)}%)
                    </span>
                  )}
                </span>
              </div>
            )}

            {/* Template Potential */}
            <div className="pl-6">
              <TemplateBadge potential={document.templatePotential} />
            </div>
          </div>
        </div>
      )}

      {/* Status */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          Status
        </h4>
        <div className="flex items-center gap-2">
          {document.status === 'Categorized' && (
            <span className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
              Categorizat: {document.categoryName}
            </span>
          )}
          {document.status === 'Skipped' && (
            <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs font-medium">
              Sărit
            </span>
          )}
          {document.status === 'Uncategorized' && (
            <span className="px-2 py-1 bg-amber-100 text-amber-700 rounded text-xs font-medium">
              Necategorizat
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
