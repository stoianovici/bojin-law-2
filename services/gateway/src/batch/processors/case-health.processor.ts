/**
 * Case Health Scoring Processor
 * OPS-239: Case Health Scoring Processor
 *
 * Calculates health scores for active cases nightly.
 * Scores based on:
 * - Days since last activity (25%)
 * - Unanswered emails (25%)
 * - Overdue tasks (25%)
 * - Upcoming deadlines (25%)
 *
 * Also generates AI insights about concerns and suggested actions.
 */

import { prisma } from '@legal-platform/database';
import { aiClient } from '../../services/ai-client.service';
import type {
  BatchProcessor,
  BatchProcessorContext,
  BatchProcessorResult,
} from '../batch-processor.interface';

// ============================================================================
// Types
// ============================================================================

interface CaseData {
  id: string;
  title: string;
  caseNumber: string;
  status: string;
  lastActivityDate: Date | null;
  unansweredEmailCount: number;
  overdueTaskCount: number;
  upcomingDeadlineCount: number;
  upcomingDeadlinesPrepared: number;
}

interface FactorScores {
  activityScore: number;
  emailScore: number;
  taskScore: number;
  deadlineScore: number;
}

interface AIHealthInsight {
  concerns: string[];
  suggestions: string[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
}

// ============================================================================
// Score Calculation
// ============================================================================

/**
 * Calculate activity score based on days since last activity
 * 100 if <7d, 50 if <14d, 0 if >30d
 */
function calculateActivityScore(lastActivityDate: Date | null): number {
  if (!lastActivityDate) {
    return 0; // No activity tracked
  }

  const now = new Date();
  const daysSinceActivity = Math.floor(
    (now.getTime() - lastActivityDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (daysSinceActivity < 7) return 100;
  if (daysSinceActivity < 14) return 75;
  if (daysSinceActivity < 21) return 50;
  if (daysSinceActivity < 30) return 25;
  return 0;
}

/**
 * Calculate email score based on unanswered emails
 * 100 if 0, 50 if 1-2, 0 if >3
 */
function calculateEmailScore(unansweredCount: number): number {
  if (unansweredCount === 0) return 100;
  if (unansweredCount <= 2) return 50;
  if (unansweredCount <= 5) return 25;
  return 0;
}

/**
 * Calculate task score based on overdue tasks
 * 100 if 0, 50 if 1, 0 if >2
 */
function calculateTaskScore(overdueCount: number): number {
  if (overdueCount === 0) return 100;
  if (overdueCount === 1) return 50;
  if (overdueCount === 2) return 25;
  return 0;
}

/**
 * Calculate deadline score based on upcoming deadlines
 * 100 if none <7d, 50 if prepared, 0 if unprepared
 */
function calculateDeadlineScore(upcomingCount: number, preparedCount: number): number {
  if (upcomingCount === 0) return 100;
  const preparedRatio = preparedCount / upcomingCount;
  if (preparedRatio >= 0.8) return 75;
  if (preparedRatio >= 0.5) return 50;
  if (preparedRatio >= 0.25) return 25;
  return 0;
}

/**
 * Calculate overall health score from factor scores (weighted average)
 */
function calculateOverallScore(factors: FactorScores): number {
  return Math.round(
    factors.activityScore * 0.25 +
      factors.emailScore * 0.25 +
      factors.taskScore * 0.25 +
      factors.deadlineScore * 0.25
  );
}

/**
 * Determine risk level from overall score
 */
function determineRiskLevel(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 80) return 'low';
  if (score >= 60) return 'medium';
  if (score >= 40) return 'high';
  return 'critical';
}

// ============================================================================
// AI Insight Generation
// ============================================================================

const HEALTH_INSIGHT_SYSTEM_PROMPT = `Ești un asistent juridic AI care analizează starea de sănătate a dosarelor.

Primești date despre un dosar și trebuie să generezi:
1. Preocupări principale (max 3) - probleme care necesită atenție
2. Acțiuni sugerate (max 3) - pași concreți pentru a îmbunătăți situația

Răspunde NUMAI în format JSON valid, fără comentarii sau text suplimentar:
{
  "concerns": ["preocupare 1", "preocupare 2"],
  "suggestions": ["acțiune 1", "acțiune 2"]
}

Reguli:
- Scrie în română
- Fii concis și specific
- Dacă dosarul e în stare bună, returnează arrays goale
- Nu repeta informațiile din input, oferă insight-uri utile`;

async function generateAIInsights(
  caseData: CaseData,
  factors: FactorScores,
  overallScore: number,
  options: { firmId: string; batchJobId: string }
): Promise<{ insight: AIHealthInsight; tokens: number; cost: number }> {
  const prompt = `Analizează starea dosarului:

Dosar: ${caseData.title} (${caseData.caseNumber})
Scor general: ${overallScore}/100

Factori:
- Activitate: ${factors.activityScore}/100 (${caseData.lastActivityDate ? `ultima activitate: ${caseData.lastActivityDate.toLocaleDateString('ro-RO')}` : 'fără activitate recentă'})
- Emailuri: ${factors.emailScore}/100 (${caseData.unansweredEmailCount} emailuri fără răspuns)
- Sarcini: ${factors.taskScore}/100 (${caseData.overdueTaskCount} sarcini depășite)
- Termene: ${factors.deadlineScore}/100 (${caseData.upcomingDeadlineCount} termene în 7 zile, ${caseData.upcomingDeadlinesPrepared} pregătite)

Generează analiza JSON:`;

  try {
    const response = await aiClient.complete(
      prompt,
      {
        feature: 'case_health',
        firmId: options.firmId,
        batchJobId: options.batchJobId,
        entityType: 'case',
        entityId: caseData.id,
      },
      {
        model: 'claude-3-5-haiku-20241022', // Use Haiku for cost efficiency
        maxTokens: 256,
        temperature: 0.3,
        system: HEALTH_INSIGHT_SYSTEM_PROMPT,
      }
    );

    // Parse JSON response
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        insight: {
          concerns: parsed.concerns || [],
          suggestions: parsed.suggestions || [],
          riskLevel: determineRiskLevel(overallScore),
        },
        tokens: response.inputTokens + response.outputTokens,
        cost: response.costEur,
      };
    }

    // Fallback if parsing fails
    return {
      insight: {
        concerns: [],
        suggestions: [],
        riskLevel: determineRiskLevel(overallScore),
      },
      tokens: response.inputTokens + response.outputTokens,
      cost: response.costEur,
    };
  } catch (error) {
    console.error('[CaseHealthProcessor] AI insight generation failed:', error);
    // Return default insight without AI
    return {
      insight: {
        concerns: [],
        suggestions: [],
        riskLevel: determineRiskLevel(overallScore),
      },
      tokens: 0,
      cost: 0,
    };
  }
}

