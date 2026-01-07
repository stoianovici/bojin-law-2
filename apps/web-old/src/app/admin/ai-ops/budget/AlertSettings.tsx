/**
 * AlertSettings Component
 * OPS-246: Budget Controls & Alerts Page
 *
 * Checkboxes for configuring budget alert thresholds and auto-pause behavior.
 */

'use client';

import React from 'react';
import { AlertTriangle, Bell, Pause, Link as LinkIcon } from 'lucide-react';

// ============================================================================
// Types
// ============================================================================

export interface AlertSettingsData {
  alertAt75: boolean;
  alertAt90: boolean;
  autoPauseAt100: boolean;
  slackWebhookUrl: string | null;
}

interface AlertSettingsProps {
  settings: AlertSettingsData;
  onChange: (settings: AlertSettingsData) => void;
  disabled?: boolean;
}

// ============================================================================
// Component
// ============================================================================

export function AlertSettings({ settings, onChange, disabled }: AlertSettingsProps) {
  const handleCheckboxChange = (key: keyof Omit<AlertSettingsData, 'slackWebhookUrl'>) => {
    onChange({
      ...settings,
      [key]: !settings[key],
    });
  };

  const handleWebhookChange = (value: string) => {
    onChange({
      ...settings,
      slackWebhookUrl: value || null,
    });
  };

  return (
    <div className="space-y-4">
      {/* Alert at 75% */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={settings.alertAt75}
          onChange={() => handleCheckboxChange('alertAt75')}
          disabled={disabled}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Bell className="w-4 h-4 text-yellow-500" />
            <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600">
              Alertă email la 75% din buget
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Partenerii vor primi un email când cheltuielile ating 75% din buget
          </p>
        </div>
      </label>

      {/* Alert at 90% */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={settings.alertAt90}
          onChange={() => handleCheckboxChange('alertAt90')}
          disabled={disabled}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600">
              Alertă email la 90% din buget
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Alertă de urgență când bugetul este aproape epuizat
          </p>
        </div>
      </label>

      {/* Auto-pause at 100% */}
      <label className="flex items-start gap-3 cursor-pointer group">
        <input
          type="checkbox"
          checked={settings.autoPauseAt100}
          onChange={() => handleCheckboxChange('autoPauseAt100')}
          disabled={disabled}
          className="mt-1 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50"
        />
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Pause className="w-4 h-4 text-red-500" />
            <span className="text-sm font-medium text-gray-900 group-hover:text-blue-600">
              Pauză automată funcții non-esențiale la 100%
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Dezactivează automat Thread Summaries și Case Health când bugetul este epuizat
          </p>
        </div>
      </label>

      {/* Slack webhook */}
      <div className="pt-2 border-t border-gray-100">
        <label className="flex items-start gap-3">
          <div className="mt-2.5">
            <LinkIcon className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex-1">
            <span className="text-sm font-medium text-gray-900">Webhook Slack pentru alerte</span>
            <p className="text-xs text-gray-500 mt-0.5 mb-2">
              Opțional - primește notificări și în Slack
            </p>
            <input
              type="url"
              value={settings.slackWebhookUrl || ''}
              onChange={(e) => handleWebhookChange(e.target.value)}
              disabled={disabled}
              placeholder="https://hooks.slack.com/services/..."
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>
        </label>
      </div>
    </div>
  );
}
