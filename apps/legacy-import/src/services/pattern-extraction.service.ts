/**
 * Pattern Extraction Service
 * Story 2.12.1 - AC4: Pattern Extraction Enhancement
 *
 * Analyzes Romanian legal documents to extract common patterns,
 * build clause libraries, and calculate template quality scores
 */

import type { DocumentPattern } from '@legal-platform/types';

export interface ExtractedPhrase {
  text: string;
  occurrences: number;
  documents: string[];
  confidence: number;
}

export interface ClauseStructure {
  id: string;
  patternRo: string;
  patternEn: string;
  category: string;
  occurrences: number;
  documents: string[];
}

export interface TemplateQualityScore {
  typeId: string;
  overallScore: number; // 0-100
  consistencyScore: number;
  coverageScore: number;
  clarityScore: number;
  recommendation: 'ready' | 'needs_review' | 'insufficient_data';
}

export interface GeneratedTemplateStructure {
  typeName: string;
  sections: Array<{
    id: string;
    labelRo: string;
    labelEn: string;
    commonPhrases: string[];
    variablePlaceholders: string[];
  }>;
  standardClauses: string[];
  qualityScore: number;
}

/**
 * Pattern Extraction Service
 * Analyzes document corpus to extract reusable patterns
 */
export class PatternExtractionService {
  /**
   * Extract common Romanian legal phrases from documents
   * AC4: Min 5 words, appears in 3+ documents
   */
  async extractCommonPhrases(
    documents: Array<{ id: string; content: string; typeId: string }>
  ): Promise<ExtractedPhrase[]> {
    const phraseMap = new Map<string, { docs: Set<string>; count: number }>();

    // Extract phrases from each document
    for (const doc of documents) {
      const phrases = this.extractPhrasesFromText(doc.content);

      for (const phrase of phrases) {
        if (!phraseMap.has(phrase)) {
          phraseMap.set(phrase, { docs: new Set(), count: 0 });
        }
        const entry = phraseMap.get(phrase)!;
        entry.docs.add(doc.id);
        entry.count++;
      }
    }

    // Filter: min 5 words, 3+ documents
    const extracted: ExtractedPhrase[] = [];
    for (const [text, data] of phraseMap) {
      const wordCount = text.split(/\s+/).length;
      if (wordCount >= 5 && data.docs.size >= 3) {
        extracted.push({
          text,
          occurrences: data.count,
          documents: Array.from(data.docs),
          confidence: this.calculatePhraseConfidence(data.count, data.docs.size, documents.length),
        });
      }
    }

    // Sort by confidence and occurrences
    return extracted.sort((a, b) => b.confidence - a.confidence || b.occurrences - a.occurrences);
  }

  /**
   * Extract phrases from Romanian legal text
   * Looks for complete sentences and common legal phrases
   */
  private extractPhrasesFromText(content: string): string[] {
    const phrases: string[] = [];

    // Normalize text
    const normalized = content.replace(/\s+/g, ' ').replace(/\n+/g, ' ').trim();

    // Split into sentences (Romanian punctuation)
    const sentences = normalized.split(/[.;!?]\s+/);

    for (const sentence of sentences) {
      const words = sentence.trim().split(/\s+/);

      // Extract phrases of 5-15 words
      for (let length = 5; length <= 15 && length <= words.length; length++) {
        for (let i = 0; i <= words.length - length; i++) {
          const phrase = words.slice(i, i + length).join(' ');

          // Filter: must contain Romanian legal indicators
          if (this.isLegalPhrase(phrase)) {
            phrases.push(phrase);
          }
        }
      }
    }

    return phrases;
  }

