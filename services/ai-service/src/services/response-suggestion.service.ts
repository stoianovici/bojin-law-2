/**
 * Response Suggestion Service
 * Story 3.5: Semantic Version Control System
 *
 * Generates suggested responses for opposing counsel's document modifications
 * Supports accept, reject, and counter-proposal responses
 */

import {
  ResponseType,
  PartyRole,
  LegalChange,
  ResponseSuggestion,
  DocumentContext,
  RiskLevel,
  ClaudeModel,
  AIOperationType,
} from '@legal-platform/types';
import { providerManager } from './provider-manager.service';
import { tokenTracker } from './token-tracker.service';
import { riskAssessmentService } from './risk-assessment.service';
import logger from '../lib/logger';
import { v4 as uuidv4 } from 'uuid';

export class ResponseSuggestionService {
  /**
   * Generate response suggestions for a set of changes
   */
  async generateResponseSuggestions(
    changes: LegalChange[],
    partyRole: PartyRole,
    language: 'ro' | 'en',
    context: DocumentContext
  ): Promise<ResponseSuggestion[]> {
    const suggestions: ResponseSuggestion[] = [];

    for (const change of changes) {
      const changeSuggestions = await this.generateSuggestionsForChange(
        change,
        partyRole,
        language,
        context
      );
      suggestions.push(...changeSuggestions);
    }

    return suggestions;
  }

  /**
   * Generate suggestions for a single change
   */
  async generateSuggestionsForChange(
    change: LegalChange,
    partyRole: PartyRole,
    language: 'ro' | 'en',
    context: DocumentContext
  ): Promise<ResponseSuggestion[]> {
    const suggestions: ResponseSuggestion[] = [];

    // Assess risk to determine response strategy
    const riskAssessment = await riskAssessmentService.assessChangeRisk(change, context);

    // Generate acceptance language if risk is low
    if (riskAssessment.riskLevel === RiskLevel.LOW) {
      const acceptance = await this.generateAcceptanceLanguage(change, language, context);
      suggestions.push(acceptance);
    }

    // Generate counter-proposal for medium/high risk
    if (riskAssessment.riskLevel !== RiskLevel.LOW) {
      const counterProposal = await this.generateCounterProposal(
        change,
        partyRole,
        language,
        context
      );
      suggestions.push(counterProposal);
    }

    // Generate rejection language for high risk
    if (riskAssessment.riskLevel === RiskLevel.HIGH) {
      const rejection = await this.generateRejectionLanguage(
        change,
        riskAssessment.explanation,
        language,
        context
      );
      suggestions.push(rejection);
    }

    // Always provide a clarification option
    const clarification = await this.generateClarificationRequest(change, language, context);
    suggestions.push(clarification);

    return suggestions;
  }

  /**
   * Generate acceptance language for a change
   */
  async generateAcceptanceLanguage(
    change: LegalChange,
    language: 'ro' | 'en',
    context: DocumentContext
  ): Promise<ResponseSuggestion> {
    const languagePrompt = language === 'ro'
      ? 'Generează un text profesional de acceptare în limba română pentru această modificare contractuală.'
      : 'Generate professional acceptance language for this contract change.';

    const prompt = `${languagePrompt}

Change summary: ${change.plainSummary || 'Contract modification'}

Original text:
"""
${change.beforeText.substring(0, 300)}
"""

Proposed change:
"""
${change.afterText.substring(0, 300)}
"""

Generate a brief, professional acceptance statement. Be concise (1-2 sentences).
Include any reasonable conditions if appropriate.`;

    try {
      const startTime = Date.now();
      const response = await providerManager.execute({
        prompt,
        model: ClaudeModel.Sonnet,
        maxTokens: 200,
        temperature: 0.3,
      });

      await tokenTracker.recordUsage({
        firmId: context.firmId,
        operationType: AIOperationType.TextGeneration,
        modelUsed: response.model,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        latencyMs: response.latencyMs,
      });

      return {
        id: uuidv4(),
        changeId: change.id,
        suggestionType: ResponseType.ACCEPT,
        suggestedText: response.content.trim(),
        reasoning: language === 'ro'
          ? 'Modificarea prezintă risc scăzut și este în concordanță cu interesele clientului.'
          : 'The change presents low risk and aligns with client interests.',
        language,
        createdAt: new Date(),
      };
    } catch (error) {
      logger.error('Acceptance language generation failed', { error });
      return this.getTemplateAcceptance(change, language);
    }
  }

