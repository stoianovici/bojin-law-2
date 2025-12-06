/**
 * Communication Intelligence Worker
 * Story 5.2: Communication Intelligence Engine
 *
 * Processes newly synced emails in batches to extract actionable intelligence:
 * - Deadlines, commitments, action items, questions
 * - Risk indicators
 * - Thread-level analysis
 *
 * Uses configurable batch sizes and intervals to manage processing load.
 */

import {
  PrismaClient,
  ExtractionStatus,
  TaskPriority,
} from '@legal-platform/database';

// ============================================================================
// Configuration
// ============================================================================

interface WorkerConfig {
  batchSize: number;
  intervalMs: number;
  minConfidenceThreshold: number;
  enableRiskAnalysis: boolean;
  enableThreadAnalysis: boolean;
}

const DEFAULT_CONFIG: WorkerConfig = {
  batchSize: parseInt(process.env.INTELLIGENCE_BATCH_SIZE || '20', 10),
  intervalMs: parseInt(process.env.INTELLIGENCE_INTERVAL_MS || '60000', 10),
  minConfidenceThreshold: 0.5,
  enableRiskAnalysis: true,
  enableThreadAnalysis: true,
};

// Worker state
let prisma: PrismaClient;
let intervalHandle: NodeJS.Timeout | null = null;
let isRunning = false;

// Processing metrics
interface ProcessingMetrics {
  totalProcessed: number;
  totalExtractions: number;
  avgConfidence: number;
  avgProcessingTimeMs: number;
  errorCount: number;
  lastRunAt: Date | null;
}

let metrics: ProcessingMetrics = {
  totalProcessed: 0,
  totalExtractions: 0,
  avgConfidence: 0,
  avgProcessingTimeMs: 0,
  errorCount: 0,
  lastRunAt: null,
};

// ============================================================================
// Types
// ============================================================================

interface EmailForProcessing {
  id: string;
  subject: string;
  bodyContent: string;
  from: { name?: string; address: string };
  toRecipients: Array<{ name?: string; address: string }>;
  ccRecipients: Array<{ name?: string; address: string }>;
  receivedDateTime: Date;
  conversationId: string;
  caseId: string | null;
  firmId: string;
  userId: string;
}

interface ExtractionResult {
  emailId: string;
  deadlines: Array<{
    description: string;
    dueDate: string;
    confidence: number;
  }>;
  commitments: Array<{
    party: string;
    commitmentText: string;
    dueDate?: string;
    confidence: number;
  }>;
  actionItems: Array<{
    description: string;
    suggestedAssignee?: string;
    priority: 'Low' | 'Medium' | 'High' | 'Urgent';
    confidence: number;
  }>;
  questions: Array<{
    questionText: string;
    respondBy?: string;
    confidence: number;
  }>;
  tokensUsed: number;
  processingTimeMs: number;
}

// ============================================================================
// Worker Lifecycle
// ============================================================================

export function initializePrisma(client: PrismaClient): void {
  prisma = client;
}

export function startCommunicationIntelligenceWorker(
  config: Partial<WorkerConfig> = {}
): void {
  if (isRunning) {
    console.log('[Intelligence Worker] Already running');
    return;
  }

  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  console.log('[Intelligence Worker] Starting...');
  console.log('  Batch size:', finalConfig.batchSize);
  console.log('  Interval:', finalConfig.intervalMs / 1000, 'seconds');
  console.log('  Min confidence:', finalConfig.minConfidenceThreshold);

  isRunning = true;

  // Run immediately
  processBatch(finalConfig).catch((error) => {
    console.error('[Intelligence Worker] Error in initial processing:', error);
  });

  // Then run on interval
  intervalHandle = setInterval(() => {
    processBatch(finalConfig).catch((error) => {
      console.error('[Intelligence Worker] Error in batch processing:', error);
    });
  }, finalConfig.intervalMs);

  console.log('[Intelligence Worker] Started successfully');
}

export function stopCommunicationIntelligenceWorker(): void {
  if (!isRunning) {
    console.log('[Intelligence Worker] Not running');
    return;
  }

  console.log('[Intelligence Worker] Stopping...');

  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }

  isRunning = false;
  console.log('[Intelligence Worker] Stopped');
}

export function isWorkerRunning(): boolean {
  return isRunning;
}

export function getMetrics(): ProcessingMetrics {
  return { ...metrics };
}

// ============================================================================
// Batch Processing (AC: 1)
// ============================================================================