  /**
   * Check if phrase is likely a legal phrase
   */
  private isLegalPhrase(phrase: string): boolean {
    const legalIndicators = [
      'conform',
      'potrivit',
      'prevederilor',
      'cod civil',
      'cod procedură civilă',
      'articol',
      'art.',
      'obligat',
      'drept',
      'prezenta',
      'prin prezenta',
      'solicită',
      'solicităm',
      'vă rugăm',
      'somăm',
      'notificăm',
      'contractual',
      'legal',
      'instanță',
      'judecătorie',
    ];

    const lower = phrase.toLowerCase();
    return legalIndicators.some((indicator) => lower.includes(indicator));
  }

  /**
   * Calculate confidence score for a phrase
   */
  private calculatePhraseConfidence(
    totalOccurrences: number,
    documentCount: number,
    totalDocs: number
  ): number {
    // Confidence based on:
    // - Document coverage (appears in X% of documents)
    // - Repetition frequency
    const coverage = documentCount / totalDocs;
    const frequency = Math.min(totalOccurrences / documentCount, 10) / 10; // Cap at 10 per doc

    return Math.round((coverage * 0.7 + frequency * 0.3) * 100);
  }

  /**
   * Identify standard clause structures in Romanian documents
   */
  async identifyClauseStructures(
    documents: Array<{ id: string; content: string; typeId: string }>
  ): Promise<ClauseStructure[]> {
    const structures: ClauseStructure[] = [];

    // Common Romanian legal clause patterns
    const clausePatterns = [
      {
        id: 'preamble',
        patternRo: 'Subscrisa .+, prin avocat .+',
        patternEn: 'The undersigned .+, represented by attorney .+',
        category: 'preamble',
      },
      {
        id: 'legal_basis',
        patternRo: 'Potrivit prevederilor (Art\\.|articolului) \\d+',
        patternEn: 'According to the provisions of Article \\d+',
        category: 'legal_basis',
      },
      {
        id: 'request',
        patternRo: 'Solicităm .+',
        patternEn: 'We request .+',
        category: 'request',
      },
      {
        id: 'warning',
        patternRo: 'În caz contrar .+',
        patternEn: 'Otherwise .+',
        category: 'warning',
      },
      {
        id: 'deadline',
        patternRo: 'în termen de \\d+ zile',
        patternEn: 'within \\d+ days',
        category: 'deadline',
      },
    ];

    // Search for patterns in documents
    for (const pattern of clausePatterns) {
      const regex = new RegExp(pattern.patternRo, 'gi');
      const foundDocs = new Set<string>();
      let occurrences = 0;

      for (const doc of documents) {
        const matches = doc.content.match(regex);
        if (matches) {
          foundDocs.add(doc.id);
          occurrences += matches.length;
        }
      }

      if (foundDocs.size >= 2) {
        structures.push({
          id: pattern.id,
          patternRo: pattern.patternRo,
          patternEn: pattern.patternEn,
          category: pattern.category,
          occurrences,
          documents: Array.from(foundDocs),
        });
      }
    }

    return structures;
  }

  /**
   * Build clause library with Romanian/English mappings
   */
  async buildClauseLibrary(
    phrases: ExtractedPhrase[],
    structures: ClauseStructure[]
  ): Promise<DocumentPattern[]> {
    const patterns: DocumentPattern[] = [];
    let patternIndex = 0;

    // Convert phrases to patterns
    for (const phrase of phrases.slice(0, 50)) {
      // Top 50 phrases
      const pattern: DocumentPattern = {
        id: `pattern-${++patternIndex}`,
        type_id: 'general', // Will be updated with specific type
        pattern_type: 'common_phrase',
        pattern_text_ro: phrase.text,
        pattern_text_en: this.translatePhrase(phrase.text), // Simplified translation
        occurrence_count: phrase.occurrences,
        occurrence_percentage: Math.round((phrase.documents.length / 100) * 100), // Placeholder
        min_word_count: phrase.text.split(/\s+/).length,
        source_document_ids: phrase.documents,
        confidence_score: phrase.confidence / 100,
        extracted_at: new Date(),
        metadata: {
          wordCount: phrase.text.split(/\s+/).length,
          documentCount: phrase.documents.length,
        },
      };
      patterns.push(pattern);
    }

    // Convert structures to patterns
    for (const structure of structures) {
      const pattern: DocumentPattern = {
        id: `pattern-${++patternIndex}`,
        type_id: 'general',
        pattern_type: 'clause_structure',
        pattern_text_ro: structure.patternRo,
        pattern_text_en: structure.patternEn,
        occurrence_count: structure.occurrences,
        occurrence_percentage: Math.round((structure.documents.length / 100) * 100),
        min_word_count: 5,
        source_document_ids: structure.documents,
        confidence_score: 0.9,
        extracted_at: new Date(),
        metadata: {
          category: structure.category,
          structureType: 'clause',
        },
      };
      patterns.push(pattern);
    }

    return patterns;
  }

