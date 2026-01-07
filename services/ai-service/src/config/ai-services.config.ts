/**
 * AI Services Metadata Configuration
 * Romanian display names, descriptions, and icons for all AI operation types
 */

import { AIOperationType } from '@legal-platform/types';

/**
 * Metadata for an AI service/operation type
 */
export interface AIServiceMetadata {
  /** Romanian display name */
  name: string;
  /** Romanian description of what this operation does */
  description: string;
  /** Lucide icon name for UI display */
  icon: string;
}

/**
 * Mapping of all AI operation types to their Romanian metadata
 */
export const AI_SERVICE_METADATA: Record<AIOperationType, AIServiceMetadata> = {
  // ========================================
  // Core AI Operations
  // ========================================
  [AIOperationType.TextGeneration]: {
    name: 'Generare text',
    description: 'Generare de text pentru diverse scopuri juridice',
    icon: 'FileText',
  },

  [AIOperationType.DocumentSummary]: {
    name: 'Rezumat document',
    description: 'Rezumarea automata a documentelor juridice',
    icon: 'FileText',
  },

  [AIOperationType.LegalAnalysis]: {
    name: 'Analiza juridica',
    description: 'Analiza si rationament juridic avansat',
    icon: 'Scale',
  },

  [AIOperationType.Classification]: {
    name: 'Clasificare',
    description: 'Clasificarea automata a continutului',
    icon: 'Tag',
  },

  [AIOperationType.Extraction]: {
    name: 'Extragere',
    description: 'Extragerea datelor structurate din text',
    icon: 'Database',
  },

  [AIOperationType.Embedding]: {
    name: 'Embedding',
    description: 'Generare de embeddings vectoriale pentru cautare semantica',
    icon: 'Bot',
  },

  [AIOperationType.Chat]: {
    name: 'Asistent AI',
    description: 'Asistent conversational pentru intrebari juridice',
    icon: 'MessageSquare',
  },

  // ========================================
  // Document Operations
  // ========================================
  [AIOperationType.DocumentReviewAnalysis]: {
    name: 'Analiza document (revizuire)',
    description: 'Analiza detaliata pentru revizuirea documentelor',
    icon: 'FileSearch',
  },

  [AIOperationType.DocumentCompleteness]: {
    name: 'Completitudine documente',
    description: 'Verificarea completitudinii documentelor necesare',
    icon: 'CheckCircle',
  },

  // ========================================
  // Task Operations
  // ========================================
  [AIOperationType.TaskParsing]: {
    name: 'Parsare sarcini',
    description: 'Extragerea sarcinilor din limbaj natural',
    icon: 'ListTodo',
  },

  // ========================================
  // Communication Operations
  // ========================================
  [AIOperationType.CommunicationIntelligence]: {
    name: 'Inteligenta comunicari',
    description: 'Analiza inteligenta a emailurilor si comunicarilor',
    icon: 'Mail',
  },

  [AIOperationType.ThreadAnalysis]: {
    name: 'Analiza thread email',
    description: 'Analiza conversatiilor si threadurilor de email',
    icon: 'GitBranch',
  },

  // ========================================
  // Risk & Pattern Operations
  // ========================================
  [AIOperationType.RiskAnalysis]: {
    name: 'Analiza risc',
    description: 'Evaluarea riscurilor pentru cazuri si documente',
    icon: 'AlertTriangle',
  },

  [AIOperationType.PatternRecognition]: {
    name: 'Recunoastere tipare',
    description: 'Identificarea tiparelor recurente in date',
    icon: 'Sparkles',
  },

  // ========================================
  // Proactive AI Operations
  // ========================================
  [AIOperationType.ProactiveSuggestion]: {
    name: 'Sugestii proactive',
    description: 'Sugestii automate bazate pe contextul curent',
    icon: 'Lightbulb',
  },

  [AIOperationType.MorningBriefing]: {
    name: 'Briefing matinal',
    description: 'Rezumat zilnic al activitatilor si prioritatilor',
    icon: 'Sun',
  },

  // ========================================
  // Snippet Operations
  // ========================================
  [AIOperationType.SnippetDetection]: {
    name: 'Detectare snippet-uri',
    description: 'Identificarea fragmentelor de text reutilizabile',
    icon: 'Scissors',
  },

  [AIOperationType.SnippetShortcut]: {
    name: 'Shortcut snippet',
    description: 'Aplicarea rapida a snippet-urilor predefinite',
    icon: 'Zap',
  },

  // ========================================
  // Style Operations
  // ========================================
  [AIOperationType.StyleAnalysis]: {
    name: 'Analiza stil',
    description: 'Analiza stilului de scriere pentru consistenta',
    icon: 'Palette',
  },

  [AIOperationType.StyleApplication]: {
    name: 'Aplicare stil',
    description: 'Aplicarea stilului de scriere dorit pe text',
    icon: 'PenTool',
  },
};

/**
 * Helper function to get metadata for an operation type
 */
export function getAIServiceMetadata(operationType: AIOperationType): AIServiceMetadata {
  return AI_SERVICE_METADATA[operationType];
}

/**
 * Get all operation types as an array with their metadata
 */
export function getAllAIServicesWithMetadata(): Array<{
  operationType: AIOperationType;
  metadata: AIServiceMetadata;
}> {
  return Object.entries(AI_SERVICE_METADATA).map(([operationType, metadata]) => ({
    operationType: operationType as AIOperationType,
    metadata,
  }));
}
