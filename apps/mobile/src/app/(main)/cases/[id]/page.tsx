'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import {
  ArrowLeft,
  Phone,
  Mail,
  Users,
  Calendar,
  Briefcase,
  FileText,
  CheckCircle2,
  Clock,
  AlertCircle,
  ChevronRight,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { Card, Avatar, Badge, StatusBadge, Skeleton, SkeletonCard, Button } from '@/components/ui';
import { useCase, type CaseTask, type CaseSummary } from '@/hooks/useCase';
import type { CaseStatus } from '@/hooks/useCases';
import { clsx } from 'clsx';

// ============================================
// Tab Types
// ============================================

type TabId = 'tasks' | 'team' | 'details';

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'tasks', label: 'Sarcini' },
  { id: 'team', label: 'Echipă' },
  { id: 'details', label: 'Detalii' },
];

// ============================================
// Page Component
// ============================================

export default function CaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const caseId = params.id as string;

  const {
    case: caseData,
    loading,
    error,
    leadMember,
    tasks,
    tasksLoading,
    taskCounts,
    summary,
    summaryLoading,
    fetchSummary,
  } = useCase(caseId);

  const [activeTab, setActiveTab] = useState<TabId>('tasks');

  if (loading && !caseData) {
    return <CaseDetailSkeleton />;
  }

  if (error || !caseData) {
    return (
      <div className="min-h-screen bg-bg-primary px-6 py-4">
        <button onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="w-6 h-6 text-text-primary" />
        </button>
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-error mx-auto mb-4" />
          <p className="text-text-secondary">Nu s-a putut încărca dosarul</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={() => router.back()}>
            Înapoi la dosare
          </Button>
        </div>
      </div>
    );
  }

  const statusMap: Record<CaseStatus, 'active' | 'pending' | 'completed' | 'draft'> = {
    Active: 'active',
    Pending: 'pending',
    Closed: 'completed',
    OnHold: 'draft',
  };

  return (
    <div className="min-h-screen bg-bg-primary pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg-primary/80 backdrop-blur-lg border-b border-white/5">
        <div className="px-6 py-4 flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="w-10 h-10 flex items-center justify-center -ml-2"
          >
            <ArrowLeft className="w-5 h-5 text-text-primary" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-text-primary truncate">{caseData.title}</p>
            {caseData.referenceNumbers && caseData.referenceNumbers.length > 0 && (
              <p className="text-xs text-text-tertiary truncate">{caseData.referenceNumbers[0]}</p>
            )}
          </div>
          <StatusBadge status={statusMap[caseData.status]} />
        </div>
      </div>

      {/* Case Overview */}
      <div className="px-6 py-4">
        <div className="space-y-3">
          {/* Client */}
          {caseData.client && (
            <div className="flex items-center gap-3">
              <Avatar name={caseData.client.name} size="lg" />
              <div>
                <p className="text-sm font-medium text-text-primary">{caseData.client.name}</p>
                <p className="text-xs text-text-tertiary">Client</p>
              </div>
            </div>
          )}

          {/* Meta Info */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="default" size="sm">
              <Briefcase className="w-3 h-3 mr-1" />
              {caseData.type}
            </Badge>
            {caseData.openedDate && (
              <Badge variant="default" size="sm">
                <Calendar className="w-3 h-3 mr-1" />
                {format(new Date(caseData.openedDate), 'd MMM yyyy', {
                  locale: ro,
                })}
              </Badge>
            )}
            {leadMember && (
              <Badge variant="default" size="sm">
                <Users className="w-3 h-3 mr-1" />
                {leadMember.user.firstName} {leadMember.user.lastName}
              </Badge>
            )}
          </div>

          {/* Reference Numbers */}
          {caseData.referenceNumbers && caseData.referenceNumbers.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {caseData.referenceNumbers.map((ref, i) => (
                <Badge key={i} variant="primary" size="sm">
                  {ref}
                </Badge>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* AI Summary */}
      <div className="px-6 py-2">
        <AISummaryCard
          summary={summary}
          loading={summaryLoading}
          onRefresh={() => fetchSummary()}
        />
      </div>

      {/* Tabs */}
      <div className="px-6 py-3">
        <div className="flex gap-1 bg-bg-elevated rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={clsx(
                'flex-1 py-2 rounded-md text-sm font-medium transition-colors',
                activeTab === tab.id ? 'bg-bg-card text-text-primary' : 'text-text-tertiary'
              )}
            >
              {tab.label}
              {tab.id === 'tasks' && taskCounts.pending > 0 && (
                <span className="ml-1.5 text-xs text-accent">{taskCounts.pending}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-6 py-2">
        {activeTab === 'tasks' && <TasksTab tasks={tasks} loading={tasksLoading} />}
        {activeTab === 'team' && <TeamTab caseData={caseData} />}
        {activeTab === 'details' && <DetailsTab caseData={caseData} />}
      </div>
    </div>
  );
}

// ============================================
// AI Summary Card
// ============================================

interface AISummaryCardProps {
  summary: CaseSummary | null;
  loading: boolean;
  onRefresh: () => void;
}

function AISummaryCard({ summary, loading, onRefresh }: AISummaryCardProps) {
  const [expanded, setExpanded] = useState(false);

  if (loading && !summary) {
    return (
      <Card padding="md">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium text-text-primary">Sumar AI</span>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </Card>
    );
  }

  if (!summary) {
    return (
      <Card padding="md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-text-tertiary" />
            <span className="text-sm text-text-tertiary">Sumar AI</span>
          </div>
          <Button variant="secondary" size="sm" onClick={onRefresh}>
            Generare rezumat
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card padding="md">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-accent" />
          <span className="text-sm font-medium text-text-primary">Sumar AI</span>
          {summary.isStale && (
            <Badge variant="default" size="sm">
              Vechi
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={onRefresh} disabled={loading}>
          <RefreshCw className={clsx('w-4 h-4', loading && 'animate-spin')} />
        </Button>
      </div>

      <p className="text-sm text-text-secondary leading-relaxed">
        {expanded
          ? summary.executiveSummary
          : summary.executiveSummary.slice(0, 150) +
            (summary.executiveSummary.length > 150 ? '...' : '')}
      </p>

      {summary.executiveSummary.length > 150 && (
        <button onClick={() => setExpanded(!expanded)} className="text-xs text-accent mt-2">
          {expanded ? 'Mai puțin' : 'Mai mult'}
        </button>
      )}

      {expanded && summary.openIssues.length > 0 && (
        <div className="mt-4 pt-3 border-t border-white/5">
          <p className="text-xs font-medium text-text-tertiary mb-2">Probleme deschise</p>
          <ul className="space-y-1">
            {summary.openIssues.map((issue, i) => (
              <li key={i} className="text-xs text-text-secondary flex items-start gap-2">
                <AlertCircle className="w-3 h-3 text-warning mt-0.5 shrink-0" />
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

// ============================================
// Tasks Tab
// ============================================

interface TasksTabProps {
  tasks: CaseTask[];
  loading: boolean;
}

function TasksTab({ tasks, loading }: TasksTabProps) {
  const router = useRouter();

  if (loading && tasks.length === 0) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-8">
        <CheckCircle2 className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
        <p className="text-sm text-text-secondary">Nicio sarcină pentru acest dosar</p>
      </div>
    );
  }

  const priorityColors: Record<string, string> = {
    Urgent: 'bg-error',
    High: 'bg-warning',
    Normal: 'bg-accent',
    Low: 'bg-text-tertiary',
  };

  return (
    <div className="space-y-2">
      {tasks.map((task) => (
        <Card
          key={task.id}
          interactive
          padding="md"
          onClick={() => router.push(`/tasks/${task.id}`)}
        >
          <div className="flex items-start gap-3">
            <div
              className={clsx(
                'w-2 h-2 rounded-full mt-2 shrink-0',
                priorityColors[task.priority] || 'bg-text-tertiary'
              )}
            />
            <div className="flex-1 min-w-0">
              <p
                className={clsx(
                  'text-sm',
                  task.status === 'Completed'
                    ? 'text-text-tertiary line-through'
                    : 'text-text-primary'
                )}
              >
                {task.title}
              </p>
              <div className="flex items-center gap-2 mt-1 text-xs text-text-tertiary">
                {task.dueDate && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(new Date(task.dueDate), 'd MMM', { locale: ro })}
                  </span>
                )}
                {task.assignee && (
                  <span>
                    {task.assignee.firstName} {task.assignee.lastName}
                  </span>
                )}
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-text-tertiary shrink-0" />
          </div>
        </Card>
      ))}
    </div>
  );
}

// ============================================
// Team Tab
// ============================================

interface TeamTabProps {
  caseData: {
    teamMembers: Array<{
      id: string;
      role: string;
      user: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      };
    }>;
    actors: Array<{
      id: string;
      name: string;
      role: string;
      organization: string | null;
      email: string | null;
      phone: string | null;
    }>;
  };
}

function TeamTab({ caseData }: TeamTabProps) {
  const roleLabels: Record<string, string> = {
    Lead: 'Responsabil',
    Member: 'Membru',
    Supervisor: 'Supervizor',
  };

  return (
    <div className="space-y-4">
      {/* Team Members */}
      <div>
        <p className="text-xs font-medium text-text-tertiary mb-2">Echipa internă</p>
        <div className="space-y-2">
          {caseData.teamMembers.map((member) => (
            <Card key={member.id} padding="md">
              <div className="flex items-center gap-3">
                <Avatar name={`${member.user.firstName} ${member.user.lastName}`} size="md" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text-primary">
                    {member.user.firstName} {member.user.lastName}
                  </p>
                  <p className="text-xs text-text-tertiary">
                    {roleLabels[member.role] || member.role}
                  </p>
                </div>
                <a
                  href={`mailto:${member.user.email}`}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-bg-hover"
                >
                  <Mail className="w-4 h-4 text-text-secondary" />
                </a>
              </div>
            </Card>
          ))}
        </div>
      </div>

      {/* Actors */}
      {caseData.actors.length > 0 && (
        <div>
          <p className="text-xs font-medium text-text-tertiary mb-2">Părți implicate</p>
          <div className="space-y-2">
            {caseData.actors.map((actor) => (
              <Card key={actor.id} padding="md">
                <div className="flex items-start gap-3">
                  <Avatar name={actor.name} size="md" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-text-primary">{actor.name}</p>
                    <p className="text-xs text-text-tertiary">
                      {actor.role}
                      {actor.organization && ` · ${actor.organization}`}
                    </p>
                    {(actor.email || actor.phone) && (
                      <div className="flex items-center gap-3 mt-2">
                        {actor.email && (
                          <a
                            href={`mailto:${actor.email}`}
                            className="text-xs text-accent flex items-center gap-1"
                          >
                            <Mail className="w-3 h-3" />
                            Email
                          </a>
                        )}
                        {actor.phone && (
                          <a
                            href={`tel:${actor.phone}`}
                            className="text-xs text-accent flex items-center gap-1"
                          >
                            <Phone className="w-3 h-3" />
                            Telefon
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================
// Details Tab
// ============================================

interface DetailsTabProps {
  caseData: {
    title: string;
    description: string | null;
    keywords: string[] | null;
    openedDate: string | null;
    updatedAt: string;
  };
}

function DetailsTab({ caseData }: DetailsTabProps) {
  return (
    <div className="space-y-4">
      {/* Title */}
      <div>
        <p className="text-xs font-medium text-text-tertiary mb-1">Titlu</p>
        <p className="text-sm text-text-primary">{caseData.title}</p>
      </div>

      {/* Description */}
      {caseData.description && (
        <div>
          <p className="text-xs font-medium text-text-tertiary mb-1">Descriere</p>
          <p className="text-sm text-text-secondary whitespace-pre-wrap">{caseData.description}</p>
        </div>
      )}

      {/* Keywords */}
      {caseData.keywords && caseData.keywords.length > 0 && (
        <div>
          <p className="text-xs font-medium text-text-tertiary mb-2">Cuvinte cheie</p>
          <div className="flex flex-wrap gap-1">
            {caseData.keywords.map((keyword, i) => (
              <Badge key={i} variant="default" size="sm">
                {keyword}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Dates */}
      <div className="grid grid-cols-2 gap-4">
        {caseData.openedDate && (
          <div>
            <p className="text-xs font-medium text-text-tertiary mb-1">Data deschiderii</p>
            <p className="text-sm text-text-primary">
              {format(new Date(caseData.openedDate), 'd MMMM yyyy', {
                locale: ro,
              })}
            </p>
          </div>
        )}
        <div>
          <p className="text-xs font-medium text-text-tertiary mb-1">Ultima actualizare</p>
          <p className="text-sm text-text-primary">
            {format(new Date(caseData.updatedAt), 'd MMMM yyyy', {
              locale: ro,
            })}
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================
// Loading Skeleton
// ============================================

function CaseDetailSkeleton() {
  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-4">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-4 w-24 mb-1" />
          <Skeleton className="h-3 w-48" />
        </div>
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>

      {/* Overview */}
      <div className="px-6 py-4 space-y-3">
        <div className="flex items-center gap-3">
          <Skeleton className="w-12 h-12 rounded-full" />
          <div>
            <Skeleton className="h-4 w-32 mb-1" />
            <Skeleton className="h-3 w-16" />
          </div>
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-24 rounded-full" />
        </div>
      </div>

      {/* Summary */}
      <div className="px-6 py-2">
        <SkeletonCard />
      </div>

      {/* Tabs */}
      <div className="px-6 py-3">
        <Skeleton className="h-10 w-full rounded-lg" />
      </div>

      {/* Content */}
      <div className="px-6 py-2 space-y-2">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    </div>
  );
}
