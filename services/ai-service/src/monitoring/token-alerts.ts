/**
 * Token Usage Alerting System
 * Story 3.8: Document System Testing and Performance - Task 15
 *
 * Features:
 * - Alert thresholds: 50%, 75%, 90%, 100% of budget
 * - Alert channels: Email, in-app notification
 * - Rate limit notifications to prevent spam
 * - Alert rules:
 *   - Firm daily budget exceeded
 *   - User hourly rate unusual
 *   - Cost spike detection (>200% of average)
 */

import { TokenUsageMonitor } from './token-usage-monitor';

// Alert threshold configuration
export const ALERT_THRESHOLDS = {
  firmDailyBudget: {
    warning: 0.5,    // 50% of daily budget
    critical: 0.75,  // 75% of daily budget
    exceeded: 0.9,   // 90% of daily budget
    blocked: 1.0,    // 100% - block new requests
  },
  userHourlyRate: {
    warning: 1000,   // tokens/hour unusual
    spike: 5000,     // tokens/hour spike
  },
  costAnomaly: {
    threshold: 2.0,  // 200% of 7-day average
  },
};

export interface Alert {
  id: string;
  type: AlertType;
  severity: AlertSeverity;
  firmId: string;
  userId: string | null;
  message: string;
  details: Record<string, unknown>;
  createdAt: Date;
  sentVia: AlertChannel[];
  acknowledged: boolean;
  acknowledgedAt: Date | null;
  acknowledgedBy: string | null;
}

export type AlertType =
  | 'budget_warning'
  | 'budget_critical'
  | 'budget_exceeded'
  | 'budget_blocked'
  | 'user_rate_warning'
  | 'user_rate_spike'
  | 'cost_anomaly'
  | 'single_request_high';

export type AlertSeverity = 'info' | 'warning' | 'critical' | 'emergency';

export type AlertChannel = 'email' | 'in_app' | 'webhook' | 'slack';

export interface AlertRecipient {
  userId: string;
  email: string;
  name: string;
  role: string;
  channels: AlertChannel[];
}

export interface AlertRateLimit {
  alertType: AlertType;
  firmId: string;
  lastSentAt: Date;
  count: number;
  windowStart: Date;
}

// Rate limiting configuration (per hour)
const RATE_LIMITS: Record<AlertType, { maxPerHour: number; cooldownMinutes: number }> = {
  budget_warning: { maxPerHour: 2, cooldownMinutes: 30 },
  budget_critical: { maxPerHour: 3, cooldownMinutes: 20 },
  budget_exceeded: { maxPerHour: 4, cooldownMinutes: 15 },
  budget_blocked: { maxPerHour: 6, cooldownMinutes: 10 },
  user_rate_warning: { maxPerHour: 2, cooldownMinutes: 30 },
  user_rate_spike: { maxPerHour: 4, cooldownMinutes: 15 },
  cost_anomaly: { maxPerHour: 2, cooldownMinutes: 30 },
  single_request_high: { maxPerHour: 3, cooldownMinutes: 20 },
};

// Email service interface (to be injected)
interface EmailService {
  send(to: string, subject: string, body: string, options?: { priority?: 'high' | 'normal' }): Promise<void>;
}

// Notification service interface (to be injected)
interface NotificationService {
  sendInApp(userId: string, notification: { title: string; body: string; type: string; metadata: Record<string, unknown> }): Promise<void>;
}

// Redis client interface (to be injected)
interface RedisClient {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, options?: { EX?: number }): Promise<void>;
  incr(key: string): Promise<number>;
  expire(key: string, seconds: number): Promise<void>;
}

export class TokenAlertService {
  private tokenMonitor: TokenUsageMonitor;
  private emailService: EmailService;
  private notificationService: NotificationService;
  private redis: RedisClient;
  private alertHistory: Map<string, Alert[]> = new Map();

  constructor(
    tokenMonitor: TokenUsageMonitor,
    emailService: EmailService,
    notificationService: NotificationService,
    redis: RedisClient
  ) {
    this.tokenMonitor = tokenMonitor;
    this.emailService = emailService;
    this.notificationService = notificationService;
    this.redis = redis;
  }

