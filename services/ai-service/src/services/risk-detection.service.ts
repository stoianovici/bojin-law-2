/**
 * Risk Detection Service
 * Story 5.2: Communication Intelligence Engine
 *
 * Detects risk indicators from email content:
 * - Client dissatisfaction signals
 * - Deadline risks
 * - Scope creep indicators
 * - Payment risks
 * - Relationship risks
 *
 * [Source: docs/architecture/external-apis.md#anthropic-claude-api]
 */

import { AIOperationType, ClaudeModel, TaskComplexity } from '@legal-platform/types';
import { providerManager, ProviderRequest } from './provider-manager.service';
import { modelRouter } from './model-router.service';
import { tokenTracker } from './token-tracker.service';

// ============================================================================
// Types
// ============================================================================

export type RiskType =
  | 'ClientDissatisfaction'
  | 'DeadlineRisk'
  | 'ScopeCreep'
  | 'PaymentRisk'
  | 'RelationshipRisk';

export type RiskSeverity = 'Low' | 'Medium' | 'High';

export interface EmailForRiskAnalysis {
  id: string;
  subject: string;
  bodyContent: string;
  from: { name?: string; address: string };
  toRecipients: Array<{ name?: string; address: string }>;
  receivedDateTime: Date;
  isFromClient?: boolean;
}

export interface ThreadContext {
  recentEmails: EmailForRiskAnalysis[];
  hasPaymentDiscussions: boolean;
  hasScopeChanges: boolean;
  clientSentimentHistory?: string[];
}

export interface RiskIndicatorResult {
  type: RiskType;
  severity: RiskSeverity;
  description: string;
  evidence: string;
  suggestedAction?: string;
}

export interface RiskDetectionResult {
  emailId: string;
  risks: RiskIndicatorResult[];
  overallRiskLevel: RiskSeverity;
  tokensUsed: number;
  processingTimeMs: number;
}

// ============================================================================
// Constants
// ============================================================================

const RISK_DETECTION_SYSTEM_PROMPT = `You are an AI risk analyst for a Romanian law firm.
Your task is to identify potential risks in email communications from clients and other parties.

IMPORTANT: Răspunde în limba română. Toate descrierile riscurilor, dovezile și acțiunile sugerate trebuie să fie în română.

Analyze the email content for these risk categories:

1. CLIENT DISSATISFACTION
   - Indicators: "unhappy", "disappointed", "unacceptable", "not what we expected"
   - Romanian: "nemulțumit", "dezamăgit", "inacceptabil", "nu este ceea ce ne așteptam"
   - Tone: Negative sentiment, complaints, frustration
   - Severity:
     * High: Explicit threats to leave, formal complaints
     * Medium: Clear dissatisfaction expressed
     * Low: Mild concerns or questions

2. DEADLINE RISK
   - Indicators: Tight timelines, impossible deadlines, missed deadlines mentioned
   - Look for: "urgent", "immediately", "overdue", "termen depășit"
   - Severity:
     * High: Court deadlines at risk, critical business deadlines
     * Medium: Important but not critical deadlines
     * Low: Flexible deadlines with pressure

3. SCOPE CREEP
   - Indicators: Requests outside original engagement, "could you also...", "one more thing"
   - Romanian: "am mai avea nevoie de...", "puteți să ne ajutați și cu..."
   - Severity:
     * High: Major new work area, significant additional hours
     * Medium: Related but additional work
     * Low: Minor additions or clarifications

4. PAYMENT RISK
   - Indicators: Billing disputes, payment delays, budget concerns
   - Look for: "invoice", "payment", "budget", "cost", "factură", "plată", "buget"
   - Severity:
     * High: Refusal to pay, significant disputes
     * Medium: Payment delays, negotiation attempts
     * Low: Questions about billing, budget concerns

5. RELATIONSHIP RISK
   - Indicators: Threats to terminate, competition mentions, communication breakdown
   - Look for: "termination", "other firms", "reconsidering", "alte firme", "reziliere"
   - Severity:
     * High: Explicit termination threats, engaging competitors
     * Medium: Dissatisfaction with relationship, communication issues
     * Low: Comparison shopping, routine contract review

Rules:
- Only flag genuine risks, not routine communications
- Include direct quotes as evidence
- Provide actionable suggestions when possible
- Be culturally aware of Romanian business communication styles
- Consider context from thread history if provided

Respond ONLY with valid JSON:
{
  "risks": [
    {
      "type": "ClientDissatisfaction|DeadlineRisk|ScopeCreep|PaymentRisk|RelationshipRisk",
      "severity": "Low|Medium|High",
      "description": "What the risk is",
      "evidence": "Direct quote from email",
      "suggestedAction": "What to do about it (optional)"
    }
  ],
  "overallRiskLevel": "Low|Medium|High"
}

If no risks are found, return: { "risks": [], "overallRiskLevel": "Low" }`;

