/**
 * Legal Change Classifier Service
 * Story 3.5: Semantic Version Control System
 *
 * Classifies legal changes with Romanian/English legal terminology awareness
 * Identifies specific types of legal changes in contracts and documents
 */

import {
  LegalChangeType,
  DocumentContext,
  SemanticChange,
  LegalChange,
  ClaudeModel,
  AIOperationType,
} from '@legal-platform/types';
import { providerManager } from './provider-manager.service';
import { tokenTracker } from './token-tracker.service';
import logger from '../lib/logger';

// Romanian legal change patterns
const ROMANIAN_PATTERNS: Record<LegalChangeType, RegExp[]> = {
  [LegalChangeType.TERM_MODIFICATION]: [
    /\b(termen|perioadă|durată|valabilitate|prelungire)\b/i,
    /\b(\d+\s*(zile|luni|ani|săptămâni))\b/i,
  ],
  [LegalChangeType.OBLIGATION_CHANGE]: [
    /\b(obligație|obligații|îndatorire|angajament|responsabilitate)\b/i,
    /\b(trebuie|va trebui|are obligația|este obligat)\b/i,
  ],
  [LegalChangeType.PARTY_CHANGE]: [
    /\b(parte|părți|contractant|beneficiar|prestator|furnizor|client)\b/i,
    /\b(societate|persoană juridică|persoană fizică)\b/i,
  ],
  [LegalChangeType.DATE_CHANGE]: [
    /\b(\d{1,2}[./-]\d{1,2}[./-]\d{2,4})\b/,
    /\b(ianuarie|februarie|martie|aprilie|mai|iunie|iulie|august|septembrie|octombrie|noiembrie|decembrie)\b/i,
    /\b(dată|la data|începând cu|până la)\b/i,
  ],
  [LegalChangeType.AMOUNT_CHANGE]: [
    /\b(\d+[.,]?\d*\s*(lei|ron|euro|eur|usd|\$|€))\b/i,
    /\b(sumă|valoare|preț|cost|tarif|taxă|comision)\b/i,
    /\b(procent|%)\b/i,
  ],
  [LegalChangeType.LIABILITY_CHANGE]: [
    /\b(răspundere|responsabilitate|daune|despăgubire|prejudiciu)\b/i,
    /\b(limită de răspundere|excludere răspundere|exonerare)\b/i,
    /\b(penalități|daune-interese|clauză penală)\b/i,
  ],
  [LegalChangeType.TERMINATION_CHANGE]: [
    /\b(reziliere|încetare|denunțare|anulare|revocare)\b/i,
    /\b(rezoluțiune|rezoluție|desființare)\b/i,
    /\b(expirare|prelungire automată)\b/i,
  ],
  [LegalChangeType.FORCE_MAJEURE_CHANGE]: [
    /\b(forță majoră|caz fortuit|împrejurări excepționale)\b/i,
    /\b(calamitate|pandemie|război|grevă)\b/i,
  ],
  [LegalChangeType.PAYMENT_TERMS_CHANGE]: [
    /\b(plată|plăți|scadență|facturare|decontare)\b/i,
    /\b(avans|rată|tranșă|sold)\b/i,
    /\b(întârziere la plată|dobândă|penalități de întârziere)\b/i,
  ],
  [LegalChangeType.SCOPE_CHANGE]: [
    /\b(obiect|obiectul contractului|domeniu de aplicare)\b/i,
    /\b(servicii|lucrări|bunuri|produse)\b/i,
    /\b(specificații|cerințe|standarde)\b/i,
  ],
};

