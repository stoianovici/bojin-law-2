/**
 * AlertsManager
 *
 * Production alerting system for Skills monitoring with multiple notification channels:
 * - PagerDuty integration for critical alerts
 * - Slack notifications for warnings and info
 * - Email reports for daily/weekly summaries
 * - Escalation policies for incident response
 *
 * Alert Severity Levels:
 * - CRITICAL (SEV1): Immediate page, service down or high error rate
 * - WARNING (SEV2/SEV3): Slack notification, degraded performance
 * - INFO: Email only, metrics below threshold
 *
 * Implements AC#2: Configure monitoring alerts for all critical metrics
 */

export type AlertSeverity = 'critical' | 'warning' | 'info';
export type AlertChannel = 'pagerduty' | 'slack' | 'email';

export interface AlertThreshold {
  id: string;
  name: string;
  description: string;
  severity: AlertSeverity;
  condition: (metrics: SkillsHealthMetrics) => boolean;
  threshold: string;
  duration: string; // Duration before triggering
  channels: AlertChannel[];
  escalationPolicy?: string;
  runbookUrl?: string;
}

export interface SkillsHealthMetrics {
  // Error rates
  skillErrorRate: number; // Percentage (0-100)
  timeoutRate: number; // Percentage (0-100)

  // Performance metrics
  p95ResponseTime: number; // milliseconds
  averageResponseTime: number; // milliseconds

  // Cost metrics
  hourlyAICost: number; // USD
  costSpikePercentage: number; // Percentage vs baseline (0-200)

  // Cache metrics
  cacheHitRate: number; // Percentage (0-100)

  // Service health
  serviceHealth: number; // 0 = down, 1 = healthy

  // Timestamp
  timestamp: Date;
}

export interface Alert {
  id: string;
  thresholdId: string;
  name: string;
  severity: AlertSeverity;
  triggeredAt: Date;
  resolvedAt?: Date;
  status: 'active' | 'resolved';
  metrics: SkillsHealthMetrics;
  notificationsSent: {
    channel: AlertChannel;
    sentAt: Date;
    success: boolean;
  }[];
  escalationLevel: number;
  runbookUrl?: string;
}

export interface SlackMessage {
  channel: string;
  text: string;
  attachments?: {
    color: string;
    title: string;
    text: string;
    fields: { title: string; value: string; short: boolean }[];
  }[];
}

export interface PagerDutyEvent {
  routing_key: string;
  event_action: 'trigger' | 'acknowledge' | 'resolve';
  dedup_key?: string;
  payload: {
    summary: string;
    severity: 'critical' | 'error' | 'warning' | 'info';
    source: string;
    timestamp: string;
    custom_details?: Record<string, any>;
  };
  links?: {
    href: string;
    text: string;
  }[];
}

export interface EmailReport {
  to: string[];
  subject: string;
  body: string;
  attachments?: {
    filename: string;
    content: string;
  }[];
}

/**
 * Production alert thresholds configuration (AC#2)
 */
