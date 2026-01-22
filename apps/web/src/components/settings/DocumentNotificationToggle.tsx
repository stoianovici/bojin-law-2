'use client';

import { useUserPreferences } from '@/hooks/useSettings';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

export function DocumentNotificationToggle() {
  const { data, updatePreferences, updateLoading } = useUserPreferences();
  const isEnabled = data?.receiveAllDocNotifications ?? false;

  const handleToggle = async (checked: boolean) => {
    try {
      await updatePreferences({ receiveAllDocNotifications: checked });
    } catch (err) {
      console.error('Failed to update notification preference:', err);
    }
  };

  return (
    <Switch
      checked={isEnabled}
      onCheckedChange={handleToggle}
      disabled={updateLoading}
      className={cn(updateLoading && 'opacity-50 cursor-not-allowed')}
    />
  );
}
