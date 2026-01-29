/**
 * Contract Analysis Service
 * Handles contract analysis for premium mode in Word add-in.
 * Uses Opus 4.5 with extended thinking for deep analysis.
 */

import Anthropic from '@anthropic-ai/sdk';
import { aiClient, type AICallOptions } from './ai-client.service';
import logger from '../utils/logger';

// ============================================================================
// Types
// ============================================================================

export interface ClauseAlternative {
  id: string;
  label: 'Conservator' | 'Echilibrat' | 'Agresiv';
  description: string;
  text: string;
}

export interface ClauseAnalysis {
  id: string;
  clauseReference: string;
  clauseText: string;
  riskLevel: 'high' | 'medium' | 'low';
  reasoning: string;
  alternatives: ClauseAlternative[];
  cpcArticles: string[];
}

export interface ClarifyingQuestion {
  id: string;
  question: string;
  options: Array<{
    id: string;
    label: string;
    description: string;
  }>;
}

export interface ContractAnalysisResult {
  clauses: ClauseAnalysis[];
  clarifyingQuestions?: ClarifyingQuestion[];
  summary: {
    totalClauses: number;
    highRisk: number;
    mediumRisk: number;
    lowRisk: number;
  };
  thinkingBlocks: string[];
  processingTimeMs: number;
}

export interface ClauseResearchResult {
  legislation: Array<{
    title: string;
    article: string;
    relevance: string;
  }>;
  jurisprudence: Array<{
    court: string;
    decision: string;
    summary: string;
  }>;
  analysis: string;
  processingTimeMs: number;
}

// ============================================================================
// Prompts
// ============================================================================

const CONTRACT_ANALYSIS_PROMPT = `Ești un avocat expert în dreptul contractual românesc, specializat în analiza și evaluarea riscurilor contractuale.

MISIUNEA TA:
Analizează contractul furnizat și identifică clauzele problematice sau riscante pentru client.

CRITERII DE EVALUARE A RISCULUI:

**Risc RIDICAT (high):**
- Clauze care pot cauza pierderi financiare semnificative
- Clauze penale disproporționate (>20% din valoarea contractului)
- Limitări de răspundere care exonerează complet cealaltă parte
- Clauze de exclusivitate fără compensație adecvată
- Termene imposibil de respectat
- Clauze abuzive în sensul Legii 193/2000
- Încălcări ale dispozițiilor imperative din Codul Civil

**Risc MEDIU (medium):**
- Clauze ambigue care pot fi interpretate în defavoarea clientului
- Obligații dezechilibrate dar nu excesive
- Termene scurte dar realizabile
- Clauze standard dar negociabile pentru condiții mai bune
- Lipsa unor protecții uzuale (confidențialitate, forță majoră)

**Risc SCĂZUT (low):**
- Clauze standard care favorizează ușor cealaltă parte
- Formulări care ar putea fi îmbunătățite stilistic
- Sugestii de bune practici

PENTRU FIECARE CLAUZĂ PROBLEMATICĂ, FURNIZEAZĂ:
1. Referința clauzei (articol, alineat)
2. Textul exact al clauzei
3. Nivelul de risc (high/medium/low)
4. Explicația riscului (de ce este problematică)
5. Trei alternative cu nivele diferite de protecție:
   - Conservator: Modificare minimă, mai ușor de negociat
   - Echilibrat: Protecție adecvată, standard de piață
   - Agresiv: Maximă protecție pentru client
6. Articolele relevante din Codul Civil/CPC/legi speciale

RĂSPUNDE ÎN FORMAT JSON STRICT:
\`\`\`json
{
  "clauses": [
    {
      "id": "clause-1",
      "clauseReference": "Art. 5, alin. 2",
      "clauseText": "Textul exact al clauzei...",
      "riskLevel": "high|medium|low",
      "reasoning": "Explicație detaliată a riscului...",
      "alternatives": [
        {
          "id": "alt-1-conservator",
          "label": "Conservator",
          "description": "Ce modificare propune și de ce",
          "text": "Textul alternativ al clauzei..."
        },
        {
          "id": "alt-1-echilibrat",
          "label": "Echilibrat",
          "description": "Ce modificare propune și de ce",
          "text": "Textul alternativ al clauzei..."
        },
        {
          "id": "alt-1-agresiv",
          "label": "Agresiv",
          "description": "Ce modificare propune și de ce",
          "text": "Textul alternativ al clauzei..."
        }
      ],
      "cpcArticles": ["Art. 1270 Cod Civil", "Art. 1350 Cod Civil"]
    }
  ],
  "clarifyingQuestions": [
    {
      "id": "q-1",
      "question": "Care este rolul clientului în acest contract?",
      "options": [
        {"id": "opt-1", "label": "Prestator", "description": "Clientul furnizează serviciile"},
        {"id": "opt-2", "label": "Beneficiar", "description": "Clientul primește serviciile"}
      ]
    }
  ]
}
\`\`\`

IMPORTANT:
- Analizează ÎNTREGUL contract, nu doar primele clauze
- Prioritizează clauzele cu risc ridicat
- Fii specific în identificarea textului exact
- Oferă alternative practice, nu doar teoretice
- Citează articole de lege reale și relevante`;