async function processBatch(config: WorkerConfig): Promise<void> {
  const startTime = Date.now();
  console.log('[Intelligence Worker] Processing batch...');

  try {
    // Find unprocessed emails (emails without any extractions)
    const unprocessedEmails = await findUnprocessedEmails(config.batchSize);

    if (unprocessedEmails.length === 0) {
      console.log('[Intelligence Worker] No unprocessed emails found');
      return;
    }

    console.log(`[Intelligence Worker] Found ${unprocessedEmails.length} emails to process`);

    // Process each email
    let totalConfidence = 0;
    let extractionCount = 0;

    for (const email of unprocessedEmails) {
      try {
        const result = await processEmail(email, config);

        // Store extraction results
        await storeExtractionResults(email, result, config.minConfidenceThreshold);

        // Update metrics
        const emailExtractions =
          result.deadlines.length +
          result.commitments.length +
          result.actionItems.length +
          result.questions.length;

        const allConfidences = [
          ...result.deadlines.map(d => d.confidence),
          ...result.commitments.map(c => c.confidence),
          ...result.actionItems.map(a => a.confidence),
          ...result.questions.map(q => q.confidence),
        ];

        if (allConfidences.length > 0) {
          totalConfidence += allConfidences.reduce((a, b) => a + b, 0);
          extractionCount += allConfidences.length;
        }

        metrics.totalProcessed++;
        metrics.totalExtractions += emailExtractions;

      } catch (error) {
        console.error(`[Intelligence Worker] Error processing email ${email.id}:`, error);
        metrics.errorCount++;
      }

      // Small delay between emails to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Update average metrics
    if (extractionCount > 0) {
      metrics.avgConfidence = totalConfidence / extractionCount;
    }
    metrics.avgProcessingTimeMs = Date.now() - startTime;
    metrics.lastRunAt = new Date();

    console.log(`[Intelligence Worker] Batch complete: ${unprocessedEmails.length} emails, ${metrics.totalExtractions} total extractions`);

  } catch (error) {
    console.error('[Intelligence Worker] Batch processing error:', error);
    metrics.errorCount++;
  }
}

// ============================================================================
// Email Processing
// ============================================================================

async function findUnprocessedEmails(limit: number): Promise<EmailForProcessing[]> {
  // Find emails that don't have any extracted items yet
  const emails = await prisma.email.findMany({
    where: {
      // Exclude emails that already have extractions
      extractedDeadlines: { none: {} },
      extractedCommitments: { none: {} },
      extractedActionItems: { none: {} },
      extractedQuestions: { none: {} },
    },
    select: {
      id: true,
      subject: true,
      bodyContent: true,
      from: true,
      toRecipients: true,
      ccRecipients: true,
      receivedDateTime: true,
      conversationId: true,
      caseId: true,
      firmId: true,
      userId: true,
    },
    orderBy: {
      receivedDateTime: 'desc',
    },
    take: limit,
  });

  return emails.map(email => ({
    id: email.id,
    subject: email.subject,
    bodyContent: email.bodyContent,
    from: email.from as { name?: string; address: string },
    toRecipients: email.toRecipients as Array<{ name?: string; address: string }>,
    ccRecipients: email.ccRecipients as Array<{ name?: string; address: string }>,
    receivedDateTime: email.receivedDateTime,
    conversationId: email.conversationId,
    caseId: email.caseId,
    firmId: email.firmId,
    userId: email.userId,
  }));
}

async function processEmail(
  email: EmailForProcessing,
  _config: WorkerConfig
): Promise<ExtractionResult> {
  // Call the AI service to extract intelligence
  // In production, this would call the communication-intelligence.service via HTTP
  const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:3002';

  try {
    const response = await fetch(`${aiServiceUrl}/api/intelligence/extract`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: {
          id: email.id,
          subject: email.subject,
          bodyContent: email.bodyContent,
          from: email.from,
          toRecipients: email.toRecipients,
          ccRecipients: email.ccRecipients,
          receivedDateTime: email.receivedDateTime,
          conversationId: email.conversationId,
        },
        userId: email.userId,
        firmId: email.firmId,
      }),
    });

    if (!response.ok) {
      throw new Error(`AI service returned ${response.status}`);
    }

    return await response.json() as ExtractionResult;
  } catch (error) {
    console.error(`[Intelligence Worker] AI service error for email ${email.id}:`, error);
    // Return empty results on error
    return {
      emailId: email.id,
      deadlines: [],
      commitments: [],
      actionItems: [],
      questions: [],
      tokensUsed: 0,
      processingTimeMs: 0,
    };
  }
}

