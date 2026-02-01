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
  insertOoxml,
  insertHtml,
} from '../../services/word-api';
import { StepContext } from './StepContext';
import { StepDocument } from './StepDocument';
import { StepTemplate, type CourtFilingTemplate } from './StepTemplate';
import { TemplateForm } from './TemplateForm';
import { StepResearch } from './StepResearch';
import { StepContract, type ContractAnalysisResult } from './StepContract';
import { StepSuccess } from './StepSuccess';
import { GeneratingProgress } from './GeneratingProgress';
import { ContractAnalysisPanel } from '../ContractAnalysisPanel';
import { useExpertMode } from '../../hooks/useExpertMode';
import {
  highlightClause,
  insertWithTrackedChanges,
  searchAndScrollTo,
} from '../../services/word-api';

// ============================================================================
// Types
// ============================================================================

export type WizardStep =
  | 'context'
  | 'details'
  | 'template-form'
  | 'contract-analyzing'
  | 'contract-results'
  | 'generating'
  | 'success';
export type ContextType = 'case' | 'client' | 'internal';
export type CreateType = 'document' | 'template' | 'research' | 'contract';

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

/** Validation result for court filing documents */
export interface ValidationResult {
  valid: boolean;
  missingSections: string[];
  foundSections: string[];
  warnings?: string[];
}

export interface GenerationResult {
  content: string;
  ooxmlContent?: string;
  title: string;
  tokensUsed: number;
  processingTimeMs: number;
  /** Validation result for court filing documents */
  validation?: ValidationResult;
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
  // Expert mode context
  const { isExpertMode } = useExpertMode();

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

  // Contract analysis state (for expert mode)
  const [contractAnalysisResult, setContractAnalysisResult] =
    useState<ContractAnalysisResult | null>(null);

