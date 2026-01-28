'use client';

import { clsx } from 'clsx';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import {
  Mail,
  FileText,
  CheckSquare,
  Calendar,
  AlertCircle,
  Bell,
  type LucideIcon,
} from 'lucide-react';
import { InAppNotification } from '@/store/realtime';

// ============================================================================
// Types
// ============================================================================

interface NotificationItemProps {
  notification: InAppNotification;
  onPress: (notification: InAppNotification) => void;
}

// ============================================================================
// Icon Mapping
// ============================================================================

const iconMap: Record<string, LucideIcon> = {
  email: Mail,
  document: FileText,
  task: CheckSquare,
  calendar: Calendar,
  alert: AlertCircle,
  default: Bell,
};

// ============================================================================
// Icon Component
// ============================================================================

function NotificationIcon({ icon, className }: { icon: string | null; className?: string }) {
  const IconComponent = (icon && iconMap[icon]) || iconMap.default;
  return <IconComponent className={className} />;
}

// ============================================================================
// Component
// ============================================================================

export function NotificationItem({ notification, onPress }: NotificationItemProps) {
  const timeAgo = formatDistanceToNow(new Date(notification.createdAt), {
    addSuffix: true,
    locale: ro,
  });

  return (
    <button
      onClick={() => onPress(notification)}
      className={clsx(
        'w-full flex items-start gap-3 p-4',
        'text-left transition-colors',
        notification.read ? 'bg-transparent' : 'bg-accent/5',
        'hover:bg-bg-hover active:bg-bg-card'
      )}
    >
      {/* Icon */}
      <div
        className={clsx(
          'shrink-0 w-10 h-10 rounded-full',
          'flex items-center justify-center',
          notification.read ? 'bg-bg-card text-text-tertiary' : 'bg-accent/20 text-accent'
        )}
      >
        <NotificationIcon icon={notification.icon} className="w-5 h-5" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p
          className={clsx(
            'text-sm line-clamp-1',
            notification.read ? 'text-text-secondary' : 'text-text-primary font-medium'
          )}
        >
          {notification.title}
        </p>
        <p className="text-sm text-text-secondary line-clamp-2 mt-0.5">{notification.body}</p>
        <p className="text-xs text-text-tertiary mt-1">{timeAgo}</p>
      </div>

      {/* Unread dot */}
      {!notification.read && <div className="shrink-0 w-2 h-2 rounded-full bg-accent mt-2" />}
    </button>
  );
}
