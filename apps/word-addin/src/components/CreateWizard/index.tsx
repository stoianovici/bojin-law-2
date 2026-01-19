/**
 * CreateWizard Component
 * Two-step wizard for document creation in Word Add-in.
 *
 * Step 1 (Context): Select context type + case/client + creation type
 * Step 2 (Details): Type-specific form (document/template/research)
 * Step 3 (Success): Result display with save to platform option
 */

import { useState, useCallback, useEffect } from 'react';
import { apiClient } from '../../services/api-client';
import {
  getDocumentName,
  getDocumentProperties,
  getDocumentUrl,
  getDocumentFileName,
} from '../../services/word-api';
import { StepContext } from './StepContext';
import { StepDocument } from './StepDocument';
import { StepTemplate } from './StepTemplate';
import { StepResearch } from './StepResearch';
import { StepSuccess } from './StepSuccess';

// ============================================================================
// Types
// ============================================================================

export type WizardStep = 'context' | 'details' | 'generating' | 'success';
export type ContextType = 'case' | 'client' | 'internal';
export type CreateType = 'document' | 'template' | 'research';

export interface ActiveCase {
  id: string;
  title: string;
  caseNumber: string;
}

export interface ActiveClient {
  id: string;
  name: string;
  type: 'Individual' | 'Company';
}

export interface WizardState {
  step: WizardStep;
  contextType: ContextType;
  caseId: string;
  caseNumber: string;
  clientId: string;
  createType: CreateType;
  documentName: string;
}

export interface GenerationResult {
  content: string;
  ooxmlContent?: string;
  title: string;
  tokensUsed: number;
  processingTimeMs: number;
}

interface PresetContext {
  caseId?: string;
  caseNumber?: string;
  clientId?: string;
  clientName?: string;
}

interface CreateWizardProps {
  onError: (error: string) => void;
  /** If provided, skip context step and use this case */
  presetContext?: PresetContext;
  /** Called after successful save with document details for storing in Word properties */
  onSaveSuccess?: (result: {
    documentId: string;
    caseId?: string;
    caseNumber?: string;
    fileName: string;
  }) => void;
}

// ============================================================================
// Component
// ============================================================================

