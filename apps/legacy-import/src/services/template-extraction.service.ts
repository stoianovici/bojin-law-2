/**
 * Template Extraction Service
 * Extracts document templates from approved clusters using AI.
 *
 * Uses Anthropic Batch API with Claude Sonnet for high-quality template extraction.
 * Extracts: sections, variable fields, boilerplate clauses, style guide.
 */

import Anthropic from '@anthropic-ai/sdk';
import { prisma } from '@/lib/prisma';

// ============================================================================
// Types
// ============================================================================

export interface ExtractionStats {
  total: number;
  extracted: number;
  skipped: number;
  errors: number;
}

interface TemplateSection {
  name: string;
  description: string;
  isRequired: boolean;
  order: number;
}

interface VariableField {
  name: string;
  description: string;
  fieldType: 'text' | 'date' | 'number' | 'currency' | 'party' | 'address';
  isRequired: boolean;
  exampleValue?: string;
}

interface ExtractedTemplate {
  sections: TemplateSection[];
  variableFields: VariableField[];
  boilerplateClauses: string[];
  styleGuide: {
    language: string;
    formality: string;
    commonPhrases: string[];
    formatting: string;
  };
}

interface BatchRequest {
  custom_id: string;
  params: {
    model: string;
    max_tokens: number;
    messages: Array<{ role: 'user'; content: string }>;
    system?: string;
  };
}

// ============================================================================
// Constants
// ============================================================================

const SONNET_MODEL = 'claude-sonnet-4-20250514';
const MIN_DOCS_FOR_TEMPLATE = 5;
const MAX_DOCS_PER_EXTRACTION = 10;
const MAX_TEXT_PER_DOC = 5000;

const EXTRACTION_SYSTEM_PROMPT = `You are a legal document analyst specializing in Romanian law firm documentation.

Your task is to analyze a set of similar legal documents and extract a reusable template structure.

Analyze the provided documents and extract:

1. **Sections**: Identify the common structural sections that appear across documents
   - Note which sections are required vs optional
   - Order them as they typically appear

2. **Variable Fields**: Identify placeholders/variables that change between documents
   - Common types: party names, dates, addresses, amounts, durations
   - Note the field type and whether it's required

3. **Boilerplate Clauses**: Identify standard clauses that appear verbatim or near-verbatim

4. **Style Guide**: Note the writing style
   - Language register (formal/informal)
   - Common phrases and legal terminology
   - Formatting conventions

Respond in JSON format:
{
  "sections": [
    {
      "name": "Section name in Romanian",
      "description": "Brief description",
      "isRequired": true/false,
      "order": 1
    }
  ],
  "variableFields": [
    {
      "name": "FIELD_NAME",
      "description": "What this field represents",
      "fieldType": "text|date|number|currency|party|address",
      "isRequired": true/false,
      "exampleValue": "optional example"
    }
  ],
  "boilerplateClauses": [
    "Standard clause text..."
  ],
  "styleGuide": {
    "language": "Romanian legal",
    "formality": "Formal/Semi-formal",
    "commonPhrases": ["phrases used frequently"],
    "formatting": "Description of formatting conventions"
  }
}`;

// ============================================================================
// Service
// ============================================================================

