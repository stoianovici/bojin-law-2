'use client';

import { useState, useCallback } from 'react';
import {
  X,
  Cloud,
  CheckCircle,
  AlertTriangle,
  Loader2,
  FolderOpen,
  FileText,
  Trash2,
} from 'lucide-react';

interface ExportModalProps {
  sessionId: string;
  isOpen: boolean;
  onClose: () => void;
  onExportComplete: () => void;
  stats: {
    totalDocuments: number;
    categorizedCount: number;
    skippedCount: number;
    categoriesCount: number;
  };
}

type ExportStatus = 'ready' | 'authenticating' | 'exporting' | 'success' | 'error';

interface ExportResult {
  categoriesExported: number;
  documentsExported: number;
  oneDrivePath: string;
  cleanup?: {
    r2FilesDeleted: number;
  };
}

export function ExportModal({
  sessionId,
  isOpen,
  onClose,
  onExportComplete,
  stats,
}: ExportModalProps) {
  const [status, setStatus] = useState<ExportStatus>('ready');
  const [progress, setProgress] = useState(0);
  const [currentCategory, setCurrentCategory] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ExportResult | null>(null);

  const startExport = useCallback(async () => {
    try {
      setStatus('authenticating');
      setError(null);

      // Get Microsoft access token
      // In production, this would use MSAL to get a token
      // For now, we'll use a placeholder that needs to be implemented
      const accessToken = await getMicrosoftAccessToken();

      if (!accessToken) {
        throw new Error('Failed to authenticate with Microsoft');
      }

      setStatus('exporting');
      setProgress(0);
      setCurrentCategory('Starting export...');

      // Call export API
      const response = await fetch('/api/export-onedrive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          accessToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Export failed');
      }

      setResult({
        categoriesExported: data.categoriesExported,
        documentsExported: data.documentsExported,
        oneDrivePath: data.oneDrivePath,
        cleanup: data.cleanup,
      });
      setStatus('success');
      setProgress(100);
      onExportComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Export failed');
      setStatus('error');
    }
  }, [sessionId, onExportComplete]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Cloud className="h-5 w-5 text-blue-600" />
            <h2 className="text-lg font-semibold text-gray-900">Exportă în OneDrive</h2>
          </div>
          {status !== 'exporting' && (
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {status === 'ready' && (
            <>
              <p className="text-gray-600 mb-4">
                Exportă documentele categorizate în contul tău OneDrive pentru antrenament AI.
                Aceasta va:
              </p>

              <ul className="space-y-3 mb-6">
                <li className="flex items-start gap-3 text-sm">
                  <FolderOpen className="h-5 w-5 text-blue-500 mt-0.5" />
                  <span>
                    Crea structura de foldere: <code>/AI-Training/&#123;Categorie&#125;/</code>
                  </span>
                </li>
                <li className="flex items-start gap-3 text-sm">
                  <FileText className="h-5 w-5 text-green-500 mt-0.5" />
                  <span>
                    Încărca <strong>{stats.categorizedCount}</strong> documente categorizate în{' '}
                    <strong>{stats.categoriesCount}</strong> foldere de categorii
                  </span>
                </li>
                <li className="flex items-start gap-3 text-sm">
                  <Trash2 className="h-5 w-5 text-red-500 mt-0.5" />
                  <span>
                    Șterge automat fișierele temporare din stocare cloud (PST și documentele
                    extrase)
                  </span>
                </li>
              </ul>

              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-6">
                <p className="text-sm text-amber-800">
                  <strong>Notă:</strong> {stats.skippedCount} documente sărite NU vor fi exportate.
                  Asigură-te că ai verificat și categorizat toate documentele importante.
                </p>
              </div>
            </>
          )}

          {status === 'authenticating' && (
            <div className="text-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
              <p className="text-gray-600">Se autentifică cu Microsoft...</p>
            </div>
          )}

          {status === 'exporting' && (
            <div className="py-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Se exportă documentele...</span>
                <span className="text-sm text-gray-500">{progress}%</span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-3">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {currentCategory && (
                <p className="text-sm text-gray-500 text-center">{currentCategory}</p>
              )}
            </div>
          )}

          {status === 'success' && result && (
            <div className="text-center py-4">
              <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Export finalizat!</h3>
              <p className="text-gray-600 mb-4">
                {result.documentsExported} documente exportate cu succes în{' '}
                {result.categoriesExported} categorii.
              </p>

              <div className="bg-gray-50 rounded-lg p-4 text-left text-sm space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Locație OneDrive:</span>
                  <span className="font-medium">{result.oneDrivePath}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Documente exportate:</span>
                  <span className="font-medium">{result.documentsExported}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Categorii create:</span>
                  <span className="font-medium">{result.categoriesExported}</span>
                </div>
                {result.cleanup && (
                  <div className="flex justify-between border-t border-gray-200 pt-2">
                    <span className="text-gray-600">Fișiere temporare curățate:</span>
                    <span className="font-medium text-green-600">
                      {result.cleanup.r2FilesDeleted} fișiere șterse
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center py-4">
              <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 mb-2">Export eșuat</h3>
              <p className="text-red-600 mb-4">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 flex justify-end gap-3">
          {status === 'ready' && (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Anulează
              </button>
              <button
                onClick={startExport}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
              >
                <Cloud className="h-4 w-4" />
                Începe exportul
              </button>
            </>
          )}

          {(status === 'success' || status === 'error') && (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
            >
              Închide
            </button>
          )}

          {status === 'error' && (
            <button
              onClick={() => setStatus('ready')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Încearcă din nou
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Get Microsoft access token for OneDrive
 * In production, this would use MSAL.js
 * For now, returns a placeholder implementation
 */
async function getMicrosoftAccessToken(): Promise<string | null> {
  // TODO: Implement MSAL authentication
  // This would typically:
  // 1. Check if user is already signed in
  // 2. If not, redirect to Microsoft login
  // 3. Exchange auth code for tokens
  // 4. Return access token with Files.ReadWrite scope

  // For development/testing, you can use a manual token from:
  // https://developer.microsoft.com/en-us/graph/graph-explorer

  // Check if there's a token in localStorage (for testing)
  const testToken =
    typeof window !== 'undefined' ? localStorage.getItem('ms_graph_test_token') : null;

  if (testToken) {
    return testToken;
  }

  // Show alert for now - in production this would open MSAL popup
  if (typeof window !== 'undefined') {
    const token = window.prompt(
      'Introdu token-ul de acces Microsoft Graph (pentru testare).\n\n' +
        'Obține unul de la: https://developer.microsoft.com/en-us/graph/graph-explorer\n' +
        'Permisiune necesară: Files.ReadWrite'
    );

    if (token) {
      localStorage.setItem('ms_graph_test_token', token);
      return token;
    }
  }

  return null;
}
