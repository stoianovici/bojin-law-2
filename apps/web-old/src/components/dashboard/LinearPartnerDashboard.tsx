/**
 * LinearPartnerDashboard - Redesigned Partner Dashboard with Linear styling
 * OPS-356: Dashboard Page Redesign
 *
 * Features:
 * - Morning briefing card with greeting + summary + 4 stats
 * - 3-column CSS grid for widgets
 * - SupervisedCasesWidget: case items with status dots
 * - MyTasksWidget: task items with checkboxes
 * - FirmMetricsWidget: 2×2 metric cards
 * - TeamWorkloadWidget: team rows with workload bars (spans 2 cols)
 */

'use client';

import React, { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePartnerDashboard } from '@/hooks/usePartnerDashboard';
import { useMyTasks, useTasks } from '@/hooks/useTasks';
import { useMorningBriefing } from '@/hooks/useMorningBriefing';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import {
  WidgetGrid,
  Widget,
  WidgetBody,
  BriefingCard,
  WorkloadItem,
} from '@/components/linear/WidgetGrid';
import { LinearCardHeader, CardActionButton } from '@/components/linear/SectionHeader';
import {
  MetricCard,
  MetricGrid,
  BriefingStat,
  BriefingStatsRow,
} from '@/components/linear/MetricCard';
import { CaseListItem, TaskListItem } from '@/components/linear/ListItem';

// ====================================================================
// Icons
// ====================================================================

const CasesIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-4 w-4">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
    />
  </svg>
);

const TasksIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-4 w-4">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
    />
  </svg>
);

const MetricsIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-4 w-4">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
    />
  </svg>
);

const TeamIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-4 w-4">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
    />
  </svg>
);

const SunIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-5 w-5 text-linear-accent">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
    />
  </svg>
);

const RefreshIcon = () => (
  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" className="h-4 w-4">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
    />
  </svg>
);

// ====================================================================
// Loading Skeleton Components
// ====================================================================

function BriefingSkeleton() {
  return (
    <div className="relative mb-6 overflow-hidden rounded-lg border border-linear-border-subtle bg-linear-bg-secondary p-5">
      <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-linear-accent to-[#8B5CF6] opacity-50" />
      <div className="mb-4 flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-lg" />
        <div>
          <Skeleton className="h-5 w-48 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <Skeleton className="h-4 w-full mb-2" />
      <Skeleton className="h-4 w-3/4 mb-4" />
      <div className="flex gap-6 border-t border-linear-border-subtle pt-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex flex-col gap-1">
            <Skeleton className="h-7 w-8" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

function WidgetSkeleton() {
  return (
    <Widget>
      <div className="border-b border-linear-border-subtle px-5 py-4">
        <Skeleton className="h-4 w-36" />
      </div>
      <WidgetBody>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 py-2">
              <Skeleton className="h-4 w-4 rounded" />
              <div className="flex-1">
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-3 w-2/3" />
              </div>
            </div>
          ))}
        </div>
      </WidgetBody>
    </Widget>
  );
}

// ====================================================================
// MorningBriefingWidget
// ====================================================================

interface MorningBriefingWidgetProps {
  loading: boolean;
}

function MorningBriefingWidget({ loading }: MorningBriefingWidgetProps) {
  const {
    briefing,
    summary,
    hasBriefing,
    generateBriefing,
    loading: briefingLoading,
  } = useMorningBriefing();

  if (loading || briefingLoading) {
    return <BriefingSkeleton />;
  }

  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Bună dimineața';
    if (hour < 18) return 'Bună ziua';
    return 'Bună seara';
  };

  const dateString = new Date().toLocaleDateString('ro-RO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  // If no briefing, show generate prompt
  if (!hasBriefing) {
    return (
      <BriefingCard
        icon={<SunIcon />}
        title={`${getGreeting()}`}
        subtitle={dateString}
        action={
          <Button variant="ghost" size="sm" onClick={() => generateBriefing()}>
            <RefreshIcon />
            <span className="ml-2">Generează Briefing</span>
          </Button>
        }
      >
        <p className="text-sm text-linear-text-secondary">
          Apăsați pentru a genera briefing-ul zilnic cu AI.
        </p>
      </BriefingCard>
    );
  }

  // Extract stats from briefing
  const stats = [
    { value: briefing?.prioritizedTasks?.length || 0, label: 'Sarcini prioritare' },
    { value: briefing?.keyDeadlines?.length || 0, label: 'Termene cheie' },
    { value: briefing?.riskAlerts?.length || 0, label: 'Alerte risc' },
    { value: briefing?.suggestions?.length || 0, label: 'Sugestii AI' },
  ];

  return (
    <BriefingCard
      icon={<SunIcon />}
      title={`${getGreeting()}`}
      subtitle={dateString}
      action={
        <Button variant="ghost" size="sm" onClick={() => generateBriefing()}>
          <RefreshIcon />
          <span className="ml-2">Actualizează</span>
        </Button>
      }
    >
      {summary && (
        <p className="mb-4 text-sm leading-relaxed text-linear-text-secondary">{summary}</p>
      )}
      <BriefingStatsRow>
        {stats.map((stat, index) => (
          <BriefingStat key={index} value={stat.value} label={stat.label} />
        ))}
      </BriefingStatsRow>
    </BriefingCard>
  );
}