// English legal change patterns
const ENGLISH_PATTERNS: Record<LegalChangeType, RegExp[]> = {
  [LegalChangeType.TERM_MODIFICATION]: [
    /\b(term|period|duration|validity|extension|renewal)\b/i,
    /\b(\d+\s*(days?|months?|years?|weeks?))\b/i,
  ],
  [LegalChangeType.OBLIGATION_CHANGE]: [
    /\b(obligation|duty|commitment|responsibility|covenant)\b/i,
    /\b(shall|must|will be required|is obligated)\b/i,
  ],
  [LegalChangeType.PARTY_CHANGE]: [
    /\b(party|parties|contractor|vendor|supplier|client|customer)\b/i,
    /\b(company|corporation|entity|individual)\b/i,
  ],
  [LegalChangeType.DATE_CHANGE]: [
    /\b(\d{1,2}[/-]\d{1,2}[/-]\d{2,4})\b/,
    /\b(january|february|march|april|may|june|july|august|september|october|november|december)\b/i,
    /\b(effective date|commencement|expiration|as of)\b/i,
  ],
  [LegalChangeType.AMOUNT_CHANGE]: [
    /\b(\$?\d+[.,]?\d*\s*(dollars?|euros?|pounds?|usd|eur|gbp))\b/i,
    /\b(amount|value|price|cost|fee|rate|charge)\b/i,
    /\b(percent|%|percentage)\b/i,
  ],
  [LegalChangeType.LIABILITY_CHANGE]: [
    /\b(liability|liabilities|damages|compensation|indemnification)\b/i,
    /\b(limitation of liability|exclusion|waiver)\b/i,
    /\b(penalties|liquidated damages|consequential damages)\b/i,
  ],
  [LegalChangeType.TERMINATION_CHANGE]: [
    /\b(termination|cancellation|rescission|revocation)\b/i,
    /\b(breach|default|cure period)\b/i,
    /\b(expiration|auto-renewal|notice period)\b/i,
  ],
  [LegalChangeType.FORCE_MAJEURE_CHANGE]: [
    /\b(force majeure|act of god|unforeseen circumstances)\b/i,
    /\b(natural disaster|pandemic|war|strike)\b/i,
  ],
  [LegalChangeType.PAYMENT_TERMS_CHANGE]: [
    /\b(payment|payments|due date|invoicing|settlement)\b/i,
    /\b(deposit|installment|milestone|balance)\b/i,
    /\b(late payment|interest|penalty|net \d+)\b/i,
  ],
  [LegalChangeType.SCOPE_CHANGE]: [
    /\b(scope|scope of work|subject matter|deliverables)\b/i,
    /\b(services|work|goods|products)\b/i,
    /\b(specifications|requirements|standards)\b/i,
  ],
};

export class LegalChangeClassifierService {
  /**
   * Classify a legal change using pattern matching and AI
   */
  async classifyLegalChange(
    beforeText: string,
    afterText: string,
    context: DocumentContext
  ): Promise<{
    classification: LegalChangeType;
    confidence: number;
    affectedParties: string[];
    impactDescription: string;
    relatedClauses: string[];
  }> {
    const patterns = context.language === 'ro' ? ROMANIAN_PATTERNS : ENGLISH_PATTERNS;

    // First, try pattern-based classification
    const patternResults = this.classifyByPatterns(beforeText, afterText, patterns);

    if (patternResults.matchedTypes.length === 1 && patternResults.confidence > 0.8) {
      // High confidence pattern match
      return {
        classification: patternResults.matchedTypes[0],
        confidence: patternResults.confidence,
        affectedParties: this.extractParties(beforeText, afterText, context.language),
        impactDescription: this.generateImpactDescription(
          patternResults.matchedTypes[0],
          beforeText,
          afterText,
          context.language
        ),
        relatedClauses: [],
      };
    }

    // Use AI for complex or ambiguous cases
    return this.classifyWithAI(beforeText, afterText, context);
  }

