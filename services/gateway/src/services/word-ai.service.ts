/**
 * Word AI Service
 * Handles AI operations for the Word add-in
 */

import type {
  WordSuggestionRequest,
  WordSuggestionResponse,
  WordAISuggestion,
  WordExplainRequest,
  WordExplainResponse,
  WordImproveRequest,
  WordImproveResponse,
  WordDraftRequest,
  WordDraftResponse,
  WordDraftFromTemplateRequest,
  WordDraftFromTemplateResponse,
} from '@legal-platform/types';
import { aiClient, getModelForFeature } from './ai-client.service';
import { caseContextFileService } from './case-context-file.service';
import { wordTemplateService } from './word-template.service';
import logger from '../utils/logger';
import { randomUUID } from 'crypto';

// ============================================================================
// System Prompts
// ============================================================================

const SYSTEM_PROMPTS = {
  suggest: `Ești un asistent juridic pentru o firmă de avocatură din România.
Ajuți avocații să redacteze documente juridice oferind sugestii contextuale.

Reguli:
- Generează text în limba română, folosind terminologia juridică corectă
- Adaptează tonul și stilul la contextul documentului
- Pentru sugestii de tip "precedent", referențiază coduri legale românești reale
- Fii precis și profesionist
- Returnează DOAR textul sugerat, fără explicații suplimentare`,

  explain: `Ești un asistent juridic care explică texte legale în limbaj simplu.

Reguli:
- Explică semnificația și implicațiile textului selectat
- Referențiază coduri legale românești relevante (Codul Civil, Codul de Procedură Civilă, etc.)
- Folosește un limbaj pe care non-juriștii îl pot înțelege
- Identifică riscuri sau implicații importante
- Răspunde întotdeauna în limba română`,

  improve: `Ești un editor juridic expert care îmbunătățește documente legale.

Tipuri de îmbunătățiri:
- clarity (claritate): Fă textul mai ușor de înțeles păstrând precizia juridică
- formality (formalitate): Crește tonul profesional juridic
- brevity (concizie): Fă textul mai concis fără a pierde sensul
- legal_precision (precizie juridică): Îmbunătățește acuratețea juridică și reduce ambiguitatea

Reguli:
- Păstrează intenția și sensul original
- Folosește terminologia juridică românească corectă
- Explică ce modificări ai făcut și de ce
- Răspunde întotdeauna în limba română`,

  draftFromTemplate: `Ești un expert în redactarea documentelor juridice pentru o firmă de avocatură din România.
Creezi documente profesionale bazate pe template-uri și contextul dosarului.

Reguli:
1. Folosește template-ul furnizat ca ghid structural
2. Completează placeholder-urile cu informații specifice dosarului
3. Adaptează limbajul la cerințele specifice ale dosarului
4. Menține stilul juridic profesional românesc
5. Include toate elementele formale necesare (antet, date, semnături)
6. Referențiază coduri legale românești relevante unde este cazul

Generează conținut complet, gata de utilizare.`,

  draft: `Ești un expert în redactarea documentelor juridice pentru o firmă de avocatură din România.
Creezi documente profesionale bazate pe contextul dosarului și instrucțiunile utilizatorului.

Reguli:
1. Analizează cu atenție contextul dosarului furnizat
2. Adaptează stilul și conținutul la tipul de document solicitat (indicat de numele documentului)
3. Folosește terminologia juridică românească corectă
4. Menține un stil profesional și clar
5. Include informații relevante din contextul dosarului (părți, termene, fapte)
6. Referențiază coduri legale românești relevante unde este cazul
7. Generează conținut complet și structurat

Generează documentul direct, fără explicații suplimentare.`,
};

// ============================================================================
// Service
// ============================================================================