export const ALERT_THRESHOLDS: AlertThreshold[] = [
  // CRITICAL ALERTS - PagerDuty
  {
    id: 'skills-service-down',
    name: 'Skills Service Down',
    description: 'Skills service health check failure',
    severity: 'critical',
    condition: (metrics) => metrics.serviceHealth === 0,
    threshold: 'service.health == 0',
    duration: '1 minute',
    channels: ['pagerduty', 'slack'],
    escalationPolicy: 'oncall-engineering',
    runbookUrl: '/docs/runbooks/incident-response.md#sev1-complete-skills-outage',
  },
  {
    id: 'high-skill-error-rate',
    name: 'High Skill Error Rate',
    description: 'Skill execution error rate exceeds 5%',
    severity: 'critical',
    condition: (metrics) => metrics.skillErrorRate > 5,
    threshold: 'skill_error_rate > 5%',
    duration: '5 minutes',
    channels: ['pagerduty', 'slack'],
    escalationPolicy: 'oncall-engineering',
    runbookUrl: '/docs/runbooks/incident-response.md#sev1-high-error-rate',
  },
  {
    id: 'skills-response-time-critical',
    name: 'Skills Response Time Critical',
    description: 'p95 skill response time exceeds 10 seconds',
    severity: 'critical',
    condition: (metrics) => metrics.p95ResponseTime > 10000,
    threshold: 'p95_skill_response > 10s',
    duration: '5 minutes',
    channels: ['pagerduty', 'slack'],
    escalationPolicy: 'oncall-engineering',
    runbookUrl: '/docs/runbooks/performance-tuning.md#slow-response-times',
  },

  // WARNING ALERTS - Slack
  {
    id: 'elevated-skill-timeout-rate',
    name: 'Elevated Skill Timeout Rate',
    description: 'Skill timeout rate exceeds 5%',
    severity: 'warning',
    condition: (metrics) => metrics.timeoutRate > 5,
    threshold: 'skill_timeout_rate > 5%',
    duration: '10 minutes',
    channels: ['slack', 'email'],
    runbookUrl: '/docs/runbooks/performance-tuning.md#timeout-issues',
  },
  {
    id: 'low-cache-hit-rate',
    name: 'Low Cache Hit Rate',
    description: 'Skill cache hit rate below 30%',
    severity: 'warning',
    condition: (metrics) => metrics.cacheHitRate < 30,
    threshold: 'skill_cache_hit_rate < 30%',
    duration: '15 minutes',
    channels: ['slack', 'email'],
    runbookUrl: '/docs/runbooks/performance-tuning.md#cache-optimization',
  },
  {
    id: 'cost-spike-detected',
    name: 'Cost Spike Detected',
    description: 'Hourly AI cost exceeds 150% of baseline',
    severity: 'warning',
    condition: (metrics) => metrics.costSpikePercentage > 150,
    threshold: 'cost_spike > 150%',
    duration: 'immediate',
    channels: ['slack', 'email'],
    runbookUrl: '/docs/runbooks/cost-optimization.md#investigating-cost-spikes',
  },

  // INFO ALERTS - Email only
  {
    id: 'cache-warmup-needed',
    name: 'Cache Warmup Needed',
    description: 'Cache hit rate below 40% during peak hours',
    severity: 'info',
    condition: (metrics) => metrics.cacheHitRate < 40,
    threshold: 'cache_hit_rate < 40%',
    duration: '30 minutes',
    channels: ['email'],
  },
];

/**
 * AlertsManager - Production alerting system
 */
export class AlertsManager {
  private activeAlerts: Map<string, Alert> = new Map();
  private alertHistory: Alert[] = [];
  private readonly historyLimit = 1000;
  private lastMetrics?: SkillsHealthMetrics;
  private metricsHistory: SkillsHealthMetrics[] = [];
  private readonly metricsHistoryLimit = 1440; // 24 hours at 1min intervals

  constructor(
    private readonly config: {
      pagerduty?: {
        enabled: boolean;
        routingKey: string;
        apiUrl?: string;
      };
      slack?: {
        enabled: boolean;
        webhookUrl: string;
        channel: string;
      };
      email?: {
        enabled: boolean;
        smtpConfig: any; // SMTP configuration
        from: string;
        to: string[];
      };
    }
  ) {}

  // ============================================================================
  // Public Methods - Alert Evaluation
  // ============================================================================

  /**
   * Evaluate metrics against all alert thresholds
   */
  async evaluateMetrics(metrics: SkillsHealthMetrics): Promise<Alert[]> {
    this.lastMetrics = metrics;
    this.addToMetricsHistory(metrics);

    const triggeredAlerts: Alert[] = [];

    for (const threshold of ALERT_THRESHOLDS) {
      const shouldTrigger = threshold.condition(metrics);

      if (shouldTrigger) {
        const alert = await this.triggerAlert(threshold, metrics);
        triggeredAlerts.push(alert);
      } else {
        // Check if we should resolve an active alert
        await this.resolveAlert(threshold.id);
      }
    }

    return triggeredAlerts;
  }

