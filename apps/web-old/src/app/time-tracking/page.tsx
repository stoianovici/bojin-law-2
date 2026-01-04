/**
 * Time Tracking Page
 * Main page for time entry and tracking
 */

'use client';

import { SummaryView } from '../../components/time-tracking/SummaryView';
import { NaturalLanguageEntry } from '../../components/time-tracking/NaturalLanguageEntry';
import { TasksInProgress } from '../../components/time-tracking/TasksInProgress';
import { PageLayout, PageContent } from '../../components/linear/PageLayout';

export default function TimeTrackingPage() {
  return (
    <PageLayout>
      <PageContent>
        {/* Summary Panel */}
        <SummaryView />

        {/* Two-Column Layout */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Left Column - Natural Language Entry */}
          <div className="lg:col-span-1">
            <NaturalLanguageEntry />
          </div>

          {/* Right Column - Tasks In Progress */}
          <div className="lg:col-span-2">
            <TasksInProgress />
          </div>
        </div>
      </PageContent>
    </PageLayout>
  );
}
