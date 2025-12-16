/**
 * Document Review AI Service
 * Story 3.6: Document Review and Approval Workflow
 *
 * Analyzes documents for concerns, inconsistencies, and potential issues
 * Uses Claude Sonnet for comprehensive legal document analysis
 */

import { ClaudeModel, AIOperationType } from '@legal-platform/types';
import type {
  ConcernType,
  ConcernSeverity,
  AIAnalysisConcern,
  DocumentAnalysisResult,
  DocumentContext,
} from '@legal-platform/types';
import { providerManager } from './provider-manager.service';
import { tokenTracker } from './token-tracker.service';
import logger from '../lib/logger';

// Concern type descriptions for the AI prompt
const CONCERN_TYPE_DESCRIPTIONS: Record<ConcernType, string> = {
  LEGAL_INCONSISTENCY: 'Contradictions or inconsistencies in legal terms, clauses, or obligations',
  AMBIGUOUS_LANGUAGE: 'Vague or unclear language that could lead to multiple interpretations',
  MISSING_CLAUSE:
    'Standard clauses missing for this document type (e.g., force majeure, jurisdiction)',
  OUTDATED_REFERENCE: 'References to outdated laws, regulations, or standards',
  COMPLIANCE_ISSUE: 'Potential violations of legal requirements or regulatory standards',
  STYLE_VIOLATION: 'Inconsistent formatting, terminology, or style with firm guidelines',
  HIGH_RISK_CLAUSE: 'Clauses that expose parties to significant liability or risk',
};

// Severity descriptions
const SEVERITY_DESCRIPTIONS = {
  ERROR: 'Critical issues that must be addressed before approval',
  WARNING: 'Important issues that should be reviewed',
  INFO: 'Minor suggestions for improvement',
};

export class DocumentReviewAIService {
  private readonly maxTokens = 4096;
  private readonly concernConfidenceThreshold = 0.6;

  /**
   * Analyze document content for concerns
   */
  async analyzeDocumentForConcerns(
    documentContent: string,
    documentType: string,
    context: DocumentContext
  ): Promise<DocumentAnalysisResult> {
    const startTime = Date.now();

    try {
      const concerns = await this.detectConcernsWithAI(documentContent, documentType, context);

      const processingTimeMs = Date.now() - startTime;

      return {
        concerns,
        processingTimeMs,
        tokensUsed: 0, // Will be updated by the AI call
        modelUsed: ClaudeModel.Sonnet,
      };
    } catch (error) {
      logger.error('AI document review analysis failed', { error });
      // Fall back to rule-based detection
      return this.detectConcernsWithRules(documentContent, documentType, context);
    }
  }

  /**
   * AI-powered concern detection
   */
  private async detectConcernsWithAI(
    documentContent: string,
    documentType: string,
    context: DocumentContext
  ): Promise<AIAnalysisConcern[]> {
    const languageInstruction =
      context.language === 'ro'
        ? 'Analizează documentul în limba română și răspunde în română.'
        : 'Analyze the document in English and respond in English.';

    const concernTypesJson = JSON.stringify(CONCERN_TYPE_DESCRIPTIONS, null, 2);
    const severitiesJson = JSON.stringify(SEVERITY_DESCRIPTIONS, null, 2);

    // Truncate document if too long (keep first and last portions for context)
    const maxContentLength = 12000;
    let truncatedContent = documentContent;
    if (documentContent.length > maxContentLength) {
      const halfLength = Math.floor(maxContentLength / 2);
      truncatedContent =
        documentContent.substring(0, halfLength) +
        '\n\n[...content truncated...]\n\n' +
        documentContent.substring(documentContent.length - halfLength);
    }

    const prompt = `${languageInstruction}

You are a legal document reviewer. Analyze the following ${documentType} document for potential concerns.

Document Content:
"""
${truncatedContent}
"""

Document Type: ${documentType}
${context.caseType ? `Case Type: ${context.caseType}` : ''}
${context.firmStyleGuide ? `Firm Style Guide: ${context.firmStyleGuide}` : ''}

Concern Types to Check:
${concernTypesJson}

Severity Levels:
${severitiesJson}

For each concern found:
1. Identify the specific text that triggers the concern
2. Determine the concern type and severity
3. Provide a clear description of why this is a concern
4. Suggest a fix if applicable
5. Provide your confidence level (0.0 to 1.0)

IMPORTANT: Only flag genuine concerns that would matter in a legal review. Avoid false positives.

Respond in JSON format with an array of concerns:
{
  "concerns": [
    {
      "concernType": "LEGAL_INCONSISTENCY" | "AMBIGUOUS_LANGUAGE" | "MISSING_CLAUSE" | "OUTDATED_REFERENCE" | "COMPLIANCE_ISSUE" | "STYLE_VIOLATION" | "HIGH_RISK_CLAUSE",
      "severity": "ERROR" | "WARNING" | "INFO",
      "description": "Clear explanation of the concern",
      "anchorText": "Exact text from document that triggers this concern",
      "suggestedFix": "Recommended fix or null if not applicable",
      "confidence": 0.85
    }
  ]
}

If no significant concerns are found, return: { "concerns": [] }`;

    const startTime = Date.now();
    const response = await providerManager.execute({
      prompt,
      model: ClaudeModel.Sonnet,
      maxTokens: this.maxTokens,
      temperature: 0.2,
    });

    // Track token usage
    await tokenTracker.recordUsage({
      firmId: context.firmId || 'system',
      operationType: AIOperationType.DocumentReviewAnalysis,
      modelUsed: response.model,
      inputTokens: response.inputTokens,
      outputTokens: response.outputTokens,
      latencyMs: response.latencyMs,
    });

    // Parse AI response
    const result = this.parseAIResponse(response.content, documentContent);
    return result;
  }

