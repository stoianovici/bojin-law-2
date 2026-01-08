'use client';

import * as React from 'react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  CheckCheck,
  FileText,
  Briefcase,
  CheckSquare,
  MessageSquare,
  AlertCircle,
  Loader2,
  Inbox,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button, Tabs, TabsList, TabsTrigger } from '@/components/ui';
import { ScrollArea } from '@/components/ui/ScrollArea';
import { GET_NOTIFICATIONS, GET_UNREAD_NOTIFICATION_COUNT } from '@/graphql/queries';
import { MARK_NOTIFICATION_AS_READ, MARK_ALL_NOTIFICATIONS_AS_READ } from '@/graphql/mutations';

// ============================================================================
// TYPES
// ============================================================================

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  caseId: string | null;
  createdAt: string;
  readAt: string | null;
}

// ============================================================================
// HELPERS
// ============================================================================

function getNotificationIcon(type: string) {
  switch (type) {
    case 'CasePendingApproval':
    case 'CaseApproved':
    case 'CaseRejected':
      return <Briefcase className="h-5 w-5" />;
    case 'DocumentReviewRequested':
    case 'DocumentReviewAssigned':
    case 'DocumentApproved':
    case 'DocumentRejected':
    case 'DocumentRevisionRequested':
    case 'DocumentCommentAdded':
    case 'DocumentCommentMentioned':
      return <FileText className="h-5 w-5" />;
    case 'TaskDeadlineReminder':
    case 'TaskOverdue':
    case 'TaskCommentAdded':
    case 'TaskStatusUpdated':
    case 'SubtaskCreated':
      return <CheckSquare className="h-5 w-5" />;
    case 'DelegationRequested':
    case 'DelegationAccepted':
    case 'DelegationDeclined':
      return <MessageSquare className="h-5 w-5" />;
    default:
      return <AlertCircle className="h-5 w-5" />;
  }
}

/**
 * Transform backend notification links to valid frontend routes
 * Backend sets links like /cases/{id}, /tasks/{id}, /reviews/{id} which don't map directly to UI routes
 */
function transformLink(link: string | null): string | null {
  if (!link) return null;

  // /tasks/* → /tasks (task detail pages don't exist)
  if (link.startsWith('/tasks')) {
    return '/tasks';
  }

  // /cases/{id}... → /cases/{id}/edit (extract case ID, ignore query params)
  if (link.startsWith('/cases/')) {
    const match = link.match(/^\/cases\/([a-f0-9-]+)/i);
    if (match) {
      return `/cases/${match[1]}/edit`;
    }
    return '/cases';
  }

  // /reviews/* → /documents (review pages don't exist)
  if (link.startsWith('/reviews')) {
    return '/documents';
  }

  // /delegations → /tasks
  if (link.startsWith('/delegations')) {
    return '/tasks';
  }

  return link;
}

function getIconColor(type: string): string {
  if (type.includes('Rejected') || type.includes('Overdue')) {
    return 'text-red-400 bg-red-400/10';
  }
  if (type.includes('Approved') || type.includes('Accepted')) {
    return 'text-green-400 bg-green-400/10';
  }
  if (type.includes('Pending') || type.includes('Requested') || type.includes('Reminder')) {
    return 'text-amber-400 bg-amber-400/10';
  }
  return 'text-linear-accent bg-linear-accent/10';
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffDays === 0) return 'Astăzi';
  if (diffDays === 1) return 'Ieri';
  if (diffDays < 7) return `Acum ${diffDays} zile`;

  return date.toLocaleDateString('ro-RO', {
    day: 'numeric',
    month: 'long',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

function groupNotificationsByDate(notifications: Notification[]): Map<string, Notification[]> {
  const groups = new Map<string, Notification[]>();

  notifications.forEach((notification) => {
    const dateKey = formatDate(notification.createdAt);
    if (!groups.has(dateKey)) {
      groups.set(dateKey, []);
    }
    groups.get(dateKey)!.push(notification);
  });

  return groups;
}

// ============================================================================
// NOTIFICATION ITEM
// ============================================================================

interface NotificationItemProps {
  notification: Notification;
  onRead: (id: string) => void;
  onClick: (link: string | null) => void;
}

function NotificationItem({ notification, onRead, onClick }: NotificationItemProps) {
  const handleClick = () => {
    if (!notification.read) {
      onRead(notification.id);
    }
    onClick(notification.link);
  };

  return (
    <button
      onClick={handleClick}
      className={cn(
        'w-full flex items-start gap-4 p-4 text-left rounded-lg transition-all border',
        'hover:bg-linear-bg-hover hover:border-linear-border-default',
        !notification.read
          ? 'bg-linear-accent/5 border-linear-accent/20'
          : 'bg-linear-bg-secondary border-linear-border-subtle'
      )}
    >
      {/* Icon */}
      <div
        className={cn(
          'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
          getIconColor(notification.type)
        )}
      >
        {getNotificationIcon(notification.type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p
              className={cn(
                'text-sm leading-tight',
                notification.read
                  ? 'text-linear-text-secondary'
                  : 'text-linear-text-primary font-medium'
              )}
            >
              {notification.title}
            </p>
            <p className="text-[13px] text-linear-text-tertiary mt-1 line-clamp-2">
              {notification.message}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-xs text-linear-text-muted">
              {formatTime(notification.createdAt)}
            </span>
            {!notification.read && <div className="w-2.5 h-2.5 rounded-full bg-linear-accent" />}
          </div>
        </div>
      </div>
    </button>
  );
}

// ============================================================================
// NOTIFICATION GROUP
// ============================================================================

interface NotificationGroupProps {
  date: string;
  notifications: Notification[];
  onRead: (id: string) => void;
  onClick: (link: string | null) => void;
}

function NotificationGroup({ date, notifications, onRead, onClick }: NotificationGroupProps) {
  return (
    <div className="mb-6">
      <h3 className="text-xs font-medium uppercase tracking-wider text-linear-text-muted mb-3 px-1">
        {date}
      </h3>
      <div className="space-y-2">
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onRead={onRead}
            onClick={onClick}
          />
        ))}
      </div>
    </div>
  );
}

// ============================================================================
// EMPTY STATE
// ============================================================================

function EmptyState({ filter }: { filter: 'all' | 'unread' }) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <div className="w-16 h-16 rounded-full bg-linear-bg-tertiary flex items-center justify-center mb-4">
        <Inbox className="h-8 w-8 text-linear-text-tertiary" />
      </div>
      <h3 className="text-lg font-medium text-linear-text-primary mb-1">
        {filter === 'unread' ? 'Nicio notificare necitită' : 'Nicio notificare'}
      </h3>
      <p className="text-sm text-linear-text-tertiary">
        {filter === 'unread'
          ? 'Ai citit toate notificările. Bravo!'
          : 'Notificările vor apărea aici când apar evenimente importante.'}
      </p>
    </div>
  );
}

