'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import {
  ArrowLeft,
  Phone,
  Mail,
  MapPin,
  Building2,
  User,
  ChevronRight,
  Clock,
  FileText,
  AlertCircle,
  Briefcase,
} from 'lucide-react';
// Note: format and ro are used in TasksTab
import {
  Card,
  Avatar,
  Badge,
  StatusBadge,
  Skeleton,
  SkeletonCard,
  Button,
  DocumentPreview,
} from '@/components/ui';
import { useClient, type ClientTask, type ClientCase, type InboxDocument } from '@/hooks/useClient';
import { useDocumentPreview } from '@/hooks/useDocumentPreview';
import type { CaseStatus } from '@/hooks/useCases';
import { clsx } from 'clsx';

// ============================================
// Types
// ============================================

type TabId = 'tasks' | 'documents' | 'cases';

interface CaseWithDocuments extends ClientCase {
  documentCount: number;
}

const tabs: Array<{ id: TabId; label: string }> = [
  { id: 'tasks', label: 'Sarcini' },
  { id: 'documents', label: 'Documente' },
  { id: 'cases', label: 'Dosare' },
];

// ============================================
// Helper: Get court reference number from referenceNumbers
// ============================================

function getCourtReference(referenceNumbers: string[] | null): string | null {
  if (!referenceNumbers || referenceNumbers.length === 0) return null;
  return referenceNumbers[0];
}

// ============================================
// Page Component
// ============================================

