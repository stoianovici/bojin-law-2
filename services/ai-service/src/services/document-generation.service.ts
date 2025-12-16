/**
 * Document Generation Service
 * Story 3.3: Intelligent Document Drafting
 *
 * Generates complete document drafts using AI based on case context and prompts
 */

import { v4 as uuidv4 } from 'uuid';
import {
  ChatPromptTemplate,
  SystemMessagePromptTemplate,
  HumanMessagePromptTemplate,
} from '@langchain/core/prompts';
import { StringOutputParser } from '@langchain/core/output_parsers';
import {
  DocumentGenerationInput,
  GeneratedDocument,
  DocumentContext,
  DocumentType,
  PrecedentDocument,
  ClaudeModel,
  AIOperationType,
} from '@legal-platform/types';
import { createClaudeModel, AICallbackHandler } from '../lib/langchain/client';
import { tokenTracker } from './token-tracker.service';
import { cacheService } from './cache.service';
import { contextAggregatorService } from './context-aggregator.service';
import { precedentFinderService } from './precedent-finder.service';
import logger from '../lib/logger';
import { config } from '../config';

// Document type-specific system prompts
const DOCUMENT_TYPE_PROMPTS: Record<DocumentType, string> = {
  Contract: `You are an expert legal document drafter specializing in contract law.
Create precise, enforceable contract language with clear terms and conditions.
Include standard contract sections: parties, recitals, definitions, terms, conditions, signatures.
Use clear Romanian legal terminology where appropriate.`,

  Motion: `You are an expert legal document drafter specializing in court motions.
Create persuasive, well-structured legal arguments with proper citations.
Follow standard motion format: caption, introduction, facts, legal argument, conclusion, prayer for relief.
Reference relevant Romanian procedural law.`,

  Letter: `You are an expert legal document drafter specializing in professional legal correspondence.
Create clear, professional letters with appropriate tone and legal precision.
Include proper salutation, body paragraphs, and formal closing.
Maintain client confidentiality and professional standards.`,

  Memo: `You are an expert legal document drafter specializing in legal memoranda.
Create thorough legal analysis with clear organization and citations.
Follow standard memo format: heading, question presented, brief answer, facts, discussion, conclusion.
Provide balanced analysis of legal issues.`,

  Pleading: `You are an expert legal document drafter specializing in court pleadings.
Create well-structured pleadings that meet court requirements.
Include proper caption, numbered paragraphs, and signature block.
Follow Romanian civil procedure requirements.`,

  Other: `You are an expert legal document drafter.
Create professional, well-organized legal documents.
Ensure clarity, precision, and appropriate legal terminology.
Adapt format to the specific document requirements.`,
};

// Base system prompt for all document generation
const BASE_SYSTEM_PROMPT = `You are an AI assistant for a Romanian law firm, specializing in legal document drafting.

Key Guidelines:
1. Generate complete, professional legal documents
2. Use appropriate Romanian legal terminology
3. Structure documents logically with clear sections
4. Include all necessary legal formalities
5. Reference relevant Romanian law where appropriate
6. Maintain a formal, professional tone
7. Ensure clarity and precision in all language
8. Follow the firm's established patterns when provided

Document Context:
{contextSummary}

Precedent Documents Referenced:
{precedentSummary}

{documentTypeInstructions}`;

const HUMAN_PROMPT = `Please draft the following document:

Document Type: {documentType}
User Request: {prompt}

Generate a complete, professional document that fulfills this request.
The document should be ready for review with minimal editing required.`;

