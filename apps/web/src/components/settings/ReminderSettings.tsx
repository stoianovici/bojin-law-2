'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Bell, Mail, Calendar, CheckCircle2, AlertCircle } from 'lucide-react';

export interface ReminderConfig {
  enableEmailReminders: boolean;
  reminderIntervals: number[]; // Days before due date [1, 2, 7]
  overdueReminderIntervalHours: number;
  excludeWeekends: boolean;
}

export interface ReminderSettingsProps {
  config: ReminderConfig;
  onSave: (config: ReminderConfig) => Promise<void>;
  onTestReminder?: () => Promise<void>;
}

const AVAILABLE_INTERVALS = [
  { value: 1, label: '1 day before' },
  { value: 2, label: '2 days before' },
  { value: 7, label: '7 days before' },
  { value: 14, label: '14 days before' },
];

const OVERDUE_INTERVALS = [
  { value: 1, label: 'Every hour' },
  { value: 4, label: 'Every 4 hours' },
  { value: 8, label: 'Every 8 hours' },
  { value: 24, label: 'Daily' },
];

export function ReminderSettings({ config, onSave, onTestReminder }: ReminderSettingsProps) {
  const [localConfig, setLocalConfig] = React.useState<ReminderConfig>(config);
  const [isSaving, setIsSaving] = React.useState(false);
  const [isTesting, setIsTesting] = React.useState(false);
  const [saveStatus, setSaveStatus] = React.useState<'idle' | 'success' | 'error'>('idle');
  const [hasChanges, setHasChanges] = React.useState(false);

  React.useEffect(() => {
    const configChanged = JSON.stringify(config) !== JSON.stringify(localConfig);
    setHasChanges(configChanged);
  }, [config, localConfig]);

  const handleToggleEmailReminders = () => {
    setLocalConfig((prev) => ({
      ...prev,
      enableEmailReminders: !prev.enableEmailReminders,
    }));
  };

  const handleToggleInterval = (days: number) => {
    setLocalConfig((prev) => {
      const intervals = prev.reminderIntervals.includes(days)
        ? prev.reminderIntervals.filter((d) => d !== days)
        : [...prev.reminderIntervals, days].sort((a, b) => a - b);
      return { ...prev, reminderIntervals: intervals };
    });
  };

  const handleToggleExcludeWeekends = () => {
    setLocalConfig((prev) => ({
      ...prev,
      excludeWeekends: !prev.excludeWeekends,
    }));
  };

  const handleOverdueIntervalChange = (hours: number) => {
    setLocalConfig((prev) => ({
      ...prev,
      overdueReminderIntervalHours: hours,
    }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    setSaveStatus('idle');
    try {
      await onSave(localConfig);
      setSaveStatus('success');
      setHasChanges(false);
      setTimeout(() => setSaveStatus('idle'), 3000);
    } catch (error) {
      console.error('Failed to save reminder settings:', error);
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestReminder = async () => {
    if (!onTestReminder) return;

    setIsTesting(true);
    try {
      await onTestReminder();
    } catch (error) {
      console.error('Failed to send test reminder:', error);
    } finally {
      setIsTesting(false);
    }
  };

  const handleReset = () => {
    setLocalConfig(config);
    setSaveStatus('idle');
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bell className="h-6 w-6" />
            Task Reminder Settings
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Configure when and how you receive task deadline reminders
          </p>
        </div>
        {saveStatus === 'success' && (
          <Badge variant="outline" className="bg-green-50 border-green-500 text-green-700">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Saved
          </Badge>
        )}
        {saveStatus === 'error' && (
          <Badge variant="outline" className="bg-red-50 border-red-500 text-red-700">
            <AlertCircle className="h-3 w-3 mr-1" />
            Error saving
          </Badge>
        )}
      </div>

      {/* Email Reminders Toggle */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Mail className="h-5 w-5" />
                Email Reminders
              </CardTitle>
              <CardDescription>
                Receive email notifications for approaching task deadlines
              </CardDescription>
            </div>
            <button
              onClick={handleToggleEmailReminders}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                localConfig.enableEmailReminders ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  localConfig.enableEmailReminders ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        </CardHeader>
        {localConfig.enableEmailReminders && (
          <CardContent className="border-t pt-4">
            <p className="text-sm text-gray-600 mb-3">
              Reminder emails will be sent to your registered email address.
            </p>
            {onTestReminder && (
              <Button variant="outline" size="sm" onClick={handleTestReminder} disabled={isTesting}>
                {isTesting ? 'Sending...' : 'Send Test Email'}
              </Button>
            )}
          </CardContent>
        )}
      </Card>

      {/* Reminder Intervals */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Reminder Schedule
          </CardTitle>
          <CardDescription>Choose when to receive reminders before task due dates</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-3 block">Remind me:</label>
            <div className="space-y-2">
              {AVAILABLE_INTERVALS.map((interval) => {
                const isSelected = localConfig.reminderIntervals.includes(interval.value);
                return (
                  <label
                    key={interval.value}
                    className={`flex items-center gap-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleInterval(interval.value)}
                      className="rounded w-4 h-4"
                    />
                    <span className="text-sm font-medium">{interval.label}</span>
                  </label>
                );
              })}
            </div>
            {localConfig.reminderIntervals.length === 0 && (
              <p className="text-xs text-orange-600 mt-2">Select at least one reminder interval</p>
            )}
          </div>

          {/* Overdue Reminders */}
          <div className="pt-4 border-t">
            <label className="text-sm font-medium mb-3 block">
              Overdue task reminder frequency:
            </label>
            <div className="grid grid-cols-2 gap-2">
              {OVERDUE_INTERVALS.map((interval) => {
                const isSelected = localConfig.overdueReminderIntervalHours === interval.value;
                return (
                  <button
                    key={interval.value}
                    onClick={() => handleOverdueIntervalChange(interval.value)}
                    className={`p-3 border-2 rounded-lg text-sm font-medium transition-all ${
                      isSelected
                        ? 'border-blue-500 bg-blue-50 text-blue-700'
                        : 'border-gray-200 hover:border-gray-300 text-gray-700'
                    }`}
                  >
                    {interval.label}
                  </button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Additional Options */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Additional Options</CardTitle>
        </CardHeader>
        <CardContent>
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={localConfig.excludeWeekends}
              onChange={handleToggleExcludeWeekends}
              className="rounded mt-0.5 w-4 h-4"
            />
            <div>
              <div className="text-sm font-medium">Exclude weekends</div>
              <div className="text-sm text-gray-600">
                Don&apos;t send reminder emails on Saturdays and Sundays
              </div>
            </div>
          </label>
        </CardContent>
      </Card>

      {/* Summary */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <h4 className="font-medium text-sm mb-3">Current Settings Summary</h4>
          <div className="space-y-2 text-sm text-gray-700">
            <div className="flex items-center gap-2">
              {localConfig.enableEmailReminders ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                  <span>Email reminders enabled</span>
                </>
              ) : (
                <>
                  <AlertCircle className="h-4 w-4 text-gray-500" />
                  <span>Email reminders disabled</span>
                </>
              )}
            </div>
            {localConfig.enableEmailReminders && (
              <>
                <div className="ml-6">
                  Reminders will be sent:{' '}
                  {localConfig.reminderIntervals.length > 0
                    ? localConfig.reminderIntervals
                        .map((d) => `${d} day${d !== 1 ? 's' : ''}`)
                        .join(', ') + ' before due date'
                    : 'Never (no intervals selected)'}
                </div>
                <div className="ml-6">
                  Overdue reminders:{' '}
                  {OVERDUE_INTERVALS.find(
                    (i) => i.value === localConfig.overdueReminderIntervalHours
                  )?.label.toLowerCase() || 'Not configured'}
                </div>
                {localConfig.excludeWeekends && (
                  <div className="ml-6 flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    Weekend emails disabled
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={handleReset} disabled={!hasChanges || isSaving}>
          Reset
        </Button>
        <Button onClick={handleSave} disabled={!hasChanges || isSaving}>
          {isSaving ? 'Saving...' : 'Save Settings'}
        </Button>
      </div>
    </div>
  );
}