  /**
   * Generate rejection language for a change
   */
  async generateRejectionLanguage(
    change: LegalChange,
    reason: string,
    language: 'ro' | 'en',
    context: DocumentContext
  ): Promise<ResponseSuggestion> {
    const languagePrompt = language === 'ro'
      ? 'Generează un text profesional de respingere în limba română pentru această modificare contractuală.'
      : 'Generate professional rejection language for this contract change.';

    const prompt = `${languagePrompt}

Change summary: ${change.plainSummary || 'Contract modification'}
Reason for rejection: ${reason}

Proposed change:
"""
${change.afterText.substring(0, 400)}
"""

Generate a professional rejection statement that:
1. Clearly states the rejection
2. Explains the concern briefly
3. Maintains professional tone
4. Offers to discuss alternatives

Keep it concise (2-3 sentences).`;

    try {
      const startTime = Date.now();
      const response = await providerManager.execute({
        prompt,
        model: ClaudeModel.Sonnet,
        maxTokens: 300,
        temperature: 0.3,
      });

      await tokenTracker.recordUsage({
        firmId: context.firmId,
        operationType: AIOperationType.TextGeneration,
        modelUsed: response.model,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        latencyMs: response.latencyMs,
      });

      return {
        id: uuidv4(),
        changeId: change.id,
        suggestionType: ResponseType.REJECT,
        suggestedText: response.content.trim(),
        reasoning: reason,
        language,
        createdAt: new Date(),
      };
    } catch (error) {
      logger.error('Rejection language generation failed', { error });
      return this.getTemplateRejection(change, reason, language);
    }
  }

  /**
   * Generate counter-proposal for a change
   */
  async generateCounterProposal(
    change: LegalChange,
    partyRole: PartyRole,
    language: 'ro' | 'en',
    context: DocumentContext
  ): Promise<ResponseSuggestion> {
    const roleContext = partyRole === PartyRole.CLIENT
      ? (language === 'ro' ? 'reprezentând clientul' : 'representing the client')
      : (language === 'ro' ? 'reprezentând partea adversă' : 'representing the opposing party');

    const languagePrompt = language === 'ro'
      ? `Generează o contra-propunere profesională în limba română, ${roleContext}.`
      : `Generate a professional counter-proposal, ${roleContext}.`;

    const prompt = `${languagePrompt}

Original text (our position):
"""
${change.beforeText.substring(0, 400)}
"""

Their proposed change:
"""
${change.afterText.substring(0, 400)}
"""

Generate alternative language that:
1. Addresses their concerns
2. Protects ${partyRole === PartyRole.CLIENT ? 'client' : 'our'} interests
3. Offers a reasonable middle ground
4. Uses professional legal language

Provide ONLY the suggested contract language, no explanations.`;

    try {
      const startTime = Date.now();
      const response = await providerManager.execute({
        prompt,
        model: ClaudeModel.Sonnet,
        maxTokens: 500,
        temperature: 0.4,
      });

      await tokenTracker.recordUsage({
        firmId: context.firmId,
        operationType: AIOperationType.TextGeneration,
        modelUsed: response.model,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        latencyMs: response.latencyMs,
      });

      return {
        id: uuidv4(),
        changeId: change.id,
        suggestionType: ResponseType.COUNTER_PROPOSAL,
        suggestedText: response.content.trim(),
        reasoning: language === 'ro'
          ? 'Această contra-propunere încearcă să găsească un echilibru între interesele părților.'
          : 'This counter-proposal attempts to balance the interests of both parties.',
        language,
        createdAt: new Date(),
      };
    } catch (error) {
      logger.error('Counter-proposal generation failed', { error });
      return this.getTemplateCounterProposal(change, language);
    }
  }

