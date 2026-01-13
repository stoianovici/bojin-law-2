/**
 * Document Generation Service
 * OPS-077: Service Wrappers for AI Assistant Handlers
 *
 * AI-powered document generation service for creating legal documents
 * from templates with contextual data.
 *
 * Supports web search for research documents via Brave Search API.
 */

import { prisma } from '@legal-platform/database';
import { AIOperationType, ClaudeModel } from '@legal-platform/types';
import { aiService } from './ai.service';
import { aiClient, getModelForFeature, AIToolDefinition, ToolHandler } from './ai-client.service';
import { webSearchService } from './web-search.service';
import { GraphQLError } from 'graphql';
import Anthropic from '@anthropic-ai/sdk';
import logger from '../utils/logger';

// Map model ID to ClaudeModel enum
function modelIdToClaudeModel(modelId: string): ClaudeModel {
  const enumValues = Object.values(ClaudeModel) as string[];
  if (enumValues.includes(modelId)) return modelId as ClaudeModel;
  if (modelId.includes('haiku')) return ClaudeModel.Haiku;
  if (modelId.includes('opus')) return ClaudeModel.Opus;
  return ClaudeModel.Sonnet;
}

// ============================================================================
// Types
// ============================================================================

export type DocumentType = 'Contract' | 'Motion' | 'Letter' | 'Memo' | 'Pleading' | 'Other';
export type OutputFormat = 'markdown' | 'html';

export interface UserContext {
  userId: string;
  firmId: string;
}

export interface GenerateDocumentInput {
  type: DocumentType;
  caseId?: string;
  instructions: string;
  templateId?: string;
  context?: Record<string, unknown>;
  outputFormat?: OutputFormat;
  /** Enable web search for research documents */
  enableWebSearch?: boolean;
  /** Restrict web search to authoritative legal sources */
  legalSourcesOnly?: boolean;
}

// ============================================================================
// Web Search Tool Definition
// ============================================================================

const WEB_SEARCH_TOOL: AIToolDefinition = {
  name: 'web_search',
  description:
    'Caută pe internet pentru informații actuale, legislație, jurisprudență, sau bune practici. Folosește când ai nevoie de informații actualizate sau surse externe pentru documentare.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Interogarea de căutare - fii specific și include termeni juridici relevanți.',
      },
      legal_only: {
        type: 'boolean',
        description:
          'Restricționează rezultatele la surse juridice autorizate (legislatie.just.ro, scj.ro, eur-lex.europa.eu, etc.). Default: false.',
      },
    },
    required: ['query'],
  },
};

export interface GeneratedDocument {
  title: string;
  content: string;
  format: OutputFormat;
  suggestedFileName: string;
  documentType: DocumentType;
  tokensUsed?: number;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  description: string;
  documentType: DocumentType;
  isDefault: boolean;
}

// ============================================================================
// Service
// ============================================================================

export class DocumentGenerationService {
  /**
   * Generate a legal document using AI.
   * Supports optional web search for research documents.
   */
  async generateDocument(
    input: GenerateDocumentInput,
    userContext: UserContext
  ): Promise<GeneratedDocument> {
    const {
      type,
      caseId,
      instructions,
      templateId,
      context,
      outputFormat = 'markdown',
      enableWebSearch = false,
      legalSourcesOnly = false,
    } = input;
    const { userId, firmId } = userContext;

    // Get case context if caseId provided
    let caseContext = null;
    if (caseId) {
      caseContext = await this.gatherCaseContext(caseId, firmId);
    }

    // Get template if specified
    let template = null;
    if (templateId) {
      template = await this.getTemplateById(templateId, firmId);
    }

    // Build the prompt
    const prompt = this.buildPrompt({
      documentType: type,
      instructions,
      caseContext,
      template,
      additionalContext: context,
      outputFormat,
    });

    // Get configured model for document_extraction feature (used for document generation)
    const modelId = await getModelForFeature(firmId, 'document_extraction');

    // Use web search path if enabled
    if (enableWebSearch) {
      return this.generateWithWebSearch({
        prompt,
        systemPrompt: this.getSystemPrompt(type, true),
        modelId,
        type,
        outputFormat,
        legalSourcesOnly,
        userId,
        firmId,
      });
    }

    // Standard path without web search
    const modelOverride = modelIdToClaudeModel(modelId);

    // Call AI service
    const response = await aiService.generate({
      prompt,
      systemPrompt: this.getSystemPrompt(type),
      operationType: AIOperationType.TextGeneration,
      firmId,
      userId,
      modelOverride,
      maxTokens: 4000,
      temperature: 0.4,
      useCache: false,
    });

    // Parse response
    const parsed = this.parseResponse(response.content, type, outputFormat);

    return {
      title: parsed.title,
      content: parsed.content,
      format: outputFormat,
      suggestedFileName: this.generateFileName(parsed.title, type, outputFormat),
      documentType: type,
      tokensUsed: response.totalTokens,
    };
  }

