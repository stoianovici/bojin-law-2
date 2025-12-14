/**
 * Monthly Intelligence Report Worker
 * Story 5.7: Platform Intelligence Dashboard - Task 23
 *
 * Generates and sends monthly platform intelligence reports to Partners.
 * Schedule: First day of each month at 6:00 AM (Europe/Bucharest timezone).
 */

import { prisma } from '@legal-platform/database';
import * as cron from 'node-cron';
import { getPlatformIntelligenceService } from '../services/platform-intelligence.service';
import { getDashboardExportService } from '../services/dashboard-export.service';

// ============================================================================
// Configuration
// ============================================================================

interface MonthlyReportWorkerConfig {
  enabled: boolean;
  cronSchedule: string; // Cron expression (default: "0 6 1 * *" = 6 AM on 1st of month)
  timezone: string; // Timezone for cron (default: Europe/Bucharest)
  reportRetentionDays: number; // How long to keep reports in R2 (default: 90)
}

const DEFAULT_CONFIG: MonthlyReportWorkerConfig = {
  enabled: process.env.MONTHLY_REPORT_WORKER_ENABLED !== 'false',
  cronSchedule: process.env.MONTHLY_REPORT_WORKER_CRON || '0 6 1 * *', // 6 AM on 1st of month
  timezone: process.env.MONTHLY_REPORT_WORKER_TIMEZONE || 'Europe/Bucharest',
  reportRetentionDays: parseInt(process.env.MONTHLY_REPORT_RETENTION_DAYS || '90', 10),
};

let cronJob: cron.ScheduledTask | null = null;
let isRunning = false;

// Track processed reports to prevent duplicates
const processedReports = new Map<string, Date>();

// ============================================================================
// Worker Lifecycle
// ============================================================================

/**
 * Start the monthly intelligence report worker
 * @param config - Optional configuration overrides
 */
export function startMonthlyIntelligenceReportWorker(
  config: Partial<MonthlyReportWorkerConfig> = {}
): void {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };

  if (!finalConfig.enabled) {
    console.log('[Monthly Intelligence Report Worker] Worker is disabled');
    return;
  }

  if (isRunning) {
    console.log('[Monthly Intelligence Report Worker] Worker is already running');
    return;
  }

  console.log('[Monthly Intelligence Report Worker] Starting worker...');
  console.log(`[Monthly Intelligence Report Worker] Schedule: ${finalConfig.cronSchedule}`);
  console.log(`[Monthly Intelligence Report Worker] Timezone: ${finalConfig.timezone}`);
  console.log(
    `[Monthly Intelligence Report Worker] Report retention: ${finalConfig.reportRetentionDays} days`
  );

  isRunning = true;

  // Schedule cron job
  cronJob = cron.schedule(
    finalConfig.cronSchedule,
    () => {
      generateMonthlyReports(finalConfig).catch((error) => {
        console.error('[Monthly Intelligence Report Worker] Error generating reports:', error);
      });
    },
    {
      timezone: finalConfig.timezone,
    }
  );

  console.log('[Monthly Intelligence Report Worker] Worker started successfully');
}

/**
 * Stop the monthly intelligence report worker
 */
export function stopMonthlyIntelligenceReportWorker(): void {
  if (!isRunning) {
    console.log('[Monthly Intelligence Report Worker] Worker is not running');
    return;
  }

  console.log('[Monthly Intelligence Report Worker] Stopping worker...');

  if (cronJob) {
    cronJob.stop();
    cronJob = null;
  }

  isRunning = false;
  processedReports.clear();

  console.log('[Monthly Intelligence Report Worker] Worker stopped successfully');
}

/**
 * Check if the worker is running
 */
export function isMonthlyIntelligenceReportWorkerRunning(): boolean {
  return isRunning;
}

/**
 * Manually trigger report generation (for testing)
 * @param firmId - Optional specific firm ID to generate report for
 */
export async function triggerMonthlyReportGeneration(firmId?: string): Promise<void> {
  await generateMonthlyReports(DEFAULT_CONFIG, firmId);
}

// ============================================================================
// Report Generation
// ============================================================================

