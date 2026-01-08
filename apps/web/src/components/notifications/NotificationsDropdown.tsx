'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useQuery, useMutation } from '@apollo/client/react';
import {
  Bell,
  CheckCheck,
  FileText,
  Briefcase,
  CheckSquare,
  MessageSquare,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui';
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/Popover';
import { ScrollArea } from '@/components/ui/ScrollArea';
import {
  GET_NOTIFICATIONS,
  GET_UNREAD_NOTIFICATION_COUNT,
  GET_IN_APP_NOTIFICATIONS,
  GET_IN_APP_NOTIFICATION_COUNT,
} from '@/graphql/queries';
import {
  MARK_NOTIFICATION_AS_READ,
  MARK_ALL_NOTIFICATIONS_AS_READ,
  MARK_IN_APP_NOTIFICATION_READ,
  MARK_ALL_IN_APP_NOTIFICATIONS_READ,
} from '@/graphql/mutations';

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

interface InAppNotification {
  id: string;
  title: string;
  body: string;
  icon: string;
  read: boolean;
  createdAt: string;
  action: {
    type: string;
    entityId?: string;
    caseId?: string;
  } | null;
}

// Unified notification for display
interface UnifiedNotification {
  id: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  read: boolean;
  createdAt: string;
  source: 'notification' | 'inapp';
}

// ============================================================================
// HELPERS
// ============================================================================

function getActionLink(
  action: { type: string; entityId?: string; caseId?: string } | null
): string | null {
  if (!action) return null;

  // Routes that actually exist in the app:
  // /cases, /cases/[id]/edit, /tasks, /email, /documents, /calendar, /notifications
  switch (action.type) {
    case 'open_task':
      return '/tasks';
    case 'open_case':
      return action.entityId ? `/cases/${action.entityId}/edit` : '/cases';
    case 'open_email':
      return '/email';
    case 'open_document':
      return '/documents';
    case 'open_calendar':
      return '/calendar';
    case 'open_inbox':
      return '/notifications';
    default:
      return null;
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

function getNotificationIcon(type: string) {
  switch (type) {
    case 'CasePendingApproval':
    case 'CaseApproved':
    case 'CaseRejected':
      return <Briefcase className="h-4 w-4" />;
    case 'DocumentReviewRequested':
    case 'DocumentReviewAssigned':
    case 'DocumentApproved':
    case 'DocumentRejected':
    case 'DocumentRevisionRequested':
    case 'DocumentCommentAdded':
    case 'DocumentCommentMentioned':
      return <FileText className="h-4 w-4" />;
    case 'TaskDeadlineReminder':
    case 'TaskOverdue':
    case 'TaskCommentAdded':
    case 'TaskStatusUpdated':
    case 'SubtaskCreated':
      return <CheckSquare className="h-4 w-4" />;
    case 'DelegationRequested':
    case 'DelegationAccepted':
    case 'DelegationDeclined':
      return <MessageSquare className="h-4 w-4" />;
    default:
      return <AlertCircle className="h-4 w-4" />;
  }
}

function getIconColor(type: string): string {
  if (type.includes('Rejected') || type.includes('Overdue')) {
    return 'text-red-400';
  }
  if (type.includes('Approved') || type.includes('Accepted')) {
    return 'text-green-400';
  }
  if (type.includes('Pending') || type.includes('Requested') || type.includes('Reminder')) {
    return 'text-amber-400';
  }
  return 'text-linear-accent';
}

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Acum';
  if (diffMins < 60) return `Acum ${diffMins} min`;
  if (diffHours < 24) return `Acum ${diffHours} ore`;
  if (diffDays < 7) return `Acum ${diffDays} zile`;

  return date.toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' });
}

// ============================================================================
// NOTIFICATION ITEM
// ============================================================================

interface NotificationItemProps {
  notification: UnifiedNotification;
  onClick: (notification: UnifiedNotification) => void;
}

function NotificationItem({ notification, onClick }: NotificationItemProps) {
  return (
    <button
      onClick={() => onClick(notification)}
      className={cn(
        'w-full flex items-start gap-3 p-3 text-left rounded-lg transition-colors',
        'hover:bg-linear-bg-hover',
        !notification.read && 'bg-linear-accent/5'
      )}
    >
      {/* Icon */}
      <div className={cn('mt-0.5 shrink-0', getIconColor(notification.type))}>
        {getNotificationIcon(notification.type)}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p
            className={cn(
              'text-[13px] leading-tight',
              notification.read
                ? 'text-linear-text-secondary'
                : 'text-linear-text-primary font-medium'
            )}
          >
            {notification.title}
          </p>
          {!notification.read && (
            <div className="w-2 h-2 rounded-full bg-linear-accent shrink-0 mt-1" />
          )}
        </div>
        <p className="text-[12px] text-linear-text-tertiary mt-0.5 line-clamp-2">
          {notification.message}
        </p>
        <p className="text-[11px] text-linear-text-muted mt-1">
          {formatTimeAgo(notification.createdAt)}
        </p>
      </div>
    </button>
  );
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export function NotificationsDropdown() {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);

  // Fetch unread counts for badge (both notification types)
  const { data: countData, refetch: refetchCount } = useQuery<{ unreadNotificationCount: number }>(
    GET_UNREAD_NOTIFICATION_COUNT,
    {
      pollInterval: 60000,
      fetchPolicy: 'cache-and-network',
    }
  );

  const { data: inAppCountData, refetch: refetchInAppCount } = useQuery<{
    inAppNotificationCount: number;
  }>(GET_IN_APP_NOTIFICATION_COUNT, {
    pollInterval: 60000,
    fetchPolicy: 'cache-and-network',
  });

  // Fetch notifications when dropdown opens
  const {
    data: notificationsData,
    loading: loadingNotifs,
    refetch: refetchNotifications,
  } = useQuery<{
    notifications: Notification[];
  }>(GET_NOTIFICATIONS, {
    variables: { limit: 15 },
    skip: !open,
    fetchPolicy: 'cache-and-network',
  });

  const {
    data: inAppData,
    loading: loadingInApp,
    refetch: refetchInApp,
  } = useQuery<{
    inAppNotifications: InAppNotification[];
  }>(GET_IN_APP_NOTIFICATIONS, {
    variables: { includeRead: true, limit: 15 },
    skip: !open,
    fetchPolicy: 'cache-and-network',
  });

  // Mutations for regular notifications
  const [markAsRead] = useMutation(MARK_NOTIFICATION_AS_READ, {
    onCompleted: () => {
      refetchCount();
      refetchNotifications();
    },
  });

  const [markAllAsRead] = useMutation(MARK_ALL_NOTIFICATIONS_AS_READ, {
    onCompleted: () => {
      refetchCount();
      refetchNotifications();
    },
  });

  // Mutations for in-app notifications
  const [markInAppAsRead] = useMutation(MARK_IN_APP_NOTIFICATION_READ, {
    onCompleted: () => {
      refetchInAppCount();
      refetchInApp();
    },
  });

  const [markAllInAppAsRead, { loading: markingAll }] = useMutation(
    MARK_ALL_IN_APP_NOTIFICATIONS_READ,
    {
      onCompleted: () => {
        refetchInAppCount();
        refetchInApp();
      },
    }
  );

  // Combine counts
  const unreadCount =
    (countData?.unreadNotificationCount ?? 0) + (inAppCountData?.inAppNotificationCount ?? 0);
  const loading = loadingNotifs || loadingInApp;

  // Convert notifications to unified format and merge
  const unifiedNotifications: UnifiedNotification[] = React.useMemo(() => {
    const fromNotifications: UnifiedNotification[] = (notificationsData?.notifications ?? []).map(
      (n) => ({
        id: n.id,
        type: n.type,
        title: n.title,
        message: n.message,
        link: transformLink(n.link),
        read: n.read,
        createdAt: n.createdAt,
        source: 'notification' as const,
      })
    );

    const fromInApp: UnifiedNotification[] = (inAppData?.inAppNotifications ?? []).map((n) => ({
      id: n.id,
      type: n.icon,
      title: n.title,
      message: n.body,
      link: getActionLink(n.action),
      read: n.read,
      createdAt: n.createdAt,
      source: 'inapp' as const,
    }));

    // Merge and sort by date (most recent first)
    return [...fromNotifications, ...fromInApp]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 20);
  }, [notificationsData, inAppData]);

  const hasUnread = unifiedNotifications.some((n) => !n.read);

  const handleMarkAsRead = (notification: UnifiedNotification) => {
    if (notification.source === 'notification') {
      markAsRead({ variables: { id: notification.id } });
    } else {
      markInAppAsRead({ variables: { id: notification.id } });
    }
  };

  const handleMarkAllAsRead = async () => {
    await Promise.all([markAllAsRead(), markAllInAppAsRead()]);
  };

  const handleNotificationClick = (notification: UnifiedNotification) => {
    if (!notification.read) {
      handleMarkAsRead(notification);
    }
    if (notification.link) {
      router.push(notification.link);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-linear-accent px-1 text-[10px] font-medium text-white">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-linear-border-subtle">
          <h3 className="text-sm font-medium text-linear-text-primary">Notificări</h3>
          {hasUnread && (
            <button
              onClick={handleMarkAllAsRead}
              disabled={markingAll}
              className="flex items-center gap-1.5 text-xs text-linear-accent hover:text-linear-accent-hover transition-colors disabled:opacity-50"
            >
              {markingAll ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <CheckCheck className="h-3 w-3" />
              )}
              Marchează toate citite
            </button>
          )}
        </div>

        {/* Notifications List */}
        <ScrollArea className="max-h-[400px]">
          {loading && unifiedNotifications.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-linear-text-tertiary" />
            </div>
          ) : unifiedNotifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 px-4">
              <div className="w-10 h-10 rounded-full bg-linear-bg-tertiary flex items-center justify-center mb-2">
                <Bell className="h-5 w-5 text-linear-text-tertiary" />
              </div>
              <p className="text-sm text-linear-text-tertiary">Nicio notificare</p>
              <p className="text-xs text-linear-text-muted mt-0.5">Ești la zi!</p>
            </div>
          ) : (
            <div className="p-2 space-y-1">
              {unifiedNotifications.map((notification) => (
                <NotificationItem
                  key={`${notification.source}-${notification.id}`}
                  notification={notification}
                  onClick={handleNotificationClick}
                />
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {unifiedNotifications.length > 0 && (
          <div className="border-t border-linear-border-subtle p-2">
            <button
              onClick={() => {
                router.push('/notifications');
                setOpen(false);
              }}
              className="w-full text-center text-xs text-linear-text-secondary hover:text-linear-text-primary py-2 transition-colors"
            >
              Vezi toate notificările
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export default NotificationsDropdown;