export class TemplateExtractionService {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic();
  }

  /**
   * Extract templates for all approved clusters in a session.
   */
  async extractTemplates(sessionId: string): Promise<ExtractionStats> {
    // Get approved clusters with enough documents (exclude deleted clusters)
    const clusters = await prisma.documentCluster.findMany({
      where: {
        sessionId,
        status: 'Approved',
        isDeleted: false,
        documentCount: { gte: MIN_DOCS_FOR_TEMPLATE },
      },
      select: {
        id: true,
        suggestedName: true,
        approvedName: true,
        documentCount: true,
      },
    });

    const stats: ExtractionStats = {
      total: clusters.length,
      extracted: 0,
      skipped: 0,
      errors: 0,
    };

    if (clusters.length === 0) {
      console.log('[TemplateExtraction] No eligible clusters found');
      return stats;
    }

    console.log(`[TemplateExtraction] Processing ${clusters.length} clusters`);

    // Build batch requests
    const requests: BatchRequest[] = [];

    for (const cluster of clusters) {
      try {
        const docTexts = await this.getClusterDocuments(cluster.id);
        if (docTexts.length < MIN_DOCS_FOR_TEMPLATE) {
          console.log(
            `[TemplateExtraction] Skipping ${cluster.approvedName || cluster.suggestedName}: only ${docTexts.length} docs with text`
          );
          stats.skipped++;
          continue;
        }

        // custom_id must match pattern ^[a-zA-Z0-9_-]{1,64}$
        requests.push({
          custom_id: `cluster_${cluster.id}`,
          params: {
            model: SONNET_MODEL,
            max_tokens: 4096,
            system: EXTRACTION_SYSTEM_PROMPT,
            messages: [
              {
                role: 'user' as const,
                content: this.buildExtractionPrompt(
                  cluster.approvedName || cluster.suggestedName,
                  docTexts
                ),
              },
            ],
          },
        });
      } catch (err) {
        console.error(`[TemplateExtraction] Error preparing cluster ${cluster.id}:`, err);
        stats.errors++;
      }
    }

    if (requests.length === 0) {
      console.log('[TemplateExtraction] No valid clusters to process');
      return stats;
    }

    // Process batch
    const results = await this.processBatch(requests);

    // Save templates
    for (const { clusterId, template } of results) {
      try {
        await this.saveTemplate(clusterId, template);
        stats.extracted++;
      } catch (err) {
        console.error(`[TemplateExtraction] Error saving template for ${clusterId}:`, err);
        stats.errors++;
      }
    }

    // Update session status
    await prisma.legacyImportSession.update({
      where: { id: sessionId },
      data: {
        pipelineStatus: 'Completed',
        pipelineCompletedAt: new Date(),
      },
    });

    console.log(
      `[TemplateExtraction] Complete: ${stats.extracted} extracted, ${stats.skipped} skipped, ${stats.errors} errors`
    );

    return stats;
  }

  /**
   * Extract template for a single cluster.
   */
  async extractForCluster(clusterId: string): Promise<ExtractedTemplate | null> {
    const cluster = await prisma.documentCluster.findUnique({
      where: { id: clusterId },
      select: {
        id: true,
        suggestedName: true,
        approvedName: true,
      },
    });

    if (!cluster) {
      throw new Error('Cluster not found');
    }

    const docTexts = await this.getClusterDocuments(clusterId);
    if (docTexts.length < MIN_DOCS_FOR_TEMPLATE) {
      return null;
    }

    // Single request (not batch)
    const response = await this.anthropic.messages.create({
      model: SONNET_MODEL,
      max_tokens: 4096,
      system: EXTRACTION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: this.buildExtractionPrompt(
            cluster.approvedName || cluster.suggestedName,
            docTexts
          ),
        },
      ],
    });

    const textContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    const template = this.parseResponse(textContent);
    if (template) {
      await this.saveTemplate(clusterId, template);
    }

    return template;
  }

  /**
   * Get document texts for a cluster.
   */
  private async getClusterDocuments(
    clusterId: string
  ): Promise<Array<{ fileName: string; text: string }>> {
    const documents = await prisma.extractedDocument.findMany({
      where: {
        clusterId,
        extractedText: { not: null },
        validationStatus: 'Accepted',
      },
      select: {
        fileName: true,
        extractedText: true,
      },
      take: MAX_DOCS_PER_EXTRACTION,
      orderBy: { createdAt: 'asc' },
    });

    return documents
      .filter((d) => d.extractedText && d.extractedText.length > 100)
      .map((d) => ({
        fileName: d.fileName,
        text:
          d.extractedText!.length > MAX_TEXT_PER_DOC
            ? d.extractedText!.substring(0, MAX_TEXT_PER_DOC) + '...'
            : d.extractedText!,
      }));
  }

  /**
   * Build the extraction prompt.
   */
  private buildExtractionPrompt(
    clusterName: string,
    documents: Array<{ fileName: string; text: string }>
  ): string {
    const parts = [
      `Analyze the following ${documents.length} documents from the category "${clusterName}" and extract a reusable template structure.\n\n`,
    ];

    for (let i = 0; i < documents.length; i++) {
      parts.push(`--- Document ${i + 1}: ${documents[i].fileName} ---\n`);
      parts.push(documents[i].text);
      parts.push('\n\n');
    }

    parts.push('Based on the above documents, extract the template structure in JSON format.');

    return parts.join('');
  }

  /**
   * Process a batch of extraction requests.
   */
  private async processBatch(
    requests: BatchRequest[]
  ): Promise<Array<{ clusterId: string; template: ExtractedTemplate }>> {
    console.log(`[TemplateExtraction] Submitting batch of ${requests.length} requests`);

    // Submit batch
    const batch = await this.anthropic.messages.batches.create({
      requests,
    });

    console.log(`[TemplateExtraction] Batch submitted: ${batch.id}`);

    // Wait for completion
    let status = await this.anthropic.messages.batches.retrieve(batch.id);
    while (status.processing_status !== 'ended') {
      console.log(`[TemplateExtraction] Batch ${batch.id}: ${status.processing_status}`);
      await this.sleep(30_000); // Poll every 30 seconds (Sonnet takes longer)
      status = await this.anthropic.messages.batches.retrieve(batch.id);
    }

    console.log(
      `[TemplateExtraction] Batch completed: ${status.request_counts.succeeded} succeeded`
    );

    // Retrieve results
    const results: Array<{ clusterId: string; template: ExtractedTemplate }> = [];
    const resultsStream = await this.anthropic.messages.batches.results(batch.id);

    for await (const result of resultsStream) {
      const clusterId = result.custom_id.replace('cluster_', '');

      if (result.result.type === 'succeeded' && result.result.message) {
        const textContent = result.result.message.content
          .filter(
            (block: Anthropic.ContentBlock): block is Anthropic.TextBlock => block.type === 'text'
          )
          .map((block: Anthropic.TextBlock) => block.text)
          .join('');

        const template = this.parseResponse(textContent);
        if (template) {
          results.push({ clusterId, template });
        } else {
          console.warn(`[TemplateExtraction] Failed to parse response for cluster ${clusterId}`);
        }
      }
    }

    return results;
  }

  /**
   * Parse AI response to ExtractedTemplate.
   */
  private parseResponse(response: string): ExtractedTemplate | null {
    try {
      // Extract JSON from response (may have markdown code blocks)
      let jsonStr = response;
      const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonStr = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonStr);

      // Validate structure
      if (!parsed.sections || !Array.isArray(parsed.sections)) {
        console.warn('[TemplateExtraction] Invalid response: missing sections');
        return null;
      }

      // Normalize to expected format
      return {
        sections: parsed.sections.map((s: any, i: number) => ({
          name: s.name || `Section ${i + 1}`,
          description: s.description || '',
          isRequired: s.isRequired ?? false,
          order: s.order ?? i + 1,
        })),
        variableFields: (parsed.variableFields || []).map((f: any) => ({
          name: f.name || 'UNNAMED',
          description: f.description || '',
          fieldType: f.fieldType || 'text',
          isRequired: f.isRequired ?? false,
          exampleValue: f.exampleValue,
        })),
        boilerplateClauses: parsed.boilerplateClauses || [],
        styleGuide: {
          language: parsed.styleGuide?.language || 'Romanian',
          formality: parsed.styleGuide?.formality || 'Formal',
          commonPhrases: parsed.styleGuide?.commonPhrases || [],
          formatting: parsed.styleGuide?.formatting || '',
        },
      };
    } catch (err) {
      console.error('[TemplateExtraction] Parse error:', err);
      return null;
    }
  }

  /**
   * Save template to database.
   */
  private async saveTemplate(clusterId: string, template: ExtractedTemplate): Promise<void> {
    // Get cluster info
    const cluster = await prisma.documentCluster.findUnique({
      where: { id: clusterId },
      select: {
        sessionId: true,
        suggestedName: true,
        approvedName: true,
        documentCount: true,
      },
    });

    if (!cluster) return;

    // Upsert template
    await prisma.documentTemplate.upsert({
      where: { clusterId },
      create: {
        clusterId,
        name: cluster.approvedName || cluster.suggestedName,
        sections: template.sections as object,
        variableFields: template.variableFields as object,
        boilerplateClauses: template.boilerplateClauses as object,
        styleGuide: template.styleGuide as object,
        sourceDocumentIds: [], // Will be populated later if needed
        extractionConfidence: 0.85,
        language: 'ro',
      },
      update: {
        name: cluster.approvedName || cluster.suggestedName,
        sections: template.sections as object,
        variableFields: template.variableFields as object,
        boilerplateClauses: template.boilerplateClauses as object,
        styleGuide: template.styleGuide as object,
      },
    });
  }

  /**
   * Sleep helper.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

export const templateExtractionService = new TemplateExtractionService();