// ============================================================================
// Storage
// ============================================================================

async function storeExtractionResults(
  email: EmailForProcessing,
  result: ExtractionResult,
  minConfidence: number
): Promise<void> {
  // Filter by confidence threshold
  const filteredDeadlines = result.deadlines.filter(d => d.confidence >= minConfidence);
  const filteredCommitments = result.commitments.filter(c => c.confidence >= minConfidence);
  const filteredActionItems = result.actionItems.filter(a => a.confidence >= minConfidence);
  const filteredQuestions = result.questions.filter(q => q.confidence >= minConfidence);

  // Store in database
  await prisma.$transaction(async (tx) => {
    // Store deadlines
    for (const deadline of filteredDeadlines) {
      await tx.extractedDeadline.create({
        data: {
          emailId: email.id,
          caseId: email.caseId,
          firmId: email.firmId,
          description: deadline.description,
          dueDate: new Date(deadline.dueDate),
          confidence: deadline.confidence,
          status: ExtractionStatus.Pending,
        },
      });
    }

    // Store commitments
    for (const commitment of filteredCommitments) {
      await tx.extractedCommitment.create({
        data: {
          emailId: email.id,
          caseId: email.caseId,
          firmId: email.firmId,
          party: commitment.party,
          commitmentText: commitment.commitmentText,
          dueDate: commitment.dueDate ? new Date(commitment.dueDate) : null,
          confidence: commitment.confidence,
          status: ExtractionStatus.Pending,
        },
      });
    }

    // Store action items
    for (const actionItem of filteredActionItems) {
      await tx.extractedActionItem.create({
        data: {
          emailId: email.id,
          caseId: email.caseId,
          firmId: email.firmId,
          description: actionItem.description,
          suggestedAssignee: actionItem.suggestedAssignee,
          priority: actionItem.priority as TaskPriority,
          confidence: actionItem.confidence,
          status: ExtractionStatus.Pending,
        },
      });
    }

    // Store questions
    for (const question of filteredQuestions) {
      await tx.extractedQuestion.create({
        data: {
          emailId: email.id,
          caseId: email.caseId,
          firmId: email.firmId,
          questionText: question.questionText,
          respondBy: question.respondBy ? new Date(question.respondBy) : null,
          confidence: question.confidence,
          status: ExtractionStatus.Pending,
        },
      });
    }
  });

  // Log low-confidence items for human review
  const lowConfidenceDeadlines = result.deadlines.filter(d => d.confidence < minConfidence);
  const lowConfidenceCommitments = result.commitments.filter(c => c.confidence < minConfidence);
  const lowConfidenceActionItems = result.actionItems.filter(a => a.confidence < minConfidence);
  const lowConfidenceQuestions = result.questions.filter(q => q.confidence < minConfidence);

  const totalLowConfidence =
    lowConfidenceDeadlines.length +
    lowConfidenceCommitments.length +
    lowConfidenceActionItems.length +
    lowConfidenceQuestions.length;

  if (totalLowConfidence > 0) {
    console.log(`[Intelligence Worker] Email ${email.id}: ${totalLowConfidence} low-confidence items filtered`);
  }
}

// ============================================================================
// Manual Trigger (for testing)
// ============================================================================

export async function processEmailManually(
  emailId: string,
  config: Partial<WorkerConfig> = {}
): Promise<ExtractionResult | null> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  const email = await prisma.email.findUnique({
    where: { id: emailId },
    select: {
      id: true,
      subject: true,
      bodyContent: true,
      from: true,
      toRecipients: true,
      ccRecipients: true,
      receivedDateTime: true,
      conversationId: true,
      caseId: true,
      firmId: true,
      userId: true,
    },
  });

  if (!email) {
    console.error(`[Intelligence Worker] Email ${emailId} not found`);
    return null;
  }

  const emailForProcessing: EmailForProcessing = {
    id: email.id,
    subject: email.subject,
    bodyContent: email.bodyContent,
    from: email.from as { name?: string; address: string },
    toRecipients: email.toRecipients as Array<{ name?: string; address: string }>,
    ccRecipients: email.ccRecipients as Array<{ name?: string; address: string }>,
    receivedDateTime: email.receivedDateTime,
    conversationId: email.conversationId,
    caseId: email.caseId,
    firmId: email.firmId,
    userId: email.userId,
  };

  const result = await processEmail(emailForProcessing, finalConfig);
  await storeExtractionResults(emailForProcessing, result, finalConfig.minConfidenceThreshold);

  return result;
}