export class WordAIService {
  /**
   * Get suggestions for text
   */
  async getSuggestions(
    request: WordSuggestionRequest,
    userId: string,
    firmId: string
  ): Promise<WordSuggestionResponse> {
    const startTime = Date.now();

    // Build context
    let caseContext = '';
    if (request.caseId) {
      const contextFile = await caseContextFileService.getContextFile(request.caseId, 'word_addin');
      if (contextFile) {
        caseContext = `\n\n## Context dosar\n${contextFile.content}`;
      }
    }

    // Build prompt based on suggestion type
    let userPrompt = '';
    switch (request.suggestionType) {
      case 'completion':
        userPrompt = `Continuă următorul text juridic în mod natural:

Context înconjurător:
"""
${request.cursorContext}
"""

Text de continuat:
"""
${request.selectedText}
"""
${caseContext}

Oferă 3 variante de continuare, fiecare pe o linie separată.`;
        break;

      case 'alternative':
        userPrompt = `Oferă reformulări alternative pentru următorul text juridic:

Text original:
"""
${request.selectedText}
"""
${caseContext}

Oferă 3 alternative, fiecare pe o linie separată.`;
        break;

      case 'precedent':
        userPrompt = `Identifică clauze sau formulări standard din legislația românească relevante pentru:

Text de referință:
"""
${request.selectedText}
"""
${caseContext}

Oferă 3 precedente sau formulări standard, fiecare cu sursa legală.`;
        break;
    }

    // Add custom instructions if provided
    if (request.customInstructions?.trim()) {
      userPrompt += `\n\nInstrucțiuni suplimentare de la utilizator:\n${request.customInstructions}`;
    }

    // Get configured model for this feature
    const model = await getModelForFeature(firmId, 'word_ai_suggest');

    // Call AI
    const response = await aiClient.complete(
      userPrompt,
      {
        feature: 'word_ai_suggest',
        userId,
        firmId,
      },
      {
        system: SYSTEM_PROMPTS.suggest,
        model,
        maxTokens: 1000,
        temperature: 0.7,
      }
    );

    // Parse suggestions from response
    const lines = response.content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0);

    const suggestions: WordAISuggestion[] = lines.slice(0, 3).map((content, index) => ({
      id: randomUUID(),
      type: request.suggestionType,
      content: content.replace(/^\d+\.\s*/, ''), // Remove leading numbers
      confidence: 0.9 - index * 0.1,
    }));