const CLAUSE_RESEARCH_PROMPT = `Ești un cercetător juridic expert în dreptul românesc.
Analizează clauza contractuală și problema identificată.
Furnizează:
1. Legislație relevantă (Cod Civil, legi speciale, OUG-uri)
2. Jurisprudență relevantă (decizii ÎCCJ, curți de apel)
3. Analiză detaliată a implicațiilor

RĂSPUNDE ÎN FORMAT JSON STRICT:
\`\`\`json
{
  "legislation": [
    {
      "title": "Codul Civil",
      "article": "Art. 1270 - Forța obligatorie",
      "relevance": "Explicație cum se aplică la clauza analizată..."
    }
  ],
  "jurisprudence": [
    {
      "court": "ÎCCJ - Secția a II-a civilă",
      "decision": "Decizia nr. 1234/2023",
      "summary": "Rezumatul relevant pentru clauza analizată..."
    }
  ],
  "analysis": "Analiză detaliată a implicațiilor clauzei în contextul legislației și jurisprudenței identificate..."
}
\`\`\``;

// ============================================================================
// Service
// ============================================================================

class ContractAnalysisService {
  private readonly OPUS_MODEL = 'claude-opus-4-5-20251101';
  private readonly THINKING_BUDGET = 10000;

  /**
   * Analyze a contract for risky clauses.
   * Uses Opus 4.5 with extended thinking for thorough analysis.
   */
  async analyzeContract(
    documentContent: string,
    options: AICallOptions,
    caseId?: string,
    clientId?: string
  ): Promise<ContractAnalysisResult> {
    const startTime = Date.now();

    logger.info('[ContractAnalysis] Starting contract analysis', {
      contentLength: documentContent.length,
      caseId,
      clientId,
    });

    const response = await aiClient.chat(
      [
        {
          role: 'user',
          content: `Analizează următorul contract și identifică clauzele problematice:\n\n${documentContent}`,
        },
      ],
      {
        ...options,
        feature: 'contract_analysis',
        entityType: caseId ? 'case' : clientId ? 'client' : undefined,
        entityId: caseId || clientId,
      },
      {
        model: this.OPUS_MODEL,
        maxTokens: 16000,
        system: CONTRACT_ANALYSIS_PROMPT,
        thinking: {
          enabled: true,
          budgetTokens: this.THINKING_BUDGET,
        },
      }
    );

    // Extract thinking blocks
    const thinkingBlocks = this.extractThinkingBlocks(response.content);

    // Extract text content
    const textContent = this.extractTextContent(response.content);

    // Parse the JSON response
    const analysis = this.parseAnalysisResponse(textContent);

    const processingTimeMs = Date.now() - startTime;

    logger.info('[ContractAnalysis] Analysis complete', {
      clausesFound: analysis.clauses.length,
      processingTimeMs,
    });

    return {
      ...analysis,
      thinkingBlocks,
      processingTimeMs,
    };
  }