  /**
   * Simplified phrase translation (Romanian to English)
   * In production, would use translation API
   */
  private translatePhrase(romanianText: string): string {
    const translations: Record<string, string> = {
      'conform prevederilor': 'according to the provisions',
      'potrivit legii': 'according to the law',
      'în termen de': 'within',
      'zile de la': 'days from',
      'prin prezenta': 'hereby',
      solicităm: 'we request',
      'vă rugăm': 'we ask you',
      'sub sancțiunea': 'under penalty of',
      'ne rezervăm dreptul': 'we reserve the right',
      'în caz contrar': 'otherwise',
      'cod civil': 'civil code',
      articol: 'article',
    };

    let translated = romanianText;
    for (const [ro, en] of Object.entries(translations)) {
      translated = translated.replace(new RegExp(ro, 'gi'), en);
    }

    return translated;
  }

  /**
   * Calculate template quality score based on pattern consistency
   */
  async calculateTemplateQuality(
    typeId: string,
    documents: Array<{ id: string; content: string }>,
    patterns: DocumentPattern[]
  ): Promise<TemplateQualityScore> {
    // Consistency: How often do patterns repeat across documents
    const consistencyScore = this.calculateConsistency(documents, patterns);

    // Coverage: What % of documents contain the key patterns
    const coverageScore = this.calculateCoverage(documents, patterns);

    // Clarity: How clear/distinct are the patterns
    const clarityScore = this.calculateClarity(patterns);

    // Overall score (weighted average)
    const overallScore = Math.round(
      consistencyScore * 0.4 + coverageScore * 0.4 + clarityScore * 0.2
    );

    // Recommendation based on score
    let recommendation: 'ready' | 'needs_review' | 'insufficient_data';
    if (overallScore >= 80) recommendation = 'ready';
    else if (overallScore >= 60) recommendation = 'needs_review';
    else recommendation = 'insufficient_data';

    return {
      typeId,
      overallScore,
      consistencyScore,
      coverageScore,
      clarityScore,
      recommendation,
    };
  }

  private calculateConsistency(
    documents: Array<{ id: string; content: string }>,
    patterns: DocumentPattern[]
  ): number {
    if (patterns.length === 0) return 0;

    // Average occurrence rate across patterns
    const avgOccurrence =
      patterns.reduce((sum, p) => sum + p.occurrence_count, 0) / patterns.length;
    const consistency = Math.min((avgOccurrence / documents.length) * 100, 100);

    return Math.round(consistency);
  }

  private calculateCoverage(
    documents: Array<{ id: string; content: string }>,
    patterns: DocumentPattern[]
  ): number {
    if (documents.length === 0 || patterns.length === 0) return 0;

    const allSourceDocs = new Set<string>();
    patterns.forEach((p) => p.source_document_ids.forEach((id) => allSourceDocs.add(id)));

    const coverage = (allSourceDocs.size / documents.length) * 100;
    return Math.round(coverage);
  }

  private calculateClarity(patterns: DocumentPattern[]): number {
    if (patterns.length === 0) return 0;

    // Clarity based on average confidence
    const avgConfidence =
      patterns.reduce((sum, p) => sum + p.confidence_score, 0) / patterns.length;

    return Math.round(avgConfidence * 100);
  }

