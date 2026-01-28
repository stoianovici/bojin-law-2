'use client';

import Link from 'next/link';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import { Briefcase, CheckSquare, Clock, ChevronRight, AlertCircle } from 'lucide-react';
import { LargeHeader } from '@/components/layout';
import { Card, Badge, Avatar, SkeletonCard } from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { useDashboard } from '@/hooks/useDashboard';
import { clsx } from 'clsx';

export default function DashboardPage() {
  const { user } = useAuth();
  const { recentCases, urgentTasks, pendingTasksCount, activeCasesCount, loading } = useDashboard();

  const greeting = getGreeting();

  return (
    <div className="min-h-screen">
      {/* Header */}
      <LargeHeader
        title={`${greeting}, ${user?.name?.split(' ')[0] || 'User'}`}
        subtitle={format(new Date(), 'EEEE, d MMMM', { locale: ro })}
        showNotifications
      />

      {/* Quick Stats */}
      <div className="px-6 py-4 grid grid-cols-2 gap-3">
        <StatCard icon={Briefcase} label="Dosare active" value={activeCasesCount} href="/cases" />
        <StatCard icon={CheckSquare} label="Sarcini" value={pendingTasksCount} href="/tasks" />
      </div>

      {/* Urgent Tasks */}
      {urgentTasks.length > 0 && (
        <section className="px-6 py-4">
          <SectionHeader title="Urgente" icon={AlertCircle} iconColor="text-error" />
          <div className="space-y-2 mt-3">
            {urgentTasks.slice(0, 3).map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </div>
        </section>
      )}

      {/* Recent Cases */}
      <section className="px-6 py-4">
        <SectionHeader title="Dosare recente" action={{ label: 'Vezi toate', href: '/cases' }} />
        <div className="space-y-2 mt-3">
          {loading ? (
            <>
              <SkeletonCard />
              <SkeletonCard />
            </>
          ) : recentCases.length > 0 ? (
            recentCases.map((caseItem) => <CaseCard key={caseItem.id} caseData={caseItem} />)
          ) : (
            <p className="text-sm text-text-tertiary py-4 text-center">Nu există dosare recente</p>
          )}
        </div>
      </section>
    </div>
  );
}

// ============================================
// Helper Components
// ============================================

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bună dimineața';
  if (hour < 18) return 'Bună ziua';
  return 'Bună seara';
}

interface StatCardProps {
  icon: React.ElementType;
  label: string;
  value: number;
  href: string;
}

function StatCard({ icon: Icon, label, value, href }: StatCardProps) {
  return (
    <Link href={href}>
      <Card interactive className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-accent-muted">
          <Icon className="w-5 h-5 text-accent" />
        </div>
        <div>
          <p className="text-2xl font-bold text-text-primary">{value}</p>
          <p className="text-xs text-text-secondary">{label}</p>
        </div>
      </Card>
    </Link>
  );
}

interface SectionHeaderProps {
  title: string;
  icon?: React.ElementType;
  iconColor?: string;
  action?: { label: string; href: string };
}

function SectionHeader({ title, icon: Icon, iconColor, action }: SectionHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        {Icon && <Icon className={clsx('w-4 h-4', iconColor || 'text-text-secondary')} />}
        <h2 className="text-sm font-semibold text-text-primary">{title}</h2>
      </div>
      {action && (
        <Link href={action.href} className="text-xs text-accent flex items-center gap-1">
          {action.label}
          <ChevronRight className="w-3 h-3" />
        </Link>
      )}
    </div>
  );
}

interface TaskCardProps {
  task: {
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    case: {
      id: string;
      caseNumber: string;
      title: string;
      referenceNumbers: string[] | null;
    } | null;
  };
}

function TaskCard({ task }: TaskCardProps) {
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date();
  const courtRef = task.case?.referenceNumbers?.[0];

  return (
    <Link href={`/tasks?id=${task.id}`}>
      <Card interactive padding="sm">
        <div className="flex items-start gap-3">
          <div
            className={clsx(
              'mt-1 w-2 h-2 rounded-full shrink-0',
              task.priority === 'Urgent' ? 'bg-error' : 'bg-warning'
            )}
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{task.title}</p>
            {task.case && (
              <p className="text-xs text-text-tertiary truncate mt-0.5">
                {task.case.title}
                {courtRef && ` · ${courtRef}`}
              </p>
            )}
            {task.dueDate && (
              <p className={clsx('text-xs mt-1', isOverdue ? 'text-error' : 'text-text-secondary')}>
                <Clock className="w-3 h-3 inline mr-1" />
                {format(new Date(task.dueDate), 'd MMM', { locale: ro })}
              </p>
            )}
          </div>
        </div>
      </Card>
    </Link>
  );
}

interface CaseCardProps {
  caseData: {
    id: string;
    caseNumber: string;
    title: string;
    type: string;
    referenceNumbers: string[] | null;
    client: { id: string; name: string } | null;
    updatedAt: string;
  };
}

function CaseCard({ caseData }: CaseCardProps) {
  const courtRef = caseData.referenceNumbers?.[0];

  return (
    <Link href={`/cases/${caseData.id}`}>
      <Card interactive padding="sm">
        <div className="flex items-center gap-3">
          <Avatar name={caseData.client?.name || caseData.title} size="md" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">{caseData.title}</p>
            {courtRef && <p className="text-xs text-text-secondary truncate">{courtRef}</p>}
            {caseData.client && (
              <p className="text-xs text-text-tertiary truncate mt-0.5">{caseData.client.name}</p>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-text-tertiary shrink-0" />
        </div>
      </Card>
    </Link>
  );
}