  /**
   * Check and send budget alerts for a firm
   */
  async checkAndAlertBudget(firmId: string): Promise<Alert[]> {
    const budgetStatus = await this.tokenMonitor.checkBudget(firmId);
    const alerts: Alert[] = [];

    // Check daily budget thresholds
    if (budgetStatus.dailyPercentage >= ALERT_THRESHOLDS.firmDailyBudget.blocked * 100) {
      const alert = await this.createAlert({
        type: 'budget_blocked',
        severity: 'emergency',
        firmId,
        userId: null,
        message: 'Daily AI budget exceeded - new requests will be blocked',
        details: {
          usage: budgetStatus.dailyUsage,
          budget: budgetStatus.dailyBudget,
          percentage: budgetStatus.dailyPercentage,
        },
      });
      alerts.push(alert);
    } else if (budgetStatus.dailyPercentage >= ALERT_THRESHOLDS.firmDailyBudget.exceeded * 100) {
      const alert = await this.createAlert({
        type: 'budget_exceeded',
        severity: 'critical',
        firmId,
        userId: null,
        message: 'Daily AI budget is at 90% - approaching limit',
        details: {
          usage: budgetStatus.dailyUsage,
          budget: budgetStatus.dailyBudget,
          percentage: budgetStatus.dailyPercentage,
        },
      });
      alerts.push(alert);
    } else if (budgetStatus.dailyPercentage >= ALERT_THRESHOLDS.firmDailyBudget.critical * 100) {
      const alert = await this.createAlert({
        type: 'budget_critical',
        severity: 'warning',
        firmId,
        userId: null,
        message: 'Daily AI budget is at 75%',
        details: {
          usage: budgetStatus.dailyUsage,
          budget: budgetStatus.dailyBudget,
          percentage: budgetStatus.dailyPercentage,
        },
      });
      alerts.push(alert);
    } else if (budgetStatus.dailyPercentage >= ALERT_THRESHOLDS.firmDailyBudget.warning * 100) {
      const alert = await this.createAlert({
        type: 'budget_warning',
        severity: 'info',
        firmId,
        userId: null,
        message: 'Daily AI budget is at 50%',
        details: {
          usage: budgetStatus.dailyUsage,
          budget: budgetStatus.dailyBudget,
          percentage: budgetStatus.dailyPercentage,
        },
      });
      alerts.push(alert);
    }

    return alerts;
  }

  /**
   * Check user rate and alert if unusual
   */
  async checkUserRate(userId: string, firmId: string): Promise<Alert | null> {
    const hourlyUsage = await this.tokenMonitor.getUserHourlyUsage(userId);

    if (hourlyUsage >= ALERT_THRESHOLDS.userHourlyRate.spike) {
      return this.createAlert({
        type: 'user_rate_spike',
        severity: 'critical',
        firmId,
        userId,
        message: `User ${userId} has unusually high token usage this hour`,
        details: {
          hourlyUsage,
          threshold: ALERT_THRESHOLDS.userHourlyRate.spike,
        },
      });
    }

    if (hourlyUsage >= ALERT_THRESHOLDS.userHourlyRate.warning) {
      return this.createAlert({
        type: 'user_rate_warning',
        severity: 'warning',
        firmId,
        userId,
        message: `User ${userId} token usage is above normal this hour`,
        details: {
          hourlyUsage,
          threshold: ALERT_THRESHOLDS.userHourlyRate.warning,
        },
      });
    }

    return null;
  }

  /**
   * Check for cost anomalies
   */
  async checkCostAnomaly(firmId: string): Promise<Alert | null> {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const weeklyUsage = await this.tokenMonitor.getAggregatedUsage(firmId, 'weekly', sevenDaysAgo, oneDayAgo);
    const dailyUsage = await this.tokenMonitor.getAggregatedUsage(firmId, 'daily', oneDayAgo, now);

    const dailyAverage = weeklyUsage.totalCostCents / 7;
    const currentDaily = dailyUsage.totalCostCents;

    if (dailyAverage > 0 && currentDaily > dailyAverage * ALERT_THRESHOLDS.costAnomaly.threshold) {
      return this.createAlert({
        type: 'cost_anomaly',
        severity: 'critical',
        firmId,
        userId: null,
        message: 'AI usage cost is significantly higher than average',
        details: {
          currentDailyCost: currentDaily,
          averageDailyCost: dailyAverage,
          percentageIncrease: ((currentDaily - dailyAverage) / dailyAverage) * 100,
        },
      });
    }

    return null;
  }

