/**
 * Style Learning Service
 * Story 5.6: AI Learning and Personalization
 *
 * Analyzes user edits to learn writing style preferences and
 * applies learned styles to AI-generated content
 */

import { v4 as uuidv4 } from 'uuid';
import { ClaudeModel, AIOperationType } from '@legal-platform/types';
import { chat } from '../lib/claude/client';
import { tokenTracker } from './token-tracker.service';
import { cacheService } from './cache.service';
import logger from '../lib/logger';
import { config } from '../config';

// ============================================================================
// Types
// ============================================================================

export interface CommonPhrase {
  phrase: string;
  frequency: number;
  context: 'greeting' | 'closing' | 'body' | 'legal_term';
}

export interface PunctuationStyle {
  useOxfordComma: boolean;
  preferSemicolons: boolean;
  useDashes: 'em-dash' | 'en-dash' | 'hyphen';
  colonBeforeLists: boolean;
}

export interface LanguagePatterns {
  primaryLanguage: 'romanian' | 'english';
  formalityByLanguage: Record<string, number>;
  preferredGreetingsByLanguage: Record<string, string[]>;
  legalTermsPreference: 'romanian' | 'latin' | 'mixed';
}

export interface WritingStyleProfile {
  id: string;
  firmId: string;
  userId: string;
  formalityLevel: number;
  averageSentenceLength: number;
  vocabularyComplexity: number;
  preferredTone: string;
  commonPhrases: CommonPhrase[];
  punctuationStyle: PunctuationStyle;
  languagePatterns: LanguagePatterns;
  sampleCount: number;
  lastAnalyzedAt: Date | null;
}

export interface StyleAnalysisResult {
  formalityScore: number;
  averageSentenceLength: number;
  vocabularyLevel: number;
  detectedTone: string;
  newPhrases: CommonPhrase[];
  punctuationPatterns: Partial<PunctuationStyle>;
  confidence: number;
}

export interface EditAnalysisInput {
  originalText: string;
  editedText: string;
  editLocation: 'greeting' | 'body' | 'closing' | 'full';
  userId: string;
  firmId: string;
}

// ============================================================================
// Prompts
// ============================================================================

const STYLE_ANALYSIS_SYSTEM = `You are an expert writing style analyst. Analyze the differences between original AI-generated text and user-edited text to extract writing style preferences.

Focus on:
1. Formality level (0.0 = very casual, 1.0 = very formal)
2. Sentence structure preferences (average length, complexity)
3. Vocabulary choices (simple vs. sophisticated)
4. Tone preferences
5. Common phrases or expressions the user prefers
6. Punctuation patterns (Oxford comma, semicolons, dashes)
7. Language-specific patterns (Romanian vs. English preferences)

Return a JSON object with your analysis.`;

const STYLE_ANALYSIS_HUMAN = `Analyze these text changes to understand the user's writing style preferences:

**Original (AI-generated):**
{original_text}

**User's edited version:**
{edited_text}

**Edit location:** {edit_location}

Provide a JSON response with these fields:
- formalityScore (0.0-1.0)
- averageSentenceLength (number of words)
- vocabularyLevel (0.0-1.0, where 1.0 is most sophisticated)
- detectedTone (string describing tone)
- newPhrases (array of {phrase, frequency: 1, context})
- punctuationPatterns (object with useOxfordComma, preferSemicolons, etc.)
- confidence (0.0-1.0 how confident in the analysis)

JSON response:`;

const STYLE_APPLICATION_SYSTEM_TEMPLATE = `You are an expert writing assistant. Apply the user's learned writing style to the given text while maintaining the original meaning and intent.

Style parameters to apply:
- Formality level: {formality_level}/1.0
- Target sentence length: approximately {sentence_length} words
- Vocabulary complexity: {vocabulary_complexity}/1.0
- Preferred tone: {preferred_tone}
- Common phrases to use when appropriate: {common_phrases}
- Language: {primary_language}

Rewrite the text to match these style preferences while preserving the legal accuracy and meaning.`;

const STYLE_APPLICATION_HUMAN = `Rewrite the following text to match the user's writing style:

{input_text}

Styled version:`;

// ============================================================================
// Service Implementation
// ============================================================================

class StyleLearningService {
  private minSamplesForLearning: number;
  private updateThreshold: number;
  private analysisBatchSize: number;

  constructor() {
    this.minSamplesForLearning = parseInt(process.env.STYLE_LEARNING_MIN_SAMPLES || '5', 10);
    this.updateThreshold = parseFloat(process.env.STYLE_LEARNING_UPDATE_THRESHOLD || '0.15');
    this.analysisBatchSize = parseInt(process.env.STYLE_LEARNING_ANALYSIS_BATCH_SIZE || '10', 10);
  }