// ============================================================================
// Case Data Fetching
// ============================================================================

async function getCaseData(caseId: string, firmId: string): Promise<CaseData | null> {
  const now = new Date();
  const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Get case with aggregated data
  const caseRecord = await prisma.case.findFirst({
    where: { id: caseId, firmId },
    select: {
      id: true,
      title: true,
      caseNumber: true,
      status: true,
      updatedAt: true,
    },
  });

  if (!caseRecord) return null;

  // Get last activity date from multiple sources
  const [lastEmail, lastTask, lastDocument] = await Promise.all([
    prisma.email.findFirst({
      where: { caseId, firmId },
      orderBy: { receivedDateTime: 'desc' },
      select: { receivedDateTime: true },
    }),
    prisma.task.findFirst({
      where: { caseId, firmId },
      orderBy: { updatedAt: 'desc' },
      select: { updatedAt: true },
    }),
    prisma.caseDocument.findFirst({
      where: { caseId, firmId },
      orderBy: { linkedAt: 'desc' },
      select: { linkedAt: true },
    }),
  ]);

  const activityDates = [
    lastEmail?.receivedDateTime,
    lastTask?.updatedAt,
    lastDocument?.linkedAt,
    caseRecord.updatedAt,
  ].filter(Boolean) as Date[];

  const lastActivityDate =
    activityDates.length > 0 ? new Date(Math.max(...activityDates.map((d) => d.getTime()))) : null;

  // Count unanswered emails (received emails without a reply in last 7 days)
  // Simplified: count emails from external senders that are unread
  const unansweredEmailCount = await prisma.email.count({
    where: {
      caseId,
      firmId,
      isRead: false,
      folderType: 'inbox',
      isIgnored: false,
      receivedDateTime: {
        gte: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
      },
    },
  });

  // Count overdue tasks
  const overdueTaskCount = await prisma.task.count({
    where: {
      caseId,
      firmId,
      status: { in: ['Pending', 'InProgress'] },
      dueDate: { lt: now },
    },
  });

  // Count upcoming deadlines (tasks due in next 7 days)
  const upcomingTasks = await prisma.task.findMany({
    where: {
      caseId,
      firmId,
      status: { in: ['Pending', 'InProgress'] },
      dueDate: {
        gte: now,
        lte: sevenDaysFromNow,
      },
    },
    select: { status: true },
  });

  const upcomingDeadlineCount = upcomingTasks.length;
  // Consider "InProgress" as prepared
  const upcomingDeadlinesPrepared = upcomingTasks.filter((t) => t.status === 'InProgress').length;

  return {
    id: caseRecord.id,
    title: caseRecord.title,
    caseNumber: caseRecord.caseNumber,
    status: caseRecord.status,
    lastActivityDate,
    unansweredEmailCount,
    overdueTaskCount,
    upcomingDeadlineCount,
    upcomingDeadlinesPrepared,
  };
}