  /**
   * Create and send an alert
   */
  private async createAlert(params: {
    type: AlertType;
    severity: AlertSeverity;
    firmId: string;
    userId: string | null;
    message: string;
    details: Record<string, unknown>;
  }): Promise<Alert> {
    const alert: Alert = {
      id: crypto.randomUUID(),
      ...params,
      createdAt: new Date(),
      sentVia: [],
      acknowledged: false,
      acknowledgedAt: null,
      acknowledgedBy: null,
    };

    // Check rate limiting
    const canSend = await this.checkRateLimit(params.type, params.firmId);

    if (canSend) {
      // Get recipients for this alert
      const recipients = await this.getAlertRecipients(params.firmId, params.severity);

      // Send via appropriate channels
      await this.sendAlert(alert, recipients);
    }

    // Store alert in history
    const firmAlerts = this.alertHistory.get(params.firmId) || [];
    firmAlerts.push(alert);
    this.alertHistory.set(params.firmId, firmAlerts.slice(-100)); // Keep last 100

    return alert;
  }

  /**
   * Check if alert can be sent based on rate limits
   */
  private async checkRateLimit(alertType: AlertType, firmId: string): Promise<boolean> {
    const rateLimit = RATE_LIMITS[alertType];
    const key = `alert:ratelimit:${alertType}:${firmId}`;

    const lastSentStr = await this.redis.get(key);

    if (lastSentStr) {
      const lastSent = JSON.parse(lastSentStr) as AlertRateLimit;
      const now = new Date();
      const cooldownMs = rateLimit.cooldownMinutes * 60 * 1000;

      // Check cooldown
      if (now.getTime() - new Date(lastSent.lastSentAt).getTime() < cooldownMs) {
        return false;
      }

      // Check hourly limit
      const hourStart = new Date(now.getTime() - 60 * 60 * 1000);
      if (new Date(lastSent.windowStart) > hourStart && lastSent.count >= rateLimit.maxPerHour) {
        return false;
      }
    }

    // Update rate limit tracking
    const now = new Date();
    const existing = lastSentStr ? JSON.parse(lastSentStr) as AlertRateLimit : null;
    const hourStart = new Date(now.getTime() - 60 * 60 * 1000);

    const newRateLimit: AlertRateLimit = {
      alertType,
      firmId,
      lastSentAt: now,
      count: existing && new Date(existing.windowStart) > hourStart ? existing.count + 1 : 1,
      windowStart: existing && new Date(existing.windowStart) > hourStart ? existing.windowStart : now,
    };

    await this.redis.set(key, JSON.stringify(newRateLimit), { EX: 3600 });

    return true;
  }

  /**
   * Get recipients for an alert based on severity
   */
  private async getAlertRecipients(firmId: string, severity: AlertSeverity): Promise<AlertRecipient[]> {
    // In production, fetch from database based on firm settings
    // For now, return mock recipients based on severity

    const allRecipients: AlertRecipient[] = [
      {
        userId: 'partner-001',
        email: 'partner@firm.com',
        name: 'Partner User',
        role: 'Partner',
        channels: ['email', 'in_app'],
      },
      {
        userId: 'owner-001',
        email: 'owner@firm.com',
        name: 'Business Owner',
        role: 'BusinessOwner',
        channels: ['email', 'in_app'],
      },
    ];

    // Filter based on severity
    switch (severity) {
      case 'emergency':
        return allRecipients; // Everyone
      case 'critical':
        return allRecipients.filter((r) => r.role === 'Partner' || r.role === 'BusinessOwner');
      case 'warning':
        return allRecipients.filter((r) => r.role === 'Partner');
      case 'info':
        return allRecipients.filter((r) => r.role === 'Partner').slice(0, 1);
      default:
        return [];
    }
  }

