import Anthropic from '@anthropic-ai/sdk';
import type { SlotDefinition } from '@/types/mapa';

// Lazy-initialize Anthropic client to ensure env var is loaded
let anthropicClient: Anthropic | null = null;

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

export interface AIAnalysisResult {
  slots: SlotDefinition[];
  procedureSummary: string;
  legalContext: string;
  warnings: string[];
  confidence: number;
}

export interface RawDocumentItem {
  text: string;
  isConditional: boolean;
  originalIndex: number;
}

/**
 * System prompt for ONRC document analysis
 */
const ONRC_ANALYSIS_SYSTEM_PROMPT = `You are a Romanian legal expert specializing in commercial law and company registration procedures with ONRC (Oficiul National al Registrului Comertului).

Your task is to analyze scraped HTML content from ONRC.ro and extract accurate, structured information about required documents for various company procedures.

Key knowledge areas:
- Romanian company law (Legea 31/1990, Legea 26/1990)
- ONRC registration and modification procedures
- Document types: cereri (applications), declarații (declarations), acte constitutive (constitutional documents), hotărâri AGA (shareholder resolutions)
- Conditional documents marked with "Dacă este cazul" (If applicable)

Document categories you should use:
- formulare: Official forms and applications
- acte_constitutive: Constitutional documents (statutes, bylaws, amendments)
- identitate: Identity documents (CI, passport)
- declaratii: Declarations and affidavits
- sediu: Registered office documentation
- financiar: Financial documents (bank statements, capital proofs)
- hotarari: Shareholder decisions and resolutions
- certificate: Certificates from various authorities
- contracte: Contracts (lease, transfer, etc.)
- taxe: Fees and tariffs documentation
- daca_este_cazul: Conditional/optional documents
- diverse: Other documents

IMPORTANT:
- Preserve Romanian legal terminology accurately
- Distinguish between mandatory (required: true) and conditional (required: false) documents
- Documents in "Dacă este cazul" sections are conditional
- Add helpful descriptions that clarify document purpose
- Consider typical lawyer/notary requirements beyond base ONRC requirements`;

/**
 * Analyze raw HTML content and extract structured document requirements using AI
 */
export async function analyzeONRCContent(
  procedureId: string,
  procedureName: string,
  rawHtml: string,
  extractedItems: RawDocumentItem[]
): Promise<AIAnalysisResult> {
  const userPrompt = buildAnalysisPrompt(procedureId, procedureName, rawHtml, extractedItems);

  try {
    const message = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      system: ONRC_ANALYSIS_SYSTEM_PROMPT,
    });

    // Extract text content from response
    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    return parseAIResponse(responseText, extractedItems);
  } catch (error) {
    console.error('AI analysis failed:', error);
    // Return fallback using original extraction
    return createFallbackResult(extractedItems);
  }
}

/**
 * Build the analysis prompt with context
 */
function buildAnalysisPrompt(
  procedureId: string,
  procedureName: string,
  rawHtml: string,
  extractedItems: RawDocumentItem[]
): string {
  // Truncate HTML if too long
  const truncatedHtml =
    rawHtml.length > 20000 ? rawHtml.substring(0, 20000) + '...[truncated]' : rawHtml;

  const hasPreExtracted = extractedItems.length > 0;
  const itemsList = hasPreExtracted
    ? extractedItems
        .map((item, i) => `${i + 1}. ${item.text}${item.isConditional ? ' [CONDITIONAL]' : ''}`)
        .join('\n')
    : '(No items pre-extracted - please analyze the HTML directly)';

  return `Analyze this ONRC procedure page and extract accurate document requirements.

## IMPORTANT: Page Structure
This page may be a CATEGORY page listing MULTIPLE procedures. You must find and analyze ONLY the procedure named "${procedureName}" (ID: ${procedureId}).

Look for:
- Headings or sections matching "${procedureName}"
- Numbered lists of documents under that specific procedure
- "Dacă este cazul" (if applicable) sections for conditional documents

## Procedure to Analyze
- ID: ${procedureId}
- Name: ${procedureName}

## Pre-extracted Items (from HTML parsing)
${itemsList}

## Raw HTML Content
\`\`\`html
${truncatedHtml}
\`\`\`

## Your Task
1. Locate the section for "${procedureName}" in the HTML
2. Extract ALL document requirements for this specific procedure
3. For each document, determine:
   - Accurate name (preserve Romanian legal terminology)
   - Helpful description explaining the document's purpose
   - Correct category from the allowed list
   - Whether it's required or conditional (items in "Dacă este cazul" are conditional)
4. Typical documents for ONRC procedures include:
   - Cerere de înregistrare (registration application)
   - Act constitutiv / Statut (articles of incorporation)
   - Acte de identitate (identity documents)
   - Declarații pe propria răspundere (affidavits)
   - Dovada sediului social (proof of registered office)
   - Hotărâre AGA (shareholders resolution)
   - Specimen de semnătură (signature specimen)

## Response Format
Respond in JSON format:
\`\`\`json
{
  "slots": [
    {
      "name": "Document name in Romanian",
      "description": "Brief explanation of document purpose",
      "category": "category_id",
      "required": true,
      "order": 1
    }
  ],
  "procedureSummary": "Brief summary of this procedure",
  "legalContext": "Relevant legal references and notes",
  "warnings": ["Any issues or ambiguities found"],
  "confidence": 0.95
}
\`\`\`

If you cannot find specific information for "${procedureName}", provide a reasonable set of typical documents for this type of procedure based on your knowledge of Romanian commercial law.

Ensure the JSON is valid and complete.`;
}