    return {
      suggestions,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Explain legal text
   */
  async explainText(
    request: WordExplainRequest,
    userId: string,
    firmId: string
  ): Promise<WordExplainResponse> {
    const startTime = Date.now();

    // Build context
    let caseContext = '';
    if (request.caseId) {
      const contextFile = await caseContextFileService.getContextFile(request.caseId, 'word_addin');
      if (contextFile) {
        caseContext = `\n\n## Context dosar\n${contextFile.content}`;
      }
    }

    let userPrompt = `Explică următorul text juridic în limbaj simplu:

Text de explicat:
"""
${request.selectedText}
"""
${caseContext}

Structurează răspunsul astfel:
1. EXPLICAȚIE: [explicația în limbaj simplu]
2. BAZA LEGALĂ: [referințele la coduri legale, dacă există]
3. IMPLICAȚII: [ce înseamnă acest text în practică]`;

    // Add custom instructions if provided
    if (request.customInstructions?.trim()) {
      userPrompt += `\n\nInstrucțiuni suplimentare de la utilizator:\n${request.customInstructions}`;
    }

    // Get configured model for this feature
    const model = await getModelForFeature(firmId, 'word_ai_explain');

    const response = await aiClient.complete(
      userPrompt,
      {
        feature: 'word_ai_explain',
        userId,
        firmId,
      },
      {
        system: SYSTEM_PROMPTS.explain,
        model,
        maxTokens: 1500,
        temperature: 0.3,
      }
    );

    // Parse response
    const content = response.content;
    const legalBasisMatch = content.match(/BAZA LEGALĂ:\s*([^\n]+(?:\n(?!IMPLICAȚII)[^\n]+)*)/i);

    return {
      explanation: content,
      legalBasis: legalBasisMatch?.[1]?.trim(),
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Improve text
   */
  async improveText(
    request: WordImproveRequest,
    userId: string,
    firmId: string
  ): Promise<WordImproveResponse> {
    const startTime = Date.now();

    const improvementLabels: Record<string, string> = {
      clarity: 'claritate',
      formality: 'formalitate',
      brevity: 'concizie',
      legal_precision: 'precizie juridică',
    };

    let userPrompt = `Îmbunătățește următorul text juridic pentru ${improvementLabels[request.improvementType]}:

Text original:
"""
${request.selectedText}
"""

Răspunde în formatul:
TEXT ÎMBUNĂTĂȚIT:
[textul îmbunătățit]

EXPLICAȚIE:
[ce ai modificat și de ce]`;

    // Add custom instructions if provided
    if (request.customInstructions?.trim()) {
      userPrompt += `\n\nInstrucțiuni suplimentare de la utilizator:\n${request.customInstructions}`;
    }

    // Get configured model for this feature
    const model = await getModelForFeature(firmId, 'word_ai_improve');

    const response = await aiClient.complete(
      userPrompt,
      {
        feature: 'word_ai_improve',
        userId,
        firmId,
      },
      {
        system: SYSTEM_PROMPTS.improve,
        model,
        maxTokens: 1500,
        temperature: 0.3,
      }
    );

    // Parse response
    const content = response.content;
    const improvedMatch = content.match(/TEXT ÎMBUNĂTĂȚIT:\s*\n?([\s\S]*?)(?=EXPLICAȚIE:|$)/i);
    const explanationMatch = content.match(/EXPLICAȚIE:\s*\n?([\s\S]*?)$/i);

    return {
      original: request.selectedText,
      improved: improvedMatch?.[1]?.trim() || content,
      explanation: explanationMatch?.[1]?.trim() || 'Textul a fost îmbunătățit.',
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Draft document content based on case context and user prompt
   */
  async draft(
    request: WordDraftRequest,
    userId: string,
    firmId: string
  ): Promise<WordDraftResponse> {
    const startTime = Date.now();

    // Get case context
    const contextFile = await caseContextFileService.getContextFile(request.caseId, 'word_addin');
    if (!contextFile) {
      throw new Error('Contextul dosarului nu este disponibil');
    }

    // Build prompt
    let userPrompt = `Generează conținut pentru un document juridic.

## Nume document
${request.documentName}

## Context dosar
${contextFile.content}

## Instrucțiuni
${request.prompt}`;

    // Add existing content if provided
    if (request.existingContent && request.existingContent.trim()) {
      userPrompt += `

## Conținut existent în document
Documentul conține deja următorul text (continuă de aici sau adaptează):
"""
${request.existingContent.substring(0, 2000)}
"""`;
    }

    userPrompt += '\n\nGenerează conținutul solicitat în limba română.';

    // Get configured model for word_draft feature
    const model = await getModelForFeature(firmId, 'word_draft');
    logger.debug('Using model for word_draft', { firmId, model });

    const response = await aiClient.complete(
      userPrompt,
      {
        feature: 'word_draft',
        userId,
        firmId,
        entityType: 'case',
        entityId: request.caseId,
      },
      {
        system: SYSTEM_PROMPTS.draft,
        model,
        maxTokens: 4000,
        temperature: 0.4,
      }
    );

    return {
      content: response.content,
      title: request.documentName,
      tokensUsed: response.inputTokens + response.outputTokens,
      processingTimeMs: Date.now() - startTime,
    };
  }

  /**
   * Draft document from template
   */
  async draftFromTemplate(
    request: WordDraftFromTemplateRequest,
    userId: string,
    firmId: string
  ): Promise<WordDraftFromTemplateResponse> {
    const startTime = Date.now();

    // Get template
    const template = await wordTemplateService.getTemplate(request.templateId, firmId);
    if (!template) {
      throw new Error('Template not found');
    }

    // Get case context
    const contextFile = await caseContextFileService.getContextFile(request.caseId, 'word_addin');
    if (!contextFile) {
      throw new Error('Case context not available');
    }

    // Build prompt
    let userPrompt = `Generează un document juridic complet bazat pe următorul template și context.

## Template: ${template.name}
${template.description ? `Descriere: ${template.description}` : ''}

${template.contentText ? `Structura template-ului:\n${template.contentText.substring(0, 3000)}` : ''}

## Context dosar
${contextFile.content}`;

    if (request.customInstructions) {
      userPrompt += `\n\n## Instrucțiuni suplimentare\n${request.customInstructions}`;
    }

    if (request.placeholderValues && Object.keys(request.placeholderValues).length > 0) {
      userPrompt += `\n\n## Valori specifice\n${Object.entries(request.placeholderValues)
        .map(([k, v]) => `- ${k}: ${v}`)
        .join('\n')}`;
    }

    userPrompt += '\n\nGenerează documentul complet în limba română.';

    // Get configured model for this feature
    const model = await getModelForFeature(firmId, 'word_ai_draft_from_template');

    const response = await aiClient.complete(
      userPrompt,
      {
        feature: 'word_ai_draft_from_template',
        userId,
        firmId,
        entityType: 'case',
        entityId: request.caseId,
      },
      {
        system: SYSTEM_PROMPTS.draftFromTemplate,
        model,
        maxTokens: 4000,
        temperature: 0.4,
      }
    );

    // Record template usage
    await wordTemplateService.recordUsage(template.id, userId, request.caseId);

    return {
      content: response.content,
      title: `${template.name} - Draft`,
      templateUsed: {
        id: template.id,
        name: template.name,
      },
      tokensUsed: response.inputTokens + response.outputTokens,
      processingTimeMs: Date.now() - startTime,
    };
  }
}

export const wordAIService = new WordAIService();