// ============================================================================
// Processor Implementation
// ============================================================================

export class CaseHealthProcessor implements BatchProcessor {
  readonly name = 'Case Health Scoring';
  readonly feature = 'case_health';

  async process(ctx: BatchProcessorContext): Promise<BatchProcessorResult> {
    const { firmId, batchJobId, onProgress } = ctx;

    // Get all active cases for the firm
    const activeCases = await prisma.case.findMany({
      where: {
        firmId,
        status: { in: ['Active', 'PendingApproval'] },
      },
      select: { id: true },
    });

    console.log(
      `[CaseHealthProcessor] Processing ${activeCases.length} active cases for firm ${firmId}`
    );

    let processed = 0;
    let failed = 0;
    let totalTokens = 0;
    let totalCost = 0;
    const errors: string[] = [];

    for (let i = 0; i < activeCases.length; i++) {
      const caseRecord = activeCases[i];

      try {
        // Get case data
        const caseData = await getCaseData(caseRecord.id, firmId);
        if (!caseData) {
          failed++;
          errors.push(`Case ${caseRecord.id}: not found`);
          continue;
        }

        // Calculate factor scores
        const factors: FactorScores = {
          activityScore: calculateActivityScore(caseData.lastActivityDate),
          emailScore: calculateEmailScore(caseData.unansweredEmailCount),
          taskScore: calculateTaskScore(caseData.overdueTaskCount),
          deadlineScore: calculateDeadlineScore(
            caseData.upcomingDeadlineCount,
            caseData.upcomingDeadlinesPrepared
          ),
        };

        const overallScore = calculateOverallScore(factors);

        // Generate AI insights (only for low-scoring cases to save costs)
        let insight: AIHealthInsight;
        if (overallScore < 70) {
          const aiResult = await generateAIInsights(caseData, factors, overallScore, {
            firmId,
            batchJobId,
          });
          insight = aiResult.insight;
          totalTokens += aiResult.tokens;
          totalCost += aiResult.cost;
        } else {
          // No AI needed for healthy cases
          insight = {
            concerns: [],
            suggestions: [],
            riskLevel: determineRiskLevel(overallScore),
          };
        }

        // Store health score
        await prisma.caseHealthScore.create({
          data: {
            caseId: caseRecord.id,
            firmId,
            score: overallScore,
            activityScore: factors.activityScore,
            emailScore: factors.emailScore,
            taskScore: factors.taskScore,
            deadlineScore: factors.deadlineScore,
            concerns: insight.concerns,
            suggestions: insight.suggestions,
            riskLevel: insight.riskLevel,
          },
        });

        processed++;
      } catch (error) {
        failed++;
        const message = error instanceof Error ? error.message : 'Unknown error';
        errors.push(`Case ${caseRecord.id}: ${message}`);
        console.error(`[CaseHealthProcessor] Error processing case ${caseRecord.id}:`, message);
      }

      // Report progress
      onProgress?.(processed + failed, activeCases.length);
    }

    console.log(
      `[CaseHealthProcessor] Completed: ${processed} processed, ${failed} failed, ${totalTokens} tokens, €${totalCost.toFixed(4)} cost`
    );

    return {
      itemsProcessed: processed,
      itemsFailed: failed,
      totalTokens,
      totalCost,
      errors: errors.length > 0 ? errors : undefined,
    };
  }
}

// ============================================================================
// Export Singleton
// ============================================================================

export const caseHealthProcessor = new CaseHealthProcessor();