/**
 * Parse AI response into structured result
 */
function parseAIResponse(responseText: string, fallbackItems: RawDocumentItem[]): AIAnalysisResult {
  try {
    // Extract JSON from response (might be wrapped in markdown code blocks)
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) ||
      responseText.match(/```\s*([\s\S]*?)\s*```/) || [null, responseText];

    const jsonStr = jsonMatch[1] || responseText;
    const parsed = JSON.parse(jsonStr.trim());

    // Validate and normalize slots
    const slots: SlotDefinition[] = (parsed.slots || [])
      .map((slot: Record<string, unknown>, index: number) => ({
        name: String(slot.name || '').trim(),
        description: slot.description ? String(slot.description).trim() : undefined,
        category: validateCategory(String(slot.category || 'diverse')),
        required: Boolean(slot.required),
        order: typeof slot.order === 'number' ? slot.order : index + 1,
      }))
      .filter((slot: SlotDefinition) => slot.name.length > 0);

    return {
      slots,
      procedureSummary: String(parsed.procedureSummary || ''),
      legalContext: String(parsed.legalContext || ''),
      warnings: Array.isArray(parsed.warnings) ? parsed.warnings.map(String) : [],
      confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.8,
    };
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    return createFallbackResult(fallbackItems);
  }
}

/**
 * Validate category against allowed values
 */
const VALID_CATEGORIES = [
  'formulare',
  'acte_constitutive',
  'identitate',
  'declaratii',
  'sediu',
  'financiar',
  'hotarari',
  'certificate',
  'contracte',
  'taxe',
  'daca_este_cazul',
  'diverse',
];

function validateCategory(category: string): string {
  const normalized = category.toLowerCase().trim();
  return VALID_CATEGORIES.includes(normalized) ? normalized : 'diverse';
}

/**
 * Create fallback result from raw extracted items
 */
function createFallbackResult(items: RawDocumentItem[]): AIAnalysisResult {
  const slots: SlotDefinition[] = items.map((item, index) => ({
    name: capitalizeFirst(item.text.split(/[;,–-]/)[0].trim()),
    description: undefined,
    category: item.isConditional ? 'daca_este_cazul' : 'diverse',
    required: !item.isConditional,
    order: index + 1,
  }));

  return {
    slots,
    procedureSummary: '',
    legalContext: '',
    warnings: ['AI analysis failed - using basic extraction'],
    confidence: 0.5,
  };
}

function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Enrich existing slot definitions with better descriptions and categorization
 */
export async function enrichSlotDefinitions(
  procedureName: string,
  slots: SlotDefinition[]
): Promise<SlotDefinition[]> {
  if (slots.length === 0) return slots;

  const slotList = slots
    .map((s, i) => `${i + 1}. ${s.name} (current category: ${s.category}, required: ${s.required})`)
    .join('\n');

  try {
    const message = await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      messages: [
        {
          role: 'user',
          content: `For the ONRC procedure "${procedureName}", enrich these document requirements with better descriptions and verify categorization:

${slotList}

Respond in JSON format:
\`\`\`json
{
  "enrichedSlots": [
    {
      "originalName": "Original name",
      "name": "Possibly improved name",
      "description": "Helpful description explaining what this document is and why it's needed",
      "category": "verified_category",
      "required": true,
      "order": 1
    }
  ]
}
\`\`\`

Guidelines:
- Keep original Romanian terminology
- Add descriptions that help lawyers understand requirements
- Verify category assignments
- Flag any documents that seem incorrect for this procedure`,
        },
      ],
      system: ONRC_ANALYSIS_SYSTEM_PROMPT,
    });

    const responseText = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map((block) => block.text)
      .join('');

    // Parse and merge enrichments
    const jsonMatch = responseText.match(/```json\s*([\s\S]*?)\s*```/) || [null, responseText];
    const parsed = JSON.parse((jsonMatch[1] || responseText).trim());

    if (Array.isArray(parsed.enrichedSlots)) {
      return parsed.enrichedSlots.map((enriched: Record<string, unknown>, index: number) => ({
        name: String(enriched.name || slots[index]?.name || ''),
        description: enriched.description
          ? String(enriched.description)
          : slots[index]?.description,
        category: validateCategory(
          String(enriched.category || slots[index]?.category || 'diverse')
        ),
        required:
          typeof enriched.required === 'boolean'
            ? enriched.required
            : (slots[index]?.required ?? true),
        order: typeof enriched.order === 'number' ? enriched.order : index + 1,
      }));
    }

    return slots;
  } catch (error) {
    console.error('Failed to enrich slots:', error);
    return slots;
  }
}

/**
 * Validate if AI service is available
 */
export async function isAIServiceAvailable(): Promise<boolean> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return false;
  }

  try {
    // Simple test call
    await getAnthropicClient().messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'test' }],
    });
    return true;
  } catch {
    return false;
  }
}
