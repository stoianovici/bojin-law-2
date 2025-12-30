'use client';

import { useState, useCallback, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  UploadCloud,
  FolderOpen,
  FileText,
  Settings,
  Loader2,
  CheckCircle,
  LayoutDashboard,
  Users,
  RefreshCw,
} from 'lucide-react';
import { PSTUploader } from '@/components/PSTUploader';
import { CategorizationWorkspace } from '@/components/Categorization';
import { PartnerDashboard, MergeCategoriesModal, ExportModal } from '@/components/Dashboard';
import { UserManagement } from '@/components/Dashboard/UserManagement';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';

type ImportStep = 'upload' | 'extract' | 'categorize' | 'dashboard' | 'export';

interface SessionState {
  sessionId: string | null;
  fileName: string | null;
  status: string;
}

interface ActiveSessionResponse {
  hasActiveSession: boolean;
  session: {
    sessionId: string;
    fileName: string;
    status: string;
    currentStep: ImportStep;
    progress: {
      totalDocuments: number;
      categorizedCount: number;
      skippedCount: number;
      analyzedCount: number;
    };
    createdAt: string;
    updatedAt: string;
  } | null;
}

interface ExtractStepProps {
  sessionId: string | null;
  onComplete: () => void;
}

interface ExtractionIncompleteBannerProps {
  sessionId: string;
  onContinueExtraction: () => void;
}

function ExtractionIncompleteBanner({
  sessionId,
  onContinueExtraction,
}: ExtractionIncompleteBannerProps) {
  const [extractionStatus, setExtractionStatus] = useState<{
    totalInPst: number;
    extractedCount: number;
    remainingCount: number; // -1 means unknown
    canContinue: boolean;
  } | null>(null);

  useEffect(() => {
    async function checkExtractionStatus() {
      try {
        const res = await fetch(`/api/extract-documents?sessionId=${sessionId}`);
        if (!res.ok) return;

        const data = await res.json();
        const progress = data.extractionProgress;

        // Show banner if canContinue is true (regardless of remainingCount)
        if (progress && progress.canContinue) {
          setExtractionStatus({
            totalInPst: progress.totalInPst,
            extractedCount: progress.extractedCount,
            remainingCount: progress.remainingCount,
            canContinue: progress.canContinue,
          });
        }
      } catch (err) {
        console.error('Error checking extraction status:', err);
      }
    }

    checkExtractionStatus();
  }, [sessionId]);

  if (!extractionStatus || !extractionStatus.canContinue) {
    return null;
  }

  const isUnknownTotal =
    extractionStatus.remainingCount === -1 || extractionStatus.totalInPst === 0;
  const progressPercent = isUnknownTotal
    ? 0
    : Math.round((extractionStatus.extractedCount / extractionStatus.totalInPst) * 100);

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FolderOpen className="h-5 w-5 text-amber-600" />
          <div>
            <p className="font-medium text-amber-900">
              {isUnknownTotal ? 'Extragerea poate fi incompletă' : 'Extragerea nu este completă'}
            </p>
            <p className="text-sm text-amber-700">
              {isUnknownTotal ? (
                <>
                  {extractionStatus.extractedCount.toLocaleString()} documente extrase.
                  <strong> Apasă pentru a verifica dacă mai sunt documente de extras.</strong>
                </>
              ) : (
                <>
                  {extractionStatus.extractedCount.toLocaleString()} din{' '}
                  {extractionStatus.totalInPst.toLocaleString()} documente extrase (
                  {progressPercent}%). Mai sunt{' '}
                  <strong>{extractionStatus.remainingCount.toLocaleString()}</strong> de extras.
                </>
              )}
            </p>
          </div>
        </div>
        <button
          onClick={onContinueExtraction}
          className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 font-medium flex items-center gap-2"
        >
          <FolderOpen className="h-4 w-4" />
          {isUnknownTotal ? 'Verifică și continuă' : 'Continuă extragerea'}
        </button>
      </div>
      {/* Mini progress bar - only show if we know the total */}
      {!isUnknownTotal && (
        <div className="mt-3 h-2 bg-amber-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-amber-500 rounded-full transition-all"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      )}
    </div>
  );
}