  /**
   * Generate template structure from high-similarity documents
   */
  async generateTemplateStructure(
    typeName: string,
    documents: Array<{ id: string; content: string }>,
    patterns: DocumentPattern[]
  ): Promise<GeneratedTemplateStructure> {
    // Extract common sections from documents
    const sections = this.extractCommonSections(documents);

    // Map patterns to sections
    const enrichedSections = sections.map((section) => {
      const relevantPhrases = patterns
        .filter((p) => section.content.some((c) => c.includes(p.pattern_text_ro)))
        .map((p) => p.pattern_text_ro);

      const variables = this.extractVariablePlaceholders(section.content);

      return {
        id: section.id,
        labelRo: section.labelRo,
        labelEn: section.labelEn,
        commonPhrases: relevantPhrases,
        variablePlaceholders: variables,
      };
    });

    // Extract standard clauses (high-frequency patterns)
    const standardClauses = patterns
      .filter((p) => p.pattern_type === 'common_phrase' && p.confidence_score >= 0.7)
      .slice(0, 10)
      .map((p) => p.pattern_text_ro);

    // Calculate quality score
    const qualityScore = await this.calculateTemplateQuality(typeName, documents, patterns);

    return {
      typeName,
      sections: enrichedSections,
      standardClauses,
      qualityScore: qualityScore.overallScore,
    };
  }

  /**
   * Extract common sections from multiple documents
   */
  private extractCommonSections(
    documents: Array<{ id: string; content: string }>
  ): Array<{ id: string; labelRo: string; labelEn: string; content: string[] }> {
    // Common Romanian legal document sections
    const commonSections = [
      { id: 'header', labelRo: 'Antet', labelEn: 'Header' },
      { id: 'parties', labelRo: 'Părți', labelEn: 'Parties' },
      { id: 'preamble', labelRo: 'Preambul', labelEn: 'Preamble' },
      { id: 'facts', labelRo: 'Expunerea Faptelor', labelEn: 'Statement of Facts' },
      { id: 'legal_basis', labelRo: 'Temeiul Legal', labelEn: 'Legal Basis' },
      { id: 'request', labelRo: 'Solicitare', labelEn: 'Request' },
      { id: 'closing', labelRo: 'Încheiere', labelEn: 'Closing' },
    ];

    // Extract content for each section from documents
    return commonSections.map((section) => ({
      ...section,
      content: documents.map((d) => this.extractSectionContent(d.content, section.labelRo)),
    }));
  }

  private extractSectionContent(documentContent: string, sectionLabel: string): string {
    // Simple extraction: find section header and get next paragraph
    const regex = new RegExp(`${sectionLabel}:?\\s*(.{0,500})`, 'i');
    const match = documentContent.match(regex);
    return match ? match[1].trim() : '';
  }

  private extractVariablePlaceholders(sectionContent: string[]): string[] {
    const variables = new Set<string>();

    // Look for common variable patterns in Romanian legal docs
    const patterns = [
      /\b([A-Z][a-z]+ [A-Z][a-z]+)\b/g, // Names: "Ion Popescu"
      /\b(\d{1,2}\.\d{1,2}\.\d{4})\b/g, // Dates: "19.11.2025"
      /\b(\d+[,.]?\d*\s+(?:RON|EUR|lei))\b/g, // Amounts: "10,000 RON"
      /\b(Str\.\s+[^,]+,\s+[^,]+)\b/g, // Addresses
    ];

    for (const content of sectionContent) {
      for (const pattern of patterns) {
        const matches = content.matchAll(pattern);
        for (const match of matches) {
          if (match[1]) {
            // Create placeholder name from content
            const varName = this.createVariableName(match[1]);
            variables.add(`{{${varName}}}`);
          }
        }
      }
    }

    return Array.from(variables);
  }

  private createVariableName(value: string): string {
    // Convert value to uppercase snake_case variable name
    return value
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
  }
}
