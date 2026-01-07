/**
 * Task Analytics Page - Redirect to unified Analytics
 *
 * This page now redirects to /analytics with the tasks tab active.
 * Task Analytics is now a tab within the unified Analytics dashboard.
 */

'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function TaskAnalyticsRedirect() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/analytics?tab=tasks');
  }, [router]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Redirecting to Analytics...</p>
      </div>
    </div>
  );
}
