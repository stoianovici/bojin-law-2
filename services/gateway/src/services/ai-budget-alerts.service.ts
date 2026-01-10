/**
 * AI Budget Alerts Service
 * OPS-246: Budget Controls & Alerts Page
 *
 * Monitors AI spending and triggers alerts when budget thresholds are crossed.
 * Sends email notifications to Partners and optional Slack webhooks.
 */

import { prisma } from '@legal-platform/database';
import { aiUsageService } from './ai-usage.service';
import { aiFeatureConfigService, type AIFeatureKey } from './ai-feature-config.service';

// ============================================================================
// Types
// ============================================================================

export interface BudgetSettingsData {
  monthlyBudgetEur: number;
  alertAt75Percent: boolean;
  alertAt90Percent: boolean;
  autoPauseAt100Percent: boolean;
  slackWebhookUrl: string | null;
  alertsSentThisMonth: string[];
  lastAlertResetAt: Date;
}

export interface BudgetSettingsInput {
  monthlyBudgetEur?: number;
  alertAt75Percent?: boolean;
  alertAt90Percent?: boolean;
  autoPauseAt100Percent?: boolean;
  slackWebhookUrl?: string | null;
}

// ============================================================================
// Service
// ============================================================================

export class AIBudgetAlertsService {
  /**
   * Get budget settings for a firm
   * Seeds default settings if not exists
   */
  async getBudgetSettings(firmId: string): Promise<BudgetSettingsData> {
    let settings = await prisma.aIBudgetSettings.findUnique({
      where: { firmId },
    });

    // Seed defaults if not exists
    if (!settings) {
      settings = await prisma.aIBudgetSettings.create({
        data: {
          firmId,
          monthlyBudgetEur: 100,
          alertAt75Percent: true,
          alertAt90Percent: true,
          autoPauseAt100Percent: false,
          slackWebhookUrl: null,
          alertsSentThisMonth: [],
          lastAlertResetAt: new Date(),
        },
      });
    }

    // Check if we need to reset alerts for new month
    const now = new Date();
    const lastReset = new Date(settings.lastAlertResetAt);
    if (lastReset.getMonth() !== now.getMonth() || lastReset.getFullYear() !== now.getFullYear()) {
      settings = await prisma.aIBudgetSettings.update({
        where: { firmId },
        data: {
          alertsSentThisMonth: [],
          lastAlertResetAt: now,
        },
      });
    }

    return {
      monthlyBudgetEur: Number(settings.monthlyBudgetEur),
      alertAt75Percent: settings.alertAt75Percent,
      alertAt90Percent: settings.alertAt90Percent,
      autoPauseAt100Percent: settings.autoPauseAt100Percent,
      slackWebhookUrl: settings.slackWebhookUrl,
      alertsSentThisMonth: settings.alertsSentThisMonth,
      lastAlertResetAt: settings.lastAlertResetAt,
    };
  }

  /**
   * Update budget settings for a firm
   */
  async updateBudgetSettings(
    firmId: string,
    input: BudgetSettingsInput,
    updatedBy?: string
  ): Promise<BudgetSettingsData> {
    const settings = await prisma.aIBudgetSettings.upsert({
      where: { firmId },
      update: {
        ...(input.monthlyBudgetEur !== undefined && {
          monthlyBudgetEur: input.monthlyBudgetEur,
        }),
        ...(input.alertAt75Percent !== undefined && {
          alertAt75Percent: input.alertAt75Percent,
        }),
        ...(input.alertAt90Percent !== undefined && {
          alertAt90Percent: input.alertAt90Percent,
        }),
        ...(input.autoPauseAt100Percent !== undefined && {
          autoPauseAt100Percent: input.autoPauseAt100Percent,
        }),
        ...(input.slackWebhookUrl !== undefined && {
          slackWebhookUrl: input.slackWebhookUrl,
        }),
        updatedBy,
      },
      create: {
        firmId,
        monthlyBudgetEur: input.monthlyBudgetEur ?? 100,
        alertAt75Percent: input.alertAt75Percent ?? true,
        alertAt90Percent: input.alertAt90Percent ?? true,
        autoPauseAt100Percent: input.autoPauseAt100Percent ?? false,
        slackWebhookUrl: input.slackWebhookUrl ?? null,
        alertsSentThisMonth: [],
        lastAlertResetAt: new Date(),
        updatedBy,
      },
    });

    return {
      monthlyBudgetEur: Number(settings.monthlyBudgetEur),
      alertAt75Percent: settings.alertAt75Percent,
      alertAt90Percent: settings.alertAt90Percent,
      autoPauseAt100Percent: settings.autoPauseAt100Percent,
      slackWebhookUrl: settings.slackWebhookUrl,
      alertsSentThisMonth: settings.alertsSentThisMonth,
      lastAlertResetAt: settings.lastAlertResetAt,
    };
  }