  /**
   * Research a specific clause for legislation and jurisprudence.
   */
  async researchClause(
    clauseText: string,
    issue: string,
    options: AICallOptions,
    caseId?: string
  ): Promise<ClauseResearchResult> {
    const startTime = Date.now();

    logger.info('[ContractAnalysis] Researching clause', {
      clauseLength: clauseText.length,
      issue,
    });

    const response = await aiClient.chat(
      [
        {
          role: 'user',
          content: `Clauza:\n"${clauseText}"\n\nProblema identificată:\n${issue}\n\nCercetează legislația și jurisprudența relevantă.`,
        },
      ],
      {
        ...options,
        feature: 'clause_research',
        entityType: caseId ? 'case' : undefined,
        entityId: caseId,
      },
      {
        model: this.OPUS_MODEL,
        maxTokens: 8000,
        system: CLAUSE_RESEARCH_PROMPT,
        thinking: {
          enabled: true,
          budgetTokens: 5000,
        },
      }
    );

    const textContent = this.extractTextContent(response.content);
    const research = this.parseResearchResponse(textContent);

    return {
      ...research,
      processingTimeMs: Date.now() - startTime,
    };
  }

  private extractThinkingBlocks(content: Anthropic.ContentBlock[]): string[] {
    const blocks: string[] = [];
    for (const block of content) {
      if (block.type === 'thinking') {
        blocks.push((block as Anthropic.ThinkingBlock).thinking);
      }
    }
    return blocks;
  }

  private extractTextContent(content: Anthropic.ContentBlock[]): string {
    for (const block of content) {
      if (block.type === 'text') {
        return (block as Anthropic.TextBlock).text;
      }
    }
    return '';
  }

  private parseAnalysisResponse(
    content: string
  ): Omit<ContractAnalysisResult, 'thinkingBlocks' | 'processingTimeMs'> {
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const json = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        const clauses: ClauseAnalysis[] = (json.clauses || []).map(
          (c: Record<string, unknown>, i: number) => ({
            id: (c.id as string) || `clause-${i}`,
            clauseReference:
              (c.clauseReference as string) || (c.reference as string) || `Clauza ${i + 1}`,
            clauseText: (c.clauseText as string) || (c.text as string) || '',
            riskLevel: (c.riskLevel as string) || (c.risk as string) || 'medium',
            reasoning: (c.reasoning as string) || (c.rationale as string) || '',
            alternatives: ((c.alternatives as Array<Record<string, unknown>>) || []).map(
              (a: Record<string, unknown>, j: number) => ({
                id: (a.id as string) || `alt-${i}-${j}`,
                label: (a.label as ClauseAlternative['label']) || 'Echilibrat',
                description: (a.description as string) || '',
                text: (a.text as string) || '',
              })
            ),
            cpcArticles:
              (c.cpcArticles as string[]) || (c.articles as string[]) || ([] as string[]),
          })
        );

        return {
          clauses,
          clarifyingQuestions: json.clarifyingQuestions as ClarifyingQuestion[] | undefined,
          summary: {
            totalClauses: clauses.length,
            highRisk: clauses.filter((c) => c.riskLevel === 'high').length,
            mediumRisk: clauses.filter((c) => c.riskLevel === 'medium').length,
            lowRisk: clauses.filter((c) => c.riskLevel === 'low').length,
          },
        };
      }
    } catch (e) {
      logger.warn('[ContractAnalysis] Failed to parse JSON response', { error: e });
    }

    // Return empty result if parsing fails
    return {
      clauses: [],
      summary: { totalClauses: 0, highRisk: 0, mediumRisk: 0, lowRisk: 0 },
    };
  }

  private parseResearchResponse(content: string): Omit<ClauseResearchResult, 'processingTimeMs'> {
    try {
      const jsonMatch = content.match(/```json\n?([\s\S]*?)\n?```/) || content.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const json = JSON.parse(jsonMatch[1] || jsonMatch[0]);
        return {
          legislation: (json.legislation as ClauseResearchResult['legislation']) || [],
          jurisprudence: (json.jurisprudence as ClauseResearchResult['jurisprudence']) || [],
          analysis: (json.analysis as string) || content,
        };
      }
    } catch (e) {
      logger.warn('[ContractAnalysis] Failed to parse research JSON', { error: e });
    }

    return {
      legislation: [],
      jurisprudence: [],
      analysis: content,
    };
  }
}

export const contractAnalysisService = new ContractAnalysisService();