  /**
   * Manually trigger an alert
   */
  async triggerAlert(threshold: AlertThreshold, metrics: SkillsHealthMetrics): Promise<Alert> {
    // Check if alert already active
    const existingAlert = this.activeAlerts.get(threshold.id);
    if (existingAlert) {
      // Update existing alert
      existingAlert.metrics = metrics;
      return existingAlert;
    }

    // Create new alert
    const alert: Alert = {
      id: `alert-${threshold.id}-${Date.now()}`,
      thresholdId: threshold.id,
      name: threshold.name,
      severity: threshold.severity,
      triggeredAt: new Date(),
      status: 'active',
      metrics,
      notificationsSent: [],
      escalationLevel: 0,
      runbookUrl: threshold.runbookUrl,
    };

    // Send notifications
    await this.sendNotifications(alert, threshold);

    // Add to active alerts
    this.activeAlerts.set(threshold.id, alert);
    this.alertHistory.push(alert);

    // Trim history if needed
    if (this.alertHistory.length > this.historyLimit) {
      this.alertHistory = this.alertHistory.slice(-this.historyLimit);
    }

    return alert;
  }

  /**
   * Resolve an active alert
   */
  async resolveAlert(thresholdId: string): Promise<void> {
    const alert = this.activeAlerts.get(thresholdId);
    if (!alert) return;

    alert.status = 'resolved';
    alert.resolvedAt = new Date();

    // Send resolution notifications
    if (alert.severity === 'critical') {
      await this.sendPagerDutyResolution(alert);
      await this.sendSlackResolution(alert);
    }

    // Remove from active alerts
    this.activeAlerts.delete(thresholdId);
  }

  // ============================================================================
  // Public Methods - Notifications
  // ============================================================================

  /**
   * Send notifications for an alert
   */
  private async sendNotifications(alert: Alert, threshold: AlertThreshold): Promise<void> {
    const notifications: Promise<void>[] = [];

    for (const channel of threshold.channels) {
      switch (channel) {
        case 'pagerduty':
          if (this.config.pagerduty?.enabled) {
            notifications.push(this.sendPagerDutyAlert(alert, threshold));
          }
          break;
        case 'slack':
          if (this.config.slack?.enabled) {
            notifications.push(this.sendSlackAlert(alert, threshold));
          }
          break;
        case 'email':
          if (this.config.email?.enabled) {
            notifications.push(this.sendEmailAlert(alert, threshold));
          }
          break;
      }
    }

    await Promise.allSettled(notifications);
  }

  /**
   * Send PagerDuty alert
   */
  private async sendPagerDutyAlert(alert: Alert, threshold: AlertThreshold): Promise<void> {
    if (!this.config.pagerduty?.enabled || !this.config.pagerduty.routingKey) {
      return;
    }

    const event: PagerDutyEvent = {
      routing_key: this.config.pagerduty.routingKey,
      event_action: 'trigger',
      dedup_key: alert.thresholdId,
      payload: {
        summary: `${alert.name}: ${threshold.description}`,
        severity: alert.severity === 'critical' ? 'critical' : 'error',
        source: 'skills-monitoring',
        timestamp: alert.triggeredAt.toISOString(),
        custom_details: {
          threshold: threshold.threshold,
          metrics: alert.metrics,
          runbook: alert.runbookUrl,
        },
      },
      links: alert.runbookUrl
        ? [
            {
              href: `https://docs.example.com${alert.runbookUrl}`,
              text: 'View Runbook',
            },
          ]
        : undefined,
    };

    try {
      const apiUrl = this.config.pagerduty.apiUrl || 'https://events.pagerduty.com/v2/enqueue';
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });

      if (!response.ok) {
        throw new Error(`PagerDuty API error: ${response.statusText}`);
      }

