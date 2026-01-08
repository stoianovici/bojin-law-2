'use client';

import { useMemo } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  CheckSquare,
  Clock,
  AlertCircle,
  FolderOpen,
  BarChart3,
  User,
  Zap,
  Search,
  Plus,
  Bell,
} from 'lucide-react';
import { useQuery } from '@/hooks/useGraphQL';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Button,
  Avatar,
  AvatarFallback,
} from '@/components/ui';
import { useAuth } from '@/hooks/useAuth';
import { GET_CASES, GET_MY_TASKS, GET_TEAM_WORKLOAD } from '@/graphql/queries';

// ============================================================================
// Types
// ============================================================================

interface Task {
  id: string;
  title: string;
  status: string;
  priority: string;
  dueDate: string;
  case: { id: string; caseNumber: string; title: string };
  assignee: { firstName: string; lastName: string };
}

interface Case {
  id: string;
  caseNumber: string;
  title: string;
  status: string;
  type: string;
  client: { id: string; name: string };
  updatedAt: string;
}

interface TeamMember {
  userId: string;
  user: { id: string; firstName: string; lastName: string };
  averageUtilization: number;
  status: string;
}

interface TeamWorkload {
  teamAverageUtilization: number;
  members: TeamMember[];
}

// Query result types
interface CasesQueryResult {
  cases: Case[];
}

interface TasksQueryResult {
  myTasks: Task[];
}

interface WorkloadQueryResult {
  teamWorkload: TeamWorkload;
}

// ============================================================================
// Utilities
// ============================================================================

function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bună dimineața';
  if (hour < 18) return 'Bună ziua';
  return 'Bună seara';
}

function getDateString() {
  const weekday = ['Duminică', 'Luni', 'Marți', 'Miercuri', 'Joi', 'Vineri', 'Sâmbătă'];
  const months = [
    'ianuarie',
    'februarie',
    'martie',
    'aprilie',
    'mai',
    'iunie',
    'iulie',
    'august',
    'septembrie',
    'octombrie',
    'noiembrie',
    'decembrie',
  ];
  const now = new Date();
  return `${weekday[now.getDay()]}, ${now.getDate()} ${months[now.getMonth()]} ${now.getFullYear()}`;
}

function isToday(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();
  return date.toDateString() === today.toDateString();
}

function isThisWeek(dateStr: string): boolean {
  const date = new Date(dateStr);
  const today = new Date();
  const weekStart = new Date(today);
  weekStart.setDate(today.getDate() - today.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);
  return date >= weekStart && date < weekEnd;
}

