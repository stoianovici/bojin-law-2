/**
 * AI Document Analyzer Service
 * Analyzes legal documents for language, type, and metadata extraction
 * Part of Story 3.2.5 - Legacy Document Import & AI Analysis
 */

// Type imports only - no side effects
import type { Job, Queue as BullQueue } from 'bull';

// These imports are safe - no Redis connection
import { francAll } from 'franc-min';
import { prisma } from '@/lib/prisma';
import type { ExtractedDocument, AIAnalysisResult, SupportedLanguage } from '@legal-platform/types';

// Map franc ISO 639-3 codes to our supported languages
const FRANC_LANG_MAP: Record<string, SupportedLanguage> = {
  ron: 'Romanian',
  eng: 'English',
  ita: 'Italian',
  fra: 'French',
};

// Romanian-specific patterns for better detection
const ROMANIAN_PATTERNS = [
  /\b(și|sau|pentru|este|sunt|care|mai|acest|această|aceste|acestea)\b/gi,
  /\b(contract|articol|obligații|părți|drepturile|executare|reziliere)\b/gi,
  /[ăâîșț]/gi, // Romanian diacritics
];

// English-specific patterns
const ENGLISH_PATTERNS = [
  /\b(the|and|for|that|with|this|from|have|will|shall)\b/gi,
  /\b(agreement|contract|party|parties|obligations|rights|termination)\b/gi,
];

// Italian-specific patterns
const ITALIAN_PATTERNS = [
  /\b(il|lo|la|gli|le|che|per|con|una|sono|della|questo)\b/gi,
  /\b(contratto|articolo|obblighi|parti|diritti|esecuzione|risoluzione)\b/gi,
];

// French-specific patterns
const FRENCH_PATTERNS = [
  /\b(le|la|les|et|pour|que|qui|avec|dans|sont|cette|ces)\b/gi,
  /\b(contrat|article|obligations|parties|droits|exécution|résiliation)\b/gi,
  /[éèêëàâùûôîç]/gi, // French diacritics
];

const BATCH_SIZE = 25; // Optimal for token usage
const MAX_TOKENS_PER_REQUEST = 4000;
const MAX_COST_PER_SESSION = 10.0; // €10 limit
const HAIKU_COST_PER_1K_TOKENS = 0.00025; // Claude Haiku pricing

interface DocumentAnalysisJob {
  sessionId: string;
  documentIds: string[];
  priority: number;
}

export class AIDocumentAnalyzer {
  private anthropic: any; // Dynamically imported
  private analysisQueue!: BullQueue<DocumentAnalysisJob>;
  private readonly model = 'claude-3-haiku-20240307';
  private initialized = false;

