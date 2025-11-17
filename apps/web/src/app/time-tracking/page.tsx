/**
 * Time Tracking Page
 * Main page for time entry and tracking
 */

'use client';

import { SummaryView } from '../../components/time-tracking/SummaryView';
import { NaturalLanguageEntry } from '../../components/time-tracking/NaturalLanguageEntry';
import { ActiveTimerWidget } from '../../components/time-tracking/ActiveTimerWidget';
import { TasksInProgress } from '../../components/time-tracking/TasksInProgress';

export default function TimeTrackingPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Pontaj</h1>
          <p className="text-sm text-gray-500 mt-1">
            Gestionează timpul tău facturat
          </p>
        </div>

        {/* Summary Panel */}
        <SummaryView />

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Natural Language Entry + Timer */}
          <div className="lg:col-span-1 space-y-6">
            <NaturalLanguageEntry />
            <ActiveTimerWidget />
          </div>

          {/* Right Column - Tasks In Progress */}
          <div className="lg:col-span-2">
            <TasksInProgress />
          </div>
        </div>
      </div>
    </main>
  );
}