  /**
   * Send alert via configured channels
   */
  private async sendAlert(alert: Alert, recipients: AlertRecipient[]): Promise<void> {
    const sendPromises: Promise<void>[] = [];

    for (const recipient of recipients) {
      for (const channel of recipient.channels) {
        switch (channel) {
          case 'email':
            sendPromises.push(this.sendEmailAlert(alert, recipient));
            break;
          case 'in_app':
            sendPromises.push(this.sendInAppAlert(alert, recipient));
            break;
        }
      }
    }

    await Promise.allSettled(sendPromises);
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(alert: Alert, recipient: AlertRecipient): Promise<void> {
    const subject = this.getEmailSubject(alert);
    const body = this.formatEmailBody(alert);

    try {
      await this.emailService.send(recipient.email, subject, body, {
        priority: alert.severity === 'emergency' || alert.severity === 'critical' ? 'high' : 'normal',
      });
      alert.sentVia.push('email');
    } catch (error) {
      console.error(`Failed to send email alert to ${recipient.email}:`, error);
    }
  }

  /**
   * Send in-app notification
   */
  private async sendInAppAlert(alert: Alert, recipient: AlertRecipient): Promise<void> {
    try {
      await this.notificationService.sendInApp(recipient.userId, {
        title: this.getAlertTitle(alert),
        body: alert.message,
        type: `ai_usage_${alert.type}`,
        metadata: {
          alertId: alert.id,
          severity: alert.severity,
          details: alert.details,
        },
      });
      alert.sentVia.push('in_app');
    } catch (error) {
      console.error(`Failed to send in-app alert to ${recipient.userId}:`, error);
    }
  }

  /**
   * Get email subject for alert
   */
  private getEmailSubject(alert: Alert): string {
    const prefix = alert.severity === 'emergency' ? '[URGENT] ' : alert.severity === 'critical' ? '[CRITICAL] ' : '';
    return `${prefix}AI Usage Alert: ${this.getAlertTitle(alert)}`;
  }

  /**
   * Get human-readable alert title
   */
  private getAlertTitle(alert: Alert): string {
    switch (alert.type) {
      case 'budget_warning':
        return 'Budget Warning - 50%';
      case 'budget_critical':
        return 'Budget Critical - 75%';
      case 'budget_exceeded':
        return 'Budget Exceeded - 90%';
      case 'budget_blocked':
        return 'Budget Limit Reached';
      case 'user_rate_warning':
        return 'Unusual User Activity';
      case 'user_rate_spike':
        return 'High User Activity Detected';
      case 'cost_anomaly':
        return 'Cost Anomaly Detected';
      case 'single_request_high':
        return 'High Token Request';
      default:
        return 'AI Usage Alert';
    }
  }

  /**
   * Format email body
   */
  private formatEmailBody(alert: Alert): string {
    return `
AI Usage Alert - ${this.getAlertTitle(alert)}

${alert.message}

Details:
${Object.entries(alert.details)
  .map(([key, value]) => `  ${key}: ${value}`)
  .join('\n')}

Time: ${alert.createdAt.toISOString()}
Alert ID: ${alert.id}

---
This is an automated alert from the Legal Platform AI monitoring system.
To manage alert settings, visit your firm settings page.
    `.trim();
  }

  /**
   * Acknowledge an alert
   */
  async acknowledgeAlert(alertId: string, userId: string): Promise<boolean> {
    for (const [_firmId, alerts] of this.alertHistory) {
      const alert = alerts.find((a) => a.id === alertId);
      if (alert) {
        alert.acknowledged = true;
        alert.acknowledgedAt = new Date();
        alert.acknowledgedBy = userId;
        return true;
      }
    }
    return false;
  }

  /**
   * Get unacknowledged alerts for a firm
   */
  getUnacknowledgedAlerts(firmId: string): Alert[] {
    const alerts = this.alertHistory.get(firmId) || [];
    return alerts.filter((a) => !a.acknowledged);
  }

  /**
   * Get alert history for a firm
   */
  getAlertHistory(firmId: string, limit = 50): Alert[] {
    const alerts = this.alertHistory.get(firmId) || [];
    return alerts.slice(-limit);
  }
}
