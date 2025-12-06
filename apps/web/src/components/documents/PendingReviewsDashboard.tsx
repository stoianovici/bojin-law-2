'use client';

/**
 * Pending Reviews Dashboard
 * Story 3.6: Document Review and Approval Workflow
 *
 * Dashboard showing pending reviews with filtering and batch operations
 */

import * as React from 'react';
import {
  FileText,
  Clock,
  AlertTriangle,
  User,
  CheckSquare,
  Filter,
  ArrowUpDown,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

interface PendingReview {
  id: string;
  document: {
    id: string;
    fileName: string;
    fileType: string;
  };
  documentVersion: {
    id: string;
    versionNumber: number;
  };
  submittedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  submittedAt: string;
  assignedTo?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  status: 'PENDING' | 'IN_REVIEW';
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  dueDate?: string;
  revisionNumber: number;
}

interface ReviewStatistics {
  totalPending: number;
  totalInReview: number;
  totalApproved: number;
  totalRejected: number;
  averageReviewTimeHours: number;
  reviewsByPriority: {
    low: number;
    normal: number;
    high: number;
    urgent: number;
  };
}

interface PendingReviewsDashboardProps {
  reviews: PendingReview[];
  statistics?: ReviewStatistics;
  onSelectReview: (reviewId: string) => void;
  onBatchReview: (reviewIds: string[]) => void;
  isPartner?: boolean;
}

const priorityConfig = {
  URGENT: { label: 'Urgent', color: 'bg-red-500 text-white' },
  HIGH: { label: 'High', color: 'bg-orange-500 text-white' },
  NORMAL: { label: 'Normal', color: 'bg-blue-500 text-white' },
  LOW: { label: 'Low', color: 'bg-gray-500 text-white' },
};

function formatRelativeDate(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffDays = Math.floor(
    (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;
  return date.toLocaleDateString();
}

function getDueDateStatus(
  dueDate?: string
): { label: string; isOverdue: boolean } | null {
  if (!dueDate) return null;

  const due = new Date(dueDate);
  const now = new Date();
  const diffDays = Math.ceil(
    (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (diffDays < 0) return { label: `${Math.abs(diffDays)}d overdue`, isOverdue: true };
  if (diffDays === 0) return { label: 'Due today', isOverdue: false };
  if (diffDays === 1) return { label: 'Due tomorrow', isOverdue: false };
  if (diffDays <= 3) return { label: `Due in ${diffDays}d`, isOverdue: false };
  return { label: due.toLocaleDateString(), isOverdue: false };
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
}

export function PendingReviewsDashboard({
  reviews,
  statistics,
  onSelectReview,
  onBatchReview,
  isPartner = false,
}: PendingReviewsDashboardProps) {
  const [selectedReviews, setSelectedReviews] = React.useState<Set<string>>(
    new Set()
  );
  const [priorityFilter, setPriorityFilter] = React.useState<string>('all');
  const [sortBy, setSortBy] = React.useState<'date' | 'priority' | 'due'>('priority');

  // Filter and sort reviews
  const filteredReviews = React.useMemo(() => {
    let result = [...reviews];

    // Apply priority filter
    if (priorityFilter !== 'all') {
      result = result.filter((r) => r.priority === priorityFilter);
    }

    // Sort
    result.sort((a, b) => {
      if (sortBy === 'priority') {
        const priorityOrder = { URGENT: 0, HIGH: 1, NORMAL: 2, LOW: 3 };
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      if (sortBy === 'due') {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      // Default: sort by date (newest first)
      return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
    });

    return result;
  }, [reviews, priorityFilter, sortBy]);

  const toggleSelect = (id: string) => {
    setSelectedReviews((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedReviews.size === filteredReviews.length) {
      setSelectedReviews(new Set());
    } else {
      setSelectedReviews(new Set(filteredReviews.map((r) => r.id)));
    }
  };

  const handleBatchReview = () => {
    onBatchReview(Array.from(selectedReviews));
  };

  return (
    <div className="space-y-4">
      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-yellow-600" />
                <span className="text-sm text-muted-foreground">Pending</span>
              </div>
              <p className="text-2xl font-bold">{statistics.totalPending}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-blue-600" />
                <span className="text-sm text-muted-foreground">In Review</span>
              </div>
              <p className="text-2xl font-bold">{statistics.totalInReview}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <span className="text-sm text-muted-foreground">Urgent</span>
              </div>
              <p className="text-2xl font-bold">{statistics.reviewsByPriority.urgent}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-600" />
                <span className="text-sm text-muted-foreground">Avg. Time</span>
              </div>
              <p className="text-2xl font-bold">
                {Math.round(statistics.averageReviewTimeHours)}h
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and Actions */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4" />
              Pending Reviews ({filteredReviews.length})
            </CardTitle>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Priority Filter */}
              <Select value={priorityFilter} onValueChange={setPriorityFilter}>
                <SelectTrigger className="w-[140px]">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Priority" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Priorities</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="NORMAL">Normal</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>

              {/* Sort */}
              <Select value={sortBy} onValueChange={(v: string) => setSortBy(v as typeof sortBy)}>
                <SelectTrigger className="w-[140px]">
                  <ArrowUpDown className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="priority">Priority</SelectItem>
                  <SelectItem value="due">Due Date</SelectItem>
                  <SelectItem value="date">Submit Date</SelectItem>
                </SelectContent>
              </Select>

              {/* Batch Review Button (Partner only) */}
              {isPartner && selectedReviews.size > 1 && (
                <Button onClick={handleBatchReview}>
                  <CheckSquare className="mr-2 h-4 w-4" />
                  Batch Review ({selectedReviews.size})
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          {filteredReviews.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No pending reviews.
            </p>
          ) : (
            <div className="space-y-2">
              {/* Select All (Partner only) */}
              {isPartner && filteredReviews.length > 1 && (
                <div className="flex items-center gap-2 pb-2 border-b">
                  <input
                    type="checkbox"
                    checked={selectedReviews.size === filteredReviews.length}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <span className="text-sm text-muted-foreground">
                    Select all
                  </span>
                </div>
              )}

              {/* Review List */}
              {filteredReviews.map((review) => {
                const dueStatus = getDueDateStatus(review.dueDate);
                const isSelected = selectedReviews.has(review.id);

                return (
                  <div
                    key={review.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer ${
                      isSelected ? 'bg-muted/50 border-primary' : ''
                    }`}
                    onClick={() => onSelectReview(review.id)}
                  >
                    {isPartner && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          e.stopPropagation();
                          toggleSelect(review.id);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium truncate">
                          {review.document.fileName}
                        </span>
                        <Badge
                          className={`text-xs ${priorityConfig[review.priority].color}`}
                        >
                          {priorityConfig[review.priority].label}
                        </Badge>
                        {review.revisionNumber > 0 && (
                          <Badge variant="outline" className="text-xs">
                            Revision #{review.revisionNumber}
                          </Badge>
                        )}
                        {dueStatus && (
                          <Badge
                            variant={dueStatus.isOverdue ? 'destructive' : 'outline'}
                            className="text-xs"
                          >
                            {dueStatus.label}
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {review.submittedBy.firstName} {review.submittedBy.lastName}
                        </span>
                        <span>{formatRelativeDate(review.submittedAt)}</span>
                        {review.assignedTo && (
                          <span className="flex items-center gap-1">
                            Assigned to:
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-xs">
                                {getInitials(
                                  review.assignedTo.firstName,
                                  review.assignedTo.lastName
                                )}
                              </AvatarFallback>
                            </Avatar>
                          </span>
                        )}
                      </div>
                    </div>

                    <Badge
                      variant={review.status === 'IN_REVIEW' ? 'default' : 'secondary'}
                    >
                      {review.status === 'IN_REVIEW' ? 'In Review' : 'Pending'}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