export default function ClientDetailPage() {
  const params = useParams();
  const router = useRouter();
  const clientId = params.id as string;

  const {
    client,
    loading,
    error,
    tasks,
    tasksLoading,
    taskCounts,
    casesWithDocuments,
    inboxDocuments,
    documentsLoading,
    totalDocumentCount,
  } = useClient(clientId);

  const [activeTab, setActiveTab] = useState<TabId>('tasks');
  const [showClientInfo, setShowClientInfo] = useState(true);

  // Hide client info when switching tabs
  const handleTabChange = (tabId: TabId) => {
    setActiveTab(tabId);
    setShowClientInfo(false);
  };

  if (loading && !client) {
    return <ClientDetailSkeleton />;
  }

  if (error || !client) {
    return (
      <div className="min-h-screen bg-bg-primary px-6 py-4">
        <button onClick={() => router.back()} className="mb-4">
          <ArrowLeft className="w-6 h-6 text-text-primary" />
        </button>
        <div className="text-center py-12">
          <AlertCircle className="w-12 h-12 text-error mx-auto mb-4" />
          <p className="text-text-secondary">Nu s-a putut încărca clientul</p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={() => router.back()}>
            Înapoi la clienți
          </Button>
        </div>
      </div>
    );
  }

  const isCompany = client.clientType === 'company';
  const TypeIcon = isCompany ? Building2 : User;

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
          <button
            onClick={() => setShowClientInfo(!showClientInfo)}
            className="flex-1 min-w-0 text-left"
          >
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-text-primary truncate">{client.name}</p>
              <TypeIcon className="w-4 h-4 text-text-tertiary shrink-0" />
            </div>
            <p className="text-xs text-text-tertiary">{client.activeCaseCount} dosare active</p>
          </button>
        </div>
      </div>

      {/* Client Info Card - collapsible */}
      {showClientInfo && (
        <div className="px-6 py-4">
          <Card padding="md">
            <div className="flex items-start gap-3">
              <Avatar name={client.name} size="xl" />
              <div className="flex-1 min-w-0 space-y-2">
                {/* Company Info */}
                {isCompany && (client.companyType || client.cui) && (
                  <div className="flex flex-wrap gap-2">
                    {client.companyType && (
                      <Badge variant="primary" size="sm">
                        {client.companyType}
                      </Badge>
                    )}
                    {client.cui && (
                      <Badge variant="default" size="sm">
                        CUI: {client.cui}
                      </Badge>
                    )}
                  </div>
                )}

                {/* Contact Info */}
                <div className="space-y-1.5">
                  {client.email && (
                    <a
                      href={`mailto:${client.email}`}
                      className="flex items-center gap-2 text-xs text-text-secondary"
                    >
                      <Mail className="w-3.5 h-3.5 text-text-tertiary" />
                      {client.email}
                    </a>
                  )}
                  {client.phone && (
                    <a
                      href={`tel:${client.phone}`}
                      className="flex items-center gap-2 text-xs text-text-secondary"
                    >
                      <Phone className="w-3.5 h-3.5 text-text-tertiary" />
                      {client.phone}
                    </a>
                  )}
                  {client.address && (
                    <p className="flex items-start gap-2 text-xs text-text-secondary">
                      <MapPin className="w-3.5 h-3.5 text-text-tertiary shrink-0 mt-0.5" />
                      {client.address}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <div className="px-6 py-3">
        <div className="flex gap-1 bg-bg-elevated rounded-lg p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id)}
              className={clsx(
                'flex-1 py-2 rounded-md text-sm font-medium transition-colors',
                activeTab === tab.id ? 'bg-bg-card text-text-primary' : 'text-text-tertiary'
              )}
            >
              {tab.label}
              {tab.id === 'tasks' && taskCounts.pending > 0 && (
                <span className="ml-1.5 text-xs text-accent">{taskCounts.pending}</span>
              )}
              {tab.id === 'documents' && totalDocumentCount > 0 && (
                <span className="ml-1.5 text-xs text-text-tertiary">{totalDocumentCount}</span>
              )}
              {tab.id === 'cases' && client.cases.length > 0 && (
                <span className="ml-1.5 text-xs text-text-tertiary">{client.cases.length}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="px-6 py-2">
        {activeTab === 'tasks' && <TasksTab tasks={tasks} loading={tasksLoading} />}
        {activeTab === 'documents' && (
          <DocumentsTab
            cases={casesWithDocuments}
            inboxDocuments={inboxDocuments}
            loading={documentsLoading}
          />
        )}
        {activeTab === 'cases' && <CasesTab cases={casesWithDocuments} />}
      </div>
    </div>
  );
}

// ============================================
// Tasks Tab
// ============================================

interface TasksTabProps {
  tasks: ClientTask[];
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
        <Briefcase className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
        <p className="text-sm text-text-secondary">Nicio sarcină pentru acest client</p>
      </div>
    );
  }

  const priorityColors: Record<string, string> = {
    Urgent: 'bg-error',
    High: 'bg-warning',
    Medium: 'bg-accent',
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
// Documents Tab (shows inbox docs + cases with documents)
// ============================================

type DocFilter = 'working' | 'email' | 'review';

const docFilterOptions: Array<{ id: DocFilter; label: string }> = [
  { id: 'working', label: 'De lucru' },
  { id: 'email', label: 'Email' },
  { id: 'review', label: 'De revizuit' },
];

interface DocumentsTabProps {
  cases: CaseWithDocuments[];
  inboxDocuments: InboxDocument[];
  loading: boolean;
}

function DocumentsTab({ cases, inboxDocuments, loading }: DocumentsTabProps) {
  const router = useRouter();
  const [docFilter, setDocFilter] = useState<DocFilter>('working');
  const preview = useDocumentPreview();

  if (loading && cases.length === 0 && inboxDocuments.length === 0) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <SkeletonCard key={i} />
        ))}
      </div>
    );
  }

  // Filter to only cases with documents
  const casesWithDocs = cases.filter((c) => c.documentCount > 0);

  // Filter inbox documents by category
  // sourceType: UPLOAD, EMAIL_ATTACHMENT, AI_GENERATED, TEMPLATE
  // status: DRAFT, READY_FOR_REVIEW, FINAL
  const filteredInboxDocs = inboxDocuments.filter((item) => {
    if (docFilter === 'working') {
      // Working docs: uploaded/AI/template files, not for review
      return (
        (item.document.sourceType === 'UPLOAD' ||
          item.document.sourceType === 'AI_GENERATED' ||
          item.document.sourceType === 'TEMPLATE') &&
        item.document.status !== 'READY_FOR_REVIEW'
      );
    }
    if (docFilter === 'email') {
      // Email docs: from email attachments
      return item.document.sourceType === 'EMAIL_ATTACHMENT';
    }
    if (docFilter === 'review') {
      // For review: documents marked for review
      return item.document.status === 'READY_FOR_REVIEW';
    }
    return true;
  });

  // Count documents by category
  const docCounts: Record<DocFilter, number> = {
    working: inboxDocuments.filter(
      (d) =>
        (d.document.sourceType === 'UPLOAD' ||
          d.document.sourceType === 'AI_GENERATED' ||
          d.document.sourceType === 'TEMPLATE') &&
        d.document.status !== 'READY_FOR_REVIEW'
    ).length,
    email: inboxDocuments.filter((d) => d.document.sourceType === 'EMAIL_ATTACHMENT').length,
    review: inboxDocuments.filter((d) => d.document.status === 'READY_FOR_REVIEW').length,
  };

  const hasDocuments = inboxDocuments.length > 0 || casesWithDocs.length > 0;

  if (!hasDocuments) {
    return (
      <div className="text-center py-8">
        <FileText className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
        <p className="text-sm text-text-secondary">Niciun document pentru acest client</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Document Category Tabs */}
      <div className="flex border-b border-white/5">
        {docFilterOptions.map((option) => {
          const count = docCounts[option.id];
          const isActive = docFilter === option.id;
          return (
            <button
              key={option.id}
              onClick={() => setDocFilter(option.id)}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-2 text-sm font-medium whitespace-nowrap transition-colors relative',
                isActive ? 'text-accent' : 'text-text-tertiary'
              )}
            >
              {option.label}
              {count > 0 && <span className="text-xs text-text-tertiary">{count}</span>}
              {isActive && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent" />}
            </button>
          );
        })}
      </div>

      {/* Client Inbox Documents */}
      {filteredInboxDocs.length > 0 && (
        <div>
          <p className="text-xs font-medium text-text-tertiary mb-2">
            Inbox client ({filteredInboxDocs.length})
          </p>
          <div className="space-y-2">
            {filteredInboxDocs.map((item) => {
              const doc = item.document;
              const extension = doc.fileName.split('.').pop()?.toUpperCase() || '';
              return (
                <Card
                  key={item.id}
                  interactive
                  padding="sm"
                  onClick={() =>
                    preview.openPreview({
                      id: doc.id,
                      fileName: doc.fileName,
                      fileType: doc.fileType,
                      thumbnailMedium: doc.thumbnailMedium,
                    })
                  }
                >
                  <div className="flex items-center gap-3">
                    {doc.thumbnailMedium ? (
                      <img
                        src={doc.thumbnailMedium}
                        alt=""
                        className="w-10 h-10 rounded object-cover bg-bg-hover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-bg-hover flex items-center justify-center">
                        {extension ? (
                          <span className="text-[10px] font-bold text-text-tertiary">
                            {extension}
                          </span>
                        ) : (
                          <FileText className="w-4 h-4 text-text-tertiary" />
                        )}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-text-primary truncate">{doc.fileName}</p>
                      <p className="text-xs text-text-tertiary">
                        {format(new Date(doc.uploadedAt), 'd MMM yyyy', { locale: ro })}
                        {doc.senderName && ` · ${doc.senderName}`}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-text-tertiary shrink-0" />
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* No filtered results message */}
      {filteredInboxDocs.length === 0 && (
        <div className="text-center py-6">
          <p className="text-sm text-text-tertiary">
            Niciun document {docFilterOptions.find((o) => o.id === docFilter)?.label.toLowerCase()}
          </p>
        </div>
      )}

      {/* Cases with Documents */}
      {casesWithDocs.length > 0 && (
        <div>
          <p className="text-xs font-medium text-text-tertiary mb-2">Documente în dosare</p>
          <div className="space-y-2">
            {casesWithDocs.map((caseItem) => {
              const courtRef = getCourtReference(caseItem.referenceNumbers);

              return (
                <Card
                  key={caseItem.id}
                  interactive
                  padding="md"
                  onClick={() => router.push(`/cases/${caseItem.id}`)}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-bg-hover flex items-center justify-center">
                      <FileText className="w-5 h-5 text-text-tertiary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {caseItem.title}
                      </p>
                      {courtRef && <p className="text-xs text-text-tertiary">{courtRef}</p>}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="default" size="sm">
                        {caseItem.documentCount} {caseItem.documentCount === 1 ? 'doc' : 'docs'}
                      </Badge>
                      <ChevronRight className="w-4 h-4 text-text-tertiary" />
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Document Preview */}
      <DocumentPreview
        open={preview.isOpen}
        onClose={preview.closePreview}
        fileName={preview.fileName}
        fileType={preview.fileType}
        previewUrl={preview.previewUrl}
        previewSource={preview.previewSource}
        thumbnailUrl={preview.thumbnailUrl}
        loading={preview.loading}
        error={preview.error}
      />
    </div>
  );
}

// ============================================
// Cases Tab
// ============================================

interface CasesTabProps {
  cases: CaseWithDocuments[];
}

function CasesTab({ cases }: CasesTabProps) {
  const router = useRouter();

  if (cases.length === 0) {
    return (
      <div className="text-center py-8">
        <Briefcase className="w-10 h-10 text-text-tertiary mx-auto mb-3" />
        <p className="text-sm text-text-secondary">Niciun dosar pentru acest client</p>
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
    <div className="space-y-2">
      {cases.map((caseItem) => {
        const courtRef = getCourtReference(caseItem.referenceNumbers);

        return (
          <Card
            key={caseItem.id}
            interactive
            padding="md"
            onClick={() => router.push(`/cases/${caseItem.id}`)}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                {/* Title & Status */}
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-medium text-text-primary truncate">
                    {caseItem.title}
                  </span>
                  <StatusBadge status={statusMap[caseItem.status]} />
                </div>

                {/* Court Reference */}
                {courtRef && <p className="text-xs text-text-secondary">{courtRef}</p>}

                {/* Type & Document Count */}
                <div className="flex items-center gap-2 mt-1.5">
                  <Badge variant="default" size="sm">
                    {caseItem.type}
                  </Badge>
                  {caseItem.documentCount > 0 && (
                    <span className="text-xs text-text-tertiary">
                      {caseItem.documentCount} docs
                    </span>
                  )}
                </div>
              </div>

              <ChevronRight className="w-5 h-5 text-text-tertiary shrink-0 mt-1" />
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ============================================
// Loading Skeleton
// ============================================

function ClientDetailSkeleton() {
  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <div className="px-6 py-4 flex items-center gap-4">
        <Skeleton className="w-10 h-10 rounded-full" />
        <div className="flex-1">
          <Skeleton className="h-4 w-32 mb-1" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>

      {/* Client Info Card */}
      <div className="px-6 py-4">
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
