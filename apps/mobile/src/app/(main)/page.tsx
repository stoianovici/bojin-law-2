'use client';

import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Sparkles } from 'lucide-react';
import { LargeHeader } from '@/components/layout';
import { PullToRefresh } from '@/components/ui';
import { DailyBriefing, FlipboardBriefing } from '@/components/briefing';
import { useAuth } from '@/hooks/useAuth';
import { useFirmBriefing } from '@/hooks/useFirmBriefing';

// Feature flag for Flipboard-style briefing (gradual rollout)
const ENABLE_FLIPBOARD = process.env.NEXT_PUBLIC_ENABLE_FLIPBOARD === 'true';

export default function HomePage() {
  const { user } = useAuth();
  const { refetch, generating } = useFirmBriefing();

  const greeting = getGreeting();

  const handleRefresh = async () => {
    await refetch();
  };

  // Render Flipboard-style briefing when enabled
  if (ENABLE_FLIPBOARD) {
    return (
      <div className="h-screen flex flex-col">
        {/* Header with greeting */}
        <LargeHeader
          title={`${greeting}, ${user?.name?.split(' ')[0] || 'User'}`}
          subtitle={format(new Date(), 'EEEE, d MMMM', { locale: ro })}
          showNotifications
          action={
            <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center">
              <Sparkles className="h-5 w-5 text-accent" />
            </div>
          }
        />

        {/* Flipboard-style Briefing */}
        <FlipboardBriefing className="flex-1 pb-safe" />
      </div>
    );
  }

  // Default: Original Daily Briefing
  return (
    <div className="min-h-screen">
      {/* Header with greeting */}
      <LargeHeader
        title={`${greeting}, ${user?.name?.split(' ')[0] || 'User'}`}
        subtitle={format(new Date(), 'EEEE, d MMMM', { locale: ro })}
        showNotifications
        action={
          <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center">
            <Sparkles className="h-5 w-5 text-accent" />
          </div>
        }
      />

      {/* Daily Briefing with Pull-to-Refresh */}
      <PullToRefresh onRefresh={handleRefresh} disabled={generating}>
        <DailyBriefing className="pb-safe" />
      </PullToRefresh>
    </div>
  );
}

// ============================================
// Helpers
// ============================================

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Buna dimineata';
  if (hour < 18) return 'Buna ziua';
  return 'Buna seara';
}