  /**
   * Generate document with web search capability.
   * Uses chatWithTools for research documents.
   */
  private async generateWithWebSearch(params: {
    prompt: string;
    systemPrompt: string;
    modelId: string;
    type: DocumentType;
    outputFormat: OutputFormat;
    legalSourcesOnly: boolean;
    userId: string;
    firmId: string;
  }): Promise<GeneratedDocument> {
    const { prompt, systemPrompt, modelId, type, outputFormat, legalSourcesOnly, userId, firmId } =
      params;

    logger.info('Generating document with web search', {
      type,
      legalSourcesOnly,
      userId,
      firmId,
    });

    // Create web search tool handler
    const webSearchHandler: ToolHandler = async (input) => {
      const query = input.query as string;
      const legalOnly = (input.legal_only as boolean) ?? legalSourcesOnly;

      logger.debug('Web search tool called', { query, legalOnly });

      if (!webSearchService.isConfigured()) {
        return 'Web search is not configured. BRAVE_SEARCH_API_KEY environment variable is not set.';
      }

      const results = await webSearchService.search(query, {
        legalOnly,
        maxResults: 5,
      });

      return webSearchService.formatResultsForAI(results);
    };

    // Call AI with tools
    const response = await aiClient.chatWithTools(
      [{ role: 'user', content: prompt }],
      {
        feature: 'research_document',
        userId,
        firmId,
      },
      {
        model: modelId,
        maxTokens: 4000,
        temperature: 0.4,
        system: systemPrompt,
        tools: [WEB_SEARCH_TOOL],
        toolHandlers: {
          web_search: webSearchHandler,
        },
        maxToolRounds: 5,
      }
    );

    // Extract text content from response
    const textContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    // Parse response
    const parsed = this.parseResponse(textContent, type, outputFormat);

    logger.info('Research document generated', {
      type,
      tokensUsed: response.inputTokens + response.outputTokens,
      costEur: response.costEur,
    });

    return {
      title: parsed.title,
      content: parsed.content,
      format: outputFormat,
      suggestedFileName: this.generateFileName(parsed.title, type, outputFormat),
      documentType: type,
      tokensUsed: response.inputTokens + response.outputTokens,
    };
  }

  /**
   * Get available templates for a document type.
   */
  async getTemplates(type: DocumentType, firmId: string): Promise<DocumentTemplate[]> {
    // For now, return predefined templates
    // In the future, this can query a templates table
    const templates = this.getDefaultTemplates(type);
    return templates;
  }