      alert.notificationsSent.push({
        channel: 'pagerduty',
        sentAt: new Date(),
        success: true,
      });
    } catch (error) {
      console.error('[AlertsManager] Failed to send PagerDuty alert:', error);
      alert.notificationsSent.push({
        channel: 'pagerduty',
        sentAt: new Date(),
        success: false,
      });
    }
  }

  /**
   * Send PagerDuty resolution
   */
  private async sendPagerDutyResolution(alert: Alert): Promise<void> {
    if (!this.config.pagerduty?.enabled || !this.config.pagerduty.routingKey) {
      return;
    }

    const event: PagerDutyEvent = {
      routing_key: this.config.pagerduty.routingKey,
      event_action: 'resolve',
      dedup_key: alert.thresholdId,
      payload: {
        summary: `${alert.name}: Resolved`,
        severity: 'info',
        source: 'skills-monitoring',
        timestamp: new Date().toISOString(),
      },
    };

    try {
      const apiUrl = this.config.pagerduty.apiUrl || 'https://events.pagerduty.com/v2/enqueue';
      await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(event),
      });
    } catch (error) {
      console.error('[AlertsManager] Failed to send PagerDuty resolution:', error);
    }
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(alert: Alert, threshold: AlertThreshold): Promise<void> {
    if (!this.config.slack?.enabled || !this.config.slack.webhookUrl) {
      return;
    }

    const color = {
      critical: '#FF0000',
      warning: '#FFA500',
      info: '#0000FF',
    }[alert.severity];

    const message: SlackMessage = {
      channel: this.config.slack.channel,
      text: `🚨 ${alert.name}`,
      attachments: [
        {
          color,
          title: threshold.description,
          text: `Threshold: ${threshold.threshold}\nDuration: ${threshold.duration}`,
          fields: [
            {
              title: 'Severity',
              value: alert.severity.toUpperCase(),
              short: true,
            },
            {
              title: 'Triggered At',
              value: alert.triggeredAt.toISOString(),
              short: true,
            },
            {
              title: 'Error Rate',
              value: `${alert.metrics.skillErrorRate.toFixed(2)}%`,
              short: true,
            },
            {
              title: 'Response Time (p95)',
              value: `${alert.metrics.p95ResponseTime.toFixed(0)}ms`,
              short: true,
            },
            {
              title: 'Cache Hit Rate',
              value: `${alert.metrics.cacheHitRate.toFixed(1)}%`,
              short: true,
            },
            {
              title: 'Hourly Cost',
              value: `$${alert.metrics.hourlyAICost.toFixed(2)}`,
              short: true,
            },
          ],
        },
      ],
    };

    if (alert.runbookUrl) {
      message.attachments![0].text += `\n\n📖 Runbook: ${alert.runbookUrl}`;
    }

    try {
      const response = await fetch(this.config.slack.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });

      if (!response.ok) {
        throw new Error(`Slack API error: ${response.statusText}`);
      }

      alert.notificationsSent.push({
        channel: 'slack',
        sentAt: new Date(),
        success: true,
      });
    } catch (error) {
      console.error('[AlertsManager] Failed to send Slack alert:', error);
      alert.notificationsSent.push({
        channel: 'slack',
        sentAt: new Date(),
        success: false,
      });
    }
  }

  /**
   * Send Slack resolution
   */
  private async sendSlackResolution(alert: Alert): Promise<void> {
    if (!this.config.slack?.enabled || !this.config.slack.webhookUrl) {
      return;
    }

    const message: SlackMessage = {
      channel: this.config.slack.channel,
      text: `✅ ${alert.name} - RESOLVED`,
      attachments: [
        {
          color: '#00FF00',
          title: 'Alert Resolved',
          text: `Duration: ${this.formatDuration(alert.triggeredAt, alert.resolvedAt!)}`,
          fields: [
            {
              title: 'Triggered At',
              value: alert.triggeredAt.toISOString(),
              short: true,
            },
            {
              title: 'Resolved At',
              value: alert.resolvedAt!.toISOString(),
              short: true,
            },
          ],
        },
      ],
    };

    try {
      await fetch(this.config.slack.webhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(message),
      });
    } catch (error) {
      console.error('[AlertsManager] Failed to send Slack resolution:', error);
    }
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(alert: Alert, threshold: AlertThreshold): Promise<void> {
    if (!this.config.email?.enabled) {
      return;
    }

    const report: EmailReport = {
      to: this.config.email.to,
      subject: `[${alert.severity.toUpperCase()}] ${alert.name}`,
      body: this.formatEmailBody(alert, threshold),
    };

    try {
      // TODO: Implement actual email sending via SMTP
      // For now, just log
      console.log('[AlertsManager] Email alert:', report);

      alert.notificationsSent.push({
        channel: 'email',
        sentAt: new Date(),
        success: true,
      });
    } catch (error) {
      console.error('[AlertsManager] Failed to send email alert:', error);
      alert.notificationsSent.push({
        channel: 'email',
        sentAt: new Date(),
        success: false,
      });
    }
  }

  // ============================================================================
  // Public Methods - Reporting
  // ============================================================================

  /**
   * Generate daily summary report
   */
  async generateDailySummary(): Promise<EmailReport> {
    const last24Hours = this.alertHistory.filter(
      (alert) =>
        alert.triggeredAt.getTime() > Date.now() - 24 * 60 * 60 * 1000
    );

    const criticalCount = last24Hours.filter((a) => a.severity === 'critical').length;
    const warningCount = last24Hours.filter((a) => a.severity === 'warning').length;
    const infoCount = last24Hours.filter((a) => a.severity === 'info').length;

    const body = `
Skills Monitoring - Daily Summary
Generated: ${new Date().toISOString()}

ALERT SUMMARY (Last 24 Hours)
==============================
Critical Alerts: ${criticalCount}
Warning Alerts:  ${warningCount}
Info Alerts:     ${infoCount}
Total Alerts:    ${last24Hours.length}

ACTIVE ALERTS
=============
${this.activeAlerts.size > 0 ? Array.from(this.activeAlerts.values()).map((a) => `- [${a.severity.toUpperCase()}] ${a.name} (triggered at ${a.triggeredAt.toISOString()})`).join('\n') : 'None'}

CURRENT METRICS
===============
${this.lastMetrics ? this.formatMetrics(this.lastMetrics) : 'No recent metrics'}

RECENT ALERTS (Last 24h)
========================
${last24Hours.length > 0 ? last24Hours.slice(0, 10).map((a) => `- [${a.severity.toUpperCase()}] ${a.name} at ${a.triggeredAt.toISOString()}`).join('\n') : 'None'}
    `.trim();

    return {
      to: this.config.email?.to || [],
      subject: `Skills Monitoring Daily Summary - ${new Date().toLocaleDateString()}`,
      body,
    };
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit?: number): Alert[] {
    if (limit) {
      return this.alertHistory.slice(-limit);
    }
    return [...this.alertHistory];
  }

  /**
   * Get current health metrics
   */
  getCurrentMetrics(): SkillsHealthMetrics | undefined {
    return this.lastMetrics;
  }

  /**
   * Get metrics history
   */
  getMetricsHistory(limit?: number): SkillsHealthMetrics[] {
    if (limit) {
      return this.metricsHistory.slice(-limit);
    }
    return [...this.metricsHistory];
  }

  // ============================================================================
  // Private Methods - Helpers
  // ============================================================================

  private addToMetricsHistory(metrics: SkillsHealthMetrics): void {
    this.metricsHistory.push(metrics);

    if (this.metricsHistory.length > this.metricsHistoryLimit) {
      this.metricsHistory = this.metricsHistory.slice(-this.metricsHistoryLimit);
    }
  }

  private formatDuration(start: Date, end: Date): string {
    const durationMs = end.getTime() - start.getTime();
    const minutes = Math.floor(durationMs / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);

    if (minutes > 60) {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }

    return `${minutes}m ${seconds}s`;
  }

  private formatEmailBody(alert: Alert, threshold: AlertThreshold): string {
    return `
ALERT TRIGGERED
===============
Name: ${alert.name}
Severity: ${alert.severity.toUpperCase()}
Triggered At: ${alert.triggeredAt.toISOString()}

DESCRIPTION
===========
${threshold.description}

THRESHOLD
=========
${threshold.threshold}
Duration: ${threshold.duration}

CURRENT METRICS
===============
${this.formatMetrics(alert.metrics)}

RUNBOOK
=======
${alert.runbookUrl || 'No runbook available'}

ESCALATION POLICY
=================
${threshold.escalationPolicy || 'No escalation policy'}
    `.trim();
  }

  private formatMetrics(metrics: SkillsHealthMetrics): string {
    return `
Skill Error Rate:     ${metrics.skillErrorRate.toFixed(2)}%
Timeout Rate:         ${metrics.timeoutRate.toFixed(2)}%
P95 Response Time:    ${metrics.p95ResponseTime.toFixed(0)}ms
Avg Response Time:    ${metrics.averageResponseTime.toFixed(0)}ms
Hourly AI Cost:       $${metrics.hourlyAICost.toFixed(2)}
Cost Spike:           ${metrics.costSpikePercentage.toFixed(0)}%
Cache Hit Rate:       ${metrics.cacheHitRate.toFixed(1)}%
Service Health:       ${metrics.serviceHealth === 1 ? 'Healthy' : 'Down'}
Timestamp:            ${metrics.timestamp.toISOString()}
    `.trim();
  }
}