  /**
   * Pattern-based classification
   */
  private classifyByPatterns(
    beforeText: string,
    afterText: string,
    patterns: Record<LegalChangeType, RegExp[]>
  ): { matchedTypes: LegalChangeType[]; confidence: number } {
    const combinedText = `${beforeText} ${afterText}`;
    const matchedTypes: LegalChangeType[] = [];
    let maxMatches = 0;

    for (const [type, typePatterns] of Object.entries(patterns)) {
      let matches = 0;
      for (const pattern of typePatterns) {
        if (pattern.test(combinedText)) {
          matches++;
        }
      }
      if (matches > 0) {
        if (matches > maxMatches) {
          matchedTypes.length = 0;
          matchedTypes.push(type as LegalChangeType);
          maxMatches = matches;
        } else if (matches === maxMatches) {
          matchedTypes.push(type as LegalChangeType);
        }
      }
    }

    const confidence = maxMatches > 0 ? Math.min(0.6 + maxMatches * 0.1, 0.95) : 0.3;
    return { matchedTypes, confidence };
  }

  /**
   * AI-based classification for complex cases
   */
  private async classifyWithAI(
    beforeText: string,
    afterText: string,
    context: DocumentContext
  ): Promise<{
    classification: LegalChangeType;
    confidence: number;
    affectedParties: string[];
    impactDescription: string;
    relatedClauses: string[];
  }> {
    const languagePrompt =
      context.language === 'ro'
        ? 'Analizează această modificare într-un contract românesc.'
        : 'Analyze this change in a contract.';

    const prompt = `${languagePrompt}

Original text:
"""
${beforeText.substring(0, 1000)}
"""

Modified text:
"""
${afterText.substring(0, 1000)}
"""

Classify this legal change into one of these categories:
- TERM_MODIFICATION: Changes to contract duration, periods, deadlines
- OBLIGATION_CHANGE: Changes to duties, responsibilities, commitments
- PARTY_CHANGE: Changes to contracting parties, names, entities
- DATE_CHANGE: Changes to specific dates or timing
- AMOUNT_CHANGE: Changes to monetary values, prices, fees
- LIABILITY_CHANGE: Changes to liability provisions, damages, indemnification
- TERMINATION_CHANGE: Changes to termination rights or procedures
- FORCE_MAJEURE_CHANGE: Changes to force majeure provisions
- PAYMENT_TERMS_CHANGE: Changes to payment schedules, methods, terms
- SCOPE_CHANGE: Changes to scope of work or deliverables

Respond in JSON format:
{
  "classification": "CATEGORY_NAME",
  "confidence": 0.X,
  "affectedParties": ["party1", "party2"],
  "impactDescription": "Brief description of the legal impact",
  "relatedClauses": ["clause1", "clause2"]
}`;

    try {
      const startTime = Date.now();
      const response = await providerManager.execute({
        prompt,
        model: ClaudeModel.Haiku,
        maxTokens: 300,
        temperature: 0,
      });

      // Track token usage
      await tokenTracker.recordUsage({
        firmId: context.firmId,
        operationType: AIOperationType.Classification,
        modelUsed: response.model,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        latencyMs: response.latencyMs,
      });

      const result = JSON.parse(response.content);
      return {
        classification: this.mapClassification(result.classification),
        confidence: result.confidence || 0.7,
        affectedParties: result.affectedParties || [],
        impactDescription: result.impactDescription || '',
        relatedClauses: result.relatedClauses || [],
      };
    } catch (error) {
      logger.error('AI classification failed', { error });
      // Fallback to most common type
      return {
        classification: LegalChangeType.TERM_MODIFICATION,
        confidence: 0.3,
        affectedParties: [],
        impactDescription: 'Classification could not be determined',
        relatedClauses: [],
      };
    }
  }

  /**
   * Map string classification to enum
   */
  private mapClassification(classification: string): LegalChangeType {
    const upperClassification = classification?.toUpperCase();
    return (
      LegalChangeType[upperClassification as keyof typeof LegalChangeType] ||
      LegalChangeType.TERM_MODIFICATION
    );
  }