  /**
   * Generate clarification request
   */
  async generateClarificationRequest(
    change: LegalChange,
    language: 'ro' | 'en',
    context: DocumentContext
  ): Promise<ResponseSuggestion> {
    const templates = {
      ro: `Ne rugăm să clarificați intenția din spatele modificării propuse la ${change.sectionPath || 'această secțiune'}. În special, dorim să înțelegem implicațiile practice ale acestei schimbări pentru obligațiile părților.`,
      en: `Please clarify the intent behind the proposed modification to ${change.sectionPath || 'this section'}. Specifically, we would like to understand the practical implications of this change for the parties' obligations.`,
    };

    return {
      id: uuidv4(),
      changeId: change.id,
      suggestionType: ResponseType.CLARIFICATION,
      suggestedText: templates[language],
      reasoning: language === 'ro'
        ? 'Solicitarea de clarificare permite înțelegerea completă a intenției modificării înainte de a răspunde.'
        : 'Requesting clarification allows for full understanding of the change intent before responding.',
      language,
      createdAt: new Date(),
    };
  }

  /**
   * Template acceptance for fallback
   */
  private getTemplateAcceptance(
    change: LegalChange,
    language: 'ro' | 'en'
  ): ResponseSuggestion {
    const templates = {
      ro: 'Acceptăm modificarea propusă la această secțiune.',
      en: 'We accept the proposed modification to this section.',
    };

    return {
      id: uuidv4(),
      changeId: change.id,
      suggestionType: ResponseType.ACCEPT,
      suggestedText: templates[language],
      language,
      createdAt: new Date(),
    };
  }

  /**
   * Template rejection for fallback
   */
  private getTemplateRejection(
    change: LegalChange,
    reason: string,
    language: 'ro' | 'en'
  ): ResponseSuggestion {
    const templates = {
      ro: `Nu putem accepta modificarea propusă din următoarele motive: ${reason}. Vă rugăm să ne contactați pentru a discuta alternative.`,
      en: `We are unable to accept the proposed modification for the following reasons: ${reason}. Please contact us to discuss alternatives.`,
    };

    return {
      id: uuidv4(),
      changeId: change.id,
      suggestionType: ResponseType.REJECT,
      suggestedText: templates[language],
      reasoning: reason,
      language,
      createdAt: new Date(),
    };
  }

  /**
   * Template counter-proposal for fallback
   */
  private getTemplateCounterProposal(
    change: LegalChange,
    language: 'ro' | 'en'
  ): ResponseSuggestion {
    const templates = {
      ro: 'Propunem o formulare alternativă care să abordeze preocupările ambelor părți. Vă rugăm să luați în considerare următoarea variantă: [Inserați textul alternativ aici]',
      en: 'We propose alternative language that addresses both parties\' concerns. Please consider the following revision: [Insert alternative text here]',
    };

    return {
      id: uuidv4(),
      changeId: change.id,
      suggestionType: ResponseType.COUNTER_PROPOSAL,
      suggestedText: templates[language],
      language,
      createdAt: new Date(),
    };
  }

  /**
   * Get response type label
   */
  getResponseTypeLabel(type: ResponseType, language: 'ro' | 'en'): string {
    const labels = {
      ro: {
        [ResponseType.ACCEPT]: 'Acceptare',
        [ResponseType.REJECT]: 'Respingere',
        [ResponseType.COUNTER_PROPOSAL]: 'Contra-propunere',
        [ResponseType.CLARIFICATION]: 'Clarificare',
      },
      en: {
        [ResponseType.ACCEPT]: 'Accept',
        [ResponseType.REJECT]: 'Reject',
        [ResponseType.COUNTER_PROPOSAL]: 'Counter-Proposal',
        [ResponseType.CLARIFICATION]: 'Request Clarification',
      },
    };

    return labels[language][type];
  }

  /**
   * Get response type color for UI
   */
  getResponseTypeColor(type: ResponseType): string {
    switch (type) {
      case ResponseType.ACCEPT:
        return 'green';
      case ResponseType.REJECT:
        return 'red';
      case ResponseType.COUNTER_PROPOSAL:
        return 'blue';
      case ResponseType.CLARIFICATION:
        return 'yellow';
      default:
        return 'gray';
    }
  }
}

// Singleton instance
export const responseSuggestionService = new ResponseSuggestionService();
