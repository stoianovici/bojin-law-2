/**
 * Prompt Injector
 *
 * Injects schema requirements into AI prompts for consistent document generation.
 * Builds system prompts and user prompt additions based on schema configuration.
 */

import type { DocumentSchema, SectionDefinition } from './document-schema.types';

// ============================================================================
// Types
// ============================================================================

/**
 * Options for building a prompt.
 */
export interface PromptBuildOptions {
  /** Document name from user */
  documentName: string;

  /** User's instructions/prompt */
  userPrompt: string;

  /** Additional context (e.g., case context) */
  context?: string;

  /** Target word count (for research docs) */
  targetWordCount?: number;

  /** Source types to include (for research docs) */
  sourceTypes?: string[];
}

/**
 * Result of building a prompt.
 */
export interface BuiltPrompt {
  /** System prompt with schema requirements */
  systemPrompt: string;

  /** Enhanced user prompt with structure guidance */
  userPrompt: string;
}

// ============================================================================
// Prompt Injector Class
// ============================================================================

export class PromptInjector {
  /**
   * Build prompts with schema requirements injected.
   *
   * @param schema - The document schema to apply
   * @param options - Build options
   * @returns Built prompts ready for AI call
   */
  build(schema: DocumentSchema, options: PromptBuildOptions): BuiltPrompt {
    const systemPrompt = this.buildSystemPrompt(schema, options);
    const userPrompt = this.buildUserPrompt(schema, options);

    return { systemPrompt, userPrompt };
  }

  /**
   * Build the system prompt with schema requirements.
   */
  private buildSystemPrompt(schema: DocumentSchema, options: PromptBuildOptions): string {
    const parts: string[] = [];

    // Add current date
    parts.push(
      `Data curentă: ${new Date().toLocaleDateString('ro-RO', { day: 'numeric', month: 'long', year: 'numeric' })}.`
    );

    // Add base instruction
    parts.push(`
## PRINCIPIU FUNDAMENTAL

Instrucțiunile utilizatorului sunt AUTORITATIVE. Respectă-le întocmai.
Avocații formulează cereri precise. NU interpreta, NU extinde, NU substitui. Execută fidel.`);

    // Add domain knowledge if available
    if (schema.promptConfig.domainKnowledge) {
      parts.push(schema.promptConfig.domainKnowledge);
    }

    // Add structure requirements if schema requires it
    if (schema.promptConfig.injectInSystemPrompt) {
      parts.push(this.buildStructureRequirements(schema, options));
    }

    // Add formatting instructions based on detail level
    parts.push(this.buildFormattingInstructions(schema));

    // Add custom prompt additions if any
    if (schema.promptConfig.customPromptAdditions) {
      parts.push(schema.promptConfig.customPromptAdditions);
    }

    return parts.join('\n\n');
  }

  /**
   * Build structure requirements section.
   */
  private buildStructureRequirements(schema: DocumentSchema, options: PromptBuildOptions): string {
    const { structure } = schema;
    const parts: string[] = ['## CERINȚE STRUCTURALE'];

    // Heading hierarchy
    const { headingHierarchy } = structure;
    if (headingHierarchy.requireH1) {
      parts.push(`- Document TREBUIE să aibă un titlu H1`);
    }
    if (headingHierarchy.h1Count === 'single') {
      parts.push(`- Un SINGUR H1 în document (titlul principal)`);
    }
    parts.push(`- Maximum ${headingHierarchy.maxDepth} niveluri de heading-uri`);

    // Required sections
    const requiredSections = structure.sections.filter((s) => s.required);
    if (requiredSections.length > 0) {
      parts.push('');
      parts.push('### Secțiuni obligatorii:');
      for (const section of requiredSections.sort((a, b) => a.order - b.order)) {
        const headingTag = `H${section.headingLevel}`;
        parts.push(`- ${section.name} (${headingTag})`);
      }
    }

    // Citations
    if (structure.citations.required) {
      parts.push('');
      parts.push('### Citări:');
      parts.push(`- Minimum ${structure.citations.minCount || 5} citări`);
      parts.push(`- Format: ${structure.citations.format}`);
      if (structure.citations.requireSourcesBlock) {
        parts.push(`- Bloc <sources> obligatoriu la final`);
      }
    }

    // Word count if specified
    if (options.targetWordCount) {
      parts.push('');
      parts.push(`### Lungime document: ~${options.targetWordCount} cuvinte`);
    }

    return parts.join('\n');
  }

