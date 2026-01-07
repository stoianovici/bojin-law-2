'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

// Types
export interface ActivityAuthor {
  id: string;
  firstName: string;
  lastName: string;
}

export interface ActivityTask {
  id: string;
  title: string;
}

export interface ActivityChange {
  from: string;
  to: string;
}

export interface Activity {
  id: string;
  type: 'subtask_completed' | 'status_changed' | 'task_created' | 'comment_added' | 'task_assigned';
  author: ActivityAuthor;
  timestamp: string;
  task?: ActivityTask;
  comment?: string;
  change?: ActivityChange;
  assignee?: ActivityAuthor;
}

export interface TeamActivityFeedProps {
  activities: Activity[];
  onTaskClick?: (taskId: string) => void;
  className?: string;
}

// Avatar gradient mapping based on initials
const avatarGradients: Record<string, string> = {
  ab: 'bg-gradient-to-br from-[#5E6AD2] to-[#8B5CF6]',
  mp: 'bg-gradient-to-br from-[#EC4899] to-[#F472B6]',
  ed: 'bg-gradient-to-br from-[#22C55E] to-[#4ADE80]',
  ai: 'bg-gradient-to-br from-[#F59E0B] to-[#FBBF24]',
  cv: 'bg-gradient-to-br from-[#3B82F6] to-[#60A5FA]',
};

// Default gradient for unknown initials
const defaultGradients = [
  'bg-gradient-to-br from-[#5E6AD2] to-[#8B5CF6]',
  'bg-gradient-to-br from-[#EC4899] to-[#F472B6]',
  'bg-gradient-to-br from-[#22C55E] to-[#4ADE80]',
  'bg-gradient-to-br from-[#F59E0B] to-[#FBBF24]',
  'bg-gradient-to-br from-[#3B82F6] to-[#60A5FA]',
];

function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getAvatarGradient(firstName: string, lastName: string): string {
  const initials = getInitials(firstName, lastName).toLowerCase();
  if (avatarGradients[initials]) {
    return avatarGradients[initials];
  }
  // Use a hash-based selection for consistent colors
  const hash = (firstName.charCodeAt(0) + lastName.charCodeAt(0)) % defaultGradients.length;
  return defaultGradients[hash];
}

function getActionText(activity: Activity): string {
  switch (activity.type) {
    case 'subtask_completed':
      return 'a finalizat subtask-ul';
    case 'status_changed':
      return 'a schimbat statusul';
    case 'task_created':
      return 'a creat sarcina';
    case 'comment_added':
      return 'a adaugat comentariu';
    case 'task_assigned':
      return activity.assignee
        ? `a atribuit lui ${activity.assignee.firstName}`
        : 'a atribuit sarcina';
    default:
      return '';
  }
}

interface ActivityAvatarProps {
  firstName: string;
  lastName: string;
  className?: string;
}

function ActivityAvatar({ firstName, lastName, className }: ActivityAvatarProps) {
  const initials = getInitials(firstName, lastName);
  const gradient = getAvatarGradient(firstName, lastName);

  return (
    <div
      className={cn(
        'w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-normal text-white shrink-0',
        gradient,
        className
      )}
    >
      {initials}
    </div>
  );
}

interface ActivityItemProps {
  activity: Activity;
  onTaskClick?: (taskId: string) => void;
}

function ActivityItem({ activity, onTaskClick }: ActivityItemProps) {
  const handleTaskClick = () => {
    if (activity.task && onTaskClick) {
      onTaskClick(activity.task.id);
    }
  };

  return (
    <div className="flex gap-3">
      <ActivityAvatar firstName={activity.author.firstName} lastName={activity.author.lastName} />
      <div className="flex-1 min-w-0">
        {/* Header */}
        <div className="flex items-baseline gap-2 flex-wrap mb-0.5">
          <span className="text-[13px] font-normal text-linear-text-primary">
            {activity.author.firstName} {activity.author.lastName}
          </span>
          <span className="text-[13px] text-linear-text-tertiary">{getActionText(activity)}</span>
          <span className="text-[11px] text-linear-text-muted ml-auto">{activity.timestamp}</span>
        </div>

        {/* Task Link */}
        {activity.task && (
          <div
            className={cn(
              'text-xs text-linear-accent-primary mt-0.5',
              onTaskClick && 'cursor-pointer hover:underline'
            )}
            onClick={handleTaskClick}
          >
            {activity.task.title}
          </div>
        )}

        {/* Comment */}
        {activity.comment && (
          <div className="text-[13px] text-linear-text-secondary leading-relaxed p-3 bg-linear-bg-tertiary rounded-md mt-2">
            {activity.comment}
          </div>
        )}

        {/* Status Change */}
        {activity.change && (
          <div className="text-xs text-linear-text-tertiary flex items-center gap-2 mt-1">
            <span className="line-through text-linear-text-muted">{activity.change.from}</span>
            <span className="text-linear-text-muted">→</span>
            <span className="text-linear-text-secondary">{activity.change.to}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export function TeamActivityFeed({ activities, onTaskClick, className }: TeamActivityFeedProps) {
  if (activities.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center py-8', className)}>
        <p className="text-sm text-linear-text-tertiary">No recent activity</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {activities.map((activity) => (
        <ActivityItem key={activity.id} activity={activity} onTaskClick={onTaskClick} />
      ))}
    </div>
  );
}

export default TeamActivityFeed;
