/**
 * AI Budget Alerts Service
 * OPS-246: Budget Controls & Alerts Page
 *
 * STUBBED: The AIBudgetSettings model was removed from the Prisma schema.
 * This service now returns default values and logs operations without persisting.
 * Re-implement when budget tracking feature is prioritized.
 */

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
// Default Settings
// ============================================================================

const DEFAULT_SETTINGS: BudgetSettingsData = {
  monthlyBudgetEur: 100,
  alertAt75Percent: true,
  alertAt90Percent: true,
  autoPauseAt100Percent: false,
  slackWebhookUrl: null,
  alertsSentThisMonth: [],
  lastAlertResetAt: new Date(),
};

// ============================================================================
// Service
// ============================================================================

export class AIBudgetAlertsService {
  /**
   * Get budget settings for a firm
   * STUBBED: Returns default settings
   */
  async getBudgetSettings(_firmId: string): Promise<BudgetSettingsData> {
    return { ...DEFAULT_SETTINGS, lastAlertResetAt: new Date() };
  }

  /**
   * Update budget settings for a firm
   * STUBBED: Logs the update and returns merged settings
   */
  async updateBudgetSettings(
    firmId: string,
    input: BudgetSettingsInput,
    _updatedBy?: string
  ): Promise<BudgetSettingsData> {
    console.log(`[AIBudgetAlerts] STUBBED: updateBudgetSettings called for firm ${firmId}`, input);

    return {
      monthlyBudgetEur: input.monthlyBudgetEur ?? DEFAULT_SETTINGS.monthlyBudgetEur,
      alertAt75Percent: input.alertAt75Percent ?? DEFAULT_SETTINGS.alertAt75Percent,
      alertAt90Percent: input.alertAt90Percent ?? DEFAULT_SETTINGS.alertAt90Percent,
      autoPauseAt100Percent: input.autoPauseAt100Percent ?? DEFAULT_SETTINGS.autoPauseAt100Percent,
      slackWebhookUrl: input.slackWebhookUrl ?? DEFAULT_SETTINGS.slackWebhookUrl,
      alertsSentThisMonth: [],
      lastAlertResetAt: new Date(),
    };
  }

  /**
   * Check if any budget thresholds have been crossed and send alerts
   * STUBBED: No-op since budget tracking is disabled
   */
  async checkThresholds(_firmId: string): Promise<void> {
    // No-op: Budget tracking disabled
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const aiBudgetAlertsService = new AIBudgetAlertsService();