export class DocumentGenerationService {
  /**
   * Generate a document based on prompt and case context
   */
  async generateDocument(input: DocumentGenerationInput): Promise<GeneratedDocument> {
    const startTime = Date.now();
    const requestId = uuidv4();

    logger.info('Starting document generation', {
      requestId,
      caseId: input.caseId,
      documentType: input.documentType,
      promptLength: input.prompt.length,
    });

    try {
      // Check cache first
      const cacheKey = this.buildCacheKey(input);
      const cachedResponse = await cacheService.get(cacheKey, input.firmId);
      if (cachedResponse) {
        logger.info('Cache hit for document generation', { requestId, cacheKey });
        return JSON.parse(cachedResponse.response) as GeneratedDocument;
      }

      // Aggregate context if requested
      let context: DocumentContext | null = null;
      if (input.includeContext !== false) {
        context = await contextAggregatorService.aggregateCaseContext(input.caseId, input.firmId);
      }

      // Find relevant precedents
      const precedents = await precedentFinderService.findSimilarDocuments({
        caseId: input.caseId,
        documentType: input.documentType,
        query: input.prompt,
        limit: 5,
        firmId: input.firmId,
      });

      // Build the prompt
      const contextSummary = context
        ? this.formatContextSummary(context)
        : 'No case context provided.';
      const precedentSummary = this.formatPrecedentSummary(precedents);
      const documentTypeInstructions = DOCUMENT_TYPE_PROMPTS[input.documentType];

      // Create LangChain prompt template
      const systemPrompt = SystemMessagePromptTemplate.fromTemplate(BASE_SYSTEM_PROMPT);
      const humanPrompt = HumanMessagePromptTemplate.fromTemplate(HUMAN_PROMPT);
      const chatPrompt = ChatPromptTemplate.fromMessages([systemPrompt, humanPrompt]);

      // Create callback handler for metrics
      const callbackHandler = new AICallbackHandler();

      // Use Sonnet model for document generation (complex task)
      const model = createClaudeModel(ClaudeModel.Sonnet, {
        maxTokens: parseInt(process.env.AI_DOCUMENT_GENERATION_MAX_TOKENS || '4096', 10),
        callbacks: [callbackHandler],
      });

      // Create the chain
      const chain = chatPrompt.pipe(model).pipe(new StringOutputParser());

      // Generate the document
      const content = await chain.invoke({
        contextSummary,
        precedentSummary,
        documentTypeInstructions,
        documentType: input.documentType,
        prompt: input.prompt,
      });

      // Get metrics from callback handler
      const metrics = callbackHandler.getMetrics();
      const generationTimeMs = Date.now() - startTime;

      // Generate suggested title
      const suggestedTitle = this.generateSuggestedTitle(input.documentType, input.prompt, context);

      // Build the result
      const result: GeneratedDocument = {
        id: requestId,
        title: suggestedTitle,
        content,
        suggestedTitle,
        templateUsed: input.templateId
          ? {
              id: input.templateId,
              name: 'Template',
              category: input.documentType,
            }
          : undefined,
        precedentsReferenced: precedents,
        tokensUsed: metrics.inputTokens + metrics.outputTokens,
        generationTimeMs,
      };

      // Track token usage
      await tokenTracker.recordUsage({
        userId: input.userId,
        caseId: input.caseId,
        firmId: input.firmId,
        operationType: AIOperationType.TextGeneration,
        modelUsed: config.claude.models.sonnet,
        inputTokens: metrics.inputTokens,
        outputTokens: metrics.outputTokens,
        latencyMs: generationTimeMs,
        cached: false,
      });

      // Cache the result
      await cacheService.set(
        cacheKey,
        input.prompt,
        JSON.stringify(result),
        config.claude.models.sonnet,
        AIOperationType.TextGeneration,
        input.firmId
      );

      logger.info('Document generation completed', {
        requestId,
        generationTimeMs,
        tokensUsed: result.tokensUsed,
        contentLength: content.length,
      });

      return result;
    } catch (error) {
      logger.error('Document generation failed', {
        requestId,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  /**
   * Build cache key for document generation request
   */
  private buildCacheKey(input: DocumentGenerationInput): string {
    const keyParts = [
      'doc-gen',
      input.caseId,
      input.documentType,
      input.templateId || 'no-template',
    ];
    return keyParts.join(':');
  }

  /**
   * Format case context into a summary for the prompt
   */
  private formatContextSummary(context: DocumentContext): string {
    const parts: string[] = [];

    // Case information
    parts.push(`Case: ${context.case.title} (${context.case.caseNumber})`);
    parts.push(`Case Type: ${context.case.type}`);
    parts.push(`Status: ${context.case.status}`);
    parts.push(`Description: ${context.case.description}`);
    parts.push(`Opened: ${new Date(context.case.openedDate).toLocaleDateString('ro-RO')}`);

    if (context.case.value) {
      parts.push(`Case Value: ${context.case.value.toLocaleString('ro-RO')} RON`);
    }

    // Client information
    parts.push('');
    parts.push(`Client: ${context.client.name}`);
    if (context.client.address) {
      parts.push(`Address: ${context.client.address}`);
    }

    // Team members
    if (context.teamMembers.length > 0) {
      parts.push('');
      parts.push('Team Members:');
      for (const member of context.teamMembers) {
        parts.push(`  - ${member.name} (${member.role})`);
      }
    }

    // Related documents summary
    if (context.relatedDocuments.length > 0) {
      parts.push('');
      parts.push('Related Documents:');
      for (const doc of context.relatedDocuments.slice(0, 5)) {
        parts.push(`  - ${doc.title} (${doc.type})`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Format precedent documents into a summary for the prompt
   */
  private formatPrecedentSummary(precedents: PrecedentDocument[]): string {
    if (precedents.length === 0) {
      return 'No similar documents found in the firm library.';
    }

    const parts: string[] = ['Similar documents from firm library:'];

    for (const doc of precedents) {
      const similarityPercent = Math.round(doc.similarity * 100);
      parts.push(`\n[${similarityPercent}% match] ${doc.title}`);
      if (doc.relevantSections.length > 0) {
        parts.push(`  Relevant sections: ${doc.relevantSections.slice(0, 3).join(', ')}`);
      }
    }

    return parts.join('\n');
  }

  /**
   * Generate a suggested title for the document
   */
  private generateSuggestedTitle(
    documentType: DocumentType,
    prompt: string,
    context: DocumentContext | null
  ): string {
    const titleParts: string[] = [];

    // Add document type prefix
    const typePrefix = {
      Contract: 'Contract',
      Motion: 'Cerere',
      Letter: 'Scrisoare',
      Memo: 'Memorandum',
      Pleading: 'Cerere de chemare în judecată',
      Other: 'Document',
    };
    titleParts.push(typePrefix[documentType]);

    // Add client name if available
    if (context?.client?.name) {
      titleParts.push('-');
      titleParts.push(context.client.name);
    }

    // Add date
    const today = new Date().toLocaleDateString('ro-RO');
    titleParts.push('-');
    titleParts.push(today);

    return titleParts.join(' ');
  }

  /**
   * Validate document generation input
   */
  validateInput(input: DocumentGenerationInput): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!input.caseId || input.caseId.trim() === '') {
      errors.push('Case ID is required');
    }

    if (!input.prompt || input.prompt.trim() === '') {
      errors.push('Prompt is required');
    }

    if (input.prompt && input.prompt.length < 10) {
      errors.push('Prompt must be at least 10 characters');
    }

    if (input.prompt && input.prompt.length > 10000) {
      errors.push('Prompt must be less than 10,000 characters');
    }

    const validTypes: DocumentType[] = [
      'Contract',
      'Motion',
      'Letter',
      'Memo',
      'Pleading',
      'Other',
    ];
    if (!validTypes.includes(input.documentType)) {
      errors.push(`Document type must be one of: ${validTypes.join(', ')}`);
    }

    if (!input.userId || input.userId.trim() === '') {
      errors.push('User ID is required');
    }

    if (!input.firmId || input.firmId.trim() === '') {
      errors.push('Firm ID is required');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }
}

// Singleton instance
export const documentGenerationService = new DocumentGenerationService();