  /**
   * Analyze an edit to extract style preferences
   */
  async analyzeEdit(input: EditAnalysisInput): Promise<StyleAnalysisResult> {
    const startTime = Date.now();
    const operationId = uuidv4();

    try {
      logger.debug('Analyzing edit for style learning', {
        operationId,
        userId: input.userId,
        editLocation: input.editLocation,
      });

      // Check cache for similar analysis
      const cacheKey = `style_analysis:${input.userId}:${this.hashText(
        input.originalText + input.editedText
      )}`;
      // Note: cacheService is for AI responses, not generic cache
      // Skip cache lookup for style analysis

      // Skip trivial edits
      if (this.isTrivialEdit(input.originalText, input.editedText)) {
        return this.createEmptyAnalysis();
      }

      // Build user prompt with interpolated values
      const userPrompt = STYLE_ANALYSIS_HUMAN.replace(
        '{original_text}',
        input.originalText.substring(0, 2000)
      )
        .replace('{edited_text}', input.editedText.substring(0, 2000))
        .replace('{edit_location}', input.editLocation);

      // Generate response using direct Anthropic SDK
      const response = await chat(STYLE_ANALYSIS_SYSTEM, userPrompt, {
        model: ClaudeModel.Sonnet,
        maxTokens: 1024,
        temperature: 0.3,
      });

      const result = this.parseAnalysisResponse(response.content);

      // Track token usage
      await tokenTracker.recordUsage({
        userId: input.userId,
        firmId: input.firmId,
        operationType: AIOperationType.StyleAnalysis,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        modelUsed: ClaudeModel.Sonnet,
        latencyMs: Date.now() - startTime,
      });

      logger.info('Style analysis completed', {
        operationId,
        userId: input.userId,
        formalityScore: result.formalityScore,
        confidence: result.confidence,
        durationMs: Date.now() - startTime,
      });

      return result;
    } catch (error) {
      logger.error('Style analysis failed', {
        operationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.createEmptyAnalysis();
    }
  }

  /**
   * Apply learned style to text
   */
  async applyStyle(
    text: string,
    profile: WritingStyleProfile,
    userId: string,
    firmId: string
  ): Promise<string> {
    const startTime = Date.now();
    const operationId = uuidv4();

    try {
      logger.debug('Applying style to text', {
        operationId,
        userId,
        textLength: text.length,
      });

      // Don't apply style if not enough samples
      if (profile.sampleCount < this.minSamplesForLearning) {
        logger.debug('Not enough samples for style application', {
          operationId,
          sampleCount: profile.sampleCount,
          required: this.minSamplesForLearning,
        });
        return text;
      }

      const commonPhrasesStr = profile.commonPhrases
        .slice(0, 10)
        .map((p) => p.phrase)
        .join(', ');

      // Build system prompt with interpolated values
      const systemPrompt = STYLE_APPLICATION_SYSTEM_TEMPLATE.replace(
        '{formality_level}',
        profile.formalityLevel.toFixed(2)
      )
        .replace('{sentence_length}', String(Math.round(profile.averageSentenceLength)))
        .replace('{vocabulary_complexity}', profile.vocabularyComplexity.toFixed(2))
        .replace('{preferred_tone}', profile.preferredTone)
        .replace('{common_phrases}', commonPhrasesStr || 'None specified')
        .replace('{primary_language}', profile.languagePatterns.primaryLanguage);

      // Build user prompt
      const userPrompt = STYLE_APPLICATION_HUMAN.replace('{input_text}', text);

      // Generate response using direct Anthropic SDK
      const response = await chat(systemPrompt, userPrompt, {
        model: ClaudeModel.Sonnet,
        maxTokens: 2048,
        temperature: 0.4,
      });

      const styledText = response.content;

      // Track token usage
      await tokenTracker.recordUsage({
        userId,
        firmId,
        operationType: AIOperationType.StyleApplication,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        modelUsed: ClaudeModel.Sonnet,
        latencyMs: Date.now() - startTime,
      });

      logger.info('Style applied successfully', {
        operationId,
        userId,
        originalLength: text.length,
        styledLength: styledText.length,
        durationMs: Date.now() - startTime,
      });

      return styledText;
    } catch (error) {
      logger.error('Style application failed', {
        operationId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return text; // Return original on failure
    }
  }

  /**
   * Update writing style profile with new analysis
   */
  updateProfile(
    existingProfile: WritingStyleProfile,
    analysis: StyleAnalysisResult
  ): WritingStyleProfile {
    const sampleCount = existingProfile.sampleCount + 1;

    // Calculate weighted average (new data has less weight as samples increase)
    const existingWeight = Math.min(sampleCount - 1, this.analysisBatchSize);
    const newWeight = 1;
    const totalWeight = existingWeight + newWeight;

    return {
      ...existingProfile,
      formalityLevel:
        (existingProfile.formalityLevel * existingWeight + analysis.formalityScore * newWeight) /
        totalWeight,
      averageSentenceLength:
        (existingProfile.averageSentenceLength * existingWeight +
          analysis.averageSentenceLength * newWeight) /
        totalWeight,
      vocabularyComplexity:
        (existingProfile.vocabularyComplexity * existingWeight +
          analysis.vocabularyLevel * newWeight) /
        totalWeight,
      preferredTone:
        analysis.confidence > 0.7 ? analysis.detectedTone : existingProfile.preferredTone,
      commonPhrases: this.mergeCommonPhrases(existingProfile.commonPhrases, analysis.newPhrases),
      punctuationStyle: {
        ...existingProfile.punctuationStyle,
        ...analysis.punctuationPatterns,
      },
      sampleCount,
      lastAnalyzedAt: new Date(),
    };
  }

  /**
   * Create a default profile for new users
   */
  createDefaultProfile(userId: string, firmId: string): WritingStyleProfile {
    return {
      id: uuidv4(),
      firmId,
      userId,
      formalityLevel: 0.7, // Default to professional
      averageSentenceLength: 18,
      vocabularyComplexity: 0.6,
      preferredTone: 'Professional',
      commonPhrases: [],
      punctuationStyle: {
        useOxfordComma: true,
        preferSemicolons: false,
        useDashes: 'em-dash',
        colonBeforeLists: true,
      },
      languagePatterns: {
        primaryLanguage: 'romanian',
        formalityByLanguage: { romanian: 0.7, english: 0.7 },
        preferredGreetingsByLanguage: {
          romanian: ['Stimate Domn', 'Stimată Doamnă'],
          english: ['Dear', 'Hello'],
        },
        legalTermsPreference: 'romanian',
      },
      sampleCount: 0,
      lastAnalyzedAt: null,
    };
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private parseAnalysisResponse(response: string): StyleAnalysisResult {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        formalityScore: this.clamp(parsed.formalityScore || 0.5, 0, 1),
        averageSentenceLength: Math.max(parsed.averageSentenceLength || 15, 5),
        vocabularyLevel: this.clamp(parsed.vocabularyLevel || 0.5, 0, 1),
        detectedTone: parsed.detectedTone || 'Professional',
        newPhrases: Array.isArray(parsed.newPhrases) ? parsed.newPhrases : [],
        punctuationPatterns: parsed.punctuationPatterns || {},
        confidence: this.clamp(parsed.confidence || 0.5, 0, 1),
      };
    } catch (error) {
      logger.warn('Failed to parse style analysis response', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return this.createEmptyAnalysis();
    }
  }

  private createEmptyAnalysis(): StyleAnalysisResult {
    return {
      formalityScore: 0.5,
      averageSentenceLength: 15,
      vocabularyLevel: 0.5,
      detectedTone: 'Professional',
      newPhrases: [],
      punctuationPatterns: {},
      confidence: 0,
    };
  }

  private isTrivialEdit(original: string, edited: string): boolean {
    // Check if edit is too small to learn from
    const originalWords = original.split(/\s+/).length;
    const editedWords = edited.split(/\s+/).length;
    const wordDiff = Math.abs(originalWords - editedWords);

    // If only a few words changed, might be too trivial
    if (wordDiff < 3 && original.length > 100) {
      const similarity = this.calculateSimilarity(original, edited);
      return similarity > 0.95; // 95% similar = trivial
    }

    return false;
  }

  private calculateSimilarity(a: string, b: string): number {
    const wordsA = new Set(a.toLowerCase().split(/\s+/));
    const wordsB = new Set(b.toLowerCase().split(/\s+/));

    const intersection = new Set([...wordsA].filter((x) => wordsB.has(x)));
    const union = new Set([...wordsA, ...wordsB]);

    return intersection.size / union.size;
  }

  private mergeCommonPhrases(existing: CommonPhrase[], newPhrases: CommonPhrase[]): CommonPhrase[] {
    const phraseMap = new Map<string, CommonPhrase>();

    // Add existing phrases
    existing.forEach((p) => phraseMap.set(p.phrase.toLowerCase(), p));

    // Merge new phrases
    newPhrases.forEach((p) => {
      const key = p.phrase.toLowerCase();
      const existingPhrase = phraseMap.get(key);
      if (existingPhrase) {
        existingPhrase.frequency++;
      } else {
        phraseMap.set(key, p);
      }
    });

    // Sort by frequency and return top 50
    return Array.from(phraseMap.values())
      .sort((a, b) => b.frequency - a.frequency)
      .slice(0, 50);
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  private hashText(text: string): string {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return hash.toString(36);
  }
}

export const styleLearningService = new StyleLearningService();
export default styleLearningService;