export function CreateWizard({ onError, presetContext, onSaveSuccess }: CreateWizardProps) {
  // Wizard state - if presetContext provided, still show context step for creation type selection
  // but case/client will be pre-filled
  const presetContextType = presetContext?.caseId
    ? 'case'
    : presetContext?.clientId
      ? 'client'
      : 'case';
  const [state, setState] = useState<WizardState>({
    step: 'context', // Always start with context to allow creation type selection
    contextType: presetContextType,
    caseId: presetContext?.caseId || '',
    caseNumber: presetContext?.caseNumber || '',
    clientId: presetContext?.clientId || '',
    createType: 'document',
    documentName: '',
  });

  // Data
  const [cases, setCases] = useState<ActiveCase[]>([]);
  const [clients, setClients] = useState<ActiveClient[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [autoDetectedCase, setAutoDetectedCase] = useState<string | null>(null);

  // Generation
  const [result, setResult] = useState<GenerationResult | null>(null);
  const [streamingContent, setStreamingContent] = useState<string>('');
  const [progressEvents, setProgressEvents] = useState<
    Array<{ type: string; tool?: string; input?: Record<string, unknown>; text?: string }>
  >([]);

  // ============================================================================
  // Data Loading
  // ============================================================================

  const loadCasesAndClients = useCallback(async () => {
    setLoadingData(true);
    try {
      const [casesResponse, clientsResponse] = await Promise.all([
        apiClient.getActiveCases(),
        apiClient.getActiveClients(),
      ]);
      setCases(casesResponse.cases);
      setClients(clientsResponse.clients);
    } catch (err) {
      console.error('Failed to load cases/clients:', err);
    } finally {
      setLoadingData(false);
    }
  }, []);

  // Load initial data and auto-detect case
  useEffect(() => {
    async function loadInitialData() {
      try {
        // Get document name
        const name = await getDocumentName();
        setState((prev) => ({ ...prev, documentName: name }));

        // Try to get case ID from document properties first
        const props = await getDocumentProperties();
        let foundCaseId = props['PlatformCaseId'];

        // If no case ID in properties, try to look it up by document URL or filename
        if (!foundCaseId) {
          try {
            const docUrl = await getDocumentUrl();
            const docFileName = await getDocumentFileName();

            if (docUrl || docFileName) {
              const lookupResult = await apiClient.lookupCaseByDocument({
                url: docUrl || undefined,
                path: docFileName || undefined,
              });

              if (lookupResult.case) {
                foundCaseId = lookupResult.case.id;
                setAutoDetectedCase(`${lookupResult.case.caseNumber} - ${lookupResult.case.title}`);
              }
            }
          } catch (lookupErr) {
            console.warn('Could not lookup case for document:', lookupErr);
          }
        }

        if (foundCaseId) {
          setState((prev) => ({ ...prev, caseId: foundCaseId }));
        }

        // Load cases and clients
        await loadCasesAndClients();
      } catch (err) {
        console.error('Failed to load initial data:', err);
        setLoadingData(false);
      }
    }

    loadInitialData();
  }, [loadCasesAndClients]);

  // ============================================================================
  // Navigation
  // ============================================================================

  const goToStep = useCallback((step: WizardStep) => {
    setState((prev) => ({ ...prev, step }));
  }, []);

  const updateState = useCallback((updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetWizard = useCallback(() => {
    setState((prev) => ({
      ...prev,
      // If presetContext, go back to details; otherwise to context
      step: presetContext ? 'details' : 'context',
      createType: 'document',
      documentName: '',
    }));
    setResult(null);
    setStreamingContent('');
    setProgressEvents([]);
  }, [presetContext]);

  // ============================================================================
  // Generation Handlers
  // ============================================================================

  const handleGenerationStart = useCallback(() => {
    goToStep('generating');
    setResult(null);
    setStreamingContent('');
    setProgressEvents([]);
  }, [goToStep]);

  const handleChunk = useCallback((chunk: string) => {
    setStreamingContent((prev) => prev + chunk);
  }, []);

  const handleProgress = useCallback(
    (event: { type: string; tool?: string; input?: Record<string, unknown>; text?: string }) => {
      setProgressEvents((prev) => [...prev, event]);
    },
    []
  );

  const handleGenerationComplete = useCallback(
    (generationResult: GenerationResult) => {
      setResult(generationResult);
      goToStep('success');
    },
    [goToStep]
  );

  const handleGenerationError = useCallback(
    (error: string) => {
      onError(error);
      goToStep('details');
    },
    [onError, goToStep]
  );

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <div className="create-wizard">
      {/* Step 1: Context Selection */}
      {state.step === 'context' && (
        <StepContext
          state={state}
          cases={cases}
          clients={clients}
          loadingData={loadingData}
          autoDetectedCase={autoDetectedCase}
          presetContext={presetContext}
          onUpdate={updateState}
          onRefresh={loadCasesAndClients}
          onNext={() => goToStep('details')}
        />
      )}

      {/* Step 2: Type-specific details */}
      {state.step === 'details' && state.createType === 'document' && (
        <StepDocument
          state={state}
          onUpdate={updateState}
          onBack={presetContext ? undefined : () => goToStep('context')}
          onGenerationStart={handleGenerationStart}
          onChunk={handleChunk}
          onProgress={handleProgress}
          onComplete={handleGenerationComplete}
          onError={handleGenerationError}
        />
      )}

      {state.step === 'details' && state.createType === 'template' && (
        <StepTemplate onBack={presetContext ? undefined : () => goToStep('context')} />
      )}

      {state.step === 'details' && state.createType === 'research' && (
        <StepResearch
          state={state}
          onBack={presetContext ? undefined : () => goToStep('context')}
          onGenerationStart={handleGenerationStart}
          onChunk={handleChunk}
          onProgress={handleProgress}
          onComplete={handleGenerationComplete}
          onError={handleGenerationError}
        />
      )}

      {/* Generating State */}
      {state.step === 'generating' && (
        <div className="wizard-generating">
          <div className="generating-header">
            <span className="loading-spinner" style={{ width: 20, height: 20 }}></span>
            <span className="generating-title">
              {state.createType === 'research' ? 'Cercetare în curs...' : 'Se generează...'}
            </span>
          </div>

          {/* Progress Events */}
          {progressEvents.length > 0 && (
            <div className="generating-progress">
              {progressEvents.slice(-5).map((event, index) => (
                <div
                  key={index}
                  className={`progress-event progress-event-${event.type === 'tool_start' ? 'tool' : event.type === 'tool_end' ? 'done' : 'thinking'}`}
                >
                  {event.type === 'tool_start' && (
                    <>
                      <strong>Căutare:</strong>{' '}
                      {(event.input as { query?: string })?.query || 'web search'}
                    </>
                  )}
                  {event.type === 'tool_end' && <>Rezultate găsite</>}
                  {event.type === 'thinking' && (
                    <>
                      {event.text?.substring(0, 150)}
                      {(event.text?.length || 0) > 150 ? '...' : ''}
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Streaming Content Preview */}
          <div className="generating-content">
            {streamingContent || (
              <span className="generating-placeholder">
                {progressEvents.length > 0
                  ? 'Se procesează rezultatele cercetării...'
                  : 'Se analizează contextul...'}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Success */}
      {state.step === 'success' && result && (
        <StepSuccess
          state={state}
          result={result}
          onReset={resetWizard}
          onError={onError}
          onSaveSuccess={onSaveSuccess}
        />
      )}
    </div>
  );
}