// ============================================================================
// Risk Detection Service
// ============================================================================

export class RiskDetectionService {
  /**
   * Detect risks in a single email (AC: 6)
   *
   * @param email - Email to analyze
   * @param threadContext - Optional context from thread history
   * @param userId - User ID for token tracking
   * @param firmId - Firm ID for token tracking
   * @returns Risk indicators with severity
   */
  async detectRisks(
    email: EmailForRiskAnalysis,
    threadContext: Partial<ThreadContext> | undefined,
    userId: string,
    firmId: string
  ): Promise<RiskDetectionResult> {
    const startTime = Date.now();

    // Build the prompt with email content
    const prompt = this.buildRiskDetectionPrompt(email, threadContext);

    // Route to appropriate model (Sonnet for nuanced analysis)
    const routing = modelRouter.selectModel({
      operationType: AIOperationType.RiskAnalysis,
      complexity: TaskComplexity.Standard,
    });

    // Make API request
    const request: ProviderRequest = {
      systemPrompt: RISK_DETECTION_SYSTEM_PROMPT,
      prompt,
      model: routing.model as ClaudeModel,
      maxTokens: 1500,
      temperature: 0.2,
    };

    try {
      const response = await providerManager.execute(request);
      const result = this.parseRiskResponse(response.content, email.id);

      // Track token usage
      const tokensUsed = response.inputTokens + response.outputTokens;
      await tokenTracker.recordUsage({
        userId,
        firmId,
        operationType: AIOperationType.RiskAnalysis,
        modelUsed: response.model,
        inputTokens: response.inputTokens,
        outputTokens: response.outputTokens,
        latencyMs: response.latencyMs,
      });

      return {
        ...result,
        tokensUsed,
        processingTimeMs: Date.now() - startTime,
      };
    } catch (error) {
      console.error('Risk detection failed:', error);
      return {
        emailId: email.id,
        risks: [],
        overallRiskLevel: 'Low',
        tokensUsed: 0,
        processingTimeMs: Date.now() - startTime,
      };
    }
  }

  /**
   * Batch detect risks for multiple emails
   */
  async batchDetectRisks(
    emails: EmailForRiskAnalysis[],
    userId: string,
    firmId: string
  ): Promise<RiskDetectionResult[]> {
    const results: RiskDetectionResult[] = [];

    for (const email of emails) {
      const result = await this.detectRisks(email, undefined, userId, firmId);
      results.push(result);

      // Small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 100));
    }

    return results;
  }

  /**
   * Get highest risk level from multiple results
   */
  getAggregateRiskLevel(results: RiskDetectionResult[]): RiskSeverity {
    const hasHighRisk = results.some((r) => r.overallRiskLevel === 'High');
    if (hasHighRisk) return 'High';

    const hasMediumRisk = results.some((r) => r.overallRiskLevel === 'Medium');
    if (hasMediumRisk) return 'Medium';

    return 'Low';
  }