  /**
   * Extract party names from text
   */
  private extractParties(beforeText: string, afterText: string, language: 'ro' | 'en'): string[] {
    const parties: Set<string> = new Set();
    const combinedText = `${beforeText} ${afterText}`;

    const patterns =
      language === 'ro'
        ? [
            /(?:Societatea|S\.C\.|SC)\s+([A-Z][A-Za-z\s]+)\s*(?:S\.R\.L\.|SRL|S\.A\.|SA)/gi,
            /(?:Dl\.|Dna\.|D-l|D-na)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/g,
            /(?:Beneficiar|Prestator|Furnizor|Client|Contractant):\s*([^\n,]+)/gi,
          ]
        : [
            /(?:Company|Corporation|Inc\.|LLC)\s+([A-Z][A-Za-z\s]+)/gi,
            /(?:Mr\.|Ms\.|Mrs\.)\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/g,
            /(?:Party|Client|Vendor|Contractor):\s*([^\n,]+)/gi,
          ];

    for (const pattern of patterns) {
      const matches = combinedText.matchAll(pattern);
      for (const match of matches) {
        if (match[1]) {
          parties.add(match[1].trim());
        }
      }
    }

    return Array.from(parties);
  }

  /**
   * Generate impact description based on change type
   */
  private generateImpactDescription(
    type: LegalChangeType,
    beforeText: string,
    afterText: string,
    language: 'ro' | 'en'
  ): string {
    const descriptions: Record<LegalChangeType, { ro: string; en: string }> = {
      [LegalChangeType.TERM_MODIFICATION]: {
        ro: 'Modificare a termenilor sau duratei contractuale',
        en: 'Modification to contract terms or duration',
      },
      [LegalChangeType.OBLIGATION_CHANGE]: {
        ro: 'Modificare a obligațiilor contractuale',
        en: 'Change to contractual obligations',
      },
      [LegalChangeType.PARTY_CHANGE]: {
        ro: 'Modificare privind părțile contractante',
        en: 'Change to contracting parties',
      },
      [LegalChangeType.DATE_CHANGE]: {
        ro: 'Modificare a datelor contractuale',
        en: 'Change to contract dates',
      },
      [LegalChangeType.AMOUNT_CHANGE]: {
        ro: 'Modificare a valorilor sau sumelor contractuale',
        en: 'Change to contract amounts or values',
      },
      [LegalChangeType.LIABILITY_CHANGE]: {
        ro: 'Modificare a clauzelor de răspundere',
        en: 'Change to liability provisions',
      },
      [LegalChangeType.TERMINATION_CHANGE]: {
        ro: 'Modificare a condițiilor de încetare',
        en: 'Change to termination conditions',
      },
      [LegalChangeType.FORCE_MAJEURE_CHANGE]: {
        ro: 'Modificare a clauzei de forță majoră',
        en: 'Change to force majeure clause',
      },
      [LegalChangeType.PAYMENT_TERMS_CHANGE]: {
        ro: 'Modificare a termenilor de plată',
        en: 'Change to payment terms',
      },
      [LegalChangeType.SCOPE_CHANGE]: {
        ro: 'Modificare a obiectului contractului',
        en: 'Change to scope of work',
      },
    };

    return descriptions[type]?.[language] || descriptions[type]?.en || 'Legal change detected';
  }

  /**
   * Enrich a semantic change with legal classification
   */
  async enrichWithLegalClassification(
    change: SemanticChange,
    context: DocumentContext
  ): Promise<LegalChange> {
    const classification = await this.classifyLegalChange(
      change.beforeText,
      change.afterText,
      context
    );

    return {
      ...change,
      legalClassification: classification.classification,
      impactDescription: classification.impactDescription,
      affectedParties: classification.affectedParties,
      relatedClauses: classification.relatedClauses,
      aiConfidence: classification.confidence,
    };
  }

  /**
   * Batch classify multiple changes
   */
  async classifyChanges(
    changes: SemanticChange[],
    context: DocumentContext
  ): Promise<LegalChange[]> {
    const legalChanges: LegalChange[] = [];

    for (const change of changes) {
      const legalChange = await this.enrichWithLegalClassification(change, context);
      legalChanges.push(legalChange);
    }

    return legalChanges;
  }
}

// Singleton instance
export const legalChangeClassifierService = new LegalChangeClassifierService();