function isOverdue(dueDate: string, status: string): boolean {
  if (status === 'Completed' || status === 'Cancelled') return false;
  return new Date(dueDate) < new Date();
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName?.[0] || ''}${lastName?.[0] || ''}`.toUpperCase();
}

function getWeekDateRange() {
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  weekEnd.setHours(23, 59, 59, 999);
  return {
    start: weekStart.toISOString(),
    end: weekEnd.toISOString(),
  };
}

// ============================================================================
// Priority Styles
// ============================================================================

const priorityStyles: Record<string, string> = {
  Urgent: 'bg-red-500/20 text-red-400 border border-red-500/30',
  High: 'bg-orange-500/20 text-orange-400 border border-orange-500/30',
  Medium: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  Low: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
};

const priorityLabels: Record<string, string> = {
  Urgent: 'Urgent',
  High: 'Prioritate înaltă',
  Medium: 'Normal',
  Low: 'Normal',
};

const caseStatusColors: Record<string, string> = {
  Active: 'bg-green-500',
  Pending: 'bg-yellow-500',
  OnHold: 'bg-orange-500',
  Closed: 'bg-gray-500',
};

// ============================================================================
// Skeleton Components
// ============================================================================

function StatSkeleton() {
  return (
    <div className="relative p-5 rounded-xl bg-linear-bg-secondary border border-linear-border-subtle animate-pulse">
      <div className="flex items-center gap-3 mb-3">
        <div className="h-9 w-9 rounded-lg bg-linear-bg-tertiary" />
      </div>
      <div className="h-8 w-12 bg-linear-bg-tertiary rounded mb-2" />
      <div className="h-4 w-24 bg-linear-bg-tertiary rounded" />
    </div>
  );
}

function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <div className="space-y-5">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse">
          <div className="h-4 w-28 bg-linear-bg-tertiary rounded mb-2" />
          <div className="h-5 w-full bg-linear-bg-tertiary rounded mb-2" />
          <div className="h-4 w-36 bg-linear-bg-tertiary rounded" />
        </div>
      ))}
    </div>
  );
}

function TeamSkeleton() {
  return (
    <div className="space-y-5">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 animate-pulse">
          <div className="h-10 w-10 rounded-full bg-linear-bg-tertiary" />
          <div className="flex-1">
            <div className="h-5 w-36 bg-linear-bg-tertiary rounded mb-2" />
            <div className="h-2 w-full bg-linear-bg-tertiary rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ============================================================================
// Main Dashboard Component
// ============================================================================

export default function DashboardPage() {
  const { user } = useAuth();
  const dateRange = useMemo(() => getWeekDateRange(), []);

  // Fetch data
  const { data: casesData, loading: loadingCases } = useQuery<CasesQueryResult>(GET_CASES, {
    variables: { status: 'Active' },
  });

  const { data: tasksData, loading: loadingTasks } = useQuery<TasksQueryResult>(GET_MY_TASKS);

  const { data: workloadData, loading: loadingWorkload } = useQuery<WorkloadQueryResult>(
    GET_TEAM_WORKLOAD,
    {
      variables: { dateRange },
    }
  );

  // Compute stats
  const activeCases = casesData?.cases?.length || 0;
  const myTasks: Task[] = tasksData?.myTasks || [];
  const recentCases: Case[] = (casesData?.cases || []).slice(0, 4);
  const teamWorkload: TeamWorkload | null = workloadData?.teamWorkload || null;

  const urgentTasks = myTasks.filter((t) => t.priority === 'Urgent' || t.priority === 'High');
  const todayTasks = myTasks.filter((t) => isToday(t.dueDate) && t.status !== 'Completed');
  const overdueTasks = myTasks.filter((t) => isOverdue(t.dueDate, t.status));
  const thisWeekTasks = myTasks.filter((t) => isThisWeek(t.dueDate) && t.status !== 'Completed');
  const teamUtilization = teamWorkload?.teamAverageUtilization || 0;

  // Tasks sorted by due date for display
  const upcomingTasks = myTasks
    .filter((t) => t.status !== 'Completed' && t.status !== 'Cancelled')
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
    .slice(0, 4);

  // Generate contextual summary as React elements
  const summaryElements: React.ReactNode[] = [];
  if (todayTasks.length > 0) {
    summaryElements.push(
      <span key="today">
        Astăzi ai{' '}
        <strong className="text-linear-text-primary font-semibold">
          {todayTasks.length} termene de judecată
        </strong>{' '}
        programate
      </span>
    );
  }
  if (urgentTasks.length > 0) {
    summaryElements.push(
      <span key="urgent">
        {' '}
        și{' '}
        <strong className="text-linear-text-primary font-semibold">
          {urgentTasks.length} sarcini urgente
        </strong>{' '}
        de finalizat
      </span>
    );
  }
  if (overdueTasks.length > 0) {
    const firstOverdue = overdueTasks[0];
    summaryElements.push(
      <span key="overdue">
        . Cazul{' '}
        <strong className="text-linear-text-primary font-semibold">
          {firstOverdue.case.title}
        </strong>{' '}
        necesită atenție - termenul de răspuns la întâmpinare expiră mâine
      </span>
    );
  }
  if (teamUtilization > 0) {
    summaryElements.push(
      <span key="team">
        . Echipa a înregistrat{' '}
        <strong className="text-linear-text-primary font-semibold">
          {Math.round(teamUtilization)}%
        </strong>{' '}
        din orele target săptămâna aceasta
      </span>
    );
  }

  const firstName = user?.name?.split(' ')[0] || 'Utilizator';

  return (
    <div className="flex-1 w-full h-full overflow-auto p-4 xl:p-6 space-y-4 xl:space-y-6">
      {/* Greeting Section */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="h-14 w-14 rounded-full bg-linear-bg-tertiary flex items-center justify-center">
            <User className="h-7 w-7 text-linear-text-muted" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-linear-text-primary">
              {getGreeting()}, {firstName}
            </h1>
            <p className="text-base text-linear-text-muted mt-1">{getDateString()}</p>
            {summaryElements.length > 0 && (
              <p className="text-base text-linear-text-secondary mt-4 max-w-3xl leading-relaxed">
                {summaryElements}.
              </p>
            )}
          </div>
        </div>
        <Button variant="secondary">
          <Bell className="h-4 w-4 mr-2" />
          Actualizează
        </Button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {loadingCases ? (
          <StatSkeleton />
        ) : (
          <Link
            href="/cases"
            className="group relative p-5 rounded-xl bg-linear-bg-secondary border border-linear-border-subtle hover:border-linear-accent/40 hover:bg-linear-bg-tertiary transition-all duration-200"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-lg bg-blue-500/10 flex items-center justify-center">
                <Briefcase className="h-4.5 w-4.5 text-blue-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-linear-text-primary group-hover:text-linear-accent transition-colors">
              {activeCases}
            </p>
            <p className="text-sm text-linear-text-muted mt-1">Cazuri active</p>
          </Link>
        )}

        {loadingTasks ? (
          <StatSkeleton />
        ) : (
          <Link
            href="/tasks?priority=urgent"
            className="group relative p-5 rounded-xl bg-linear-bg-secondary border border-linear-border-subtle hover:border-linear-accent/40 hover:bg-linear-bg-tertiary transition-all duration-200"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-lg bg-orange-500/10 flex items-center justify-center">
                <AlertCircle className="h-4.5 w-4.5 text-orange-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-linear-text-primary group-hover:text-linear-accent transition-colors">
              {urgentTasks.length}
            </p>
            <p className="text-sm text-linear-text-muted mt-1">Sarcini urgente</p>
          </Link>
        )}

        {loadingTasks ? (
          <StatSkeleton />
        ) : (
          <Link
            href="/tasks?due=today"
            className="group relative p-5 rounded-xl bg-linear-bg-secondary border border-linear-border-subtle hover:border-linear-accent/40 hover:bg-linear-bg-tertiary transition-all duration-200"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-lg bg-green-500/10 flex items-center justify-center">
                <Clock className="h-4.5 w-4.5 text-green-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-linear-text-primary group-hover:text-linear-accent transition-colors">
              {todayTasks.length}
            </p>
            <p className="text-sm text-linear-text-muted mt-1">Termene azi</p>
          </Link>
        )}

        {loadingWorkload ? (
          <StatSkeleton />
        ) : (
          <div className="relative p-5 rounded-xl bg-linear-bg-secondary border border-linear-border-subtle">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-9 w-9 rounded-lg bg-purple-500/10 flex items-center justify-center">
                <BarChart3 className="h-4.5 w-4.5 text-purple-400" />
              </div>
            </div>
            <p className="text-3xl font-bold text-linear-text-primary">
              {Math.round(teamUtilization)}%
            </p>
            <p className="text-sm text-linear-text-muted mt-1">Utilizare echipă</p>
          </div>
        )}
      </div>

      {/* Three Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Recent Cases */}
        <Card className="bg-linear-bg-secondary border-linear-border-subtle">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-md bg-blue-500/10 flex items-center justify-center">
                <FolderOpen className="h-4 w-4 text-blue-400" />
              </div>
              <CardTitle className="text-sm font-semibold tracking-tight">
                Cazuri Supravegheate
              </CardTitle>
            </div>
            <Link
              href="/cases"
              className="text-xs text-linear-text-muted hover:text-linear-accent transition-colors font-medium"
            >
              Vezi toate →
            </Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {loadingCases ? (
              <ListSkeleton rows={3} />
            ) : recentCases.length > 0 ? (
              recentCases.slice(0, 3).map((c) => (
                <Link
                  key={c.id}
                  href={`/cases/${c.id}`}
                  className="flex items-center gap-3 p-3 -mx-3 rounded-lg hover:bg-linear-bg-tertiary/50 transition-colors group"
                >
                  <div
                    className={`w-2 h-2 rounded-full shrink-0 ${caseStatusColors[c.status] || 'bg-gray-500'}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-linear-text-primary group-hover:text-linear-accent transition-colors truncate">
                      {c.title}
                    </p>
                    <p className="text-xs text-linear-text-muted mt-0.5 flex items-center gap-1.5">
                      <span className="font-mono">{c.caseNumber}</span>
                      <span className="text-linear-text-muted/50">·</span>
                      <span className="truncate">{c.client?.name}</span>
                    </p>
                  </div>
                </Link>
              ))
            ) : (
              <div className="py-8 text-center">
                <FolderOpen className="h-8 w-8 text-linear-text-muted/30 mx-auto mb-2" />
                <p className="text-sm text-linear-text-muted">Nu ai cazuri active.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* My Tasks */}
        <Card className="bg-linear-bg-secondary border-linear-border-subtle">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-md bg-green-500/10 flex items-center justify-center">
                <CheckSquare className="h-4 w-4 text-green-400" />
              </div>
              <CardTitle className="text-sm font-semibold tracking-tight">Sarcinile Mele</CardTitle>
            </div>
            <Link
              href="/tasks/new"
              className="text-xs text-linear-text-muted hover:text-linear-accent transition-colors font-medium"
            >
              + Adaugă
            </Link>
          </CardHeader>
          <CardContent className="space-y-1">
            {loadingTasks ? (
              <ListSkeleton rows={3} />
            ) : upcomingTasks.length > 0 ? (
              upcomingTasks.slice(0, 3).map((task) => (
                <Link
                  key={task.id}
                  href={`/tasks/${task.id}`}
                  className="flex items-start gap-3 p-3 -mx-3 rounded-lg hover:bg-linear-bg-tertiary/50 transition-colors group"
                >
                  <div className="mt-0.5">
                    <div className="w-4 h-4 rounded border-2 border-linear-border-default group-hover:border-linear-accent transition-colors" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-linear-text-primary group-hover:text-linear-accent transition-colors truncate">
                      {task.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-1 text-xs">
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${priorityStyles[task.priority] || priorityStyles['Medium']}`}
                      >
                        {priorityLabels[task.priority] || 'Normal'}
                      </span>
                      <span className="text-linear-text-muted/50">·</span>
                      <span
                        className={`${isOverdue(task.dueDate, task.status) ? 'text-red-400' : 'text-linear-text-muted'}`}
                      >
                        {new Date(task.dueDate).toLocaleDateString('ro-RO', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </span>
                    </div>
                  </div>
                </Link>
              ))
            ) : (
              <div className="py-8 text-center">
                <CheckSquare className="h-8 w-8 text-linear-text-muted/30 mx-auto mb-2" />
                <p className="text-sm text-linear-text-muted">Nu ai sarcini active.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Firm Metrics */}
        <Card className="bg-linear-bg-secondary border-linear-border-subtle">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-md bg-purple-500/10 flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-purple-400" />
              </div>
              <CardTitle className="text-sm font-semibold tracking-tight">Metrici Firmă</CardTitle>
            </div>
            <span className="text-xs text-linear-text-muted font-medium cursor-pointer hover:text-linear-text-secondary transition-colors">
              Această săptămână ▼
            </span>
          </CardHeader>
          <CardContent>
            {loadingTasks ? (
              <div className="grid grid-cols-2 gap-4 animate-pulse">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="p-3 rounded-lg bg-linear-bg-tertiary/30">
                    <div className="h-7 w-10 bg-linear-bg-tertiary rounded mb-1.5" />
                    <div className="h-3 w-20 bg-linear-bg-tertiary rounded" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-linear-bg-tertiary/30">
                  <p className="text-2xl font-bold text-linear-text-primary">
                    {myTasks.filter((t) => t.status !== 'Completed').length}
                  </p>
                  <p className="text-xs text-linear-text-muted mt-0.5">Sarcini active</p>
                  <p className="text-[10px] text-green-400 mt-1 font-medium">
                    +12% față de săpt. trecută
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-linear-bg-tertiary/30">
                  <p
                    className={`text-2xl font-bold ${overdueTasks.length > 0 ? 'text-red-400' : 'text-linear-text-primary'}`}
                  >
                    {overdueTasks.length}
                  </p>
                  <p className="text-xs text-linear-text-muted mt-0.5">Întârziate</p>
                </div>
                <div className="p-3 rounded-lg bg-linear-bg-tertiary/30">
                  <p className="text-2xl font-bold text-linear-text-primary">{todayTasks.length}</p>
                  <p className="text-xs text-linear-text-muted mt-0.5">Scadențe azi</p>
                </div>
                <div className="p-3 rounded-lg bg-linear-bg-tertiary/30">
                  <p className="text-2xl font-bold text-linear-text-primary">
                    {thisWeekTasks.length}
                  </p>
                  <p className="text-xs text-linear-text-muted mt-0.5">Această săptămână</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Team Utilization + Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Team Utilization */}
        <Card className="bg-linear-bg-secondary border-linear-border-subtle">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-md bg-cyan-500/10 flex items-center justify-center">
                <User className="h-4 w-4 text-cyan-400" />
              </div>
              <CardTitle className="text-sm font-semibold tracking-tight">
                Utilizare Echipă
              </CardTitle>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <button className="px-2.5 py-1 rounded-md bg-linear-bg-tertiary text-linear-text-primary font-medium">
                Săptămânal
              </button>
              <button className="px-2.5 py-1 rounded-md text-linear-text-muted hover:text-linear-text-secondary transition-colors">
                Lunar
              </button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {loadingWorkload ? (
              <TeamSkeleton />
            ) : teamWorkload?.members?.length ? (
              teamWorkload.members.slice(0, 4).map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center gap-3 p-2 -mx-2 rounded-lg hover:bg-linear-bg-tertiary/30 transition-colors"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-linear-accent/20 text-linear-accent text-xs font-medium">
                      {getInitials(member.user.firstName, member.user.lastName)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1.5">
                      <p className="text-sm font-medium text-linear-text-primary truncate">
                        {member.user.firstName} {member.user.lastName}
                      </p>
                      <span className="text-xs text-linear-text-secondary font-medium ml-2">
                        {Math.round(member.averageUtilization)}%
                      </span>
                    </div>
                    <div className="h-1.5 bg-linear-bg-tertiary rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-linear-accent to-cyan-400 rounded-full transition-all"
                        style={{ width: `${Math.min(member.averageUtilization, 100)}%` }}
                      />
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="py-8 text-center">
                <User className="h-8 w-8 text-linear-text-muted/30 mx-auto mb-2" />
                <p className="text-sm text-linear-text-muted">Nu există date de utilizare.</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card className="bg-linear-bg-secondary border-linear-border-subtle">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-7 w-7 rounded-md bg-linear-accent/10 flex items-center justify-center">
                <Zap className="h-4 w-4 text-linear-accent" />
              </div>
              <CardTitle className="text-sm font-semibold tracking-tight">Acțiuni rapide</CardTitle>
            </div>
            <span className="text-[10px] text-linear-text-muted px-1.5 py-0.5 rounded bg-linear-bg-tertiary font-mono">
              ⌘K
            </span>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search */}
            <button
              onClick={() => {
                const event = new KeyboardEvent('keydown', { key: 'k', metaKey: true });
                document.dispatchEvent(event);
              }}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-lg border border-linear-border-subtle bg-linear-bg-tertiary/50 hover:bg-linear-bg-tertiary hover:border-linear-border-default transition-all text-left"
            >
              <Search className="h-4 w-4 text-linear-text-muted" />
              <span className="text-sm text-linear-text-muted">Caută sau execută o comandă...</span>
            </button>

            {/* Frequent Actions */}
            <div>
              <p className="text-[10px] font-semibold text-linear-text-muted uppercase tracking-wider mb-2">
                Acțiuni frecvente
              </p>
              <div className="space-y-0.5">
                <Link
                  href="/cases/new"
                  className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg hover:bg-linear-bg-tertiary/50 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-md bg-linear-bg-tertiary flex items-center justify-center group-hover:bg-linear-bg-elevated">
                      <Plus className="h-4 w-4 text-linear-text-muted" />
                    </div>
                    <span className="text-sm text-linear-text-primary">Caz nou</span>
                  </div>
                  <span className="text-[10px] text-linear-text-muted px-1.5 py-0.5 rounded bg-linear-bg-tertiary font-mono">
                    ⌘N
                  </span>
                </Link>
                <Link
                  href="/tasks/new"
                  className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg hover:bg-linear-bg-tertiary/50 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-md bg-linear-bg-tertiary flex items-center justify-center group-hover:bg-linear-bg-elevated">
                      <CheckSquare className="h-4 w-4 text-linear-text-muted" />
                    </div>
                    <span className="text-sm text-linear-text-primary">Sarcină nouă</span>
                  </div>
                  <span className="text-[10px] text-linear-text-muted px-1.5 py-0.5 rounded bg-linear-bg-tertiary font-mono">
                    ⌘T
                  </span>
                </Link>
                <Link
                  href="/time/new"
                  className="flex items-center justify-between py-2 px-2 -mx-2 rounded-lg hover:bg-linear-bg-tertiary/50 transition-colors group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-md bg-linear-bg-tertiary flex items-center justify-center group-hover:bg-linear-bg-elevated">
                      <Clock className="h-4 w-4 text-linear-text-muted" />
                    </div>
                    <span className="text-sm text-linear-text-primary">Înregistrare timp</span>
                  </div>
                  <span className="text-[10px] text-linear-text-muted px-1.5 py-0.5 rounded bg-linear-bg-tertiary font-mono">
                    ⌘L
                  </span>
                </Link>
                <button className="w-full flex items-center justify-between py-2 px-2 -mx-2 rounded-lg hover:bg-linear-bg-tertiary/50 transition-colors group">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-md bg-linear-accent/15 flex items-center justify-center">
                      <Zap className="h-4 w-4 text-linear-accent" />
                    </div>
                    <span className="text-sm text-linear-text-primary">Întreabă AI</span>
                  </div>
                  <span className="text-[10px] text-linear-text-muted px-1.5 py-0.5 rounded bg-linear-bg-tertiary font-mono">
                    ⌘J
                  </span>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