  /**
   * Initialize connections lazily - only called at runtime, never during build
   */
  private async initialize() {
    if (this.initialized) return;

    // Dynamic imports to avoid loading at build time
    const [{ Anthropic }, BullModule] = await Promise.all([
      import('@anthropic-ai/sdk'),
      import('bull'),
    ]);

    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });

    // Bull exports as CommonJS module, handle both ESM and CJS import
    const Queue = (BullModule as any).default || BullModule;

    // Initialize Bull queue for async processing
    this.analysisQueue = new Queue('document-analysis', {
      redis: {
        host: process.env.REDIS_HOST,
        port: Number(process.env.REDIS_PORT),
        password: process.env.REDIS_PASSWORD,
      },
    });

    this.setupQueueProcessors();
    this.initialized = true;
  }

  /**
   * Main entry point - analyzes documents in batches
   */
  async analyzeDocuments(
    sessionId: string,
    documentIds: string[]
  ): Promise<{ jobId: string; estimatedCost: number }> {
    // Initialize connections on first use
    await this.initialize();

    // Check cost limit before processing
    const canProceed = await this.checkCostLimit(sessionId);
    if (!canProceed) {
      throw new Error('Session has reached cost limit of €10');
    }

    // Estimate cost
    const estimatedCost = this.estimateCost(documentIds.length);

    // Add to queue for processing
    const job = await this.analysisQueue.add({
      sessionId,
      documentIds,
      priority: 1,
    });

    return {
      jobId: job.id.toString(),
      estimatedCost,
    };
  }

  /**
   * Process documents with Claude API
   */
  private async analyzeWithClaude(documents: ExtractedDocument[]): Promise<AIAnalysisResult[]> {
    const prompt = this.buildAnalysisPrompt(documents);
    const startTime = Date.now();

    try {
      const response = await this.anthropic.messages.create({
        model: this.model,
        max_tokens: MAX_TOKENS_PER_REQUEST,
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2, // Lower for consistent classification
      });

      const processingTime = Date.now() - startTime;

      // Parse response
      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error('Unexpected response type from Claude');
      }

      const results = JSON.parse(content.text) as AIAnalysisResult[];

      // Log token usage for cost tracking
      await this.logTokenUsage({
        sessionId: documents[0].sessionId,
        model: this.model,
        tokensUsed: response.usage.input_tokens + response.usage.output_tokens,
        processingTimeMs: processingTime,
        documentCount: documents.length,
      });

      return results;
    } catch (error) {
      console.error('Claude API error:', error);
      // Fallback to basic language detection
      return this.fallbackAnalysis(documents);
    }
  }

  /**
   * Build the analysis prompt for Claude
   */
  private buildAnalysisPrompt(documents: ExtractedDocument[]): string {
    return `You are a legal document analyst specializing in Romanian, English, Italian, and French legal texts.
Analyze these documents and extract structured metadata for AI training.

For each document, determine:
1. Primary language (Romanian/English/Italian/French/Mixed) - based on majority text
2. Secondary language if mixed (>10% of content in another language)
3. Language ratio (percentages for all detected languages)
4. Document type in the original language (e.g., "Contract de Vanzare-Cumparare", "Contratto di Vendita", "Contrat de Vente")
5. Standard legal clause categories present
6. Template potential (High >80% standard, Medium 50-80%, Low <50%)
7. Key legal terms in each detected language (max 10 each)
8. Complexity score (0-1) based on structure and legal complexity
9. Risk indicators (unclear terms, mixed jurisdiction, unusual clauses)

Legal clause categories to identify:
- payment_terms (termeni de plata / termini di pagamento / conditions de paiement)
- delivery_conditions (conditii de livrare / condizioni di consegna / conditions de livraison)
- warranties (garantii / garanzie / garanties)
- liability (raspundere / responsabilità / responsabilité)
- termination (reziliere / risoluzione / résiliation)
- confidentiality (confidentialitate / riservatezza / confidentialité)
- dispute_resolution (solutionarea litigiilor / risoluzione delle controversie / règlement des litiges)
- force_majeure (forta majora / forza maggiore / force majeure)
- intellectual_property (proprietate intelectuala / proprietà intellettuale / propriété intellectuelle)
- compliance (conformitate / conformità / conformité)

Return ONLY a valid JSON array with NO additional text:
[
  {
    "id": "document_id",
    "primaryLanguage": "Romanian|English|Italian|French|Mixed",
    "secondaryLanguage": "Romanian|English|Italian|French|null",
    "languageRatio": {"Romanian": 0.85, "English": 0.15, "Italian": 0, "French": 0},
    "languageConfidence": 0.95,
    "documentType": "Original language type name",
    "documentTypeConfidence": 0.89,
    "clauseCategories": ["payment_terms", "warranties"],
    "templatePotential": "High|Medium|Low",
    "keyTerms": {
      "romanian": ["vanzator", "cumparator"],
      "english": ["seller", "buyer"],
      "italian": ["venditore", "acquirente"],
      "french": ["vendeur", "acheteur"]
    },
    "complexityScore": 0.65,
    "structureType": "structured|semi-structured|unstructured",
    "riskIndicators": {
      "hasUnclearTerms": false,
      "hasMixedJurisdiction": true,
      "hasUnusualClauses": false,
      "complianceFlags": ["GDPR_mentioned"]
    }
  }
]

Documents to analyze:
${documents.map((doc, i) => this.formatDocumentForPrompt(doc, i)).join('\n')}`;
  }

  /**
   * Format a single document for the prompt
   */
  private formatDocumentForPrompt(doc: ExtractedDocument, index: number): string {
    // Extract text preview (first 2000 chars is usually enough for classification)
    const textPreview = doc.extractedText?.slice(0, 2000) || '[No text extracted]';

    return `
---DOCUMENT ${index + 1}---
ID: ${doc.id}
Filename: ${doc.fileName}
Folder: ${doc.folderPath}
Email Subject: ${doc.emailMetadata?.subject || 'N/A'}
Date: ${doc.emailMetadata?.receivedDate || 'N/A'}

Text Preview:
${textPreview}
---END DOCUMENT ${index + 1}---`;
  }

  /**
   * Detect language using pattern matching as a supplement to franc
   */
  private detectLanguageWithPatterns(text: string): {
    language: SupportedLanguage;
    confidence: number;
  } {
    const scores: Record<SupportedLanguage, number> = {
      Romanian: 0,
      English: 0,
      Italian: 0,
      French: 0,
      Mixed: 0,
    };

    // Count pattern matches for each language
    for (const pattern of ROMANIAN_PATTERNS) {
      const matches = text.match(pattern);
      scores.Romanian += matches ? matches.length : 0;
    }
    for (const pattern of ENGLISH_PATTERNS) {
      const matches = text.match(pattern);
      scores.English += matches ? matches.length : 0;
    }
    for (const pattern of ITALIAN_PATTERNS) {
      const matches = text.match(pattern);
      scores.Italian += matches ? matches.length : 0;
    }
    for (const pattern of FRENCH_PATTERNS) {
      const matches = text.match(pattern);
      scores.French += matches ? matches.length : 0;
    }

    // Find the language with highest score
    const entries = Object.entries(scores).filter(([lang]) => lang !== 'Mixed') as [
      SupportedLanguage,
      number,
    ][];
    const sorted = entries.sort((a, b) => b[1] - a[1]);
    const [topLang, topScore] = sorted[0];
    const [, secondScore] = sorted[1] || ['Mixed', 0];

    // Calculate confidence based on score difference
    const totalScore = sorted.reduce((sum, [, score]) => sum + score, 0);
    if (totalScore === 0) {
      return { language: 'Mixed', confidence: 0.3 };
    }

    const confidence = topScore / totalScore;

    // If top two scores are close, it might be mixed
    if (secondScore > 0 && topScore / secondScore < 2) {
      return { language: topLang, confidence: confidence * 0.7 };
    }

    return { language: topLang, confidence: Math.min(confidence, 0.9) };
  }

  /**
   * Fallback analysis using franc library + pattern matching
   */
  private async fallbackAnalysis(documents: ExtractedDocument[]): Promise<AIAnalysisResult[]> {
    return documents.map((doc) => {
      const text = doc.extractedText || '';

      // Try franc first with multiple candidates
      const francResults = francAll(text, { minLength: 10 });
      const topFrancResult = francResults[0];

      // Get franc's best guess if available
      let francLang: SupportedLanguage | null = null;
      let francConfidence = 0;

      if (topFrancResult && topFrancResult[0] !== 'und') {
        francLang = FRANC_LANG_MAP[topFrancResult[0]] || null;
        francConfidence = topFrancResult[1];
      }

      // Also run pattern-based detection
      const patternResult = this.detectLanguageWithPatterns(text);

      // Combine results: prefer pattern detection for our target languages
      let primaryLanguage: SupportedLanguage;
      let confidence: number;

      if (patternResult.confidence > 0.5) {
        // Pattern detection is confident
        primaryLanguage = patternResult.language;
        confidence = patternResult.confidence;
      } else if (francLang && francConfidence > 0.5) {
        // Franc is confident and detected a supported language
        primaryLanguage = francLang;
        confidence = francConfidence;
      } else if (patternResult.confidence > 0.3) {
        // Low confidence pattern match is better than nothing
        primaryLanguage = patternResult.language;
        confidence = patternResult.confidence;
      } else if (francLang) {
        // Fall back to franc even with low confidence
        primaryLanguage = francLang;
        confidence = Math.max(francConfidence, 0.4);
      } else {
        // No detection worked - mark as Mixed (unknown)
        primaryLanguage = 'Mixed';
        confidence = 0.3;
      }

      // Build language ratio
      const languageRatio: Record<string, number> = {
        Romanian: 0,
        English: 0,
        Italian: 0,
        French: 0,
      };
      if (primaryLanguage !== 'Mixed') {
        languageRatio[primaryLanguage] = 1;
      }

      return {
        id: doc.id,
        primaryLanguage,
        secondaryLanguage: null,
        languageRatio,
        languageConfidence: confidence,
        documentType: 'Unknown',
        documentTypeConfidence: 0,
        clauseCategories: [],
        templatePotential: 'Low' as const,
        keyTerms: { romanian: [], english: [], italian: [], french: [] },
        complexityScore: 0.5,
        structureType: 'unstructured' as const,
        riskIndicators: {
          hasUnclearTerms: true,
          hasMixedJurisdiction: false,
          hasUnusualClauses: false,
          complianceFlags: [],
        },
      };
    });
  }

  /**
   * Check if session is within cost limit
   */
  private async checkCostLimit(sessionId: string): Promise<boolean> {
    const totalCost = await prisma.aIProcessingLog.aggregate({
      where: { sessionId },
      _sum: { costUSD: true },
    });

    const currentCost = totalCost._sum.costUSD || 0;
    return currentCost < MAX_COST_PER_SESSION;
  }

  /**
   * Estimate cost for processing documents
   */
  private estimateCost(documentCount: number): number {
    // Assume average 500 tokens per document (input + output)
    const estimatedTokens = documentCount * 500;
    const costInUSD = (estimatedTokens / 1000) * HAIKU_COST_PER_1K_TOKENS;
    return costInUSD * 0.92; // Convert USD to EUR (approximate)
  }

  /**
   * Log token usage for cost tracking
   */
  private async logTokenUsage(data: {
    sessionId: string;
    model: string;
    tokensUsed: number;
    processingTimeMs: number;
    documentCount: number;
  }) {
    const costUSD = (data.tokensUsed / 1000) * HAIKU_COST_PER_1K_TOKENS;

    await prisma.aIProcessingLog.create({
      data: {
        sessionId: data.sessionId,
        model: data.model,
        tokensUsed: data.tokensUsed,
        costUSD,
        processingTimeMs: data.processingTimeMs,
        success: true,
        metadata: {
          documentCount: data.documentCount,
          averageTokensPerDoc: Math.round(data.tokensUsed / data.documentCount),
        },
      },
    });
  }

  /**
   * Setup queue processors for async processing
   */
  private setupQueueProcessors() {
    this.analysisQueue.process(async (job: Job<DocumentAnalysisJob>) => {
      const { sessionId, documentIds } = job.data;

      // Fetch documents from database
      const documents = await prisma.extractedDocument.findMany({
        where: {
          id: { in: documentIds },
          sessionId,
        },
      });

      // Process in batches
      const batches = this.chunkArray(documents, BATCH_SIZE);
      const allResults: AIAnalysisResult[] = [];

      for (const batch of batches) {
        const results = await this.analyzeWithClaude(batch as ExtractedDocument[]);
        allResults.push(...results);

        // Update database with results
        await this.saveAnalysisResults(results);

        // Update job progress
        await job.progress(Math.round((allResults.length / documentIds.length) * 100));
      }

      return {
        processed: allResults.length,
        sessionId,
      };
    });

    // Handle failed jobs
    this.analysisQueue.on('failed', (job, err) => {
      console.error(`Job ${job.id} failed:`, err);
      // Could implement retry logic or notifications here
    });
  }

  /**
   * Save analysis results to database and trigger discovery
   */
  private async saveAnalysisResults(results: AIAnalysisResult[]) {
    // First, get the full document records for discovery
    const documentIds = results.map((r) => r.id);
    const documents = await prisma.extractedDocument.findMany({
      where: { id: { in: documentIds } },
    });

    // Create a map for quick lookup
    const docMap = new Map(documents.map((d: (typeof documents)[number]) => [d.id, d]));

    // Update documents with analysis results
    const updates = results.map((result) =>
      prisma.extractedDocument.update({
        where: { id: result.id },
        data: {
          primaryLanguage: result.primaryLanguage,
          secondaryLanguage: result.secondaryLanguage,
          languageRatio: result.languageRatio,
          languageConfidence: result.languageConfidence,
          documentType: result.documentType,
          documentTypeConfidence: result.documentTypeConfidence,
          clauseCategories: result.clauseCategories,
          templatePotential: result.templatePotential,
          aiMetadata: {
            complexityScore: result.complexityScore,
            structureType: result.structureType,
            keyTerms: result.keyTerms,
            clauseCount: result.clauseCategories.length,
          },
          riskIndicators: result.riskIndicators,
          aiAnalysisVersion: this.model,
          analysisTimestamp: new Date(),
        },
      })
    );

    await prisma.$transaction(updates);

    // Dynamically import discovery service to avoid load-time issues
    const { documentTypeDiscovery } = await import('./document-type-discovery.service');

    // Trigger document type discovery for each analyzed document
    const discoveryPromises = results.map(async (result) => {
      const document = docMap.get(result.id);
      if (!document) {
        console.warn(`Document ${result.id} not found for discovery`);
        return;
      }

      try {
        const discoveryResult = await documentTypeDiscovery.discoverAndRegister(
          document as ExtractedDocument,
          result
        );

        // Log threshold crossing events
        if (discoveryResult.action === 'threshold_reached') {
          console.log(
            `[Discovery] Threshold reached for type: ${discoveryResult.registryEntry.discoveredTypeOriginal}`,
            discoveryResult.thresholdsMet
          );

          // Here you could trigger notifications, queue template creation, etc.
          if (discoveryResult.thresholdsMet?.autoCreate) {
            console.log(
              `[Discovery] AUTO-CREATE candidate: ${discoveryResult.registryEntry.discoveredTypeOriginal} (${discoveryResult.registryEntry.totalOccurrences} occurrences)`
            );
          } else if (discoveryResult.thresholdsMet?.queueForReview) {
            console.log(
              `[Discovery] REVIEW candidate: ${discoveryResult.registryEntry.discoveredTypeOriginal} (${discoveryResult.registryEntry.totalOccurrences} occurrences)`
            );
          }
        }
      } catch (error) {
        console.error(`[Discovery] Error discovering type for document ${result.id}:`, error);
        // Don't fail the entire batch if discovery fails
      }
    });

    // Execute discovery in parallel (non-blocking)
    await Promise.allSettled(discoveryPromises);
  }

  /**
   * Get analysis status for a session
   */
  async getAnalysisStatus(sessionId: string) {
    const [totalDocs, analyzedDocs, totalCost] = await Promise.all([
      prisma.extractedDocument.count({
        where: { sessionId },
      }),
      prisma.extractedDocument.count({
        where: {
          sessionId,
          primaryLanguage: { not: null },
        },
      }),
      prisma.aIProcessingLog.aggregate({
        where: { sessionId },
        _sum: { costUSD: true },
      }),
    ]);

    return {
      total: totalDocs,
      analyzed: analyzedDocs,
      remaining: totalDocs - analyzedDocs,
      percentComplete: Math.round((analyzedDocs / totalDocs) * 100),
      costEUR: (totalCost._sum.costUSD || 0) * 0.92,
      withinBudget: (totalCost._sum.costUSD || 0) < MAX_COST_PER_SESSION,
    };
  }

  /**
   * Utility: Chunk array into smaller arrays
   */
  private chunkArray<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}

// Export lazy singleton to avoid initialization during build
let _documentAnalyzer: AIDocumentAnalyzer | null = null;

export const documentAnalyzer = {
  get instance(): AIDocumentAnalyzer {
    if (!_documentAnalyzer) {
      _documentAnalyzer = new AIDocumentAnalyzer();
    }
    return _documentAnalyzer;
  },
  analyzeDocuments: (sessionId: string, documentIds: string[]) =>
    documentAnalyzer.instance.analyzeDocuments(sessionId, documentIds),
  getAnalysisStatus: (sessionId: string) => documentAnalyzer.instance.getAnalysisStatus(sessionId),
};
