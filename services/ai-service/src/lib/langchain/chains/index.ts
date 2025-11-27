/**
 * LangChain Chain Builders
 * Story 3.1: AI Service Infrastructure
 */

import { RunnableSequence } from '@langchain/core/runnables';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { ChatAnthropic } from '@langchain/anthropic';
import {
  documentSummaryPrompt,
  legalAnalysisPrompt,
  classificationPrompt,
  extractionPrompt,
  textGenerationPrompt,
  chatPrompt,
} from '../prompts';

// Output parser for string responses
const stringParser = new StringOutputParser();

// Document summary chain
export function createDocumentSummaryChain(model: ChatAnthropic) {
  return RunnableSequence.from([
    documentSummaryPrompt,
    model,
    stringParser,
  ]);
}

// Legal analysis chain
export function createLegalAnalysisChain(model: ChatAnthropic) {
  return RunnableSequence.from([
    legalAnalysisPrompt,
    model,
    stringParser,
  ]);
}

// Classification chain
export function createClassificationChain(model: ChatAnthropic) {
  return RunnableSequence.from([
    classificationPrompt,
    model,
    stringParser,
  ]);
}

// Entity extraction chain
export function createExtractionChain(model: ChatAnthropic) {
  return RunnableSequence.from([
    extractionPrompt,
    model,
    stringParser,
  ]);
}

// General text generation chain
export function createTextGenerationChain(model: ChatAnthropic) {
  return RunnableSequence.from([
    textGenerationPrompt,
    model,
    stringParser,
  ]);
}

// Chat chain
export function createChatChain(model: ChatAnthropic) {
  return RunnableSequence.from([
    chatPrompt,
    model,
    stringParser,
  ]);
}

// Get chain by operation type
export function getChainForOperation(
  operationType: string,
  model: ChatAnthropic
): RunnableSequence {
  switch (operationType) {
    case 'document_summary':
      return createDocumentSummaryChain(model);
    case 'legal_analysis':
      return createLegalAnalysisChain(model);
    case 'classification':
      return createClassificationChain(model);
    case 'extraction':
      return createExtractionChain(model);
    case 'chat':
      return createChatChain(model);
    case 'text_generation':
    default:
      return createTextGenerationChain(model);
  }
}

// Chain execution result type
export interface ChainExecutionResult {
  content: string;
  inputTokens?: number;
  outputTokens?: number;
  latencyMs?: number;
}