  /**
   * Get a specific template by ID.
   */
  async getTemplateById(templateId: string, firmId: string): Promise<DocumentTemplate | null> {
    // For now, look up in predefined templates
    const allTemplates = [
      ...this.getDefaultTemplates('Contract'),
      ...this.getDefaultTemplates('Motion'),
      ...this.getDefaultTemplates('Letter'),
      ...this.getDefaultTemplates('Memo'),
      ...this.getDefaultTemplates('Pleading'),
    ];

    return allTemplates.find((t) => t.id === templateId) || null;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Gather case context for document generation
   */
  private async gatherCaseContext(
    caseId: string,
    firmId: string
  ): Promise<Record<string, unknown> | null> {
    const caseData = await prisma.case.findFirst({
      where: { id: caseId, firmId },
      include: {
        client: { select: { name: true, contactInfo: true } },
        actors: { select: { name: true, role: true } },
        teamMembers: {
          include: {
            user: { select: { firstName: true, lastName: true, email: true } },
          },
        },
      },
    });

    if (!caseData) {
      throw new GraphQLError('Case not found', {
        extensions: { code: 'NOT_FOUND' },
      });
    }

    return {
      caseNumber: caseData.caseNumber,
      title: caseData.title,
      status: caseData.status,
      type: caseData.type,
      client: caseData.client,
      actors: caseData.actors,
      teamMembers: caseData.teamMembers.map((tm) => ({
        name: `${tm.user.firstName} ${tm.user.lastName}`,
        role: tm.role,
        email: tm.user.email,
      })),
      referenceNumbers: caseData.referenceNumbers,
    };
  }

  /**
   * Get default templates for a document type
   */
  private getDefaultTemplates(type: DocumentType): DocumentTemplate[] {
    const templates: Record<DocumentType, DocumentTemplate[]> = {
      Contract: [
        {
          id: 'contract-standard',
          name: 'Contract Standard',
          description: 'Contract general cu clauze standard',
          documentType: 'Contract',
          isDefault: true,
        },
        {
          id: 'contract-services',
          name: 'Contract Prestări Servicii',
          description: 'Contract pentru servicii profesionale',
          documentType: 'Contract',
          isDefault: false,
        },
      ],
      Motion: [
        {
          id: 'motion-standard',
          name: 'Cerere Standard',
          description: 'Cerere generală către instanță',
          documentType: 'Motion',
          isDefault: true,
        },
        {
          id: 'motion-appeal',
          name: 'Cerere de Apel',
          description: 'Cerere de apel împotriva hotărârii',
          documentType: 'Motion',
          isDefault: false,
        },
      ],
      Letter: [
        {
          id: 'letter-formal',
          name: 'Scrisoare Formală',
          description: 'Scrisoare formală către client sau terți',
          documentType: 'Letter',
          isDefault: true,
        },
        {
          id: 'letter-notification',
          name: 'Notificare',
          description: 'Notificare juridică formală',
          documentType: 'Letter',
          isDefault: false,
        },
      ],
      Memo: [
        {
          id: 'memo-legal',
          name: 'Memoriu Juridic',
          description: 'Memoriu pentru analiză juridică internă',
          documentType: 'Memo',
          isDefault: true,
        },
      ],
      Pleading: [
        {
          id: 'pleading-standard',
          name: 'Act de Procedură Standard',
          description: 'Act de procedură pentru instanță',
          documentType: 'Pleading',
          isDefault: true,
        },
        {
          id: 'pleading-response',
          name: 'Întâmpinare',
          description: 'Răspuns la acțiune',
          documentType: 'Pleading',
          isDefault: false,
        },
      ],
      Other: [
        {
          id: 'other-general',
          name: 'Document General',
          description: 'Document juridic general',
          documentType: 'Other',
          isDefault: true,
        },
      ],
    };

    return templates[type] || [];
  }

  /**
   * Get system prompt based on document type
   * @param type - Document type
   * @param withWebSearch - Include web search instructions
   */
  private getSystemPrompt(type: DocumentType, withWebSearch = false): string {
    const basePrompt = `Ești un avocat cu experiență care redactează documente juridice în limba română.
Trebuie să generezi documente clare, profesionale și corecte din punct de vedere juridic.

Reguli generale:
- Folosește limbaj juridic corect și precis
- Respectă structura tradițională a documentelor juridice românești
- Include toate secțiunile necesare
- Menționează temeiurile legale relevante
- Păstrează un ton formal și profesional`;

    const webSearchPrompt = withWebSearch
      ? `

Instrucțiuni pentru cercetare:
- Ai acces la tool-ul web_search pentru a căuta informații actuale pe internet
- Folosește web_search când ai nevoie de legislație curentă, jurisprudență recentă, sau bune practici
- Când folosești rezultate din căutare, CITEAZĂ ÎNTOTDEAUNA sursele (include URL-urile)
- Verifică informațiile găsite și menționează dacă sunt incerte
- Folosește legal_only=true pentru surse juridice autorizate (legislatie.just.ro, scj.ro, eur-lex.europa.eu)`
      : '';

    const typeSpecificPrompts: Record<DocumentType, string> = {
      Contract: `${basePrompt}${webSearchPrompt}

Pentru contracte:
- Include părțile contractante cu date complete de identificare
- Definește clar obiectul contractului
- Specifică drepturile și obligațiile părților
- Include clauze de forță majoră și reziliere
- Adaugă clauze finale și modalități de soluționare a litigiilor`,

      Motion: `${basePrompt}${webSearchPrompt}

Pentru cereri:
- Adresează corect instanța competentă
- Identifică clar părțile (petent/intimat)
- Expune în fapt situația
- Prezintă argumentele în drept
- Formulează clar petitul`,

      Letter: `${basePrompt}${webSearchPrompt}

Pentru scrisori:
- Folosește format de scrisoare oficială
- Include antet și detalii de contact
- Expune clar scopul scrisorii
- Menține tonul profesional dar clar
- Include formulă de încheiere potrivită`,

      Memo: `${basePrompt}${webSearchPrompt}

Pentru memorii:
- Structurează analiza pe secțiuni clare
- Include rezumat executiv
- Analizează problemele juridice identificate
- Prezintă opțiuni și recomandări
- Concluzii și pași următori`,

      Pleading: `${basePrompt}${webSearchPrompt}

Pentru acte de procedură:
- Respectă formalitățile procedurale
- Identifică corect părțile și instanța
- Expune cronologic faptele relevante
- Prezintă temeiurile de drept
- Formulează petitul conform regulilor procedurale`,

      Other: `${basePrompt}${webSearchPrompt}`,
    };

    return typeSpecificPrompts[type] || `${basePrompt}${webSearchPrompt}`;
  }

  /**
   * Build prompt for document generation
   */
  private buildPrompt(params: {
    documentType: DocumentType;
    instructions: string;
    caseContext: Record<string, unknown> | null;
    template: DocumentTemplate | null;
    additionalContext?: Record<string, unknown>;
    outputFormat: OutputFormat;
  }): string {
    const { documentType, instructions, caseContext, template, additionalContext, outputFormat } =
      params;

    let prompt = `Generează un document de tip: ${documentType}\n\n`;

    if (template) {
      prompt += `Template selectat: ${template.name}\n${template.description}\n\n`;
    }

    prompt += `Instrucțiuni specifice:\n${instructions}\n\n`;

    if (caseContext) {
      prompt += `Context dosar:\n`;
      prompt += `- Număr dosar: ${caseContext.caseNumber}\n`;
      prompt += `- Titlu: ${caseContext.title}\n`;
      prompt += `- Status: ${caseContext.status}\n`;
      prompt += `- Tip: ${caseContext.type || 'Nedefinit'}\n`;

      const client = caseContext.client as { name?: string } | null;
      if (client?.name) {
        prompt += `- Client: ${client.name}\n`;
      }

      const actors = caseContext.actors as Array<{ name: string; role: string }> | null;
      if (actors && actors.length > 0) {
        prompt += `- Părți:\n`;
        actors.forEach((a) => {
          prompt += `  • ${a.name} (${a.role})\n`;
        });
      }

      const referenceNumbers = caseContext.referenceNumbers as string[] | null;
      if (referenceNumbers && referenceNumbers.length > 0) {
        prompt += `- Numere referință: ${referenceNumbers.join(', ')}\n`;
      }

      prompt += '\n';
    }

    if (additionalContext) {
      prompt += `Context suplimentar:\n${JSON.stringify(additionalContext, null, 2)}\n\n`;
    }

    prompt += `Format cerut: ${outputFormat}\n`;
    prompt += `\nGenerează documentul complet, gata de utilizare.`;
    prompt += `\n\nRăspunde cu un JSON valid în formatul:
{
  "title": "Titlul documentului",
  "content": "Conținutul complet al documentului în format ${outputFormat}"
}`;

    return prompt;
  }

  /**
   * Parse AI response
   */
  private parseResponse(
    content: string,
    type: DocumentType,
    format: OutputFormat
  ): { title: string; content: string } {
    try {
      // Try to extract JSON from potential markdown code blocks
      let jsonContent = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonContent);

      return {
        title: parsed.title || `Document ${type}`,
        content: parsed.content || content,
      };
    } catch {
      // If parsing fails, use the content as-is
      console.warn('[DocumentGeneration] Failed to parse JSON response, using raw content');
      return {
        title: `Document ${type}`,
        content,
      };
    }
  }

  /**
   * Generate filename for the document
   */
  private generateFileName(title: string, type: DocumentType, format: OutputFormat): string {
    const sanitizedTitle = title
      .toLowerCase()
      .replace(/[^a-z0-9ăâîșț\s-]/gi, '')
      .replace(/\s+/g, '-')
      .substring(0, 50);

    const extension = format === 'html' ? 'html' : 'md';
    const date = new Date().toISOString().split('T')[0];

    return `${sanitizedTitle}-${date}.${extension}`;
  }
}

// Export singleton instance
export const documentGenerationService = new DocumentGenerationService();