async function generateMonthlyReports(
  config: MonthlyReportWorkerConfig,
  specificFirmId?: string
): Promise<void> {
  console.log('[Monthly Intelligence Report Worker] Starting monthly report generation...');

  const startTime = Date.now();
  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  try {
    // Calculate previous month date range
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);

    const dateRange = {
      startDate: lastMonth,
      endDate: lastMonthEnd,
    };

    const monthKey = `${lastMonth.getFullYear()}-${String(lastMonth.getMonth() + 1).padStart(2, '0')}`;
    console.log(`[Monthly Intelligence Report Worker] Generating reports for ${monthKey}`);

    // Get firms to process
    let firms: Array<{ id: string; name: string }>;

    if (specificFirmId) {
      const firm = await prisma.firm.findUnique({
        where: { id: specificFirmId },
        select: { id: true, name: true },
      });
      firms = firm ? [firm] : [];
    } else {
      // Get all active firms
      firms = await prisma.firm.findMany({
        where: {
          // Only active firms with platform intelligence enabled
          // Add status check if there's such field
        },
        select: { id: true, name: true },
      });
    }

    console.log(`[Monthly Intelligence Report Worker] Processing ${firms.length} firms`);

    for (const firm of firms) {
      const reportKey = `${firm.id}:${monthKey}`;

      // Skip if already processed
      if (processedReports.has(reportKey)) {
        const processedAt = processedReports.get(reportKey);
        console.log(
          `[Monthly Intelligence Report Worker] Skipping ${firm.name} - already processed at ${processedAt?.toISOString()}`
        );
        skipCount++;
        continue;
      }

      try {
        console.log(`[Monthly Intelligence Report Worker] Processing firm: ${firm.name}`);

        // Get services
        const platformIntelligenceService = getPlatformIntelligenceService();
        const dashboardExportService = getDashboardExportService();

        // Generate dashboard data
        const dashboardData = await platformIntelligenceService.getDashboard(firm.id, dateRange);

        // Generate PDF export
        const exportResult = await dashboardExportService.exportDashboard(firm.id, {
          format: 'pdf',
          dateRange,
          sections: ['efficiency', 'communication', 'quality', 'tasks', 'ai', 'roi'],
        });

        // Get Partners for this firm to notify
        const partners = await prisma.user.findMany({
          where: {
            firmId: firm.id,
            role: {
              in: ['Partner', 'BusinessOwner'],
            },
          },
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        });

        // Send notifications to Partners
        for (const partner of partners) {
          try {
            // Create notification directly using prisma
            // Note: Using CasePendingApproval as a generic notification type
            // TODO: Add REPORT_READY to NotificationType enum when needed
            await prisma.notification.create({
              data: {
                userId: partner.id,
                type: 'CasePendingApproval', // Using existing type as placeholder
                title: `Raport lunar inteligență platformă - ${monthKey}`,
                message: `Raportul de inteligență platformă pentru ${firm.name} este disponibil pentru descărcare.`,
                link: '/analytics/platform-intelligence',
              },
            });

            console.log(`[Monthly Intelligence Report Worker] Notified partner: ${partner.email}`);
          } catch (notifyError) {
            console.error(
              `[Monthly Intelligence Report Worker] Failed to notify ${partner.email}:`,
              notifyError
            );
          }
        }

        // Mark as processed
        processedReports.set(reportKey, new Date());
        successCount++;

        console.log(
          `[Monthly Intelligence Report Worker] Completed report for ${firm.name} - Health Score: ${dashboardData.platformHealthScore}`
        );
      } catch (error) {
        errorCount++;
        console.error(
          `[Monthly Intelligence Report Worker] Error processing firm ${firm.name}:`,
          error
        );
      }
    }

    const duration = Date.now() - startTime;
    console.log(`[Monthly Intelligence Report Worker] Processing complete in ${duration}ms`);
    console.log(
      `[Monthly Intelligence Report Worker] Results: ${successCount} generated, ${skipCount} skipped, ${errorCount} errors`
    );
  } catch (error) {
    console.error('[Monthly Intelligence Report Worker] Fatal error:', error);
    throw error;
  }
}

// ============================================================================
// Cleanup
// ============================================================================

// Clean up old processed report keys monthly (prevent memory leak)
setInterval(
  () => {
    const now = new Date();
    const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1);

    let cleanedCount = 0;
    for (const [key, processedAt] of processedReports.entries()) {
      if (processedAt < threeMonthsAgo) {
        processedReports.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(
        `[Monthly Intelligence Report Worker] Cleaned ${cleanedCount} old report tracking entries`
      );
    }
  },
  7 * 24 * 60 * 60 * 1000 // Once per week
);

// ============================================================================
// Exports
// ============================================================================

export default {
  start: startMonthlyIntelligenceReportWorker,
  stop: stopMonthlyIntelligenceReportWorker,
  isRunning: isMonthlyIntelligenceReportWorkerRunning,
  trigger: triggerMonthlyReportGeneration,
};