  /**
   * Build formatting instructions based on detail level.
   */
  private buildFormattingInstructions(schema: DocumentSchema): string {
    const level = schema.promptConfig.formattingInstructions;

    if (level === 'minimal') {
      return `## FORMAT OUTPUT
Returnează documentul în format HTML semantic.`;
    }

    if (level === 'standard') {
      return `## FORMAT OUTPUT (HTML SEMANTIC)

Generează documentul în format HTML semantic, nu markdown.
Structură: <article> conține întregul document.
Titluri: <h1> pentru titlu principal, <h2>/<h3> pentru secțiuni.
Paragrafe: <p> pentru text, <strong> pentru bold, <em> pentru italic.
Liste: <ul>/<ol> cu <li> pentru enumerări.
Citate: <blockquote> pentru referințe legale.
NU folosi stiluri inline, clase CSS, sau atribute de stil.
Returnează DOAR <article>...</article>.`;
    }

    // detailed
    return `## FORMAT OUTPUT (HTML SEMANTIC)

Generează documentul în format HTML semantic, nu markdown.

### Structură
- <article> conține întregul document
- <h1> pentru titlu principal (un singur H1)
- <h2>, <h3>, <h4> pentru subsecțiuni

### Elemente text
- <p> pentru paragrafe
- <strong> pentru text bold (părți, termeni importanți)
- <em> pentru text italic (citate legale, termeni latini)
- <ul>/<ol> cu <li> pentru liste

### Elemente speciale
- <blockquote> pentru citate din legislație
- <aside class="note|important|definition"> pentru callout-uri
- <table> pentru date tabulare

### Citări (dacă sunt necesare)
- În text: <ref id="srcN"/>
- La final: bloc <sources> cu definiții sursă

### Reguli
- NU folosi stiluri inline
- NU folosi clase CSS (cu excepția aside)
- NU include comentarii HTML
- Returnează DOAR <article>...</article>`;
  }

  /**
   * Build the enhanced user prompt.
   */
  private buildUserPrompt(schema: DocumentSchema, options: PromptBuildOptions): string {
    const parts: string[] = [];

    // Document header
    parts.push(`Creează documentul juridic solicitat.`);
    parts.push('');
    parts.push(`## DOCUMENT: ${options.documentName}`);

    // User instructions
    parts.push('');
    parts.push(`## INSTRUCȚIUNI DE LA UTILIZATOR`);
    parts.push(options.userPrompt);

    // Context if provided
    if (options.context) {
      parts.push('');
      parts.push(options.context);
    }

    // Source types for research
    if (options.sourceTypes && options.sourceTypes.length > 0) {
      parts.push('');
      parts.push(`## TIPURI DE SURSE`);
      parts.push(`Cercetează surse de tip: ${options.sourceTypes.join(', ')}`);
    }

    // Add final instruction based on schema category
    parts.push('');
    if (schema.category === 'research') {
      parts.push('Returnează DOAR HTML semantic valid, de la <article> la </article>.');
      parts.push('Include bloc <sources> la final cu toate sursele citate.');
    } else if (schema.category === 'notification') {
      parts.push('Returnează DOAR HTML semantic valid, de la <article> la </article>.');
      parts.push('Include toate elementele juridice necesare pentru valabilitatea notificării.');
    } else {
      parts.push('Returnează documentul complet în format HTML semantic.');
    }

    return parts.join('\n');
  }

  /**
   * Get a human-readable description of required sections.
   */
  getSectionDescription(sections: SectionDefinition[]): string {
    const required = sections.filter((s) => s.required);
    const optional = sections.filter((s) => !s.required);

    const parts: string[] = [];

    if (required.length > 0) {
      parts.push('Obligatorii: ' + required.map((s) => s.name).join(', '));
    }

    if (optional.length > 0) {
      parts.push('Opționale: ' + optional.map((s) => s.name).join(', '));
    }

    return parts.join('. ');
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/**
 * Global prompt injector instance.
 */
export const promptInjector = new PromptInjector();