  // Data
  const [cases, setCases] = useState<ActiveCase[]>([]);
  const [clients, setClients] = useState<ActiveClient[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [autoDetectedCase, setAutoDetectedCase] = useState<string | null>(null);

  // Navigation animation state
  const [isReady, setIsReady] = useState(false); // True after initial data load
  const [animationDirection, setAnimationDirection] = useState<'forward' | 'back' | null>(null);

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

        // Mark wizard as ready for animations
        setIsReady(true);
      } catch (err) {
        console.error('Failed to load initial data:', err);
        setLoadingData(false);
        setIsReady(true); // Still mark ready so UI isn't stuck
      }
    }

    loadInitialData();
  }, [loadCasesAndClients]);

  // ============================================================================
  // Navigation
  // ============================================================================

  // Selected template (for template creation flow)
  const [selectedTemplate, setSelectedTemplate] = useState<CourtFilingTemplate | null>(null);

  // Step order for determining animation direction
  const STEP_ORDER: WizardStep[] = [
    'context',
    'details',
    'template-form',
    'contract-analyzing',
    'contract-results',
    'generating',
    'success',
  ];

  const goToStep = useCallback(
    (step: WizardStep, direction?: 'forward' | 'back') => {
      // Determine animation direction if not specified
      if (direction) {
        setAnimationDirection(direction);
      } else {
        const currentIndex = STEP_ORDER.indexOf(state.step);
        const nextIndex = STEP_ORDER.indexOf(step);
        setAnimationDirection(nextIndex > currentIndex ? 'forward' : 'back');
      }
      setState((prev) => ({ ...prev, step }));
    },
    [state.step]
  );

  const goBack = useCallback(() => {
    goToStep('context', 'back');
  }, [goToStep]);

  const updateState = useCallback((updates: Partial<WizardState>) => {
    setState((prev) => ({ ...prev, ...updates }));
  }, []);

  const resetWizard = useCallback(() => {
    setAnimationDirection('back');
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
    setContractAnalysisResult(null);
  }, [presetContext]);

  // ============================================================================
  // Contract Analysis Handlers (Expert Mode)
  // ============================================================================

  const handleContractAnalysisComplete = useCallback(
    async (result: ContractAnalysisResult) => {
      setContractAnalysisResult(result);

      // Apply highlights to document for each risky clause
      // Use Promise.allSettled to handle all clauses concurrently and track failures
      const highlightResults = await Promise.allSettled(
        result.clauses.map(async (clause) => {
          const color =
            clause.riskLevel === 'high'
              ? 'red'
              : clause.riskLevel === 'medium'
                ? 'yellow'
                : 'green';
          return highlightClause(clause.clauseText.substring(0, 100), color);
        })
      );

      // Count and log failures
      const failedCount = highlightResults.filter((r) => r.status === 'rejected').length;
      if (failedCount > 0) {
        console.warn(
          `[CreateWizard] Failed to highlight ${failedCount}/${result.clauses.length} clauses`
        );
        // Note: We continue anyway - highlighting is a nice-to-have, not critical
      }

      goToStep('contract-results', 'forward');
    },
    [goToStep]
  );

  const handleApplyAlternative = useCallback(
    async (clauseId: string, _alternativeId: string, text: string) => {
      try {
        // Find the original clause text
        const clause = contractAnalysisResult?.clauses.find((c) => c.id === clauseId);
        if (clause) {
          await insertWithTrackedChanges(text, clause.clauseText);
        }
      } catch (err) {
        console.error('[CreateWizard] Failed to apply alternative:', err);
        onError('Eroare la aplicarea alternativei');
      }
    },
    [contractAnalysisResult, onError]
  );

  const handleResearchClause = useCallback(
    async (clause: { clauseText: string; reasoning: string }) => {
      // For now, just log - the actual research will be triggered from ClauseCard
      console.log('[CreateWizard] Research clause:', clause.clauseText.substring(0, 50));
    },
    []
  );

  const handleNavigateToClause = useCallback(async (clauseText: string) => {
    try {
      await searchAndScrollTo(clauseText.substring(0, 100));
    } catch (err) {
      console.warn('[CreateWizard] Failed to navigate to clause:', err);
    }
  }, []);

  // ============================================================================
  // Generation Handlers
  // ============================================================================

  const handleGenerationStart = useCallback(() => {
    goToStep('generating', 'forward');
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
      goToStep('success', 'forward');
    },
    [goToStep]
  );

  const handleGenerationError = useCallback(
    (error: string) => {
      onError(error);
      goToStep('details', 'back');
    },
    [onError, goToStep]
  );

  // ============================================================================
  // Render
  // ============================================================================

  // Get animation class based on state
  const getAnimationClass = () => {
    if (!isReady) return ''; // No animation during initial load
    if (animationDirection === 'forward') return 'animate-in';
    if (animationDirection === 'back') return 'animate-back';
    return '';
  };

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
          onNext={() => {
            // Contract mode goes directly to analysis, others go to details
            if (state.createType === 'contract') {
              goToStep('contract-analyzing', 'forward');
            } else {
              goToStep('details', 'forward');
            }
          }}
          animationClass={getAnimationClass()}
          isExpertMode={isExpertMode}
        />
      )}

      {/* Step 2: Type-specific details */}
      {state.step === 'details' && state.createType === 'document' && (
        <StepDocument
          state={state}
          onUpdate={updateState}
          onBack={goBack}
          onGenerationStart={handleGenerationStart}
          onChunk={handleChunk}
          onProgress={handleProgress}
          onComplete={handleGenerationComplete}
          onError={handleGenerationError}
          animationClass={getAnimationClass()}
        />
      )}

      {state.step === 'details' && state.createType === 'template' && (
        <StepTemplate
          state={state}
          onBack={goBack}
          onSelectTemplate={(template) => {
            setSelectedTemplate(template);
            // Update document name to template name
            updateState({ documentName: template.name });
            goToStep('template-form', 'forward');
          }}
          animationClass={getAnimationClass()}
        />
      )}

      {/* Template Form - after selecting a template */}
      {state.step === 'template-form' && selectedTemplate && (
        <TemplateForm
          template={selectedTemplate}
          state={state}
          onBack={() => {
            setSelectedTemplate(null);
            goToStep('details', 'back');
          }}
          onGenerate={async (instructions) => {
            console.log('[CreateWizard] Generate template:', selectedTemplate.id, instructions);
            handleGenerationStart();

            try {
              // Use streaming to prevent timeout on long-running generation
              // Include template metadata for AI-guided generation (Phase 1)
              const result = await apiClient.generateCourtFilingStream(
                {
                  templateId: selectedTemplate.id,
                  contextType: state.contextType,
                  caseId: state.caseId || undefined,
                  clientId: state.clientId || undefined,
                  instructions: instructions || undefined,
                  templateMetadata: {
                    name: selectedTemplate.name,
                    cpcArticles: selectedTemplate.cpcArticles,
                    partyLabels: selectedTemplate.partyLabels,
                    requiredSections: selectedTemplate.requiredSections,
                    formCategory: selectedTemplate.formCategory,
                    category: selectedTemplate.category,
                    description: selectedTemplate.description,
                  },
                },
                handleChunk
              );

              // Fetch OOXML for proper formatting
              handleProgress({ type: 'phase_start', text: 'Formatez documentul pentru Word...' });

              let ooxmlContent: string | undefined;
              try {
                const ooxmlResponse = await apiClient.getOoxml(result.content, 'markdown');
                ooxmlContent = ooxmlResponse.ooxmlContent;
                handleProgress({ type: 'phase_complete', text: 'Document formatat' });
              } catch (ooxmlErr) {
                console.warn('[CreateWizard] Failed to fetch OOXML:', ooxmlErr);
                handleProgress({ type: 'phase_complete', text: 'Formatare simplificată' });
              }

              // Insert content into Word document
              if (ooxmlContent) {
                await insertOoxml(ooxmlContent, result.content);
              } else {
                await insertHtml(result.content);
              }

              handleGenerationComplete({
                content: result.content,
                ooxmlContent,
                title: result.title,
                tokensUsed: result.tokensUsed,
                processingTimeMs: result.processingTimeMs,
                validation: result.validation,
              });
            } catch (error) {
              console.error('[CreateWizard] Court filing generation error:', error);
              handleGenerationError(
                error instanceof Error ? error.message : 'Eroare la generarea documentului'
              );
            }
          }}
          animationClass={getAnimationClass()}
        />
      )}

      {state.step === 'details' && state.createType === 'research' && (
        <StepResearch
          state={state}
          onBack={goBack}
          onGenerationStart={handleGenerationStart}
          onChunk={handleChunk}
          onProgress={handleProgress}
          onComplete={handleGenerationComplete}
          onError={handleGenerationError}
          animationClass={getAnimationClass()}
          isExpertMode={isExpertMode}
        />
      )}

      {/* Contract Analysis - Expert Mode */}
      {state.step === 'contract-analyzing' && (
        <StepContract
          state={state}
          onBack={goBack}
          onAnalysisComplete={handleContractAnalysisComplete}
          onError={onError}
          animationClass={getAnimationClass()}
        />
      )}

      {state.step === 'contract-results' && contractAnalysisResult && (
        <ContractAnalysisPanel
          clauses={contractAnalysisResult.clauses}
          clarifyingQuestions={contractAnalysisResult.clarifyingQuestions}
          summary={contractAnalysisResult.summary}
          thinkingBlocks={contractAnalysisResult.thinkingBlocks}
          onApplyAlternative={handleApplyAlternative}
          onResearchClause={handleResearchClause}
          onNavigateToClause={handleNavigateToClause}
          onBack={goBack}
          onDone={resetWizard}
        />
      )}

      {/* Generating State */}
      {state.step === 'generating' && (
        <GeneratingProgress
          progressEvents={progressEvents}
          streamingContent={streamingContent}
          animationClass={getAnimationClass()}
        />
      )}

      {/* Step 3: Success */}
      {state.step === 'success' && result && (
        <StepSuccess
          state={state}
          result={result}
          onReset={resetWizard}
          onError={onError}
          onSaveSuccess={onSaveSuccess}
          animationClass={getAnimationClass()}
        />
      )}
    </div>
  );
}