// ====================================================================
// SupervisedCasesWidget
// ====================================================================

interface SupervisedCasesWidgetProps {
  cases: Array<{
    id: string;
    caseNumber: string;
    title: string;
    clientName: string;
    status: string;
    riskLevel: 'high' | 'medium' | 'low';
  }>;
  loading: boolean;
}

function SupervisedCasesWidgetComponent({ cases, loading }: SupervisedCasesWidgetProps) {
  const router = useRouter();

  if (loading) {
    return <WidgetSkeleton />;
  }

  // Map risk level to status for display
  const getStatusFromRisk = (risk: string): 'active' | 'pending' | 'at-risk' => {
    if (risk === 'high') return 'at-risk';
    if (risk === 'medium') return 'pending';
    return 'active';
  };

  return (
    <Widget>
      <LinearCardHeader
        title="Cazuri Supravegheate"
        icon={<CasesIcon />}
        actions={
          <CardActionButton onClick={() => router.push('/cases?filter=supervised')}>
            Vezi toate →
          </CardActionButton>
        }
      />
      <WidgetBody>
        {cases.length === 0 ? (
          <p className="py-8 text-center text-sm text-linear-text-tertiary">
            Nu există cazuri supravegheate
          </p>
        ) : (
          <div>
            {cases.slice(0, 4).map((caseItem) => (
              <CaseListItem
                key={caseItem.id}
                caseNumber={caseItem.caseNumber}
                title={caseItem.title}
                client={caseItem.clientName}
                status={getStatusFromRisk(caseItem.riskLevel)}
                onClick={() => router.push(`/cases/${caseItem.id}`)}
              />
            ))}
          </div>
        )}
      </WidgetBody>
    </Widget>
  );
}

// ====================================================================
// MyTasksWidget
// ====================================================================

interface MyTasksWidgetProps {
  tasks: Array<{
    id: string;
    title: string;
    priority: string;
    status: string;
    dueDate?: Date | string | null;
    case?: { caseNumber?: string } | null;
  }>;
  loading: boolean;
}

function MyTasksWidgetComponent({ tasks, loading }: MyTasksWidgetProps) {
  const router = useRouter();
  const [completedTasks, setCompletedTasks] = useState<Set<string>>(new Set());

  if (loading) {
    return <WidgetSkeleton />;
  }

  const handleToggleComplete = (taskId: string) => {
    setCompletedTasks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const mapPriority = (p: string): 'urgent' | 'high' | 'medium' | 'low' => {
    const lower = p.toLowerCase();
    if (lower === 'urgent') return 'urgent';
    if (lower === 'high') return 'high';
    if (lower === 'medium') return 'medium';
    return 'low';
  };

  const formatDueDate = (dueDate?: Date | string | null) => {
    if (!dueDate) return undefined;
    const date = dueDate instanceof Date ? dueDate : new Date(dueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (date < today) return 'Depășit';
    if (date.toDateString() === today.toDateString()) return 'Astăzi';
    if (date.toDateString() === tomorrow.toDateString()) return 'Mâine';
    return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
  };

  return (
    <Widget>
      <LinearCardHeader
        title="Sarcinile Mele"
        icon={<TasksIcon />}
        actions={
          <CardActionButton onClick={() => router.push('/tasks')}>+ Adaugă</CardActionButton>
        }
      />
      <WidgetBody>
        {tasks.length === 0 ? (
          <p className="py-8 text-center text-sm text-linear-text-tertiary">Nu există sarcini</p>
        ) : (
          <div>
            {tasks.slice(0, 4).map((task) => (
              <TaskListItem
                key={task.id}
                title={task.title}
                priority={mapPriority(task.priority)}
                caseRef={task.case?.caseNumber}
                dueDate={
                  formatDueDate(task.dueDate)
                    ? `Scadent: ${formatDueDate(task.dueDate)}`
                    : undefined
                }
                checked={completedTasks.has(task.id)}
                onCheckedChange={() => handleToggleComplete(task.id)}
              />
            ))}
          </div>
        )}
      </WidgetBody>
    </Widget>
  );
}

// ====================================================================
// FirmMetricsWidget
// ====================================================================

interface FirmMetricsWidgetProps {
  taskMetrics: {
    totalActiveTasks: number;
    overdueCount: number;
    dueTodayCount: number;
    dueThisWeekCount: number;
  };
  loading: boolean;
}

function FirmMetricsWidgetComponent({ taskMetrics, loading }: FirmMetricsWidgetProps) {
  if (loading) {
    return <WidgetSkeleton />;
  }

  return (
    <Widget>
      <LinearCardHeader
        title="Metrici Firmă"
        icon={<MetricsIcon />}
        actions={<CardActionButton>Această săptămână ▾</CardActionButton>}
      />
      <WidgetBody>
        <MetricGrid columns={2}>
          <MetricCard
            value={taskMetrics.totalActiveTasks}
            label="Sarcini active"
            trend={{
              direction: 'up',
              text: '+12% față de săpt. trecută',
            }}
          />
          <MetricCard
            value={taskMetrics.overdueCount}
            label="Întârziate"
            trend={{
              direction: 'down',
              text: `-${Math.max(0, taskMetrics.overdueCount - 2)} față de săpt. trecută`,
            }}
          />
          <MetricCard value={taskMetrics.dueTodayCount} label="Scadente azi" />
          <MetricCard value={taskMetrics.dueThisWeekCount} label="Această săptămână" />
        </MetricGrid>
      </WidgetBody>
    </Widget>
  );
}

// ====================================================================
// TeamWorkloadWidget
// ====================================================================

interface TeamMember {
  employeeId: string;
  name: string;
  weeklyUtilization: number;
}

interface TeamWorkloadWidgetProps {
  teamMembers: TeamMember[];
  loading: boolean;
}

function TeamWorkloadWidgetComponent({ teamMembers, loading }: TeamWorkloadWidgetProps) {
  if (loading) {
    return (
      <Widget span={2}>
        <div className="border-b border-linear-border-subtle px-5 py-4">
          <Skeleton className="h-4 w-36" />
        </div>
        <WidgetBody>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-4 py-2">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="flex-1">
                  <Skeleton className="h-4 w-32 mb-2" />
                  <Skeleton className="h-2 w-full rounded-full" />
                </div>
                <Skeleton className="h-4 w-10" />
              </div>
            ))}
          </div>
        </WidgetBody>
      </Widget>
    );
  }

  // Get initials from name
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <Widget span={2}>
      <LinearCardHeader
        title="Utilizare Echipă"
        icon={<TeamIcon />}
        actions={
          <>
            <CardActionButton>Săptămânal</CardActionButton>
            <CardActionButton>Lunar</CardActionButton>
          </>
        }
      />
      <WidgetBody>
        {teamMembers.length === 0 ? (
          <p className="py-8 text-center text-sm text-linear-text-tertiary">
            Nu există date despre echipă
          </p>
        ) : (
          <div>
            {teamMembers.slice(0, 4).map((member) => (
              <WorkloadItem
                key={member.employeeId}
                initials={getInitials(member.name)}
                name={member.name}
                percentage={member.weeklyUtilization}
              />
            ))}
          </div>
        )}
      </WidgetBody>
    </Widget>
  );
}