interface ExtractionProgress {
  status: 'idle' | 'extracting' | 'batch_complete' | 'complete' | 'error';
  extractedCount: number;
  totalInPst: number;
  remainingCount: number;
  batchSize?: number;
  error?: string;
}

function ExtractStep({ sessionId, onComplete }: ExtractStepProps) {
  const [progress, setProgress] = useState<ExtractionProgress>({
    status: 'idle',
    extractedCount: 0,
    totalInPst: 0,
    remainingCount: 0,
  });
  const [error, setError] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  // Check current extraction status on mount
  useEffect(() => {
    if (!sessionId) return;

    async function checkStatus() {
      try {
        const res = await fetch(`/api/extract-documents?sessionId=${sessionId}`);
        if (!res.ok) return;

        const data = await res.json();
        const extractionProgress = data.extractionProgress;

        if (extractionProgress) {
          const isComplete = extractionProgress.isComplete;
          setProgress({
            status: isComplete
              ? 'complete'
              : extractionProgress.extractedCount > 0
                ? 'batch_complete'
                : 'idle',
            extractedCount: extractionProgress.extractedCount || 0,
            totalInPst: extractionProgress.totalInPst || 0,
            remainingCount: extractionProgress.remainingCount || 0,
          });

          // Auto-complete if extraction is done
          if (isComplete && extractionProgress.extractedCount > 0) {
            setTimeout(onComplete, 1000);
          }
        }
      } catch (err) {
        console.error('Error checking extraction status:', err);
      }
    }

    checkStatus();
  }, [sessionId, onComplete]);

  const runExtractionBatch = async () => {
    if (!sessionId || isExtracting) return;

    setIsExtracting(true);
    setError(null);
    setProgress((p) => ({ ...p, status: 'extracting' }));

    try {
      const res = await fetch('/api/extract-documents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || 'Failed to extract documents');
      }

      const data = await res.json();

      const isComplete = data.progress?.isComplete;
      setProgress({
        status: isComplete ? 'complete' : 'batch_complete',
        extractedCount: data.progress?.extractedCount || 0,
        totalInPst: data.progress?.totalInPst || 0,
        remainingCount: data.progress?.remainingCount || 0,
        batchSize: data.extraction?.batchDocuments || 0,
      });

      // Auto-complete if extraction is done
      if (isComplete) {
        setTimeout(onComplete, 1500);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed');
      setProgress((p) => ({ ...p, status: 'error' }));
    } finally {
      setIsExtracting(false);
    }
  };

  // Auto-start extraction on first render if not already extracted
  useEffect(() => {
    if (sessionId && progress.status === 'idle' && !isExtracting) {
      runExtractionBatch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, progress.status]);

  const progressPercent =
    progress.totalInPst > 0 ? Math.round((progress.extractedCount / progress.totalInPst) * 100) : 0;

  if (error) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-red-200 p-8">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-100 mb-4">
            <Settings className="h-6 w-6 text-red-600" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Extragerea a eșuat</h2>
          <p className="text-red-600 mb-4">{error}</p>
          <div className="flex gap-3 justify-center">
            <button
              onClick={() => {
                setError(null);
                runExtractionBatch();
              }}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Încearcă din nou
            </button>
            {progress.extractedCount > 0 && (
              <button
                onClick={onComplete}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200"
              >
                Continuă cu {progress.extractedCount} documente
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
      <div className="text-center mb-8">
        {progress.status === 'complete' ? (
          <>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-green-100 mb-4">
              <CheckCircle className="h-6 w-6 text-green-600" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Extragere finalizată!</h2>
            <p className="text-gray-600">
              Am extras {progress.extractedCount.toLocaleString()} documente pregătite pentru
              categorizare.
            </p>
          </>
        ) : progress.status === 'batch_complete' ? (
          <>
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 mb-4">
              <FolderOpen className="h-6 w-6 text-amber-600" />
            </div>
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">
              Lot de extragere finalizat
            </h2>
            <p className="text-gray-600">
              Am extras {progress.extractedCount.toLocaleString()} din{' '}
              {progress.totalInPst.toLocaleString()} documente.
              <br />
              <strong className="text-amber-600">
                {progress.remainingCount.toLocaleString()}
              </strong>{' '}
              documente rămase de extras.
            </p>
          </>
        ) : (
          <>
            <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-2">Se extrag documentele...</h2>
            <p className="text-gray-600">
              Se procesează fișierul PST și se extrag atașamentele PDF, DOCX și DOC.
              {progress.totalInPst > 0 && (
                <>
                  <br />
                  <span className="text-sm">
                    Total în PST: {progress.totalInPst.toLocaleString()} documente
                  </span>
                </>
              )}
            </p>
          </>
        )}
      </div>

      {/* Progress Bar */}
      <div className="max-w-md mx-auto">
        <div className="flex items-center justify-between mb-2 text-sm text-gray-600">
          <span>Documente extrase</span>
          <span>
            {progress.extractedCount.toLocaleString()}
            {progress.totalInPst > 0 && ` / ${progress.totalInPst.toLocaleString()}`}
            {progress.totalInPst > 0 && ` (${progressPercent}%)`}
          </span>
        </div>
        <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              progress.status === 'complete'
                ? 'bg-green-500'
                : progress.status === 'batch_complete'
                  ? 'bg-amber-500'
                  : 'bg-blue-600'
            }`}
            style={{ width: `${progressPercent || (isExtracting ? 10 : 0)}%` }}
          />
        </div>

        {/* Continue Extraction Button */}
        {progress.status === 'batch_complete' && progress.remainingCount > 0 && (
          <div className="mt-6 text-center space-y-3">
            <button
              onClick={runExtractionBatch}
              disabled={isExtracting}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 mx-auto"
            >
              {isExtracting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Se extrag...
                </>
              ) : (
                <>
                  <FolderOpen className="h-4 w-4" />
                  Continuă extragerea ({progress.remainingCount.toLocaleString()} rămase)
                </>
              )}
            </button>
            <button
              onClick={onComplete}
              className="text-sm text-gray-500 hover:text-gray-700 underline"
            >
              Sau continuă cu documentele extrase deja
            </button>
          </div>
        )}

        {/* Info about batch extraction */}
        {(progress.status === 'extracting' || progress.status === 'batch_complete') && (
          <p className="text-xs text-gray-500 mt-4 text-center">
            Extragerea se face în loturi de ~500 documente pentru a evita timeout-ul.
            {progress.status === 'batch_complete' && ' Apasă butonul pentru a continua.'}
          </p>
        )}
      </div>
    </div>
  );
}

function ImportPageContent() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const urlSessionId = searchParams.get('sessionId');
  const [currentStep, setCurrentStep] = useState<ImportStep>('upload');
  const [session, setSession] = useState<SessionState>({
    sessionId: null,
    fileName: null,
    status: 'idle',
  });
  const [showMergeModal, setShowMergeModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showUserManagement, setShowUserManagement] = useState(false);
  const [sessionStats, setSessionStats] = useState({
    totalDocuments: 0,
    categorizedCount: 0,
    skippedCount: 0,
    categoriesCount: 0,
  });
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [resumedSession, setResumedSession] = useState<ActiveSessionResponse['session'] | null>(
    null
  );

  const isPartnerOrAdmin = user?.role === 'Partner' || user?.role === 'Admin';

  // Force Paralegals/Assistants to categorization step (they can only categorize)
  useEffect(() => {
    if (!isLoadingSession && !isPartnerOrAdmin && session.sessionId) {
      setCurrentStep('categorize');
    }
  }, [isLoadingSession, isPartnerOrAdmin, session.sessionId]);

  // Check for active session on mount (URL param takes priority, doesn't require auth)
  useEffect(() => {
    async function checkActiveSession() {
      // If sessionId is provided in URL, load that session directly (no auth required)
      if (urlSessionId) {
        try {
          const res = await fetch(`/api/session-progress?sessionId=${urlSessionId}`);
          if (res.ok) {
            const data = await res.json();
            setSession({
              sessionId: urlSessionId,
              fileName: data.pstFileName || 'Unknown',
              status: data.status,
            });
            // Determine step based on status and document count
            if (
              (data.status === 'InProgress' || data.status === 'Extracted') &&
              data.progress?.totalDocuments > 0
            ) {
              setCurrentStep('categorize');
            } else if (data.status === 'Extracting') {
              setCurrentStep('extract');
            } else {
              setCurrentStep('upload');
            }
            setResumedSession({
              sessionId: urlSessionId,
              fileName: data.pstFileName || 'Unknown',
              status: data.status,
              currentStep: 'categorize',
              progress: {
                totalDocuments: data.progress?.totalDocuments || 0,
                categorizedCount: data.progress?.categorized || 0,
                skippedCount: data.progress?.skipped || 0,
                analyzedCount: 0,
              },
              createdAt: '',
              updatedAt: '',
            });
            setIsLoadingSession(false);
            return;
          }
        } catch (err) {
          console.error('Error loading session from URL:', err);
        }
      }

      // Try to load default session (most recent with documents) - no auth required
      try {
        const defaultRes = await fetch('/api/active-session');
        if (defaultRes.ok) {
          const defaultData: ActiveSessionResponse = await defaultRes.json();
          if (defaultData.hasActiveSession && defaultData.session) {
            setSession({
              sessionId: defaultData.session.sessionId,
              fileName: defaultData.session.fileName,
              status: defaultData.session.status,
            });
            setCurrentStep(defaultData.session.currentStep);
            setResumedSession(defaultData.session);
            setIsLoadingSession(false);
            return;
          }
        }
      } catch (err) {
        console.error('Error loading default session:', err);
      }

      // Fall back to user's active session (requires auth)
      if (!user?.id) {
        setIsLoadingSession(false);
        return;
      }

      try {
        const res = await fetch(`/api/active-session?userId=${user.id}`);
        if (!res.ok) {
          setIsLoadingSession(false);
          return;
        }

        const data: ActiveSessionResponse = await res.json();

        if (data.hasActiveSession && data.session) {
          // Resume the active session
          setSession({
            sessionId: data.session.sessionId,
            fileName: data.session.fileName,
            status: data.session.status,
          });
          setCurrentStep(data.session.currentStep);
          setResumedSession(data.session);
        }
      } catch (err) {
        console.error('Error checking active session:', err);
      } finally {
        setIsLoadingSession(false);
      }
    }

    checkActiveSession();
  }, [user?.id, urlSessionId]);

  // Function to start a new session (abandon current)
  const startNewSession = useCallback(() => {
    setSession({
      sessionId: null,
      fileName: null,
      status: 'idle',
    });
    setCurrentStep('upload');
    setResumedSession(null);
  }, []);

  const handleUploadComplete = useCallback((sessionId: string, fileName: string) => {
    setSession({
      sessionId,
      fileName,
      status: 'extracting',
    });
    setCurrentStep('extract');
  }, []);

  const handleUploadError = useCallback((error: Error) => {
    console.error('Upload error:', error);
  }, []);

  const fetchSessionStats = useCallback(async () => {
    if (!session.sessionId) return;

    try {
      const res = await fetch(`/api/partner-dashboard?sessionId=${session.sessionId}`);
      if (res.ok) {
        const data = await res.json();
        setSessionStats({
          totalDocuments: data.session.totalDocuments,
          categorizedCount: data.session.categorizedCount,
          skippedCount: data.session.skippedCount,
          categoriesCount: data.categoryStats.totalCategories,
        });
      }
    } catch (err) {
      console.error('Error fetching session stats:', err);
    }
  }, [session.sessionId]);

  // Fetch stats when entering dashboard or export step
  useEffect(() => {
    if (currentStep === 'dashboard' || currentStep === 'export') {
      // Use void to handle the promise without triggering setState warning
      void fetchSessionStats();
    }
  }, [currentStep, fetchSessionStats]);

  const allSteps = [
    { id: 'upload', label: 'Încarcă PST', icon: UploadCloud },
    { id: 'extract', label: 'Extrage documente', icon: FolderOpen },
    { id: 'categorize', label: 'Categorizează', icon: FileText },
    { id: 'dashboard', label: 'Panou control', icon: LayoutDashboard },
    { id: 'export', label: 'Export', icon: Settings },
  ];

  // Paralegals only see categorization step
  const steps = isPartnerOrAdmin ? allSteps : allSteps.filter((s) => s.id === 'categorize');

  // Show loading state while checking for active session
  if (isLoadingSession) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Se verifică sesiunea activă...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Session Resume Banner */}
      {resumedSession && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 text-blue-600" />
              <div>
                <p className="font-medium text-blue-900">
                  Sesiune reluată: {resumedSession.fileName}
                </p>
                <p className="text-sm text-blue-700">
                  {resumedSession.progress.categorizedCount} din{' '}
                  {resumedSession.progress.totalDocuments} documente categorizate
                </p>
              </div>
            </div>
            {/* Only Partners can start new sessions */}
            {isPartnerOrAdmin && (
              <button
                onClick={startNewSession}
                className="px-3 py-1.5 text-sm font-medium text-blue-700 hover:text-blue-800 hover:bg-blue-100 rounded-md transition-colors"
              >
                Începe sesiune nouă
              </button>
            )}
          </div>
        </div>
      )}

      {/* Progress Steps */}
      <nav className="flex items-center justify-center" aria-label="Progress">
        <ol className="flex items-center space-x-8">
          {steps.map((step, index) => {
            const Icon = step.icon;
            const isActive = step.id === currentStep;
            const isPast = steps.findIndex((s) => s.id === currentStep) > index;

            return (
              <li key={step.id} className="flex items-center">
                {index > 0 && (
                  <div className={`h-0.5 w-16 mr-4 ${isPast ? 'bg-blue-600' : 'bg-gray-200'}`} />
                )}
                <div
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg ${
                    isActive
                      ? 'bg-blue-600 text-white'
                      : isPast
                        ? 'bg-blue-100 text-blue-600'
                        : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span className="font-medium">{step.label}</span>
                </div>
              </li>
            );
          })}
        </ol>
      </nav>

      {/* Upload Step */}
      {currentStep === 'upload' && (
        <div className="space-y-6">
          {/* User Management Toggle for Partners */}
          {isPartnerOrAdmin && (
            <div className="flex justify-end">
              <button
                onClick={() => setShowUserManagement(!showUserManagement)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  showUserManagement
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Users className="h-4 w-4" />
                {showUserManagement
                  ? 'Ascunde administrare utilizatori'
                  : 'Administrare utilizatori'}
              </button>
            </div>
          )}

          {/* User Management Panel */}
          {isPartnerOrAdmin && showUserManagement && user && (
            <UserManagement currentUserId={user.id} />
          )}

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-2">Încarcă fișierul PST</h2>
              <p className="text-gray-600">
                Încarcă fișierul PST din Outlook pentru a începe importul documentelor pentru
                antrenament AI. Sunt suportate fișiere de până la 60GB cu încărcare cu reluare.
              </p>
            </div>

            <PSTUploader onUploadComplete={handleUploadComplete} onError={handleUploadError} />

            <div className="mt-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">
                <strong>Notă de securitate:</strong> Fișierul PST va fi criptat în timpul încărcării
                și procesării. Va fi șters automat după finalizarea exportului în OneDrive.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Extract Step */}
      {currentStep === 'extract' && (
        <ExtractStep
          sessionId={session.sessionId}
          onComplete={() => setCurrentStep('categorize')}
        />
      )}

      {/* Categorize Step */}
      {currentStep === 'categorize' && session.sessionId && (
        <div className="space-y-4">
          {/* Only Partners see extraction incomplete banner */}
          {isPartnerOrAdmin && (
            <ExtractionIncompleteBanner
              sessionId={session.sessionId}
              onContinueExtraction={() => setCurrentStep('extract')}
            />
          )}
          <CategorizationWorkspace sessionId={session.sessionId} />
          {/* Only Partners see dashboard navigation */}
          {isPartnerOrAdmin && (
            <div className="flex justify-end">
              <button
                onClick={() => setCurrentStep('dashboard')}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium flex items-center gap-2"
              >
                <LayoutDashboard className="h-4 w-4" />
                Mergi la panou
              </button>
            </div>
          )}
        </div>
      )}

      {/* Dashboard Step (Partner View) */}
      {currentStep === 'dashboard' && session.sessionId && (
        <div className="space-y-6">
          {/* User Management Toggle for Partners */}
          {isPartnerOrAdmin && (
            <div className="flex justify-end">
              <button
                onClick={() => setShowUserManagement(!showUserManagement)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
                  showUserManagement
                    ? 'bg-blue-600 text-white'
                    : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Users className="h-4 w-4" />
                {showUserManagement
                  ? 'Ascunde administrare utilizatori'
                  : 'Administrare utilizatori'}
              </button>
            </div>
          )}

          {/* User Management Panel */}
          {isPartnerOrAdmin && showUserManagement && user && (
            <UserManagement currentUserId={user.id} />
          )}

          <PartnerDashboard
            sessionId={session.sessionId}
            onManageCategories={() => setShowMergeModal(true)}
            onExport={() => {
              fetchSessionStats();
              setShowExportModal(true);
            }}
          />
        </div>
      )}

      {/* Export Step - Shows after successful export */}
      {currentStep === 'export' && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <div className="text-center">
            <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">Export finalizat!</h2>
            <p className="text-gray-600 mb-6">
              Documentele categorizate au fost exportate în OneDrive și fișierele temporare au fost
              șterse.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 rounded-lg text-gray-700">
              <FolderOpen className="h-5 w-5" />
              <span>OneDrive → /AI-Training/</span>
            </div>
          </div>
        </div>
      )}

      {/* Merge Categories Modal */}
      {session.sessionId && (
        <MergeCategoriesModal
          sessionId={session.sessionId}
          isOpen={showMergeModal}
          onClose={() => setShowMergeModal(false)}
          onMergeComplete={fetchSessionStats}
        />
      )}

      {/* Export Modal */}
      {session.sessionId && (
        <ExportModal
          sessionId={session.sessionId}
          isOpen={showExportModal}
          onClose={() => setShowExportModal(false)}
          onExportComplete={() => {
            setShowExportModal(false);
            setCurrentStep('export');
          }}
          stats={sessionStats}
        />
      )}

      {/* Session Info */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="font-semibold text-gray-900 mb-4">Ghid de pornire rapidă</h3>
        <ol className="space-y-3 text-sm text-gray-600">
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
              1
            </span>
            <span>Încarcă fișierul PST din Outlook care conține atașamentele email-urilor</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
              2
            </span>
            <span>Sistemul extrage atașamentele PDF, DOCX și DOC și analizează limba</span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
              3
            </span>
            <span>
              Tu și asistenții tăi categorizați documentele (munca este distribuită pe luni)
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex-shrink-0 w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-medium">
              4
            </span>
            <span>Unifică categoriile duplicate și exportă în OneDrive pentru antrenament AI</span>
          </li>
        </ol>
      </div>
    </div>
  );
}

export default function ImportPage() {
  return (
    <ProtectedRoute>
      <ImportPageContent />
    </ProtectedRoute>
  );
}