// ============================================================================
// MAIN PAGE
// ============================================================================

export default function NotificationsPage() {
  const router = useRouter();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  // Fetch notifications
  const { data, loading, refetch } = useQuery<{ notifications: Notification[] }>(
    GET_NOTIFICATIONS,
    {
      variables: {
        read: filter === 'unread' ? false : undefined,
        limit: 100,
      },
      fetchPolicy: 'cache-and-network',
    }
  );

  // Fetch unread count
  const { data: countData, refetch: refetchCount } = useQuery<{
    unreadNotificationCount: number;
  }>(GET_UNREAD_NOTIFICATION_COUNT);

  // Mutations
  const [markAsRead] = useMutation(MARK_NOTIFICATION_AS_READ, {
    onCompleted: () => {
      refetch();
      refetchCount();
    },
  });

  const [markAllAsRead, { loading: markingAll }] = useMutation(MARK_ALL_NOTIFICATIONS_AS_READ, {
    onCompleted: () => {
      refetch();
      refetchCount();
    },
  });

  const notifications = data?.notifications ?? [];
  const unreadCount = countData?.unreadNotificationCount ?? 0;
  const groupedNotifications = groupNotificationsByDate(notifications);

  const handleMarkAsRead = (id: string) => {
    markAsRead({ variables: { id } });
  };

  const handleMarkAllAsRead = () => {
    markAllAsRead();
  };

  const handleNotificationClick = (link: string | null) => {
    const transformedLink = transformLink(link);
    if (transformedLink) {
      router.push(transformedLink);
    }
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="flex-shrink-0 bg-linear-bg-secondary border-b border-linear-border-subtle px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-medium text-linear-text-primary">Notificări</h1>
            <p className="text-sm text-linear-text-tertiary mt-0.5">
              {unreadCount > 0
                ? `${unreadCount} notificări necitite`
                : 'Toate notificările sunt citite'}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={handleMarkAllAsRead}
              disabled={markingAll}
            >
              {markingAll ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <CheckCheck className="h-4 w-4 mr-2" />
              )}
              Marchează toate citite
            </Button>
          )}
        </div>

        {/* Tabs */}
        <div className="mt-4">
          <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'unread')}>
            <TabsList variant="pills">
              <TabsTrigger value="all">Toate</TabsTrigger>
              <TabsTrigger value="unread">
                Necitite
                {unreadCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 text-[10px] bg-linear-accent/20 text-linear-accent rounded-full">
                    {unreadCount}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </header>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto p-6">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-linear-text-tertiary" />
            </div>
          ) : notifications.length === 0 ? (
            <EmptyState filter={filter} />
          ) : (
            Array.from(groupedNotifications.entries()).map(([date, notifs]) => (
              <NotificationGroup
                key={date}
                date={date}
                notifications={notifs}
                onRead={handleMarkAsRead}
                onClick={handleNotificationClick}
              />
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