// ====================================================================
// Main Dashboard Component
// ====================================================================

export interface LinearPartnerDashboardProps {
  isEditing?: boolean;
}

export function LinearPartnerDashboard({ isEditing = false }: LinearPartnerDashboardProps) {
  const { supervisedCases, loading: casesLoading } = usePartnerDashboard();
  const { tasks: myTasks, loading: myTasksLoading } = useMyTasks({
    statuses: ['Pending', 'InProgress'],
  });
  const { tasks: allTasks, loading: allTasksLoading } = useTasks({
    statuses: ['Pending', 'InProgress'],
  });

  // Calculate firm task metrics
  const taskMetrics = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const endOfWeek = new Date(today);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    const overdue = allTasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < today && t.status !== 'Completed'
    );
    const dueToday = allTasks.filter((t) => {
      if (!t.dueDate) return false;
      const due = new Date(t.dueDate);
      due.setHours(0, 0, 0, 0);
      return due.getTime() === today.getTime();
    });
    const dueThisWeek = allTasks.filter((t) => {
      if (!t.dueDate) return false;
      const due = new Date(t.dueDate);
      return due >= today && due <= endOfWeek;
    });

    return {
      totalActiveTasks: allTasks.length,
      overdueCount: overdue.length,
      dueTodayCount: dueToday.length,
      dueThisWeekCount: dueThisWeek.length,
    };
  }, [allTasks]);

  // Mock team data (replace with real data when available)
  const teamMembers: TeamMember[] = [
    { employeeId: '1', name: 'Maria Popescu', weeklyUtilization: 92 },
    { employeeId: '2', name: 'Andrei Ionescu', weeklyUtilization: 87 },
    { employeeId: '3', name: 'Elena Dumitrescu', weeklyUtilization: 78 },
    { employeeId: '4', name: 'Cristian Vasile', weeklyUtilization: 65 },
  ];

  const loading = casesLoading || myTasksLoading || allTasksLoading;

  return (
    <div className="space-y-6" data-editing={isEditing}>
      {/* Morning Briefing */}
      <MorningBriefingWidget loading={loading} />

      {/* 3-column Widget Grid */}
      <WidgetGrid columns={3}>
        {/* Row 1: 3 equal widgets */}
        <SupervisedCasesWidgetComponent cases={supervisedCases} loading={casesLoading} />

        <MyTasksWidgetComponent tasks={myTasks} loading={myTasksLoading} />

        <FirmMetricsWidgetComponent taskMetrics={taskMetrics} loading={allTasksLoading} />

        {/* Row 2: TeamWorkload spans 2 columns */}
        <TeamWorkloadWidgetComponent teamMembers={teamMembers} loading={loading} />
      </WidgetGrid>
    </div>
  );
}

LinearPartnerDashboard.displayName = 'LinearPartnerDashboard';