  /**
   * Check if any budget thresholds have been crossed and send alerts
   * Called after each AI usage log is recorded
   */
  async checkThresholds(firmId: string): Promise<void> {
    const settings = await this.getBudgetSettings(firmId);
    const currentSpend = await aiUsageService.getCurrentMonthSpend(firmId);
    const percent = (currentSpend / settings.monthlyBudgetEur) * 100;

    // Check 75% threshold
    if (
      percent >= 75 &&
      settings.alertAt75Percent &&
      !this.alreadyAlerted(settings.alertsSentThisMonth, '75')
    ) {
      await this.sendAlert(firmId, 75, currentSpend, settings.monthlyBudgetEur);
      await this.markAlertSent(firmId, '75');
    }

    // Check 90% threshold
    if (
      percent >= 90 &&
      settings.alertAt90Percent &&
      !this.alreadyAlerted(settings.alertsSentThisMonth, '90')
    ) {
      await this.sendAlert(firmId, 90, currentSpend, settings.monthlyBudgetEur);
      await this.markAlertSent(firmId, '90');
    }

    // Check 100% threshold and auto-pause
    if (
      percent >= 100 &&
      settings.autoPauseAt100Percent &&
      !this.alreadyAlerted(settings.alertsSentThisMonth, '100')
    ) {
      await this.pauseNonEssentialFeatures(firmId);
      await this.sendAlert(firmId, 100, currentSpend, settings.monthlyBudgetEur, true);
      await this.markAlertSent(firmId, '100');
    }

    // Send to Slack if configured
    if (settings.slackWebhookUrl && (percent >= 75 || percent >= 90 || percent >= 100)) {
      await this.sendSlackNotification(
        settings.slackWebhookUrl,
        firmId,
        percent,
        currentSpend,
        settings.monthlyBudgetEur
      );
    }
  }

  /**
   * Check if an alert has already been sent for a threshold this month
   */
  private alreadyAlerted(alerts: string[], threshold: string): boolean {
    return alerts.includes(threshold);
  }

  /**
   * Mark an alert as sent
   */
  private async markAlertSent(firmId: string, threshold: string): Promise<void> {
    await prisma.aIBudgetSettings.update({
      where: { firmId },
      data: {
        alertsSentThisMonth: {
          push: threshold,
        },
      },
    });
  }

  /**
   * Send email alert to all Partners in the firm
   */
  private async sendAlert(
    firmId: string,
    threshold: number,
    spent: number,
    limit: number,
    isPaused: boolean = false
  ): Promise<void> {
    const firm = await prisma.firm.findUnique({ where: { id: firmId } });
    const partners = await prisma.user.findMany({
      where: { firmId, role: 'Partner' },
    });

    if (partners.length === 0) {
      console.log(`[AIBudgetAlerts] No partners found for firm ${firmId}`);
      return;
    }

    // Log the alert (email service not implemented yet)
    console.log(`[AIBudgetAlerts] Alert triggered for ${firm?.name || firmId}:`);
    console.log(`  Threshold: ${threshold}%`);
    console.log(`  Spent: €${spent.toFixed(2)} / €${limit.toFixed(2)}`);
    console.log(`  Partners to notify: ${partners.map((p) => p.email).join(', ')}`);
    if (isPaused) {
      console.log('  Non-essential features paused');
    }

    // TODO: Integrate with email service
    // for (const partner of partners) {
    //   await emailService.send({
    //     to: partner.email,
    //     subject: `[Legal Platform] Alertă buget AI - ${threshold}%`,
    //     body: `Bugetul AI a atins ${threshold}% (€${spent.toFixed(2)} din €${limit.toFixed(2)}).${
    //       isPaused ? '\n\nFuncțiile non-esențiale au fost dezactivate automat.' : ''
    //     }`,
    //   });
    // }
  }

  /**
   * Pause non-essential AI features when budget is exhausted
   */
  private async pauseNonEssentialFeatures(firmId: string): Promise<void> {
    const nonEssentialFeatures: AIFeatureKey[] = ['case_context', 'case_health'];

    console.log(`[AIBudgetAlerts] Pausing non-essential features for firm ${firmId}`);

    for (const feature of nonEssentialFeatures) {
      try {
        await aiFeatureConfigService.updateFeatureConfig(
          firmId,
          feature,
          { enabled: false },
          'system-budget-pause'
        );
        console.log(`  Disabled: ${feature}`);
      } catch (err) {
        console.error(`  Failed to disable ${feature}:`, err);
      }
    }
  }

  /**
   * Send Slack notification via webhook
   */
  private async sendSlackNotification(
    webhookUrl: string,
    firmId: string,
    percent: number,
    spent: number,
    limit: number
  ): Promise<void> {
    try {
      const firm = await prisma.firm.findUnique({ where: { id: firmId } });

      const message = {
        text: `🚨 *Alertă Buget AI*\n\n*${firm?.name || 'Firmă'}*\n• Consum: ${percent.toFixed(1)}%\n• Cheltuit: €${spent.toFixed(2)} / €${limit.toFixed(2)}`,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🚨 Alertă Buget AI',
            },
          },
          {
            type: 'section',
            fields: [
              {
                type: 'mrkdwn',
                text: `*Firmă:*\n${firm?.name || 'Necunoscut'}`,
              },
              {
                type: 'mrkdwn',
                text: `*Consum:*\n${percent.toFixed(1)}%`,
              },
              {
                type: 'mrkdwn',
                text: `*Cheltuit:*\n€${spent.toFixed(2)}`,
              },
              {
                type: 'mrkdwn',
                text: `*Limită:*\n€${limit.toFixed(2)}`,
              },
            ],
          },
        ],
      };

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message),
      });

      console.log(`[AIBudgetAlerts] Slack notification sent to webhook`);
    } catch (err) {
      console.error('[AIBudgetAlerts] Failed to send Slack notification:', err);
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const aiBudgetAlertsService = new AIBudgetAlertsService();