  /**
   * Filter risks by type
   */
  filterByType(risks: RiskIndicatorResult[], type: RiskType): RiskIndicatorResult[] {
    return risks.filter((r) => r.type === type);
  }

  /**
   * Filter high-severity risks
   */
  getHighSeverityRisks(results: RiskDetectionResult[]): RiskIndicatorResult[] {
    return results.flatMap((r) => r.risks.filter((risk) => risk.severity === 'High'));
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private buildRiskDetectionPrompt(
    email: EmailForRiskAnalysis,
    threadContext?: Partial<ThreadContext>
  ): string {
    const date =
      email.receivedDateTime instanceof Date
        ? email.receivedDateTime.toISOString().split('T')[0]
        : String(email.receivedDateTime);

    const fromLabel = email.isFromClient ? '[CLIENT]' : '[EXTERNAL]';

    let contextSection = '';
    if (threadContext) {
      const contextParts: string[] = [];

      if (threadContext.hasPaymentDiscussions) {
        contextParts.push('- Thread includes previous payment discussions');
      }
      if (threadContext.hasScopeChanges) {
        contextParts.push('- Thread includes previous scope change requests');
      }
      if (threadContext.clientSentimentHistory?.length) {
        contextParts.push(
          `- Previous client sentiment: ${threadContext.clientSentimentHistory.join(', ')}`
        );
      }
      if (threadContext.recentEmails?.length) {
        contextParts.push(
          `- Thread contains ${threadContext.recentEmails.length} previous messages`
        );
      }

      if (contextParts.length > 0) {
        contextSection = `\n\nThread Context:\n${contextParts.join('\n')}`;
      }
    }

    return `Analyze this email for potential risks:

From: ${fromLabel} ${email.from.name || ''} <${email.from.address}>
Date: ${date}
Subject: ${email.subject}

--- Email Content ---
${email.bodyContent}
--- End Email ---${contextSection}

Identify any risk indicators in this email.`;
  }

  private parseRiskResponse(
    content: string,
    emailId: string
  ): Omit<RiskDetectionResult, 'tokensUsed' | 'processingTimeMs'> {
    try {
      // Extract JSON from response
      let jsonContent = content;
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (jsonMatch) {
        jsonContent = jsonMatch[1];
      }

      const parsed = JSON.parse(jsonContent);

      return {
        emailId,
        risks: this.validateRisks(parsed.risks || []),
        overallRiskLevel: this.validateSeverity(parsed.overallRiskLevel),
      };
    } catch (error) {
      console.error('Failed to parse risk response:', error);
      return {
        emailId,
        risks: [],
        overallRiskLevel: 'Low',
      };
    }
  }

  private validateRisks(risks: unknown[]): RiskIndicatorResult[] {
    if (!Array.isArray(risks)) return [];

    const validTypes: RiskType[] = [
      'ClientDissatisfaction',
      'DeadlineRisk',
      'ScopeCreep',
      'PaymentRisk',
      'RelationshipRisk',
    ];

    return risks
      .filter(
        (r): r is Record<string, unknown> =>
          typeof r === 'object' &&
          r !== null &&
          typeof (r as Record<string, unknown>).type === 'string' &&
          typeof (r as Record<string, unknown>).description === 'string'
      )
      .filter((r) => validTypes.includes(r.type as RiskType))
      .map((r) => ({
        type: r.type as RiskType,
        severity: this.validateSeverity(r.severity),
        description: String(r.description),
        evidence: String(r.evidence || ''),
        suggestedAction: r.suggestedAction ? String(r.suggestedAction) : undefined,
      }));
  }

  private validateSeverity(value: unknown): RiskSeverity {
    const valid: RiskSeverity[] = ['Low', 'Medium', 'High'];
    return valid.includes(String(value) as RiskSeverity) ? (String(value) as RiskSeverity) : 'Low';
  }
}

// Export singleton instance
export const riskDetection = new RiskDetectionService();