  /**
   * Parse AI response and calculate anchor positions
   */
  private parseAIResponse(content: string, documentContent: string): AIAnalysisConcern[] {
    try {
      // Extract JSON from response (handle potential markdown wrapping)
      let jsonContent = content;
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      } else {
        // Try to find JSON object
        const objectMatch = content.match(/\{[\s\S]*\}/);
        if (objectMatch) {
          jsonContent = objectMatch[0];
        }
      }

      const parsed = JSON.parse(jsonContent);
      const concerns: AIAnalysisConcern[] = [];

      for (const concern of parsed.concerns || []) {
        // Skip low confidence concerns
        if (concern.confidence < this.concernConfidenceThreshold) {
          continue;
        }

        // Find anchor position in document
        const { anchorStart, anchorEnd } = this.findAnchorPosition(
          documentContent,
          concern.anchorText
        );

        concerns.push({
          concernType: concern.concernType as ConcernType,
          severity: concern.severity as ConcernSeverity,
          description: concern.description,
          anchorText: concern.anchorText,
          anchorStart,
          anchorEnd,
          sectionPath: this.extractSectionPath(documentContent, anchorStart),
          suggestedFix: concern.suggestedFix || undefined,
          confidence: concern.confidence,
        });
      }

      return concerns;
    } catch (error) {
      logger.error('Failed to parse AI response', { error, content });
      return [];
    }
  }

  /**
   * Find the position of anchor text in document
   */
  private findAnchorPosition(
    documentContent: string,
    anchorText: string
  ): { anchorStart: number; anchorEnd: number } {
    if (!anchorText) {
      return { anchorStart: 0, anchorEnd: 0 };
    }

    // Try exact match first
    let index = documentContent.indexOf(anchorText);

    if (index === -1) {
      // Try case-insensitive match
      index = documentContent.toLowerCase().indexOf(anchorText.toLowerCase());
    }

    if (index === -1) {
      // Try fuzzy match (first 50 chars)
      const searchText = anchorText.substring(0, 50);
      index = documentContent.indexOf(searchText);
    }

    if (index === -1) {
      return { anchorStart: 0, anchorEnd: 0 };
    }

    return {
      anchorStart: index,
      anchorEnd: index + anchorText.length,
    };
  }

  /**
   * Extract section path from document position
   */
  private extractSectionPath(documentContent: string, position: number): string | undefined {
    if (position === 0) {
      return undefined;
    }

    // Find the nearest heading before this position
    const contentBefore = documentContent.substring(0, position);

    // Look for common heading patterns (Romanian and English)
    const headingPatterns = [
      /(?:^|\n)((?:Art(?:icol)?|Section|Capitol|Clauza|Anexa)[\s.]*\d*[.:]\s*[^\n]+)/gi,
      /(?:^|\n)((?:\d+\.)+\s*[^\n]+)/gi,
      /(?:^|\n)([A-Z][A-Z\s]+:)/gi,
    ];

    let lastHeading: string | undefined;

    for (const pattern of headingPatterns) {
      const matches = contentBefore.matchAll(pattern);
      for (const match of matches) {
        lastHeading = match[1].trim();
      }
    }

    return lastHeading?.substring(0, 500);
  }

  /**
   * Rule-based concern detection (fallback)
   */
  private detectConcernsWithRules(
    documentContent: string,
    documentType: string,
    context: DocumentContext
  ): DocumentAnalysisResult {
    const concerns: AIAnalysisConcern[] = [];
    const startTime = Date.now();

    // Check for ambiguous language patterns
    const ambiguousPatterns = [
      /\b(rezonabil|reasonable)\b/gi,
      /\b(în mod corespunzător|as appropriate)\b/gi,
      /\b(după caz|as the case may be)\b/gi,
      /\b(și\/sau|and\/or)\b/gi,
      /\b(etc\.?)\b/gi,
    ];

    for (const pattern of ambiguousPatterns) {
      const matches = documentContent.matchAll(pattern);
      for (const match of matches) {
        if (match.index !== undefined) {
          concerns.push({
            concernType: 'AMBIGUOUS_LANGUAGE' as ConcernType,
            severity: 'INFO' as ConcernSeverity,
            description: `Potentially ambiguous term "${match[0]}" may need clarification`,
            anchorText: this.getContextAroundMatch(documentContent, match.index, 50),
            anchorStart: match.index,
            anchorEnd: match.index + match[0].length,
            confidence: 0.65,
          });
        }
      }
    }

    // Check for missing standard clauses based on document type
    const missingClauses = this.checkMissingClauses(
      documentContent,
      documentType,
      context.language
    );
    concerns.push(...missingClauses);

    // Check for outdated references
    const outdatedRefs = this.checkOutdatedReferences(documentContent);
    concerns.push(...outdatedRefs);

    return {
      concerns: concerns.filter((c) => c.confidence >= this.concernConfidenceThreshold),
      processingTimeMs: Date.now() - startTime,
      tokensUsed: 0,
      modelUsed: 'rule-based',
    };
  }

  /**
   * Check for missing standard clauses
   */
  private checkMissingClauses(
    documentContent: string,
    documentType: string,
    language: string
  ): AIAnalysisConcern[] {
    const concerns: AIAnalysisConcern[] = [];
    const contentLower = documentContent.toLowerCase();

    // Standard clauses to check for contracts
    const contractClauses =
      language === 'ro'
        ? {
            'forță majoră': 'Force majeure clause is standard for contracts',
            jurisdicție: 'Jurisdiction clause specifies governing law',
            confidențialitate: 'Confidentiality clause protects sensitive information',
            reziliere: 'Termination clause defines contract end conditions',
          }
        : {
            'force majeure': 'Force majeure clause is standard for contracts',
            jurisdiction: 'Jurisdiction clause specifies governing law',
            confidentiality: 'Confidentiality clause protects sensitive information',
            termination: 'Termination clause defines contract end conditions',
          };

    if (documentType.toLowerCase().includes('contract')) {
      for (const [clause, description] of Object.entries(contractClauses)) {
        if (!contentLower.includes(clause)) {
          concerns.push({
            concernType: 'MISSING_CLAUSE' as ConcernType,
            severity: 'WARNING' as ConcernSeverity,
            description: `Missing "${clause}" clause. ${description}`,
            anchorText: '',
            anchorStart: 0,
            anchorEnd: 0,
            confidence: 0.7,
          });
        }
      }
    }

    return concerns;
  }

  /**
   * Check for outdated law references
   */
  private checkOutdatedReferences(documentContent: string): AIAnalysisConcern[] {
    const concerns: AIAnalysisConcern[] = [];

    // Check for outdated Romanian law references
    const outdatedLaws = [
      {
        pattern: /Legea\s+nr\.\s*31\/1990/gi,
        description: 'Law 31/1990 has been amended - verify current version',
      },
      {
        pattern: /Cod(?:ul)?\s+Civil\s+(?:din\s+)?1864/gi,
        description: 'Old Civil Code reference - New Civil Code applies since 2011',
      },
      {
        pattern: /O\.U\.G\.\s*nr\.\s*34\/2006/gi,
        description: 'OUG 34/2006 has been replaced - verify current public procurement law',
      },
    ];

    for (const law of outdatedLaws) {
      const matches = documentContent.matchAll(law.pattern);
      for (const match of matches) {
        if (match.index !== undefined) {
          concerns.push({
            concernType: 'OUTDATED_REFERENCE' as ConcernType,
            severity: 'WARNING' as ConcernSeverity,
            description: law.description,
            anchorText: match[0],
            anchorStart: match.index,
            anchorEnd: match.index + match[0].length,
            confidence: 0.8,
          });
        }
      }
    }

    return concerns;
  }

  /**
   * Get context around a match
   */
  private getContextAroundMatch(content: string, index: number, contextLength: number): string {
    const start = Math.max(0, index - contextLength);
    const end = Math.min(content.length, index + contextLength);
    return content.substring(start, end);
  }

  /**
   * Classify document into sections for targeted analysis
   */
  async parseDocumentSections(documentContent: string): Promise<
    Array<{
      title: string;
      content: string;
      startIndex: number;
      endIndex: number;
    }>
  > {
    const sections: Array<{
      title: string;
      content: string;
      startIndex: number;
      endIndex: number;
    }> = [];

    // Split by common section patterns
    const sectionPattern =
      /(?:^|\n)((?:Art(?:icol)?|Section|Capitol|Clauza|Anexa|ARTICOLUL|CAPITOLUL)[\s.]*\d*[.:]?\s*[^\n]*)/gi;

    let lastIndex = 0;
    let lastTitle = 'Introduction';
    const matches = [...documentContent.matchAll(sectionPattern)];

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      if (match.index !== undefined) {
        // Save previous section
        if (match.index > lastIndex) {
          sections.push({
            title: lastTitle,
            content: documentContent.substring(lastIndex, match.index).trim(),
            startIndex: lastIndex,
            endIndex: match.index,
          });
        }
        lastTitle = match[1].trim();
        lastIndex = match.index + match[0].length;
      }
    }

    // Add final section
    if (lastIndex < documentContent.length) {
      sections.push({
        title: lastTitle,
        content: documentContent.substring(lastIndex).trim(),
        startIndex: lastIndex,
        endIndex: documentContent.length,
      });
    }

    return sections;
  }
}

// Singleton instance
export const documentReviewAIService = new DocumentReviewAIService();
