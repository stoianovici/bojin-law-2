'use client';

import * as React from 'react';
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
import { Users, Sparkles, Clock, CheckCircle2, User } from 'lucide-react';
import type { ParallelTaskGroup, User as UserType } from '@legal-platform/types';

export interface ParallelTasksPanelProps {
  _caseId: string;
  parallelTaskGroups: ParallelTaskGroup[];
  users: UserType[];
  isLoading?: boolean;
  onAssign: (taskId: string, userId: string) => Promise<void>;
  onBulkAssign: (assignments: Record<string, string>) => Promise<void>;
  onRefresh: () => void;
}

export function ParallelTasksPanel({
  _caseId,
  parallelTaskGroups,
  users,
  isLoading = false,
  onAssign,
  onBulkAssign,
  onRefresh,
}: ParallelTasksPanelProps) {
  const [selectedAssignments, setSelectedAssignments] = React.useState<Record<string, string>>({});
  const [isAssigning, setIsAssigning] = React.useState(false);
  const [expandedGroup, setExpandedGroup] = React.useState<string | null>(
    parallelTaskGroups[0]?.groupId || null
  );

  const handleAssignmentChange = (taskId: string, userId: string) => {
    setSelectedAssignments((prev) => ({ ...prev, [taskId]: userId }));
  };

  const handleApplyAISuggestions = (groupId: string) => {
    const group = parallelTaskGroups.find((g) => g.groupId === groupId);
    if (!group) return;

    const aiAssignments: Record<string, string> = {};
    group.tasks.forEach((task: typeof group.tasks[number]) => {
      const suggestions = group.suggestedAssignees?.filter(
        (s: typeof group.suggestedAssignees[number]) => s.matchScore > 70
      );
      if (suggestions && suggestions.length > 0) {
        aiAssignments[task.id] = suggestions[0].userId;
      }
    });

    setSelectedAssignments((prev) => ({ ...prev, ...aiAssignments }));
  };

  const handleBulkAssign = async () => {
    setIsAssigning(true);
    try {
      await onBulkAssign(selectedAssignments);
      setSelectedAssignments({});
    } catch (error) {
      console.error('Failed to bulk assign tasks:', error);
    } finally {
      setIsAssigning(false);
    }
  };

  const getWorkloadColor = (workload: number, capacity: number) => {
    const percentage = (workload / capacity) * 100;
    if (percentage >= 90) return 'text-red-600 bg-red-50';
    if (percentage >= 70) return 'text-orange-600 bg-orange-50';
    return 'text-green-600 bg-green-50';
  };

  const getMatchScoreColor = (score: number) => {
    if (score >= 80) return 'border-green-500 bg-green-50 text-green-700';
    if (score >= 60) return 'border-blue-500 bg-blue-50 text-blue-700';
    if (score >= 40) return 'border-orange-500 bg-orange-50 text-orange-700';
    return 'border-red-500 bg-red-50 text-red-700';
  };

  const totalTasksInGroups = parallelTaskGroups.reduce(
    (sum, group) => sum + group.tasks.length,
    0
  );
  const assignedTasks = Object.keys(selectedAssignments).length;

  return (
    <div className="space-y-6">
      {/* Header Summary */}
      <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-purple-500 rounded-lg">
                <Users className="h-6 w-6 text-white" />
              </div>
              <div>
                <div className="text-2xl font-bold text-purple-900">
                  {parallelTaskGroups.length}
                </div>
                <div className="text-sm text-purple-700">Parallel Task Groups</div>
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-purple-900">{totalTasksInGroups}</div>
              <div className="text-sm text-purple-700">Tasks to Assign</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-green-700">{assignedTasks}</div>
              <div className="text-sm text-purple-700">Assigned</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Team Member Availability */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-5 w-5" />
            Team Member Availability
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {users.map((user) => {
              // Calculate workload from parallel task groups
              const userWorkload =
                parallelTaskGroups
                  .flatMap((g) => g.suggestedAssignees || [])
                  .find((s: typeof parallelTask.assignmentSuggestions[number]) => s.userId === user.id)?.currentWorkload || 0;
              const userCapacity =
                parallelTaskGroups
                  .flatMap((g) => g.suggestedAssignees || [])
                  .find((s: typeof parallelTask.assignmentSuggestions[number]) => s.userId === user.id)?.availableCapacity || 40;

              const workloadPercentage = Math.round((userWorkload / userCapacity) * 100);

              return (
                <Card key={user.id} className="border">
                  <CardContent className="pt-4">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                        <User className="h-4 w-4 text-gray-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate">{user.name}</div>
                        <div className="text-xs text-gray-500 truncate">{user.email}</div>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-gray-600">Workload</span>
                        <span className={`font-medium px-2 py-0.5 rounded ${getWorkloadColor(userWorkload, userCapacity)}`}>
                          {workloadPercentage}%
                        </span>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            workloadPercentage >= 90
                              ? 'bg-red-500'
                              : workloadPercentage >= 70
                              ? 'bg-orange-500'
                              : 'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(workloadPercentage, 100)}%` }}
                        ></div>
                      </div>
                      <div className="text-xs text-gray-600">
                        {userWorkload}h / {userCapacity}h
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Parallel Task Groups */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Parallel Task Groups
            </CardTitle>
            {assignedTasks > 0 && (
              <Button onClick={handleBulkAssign} disabled={isAssigning} size="sm">
                <CheckCircle2 className="h-4 w-4 mr-1" />
                {isAssigning ? 'Assigning...' : `Assign ${assignedTasks} Tasks`}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {parallelTaskGroups.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              No parallel tasks found. Tasks have dependencies or are already assigned.
            </div>
          ) : (
            <div className="space-y-4">
              {parallelTaskGroups.map((group) => {
                const isExpanded = expandedGroup === group.groupId;

                return (
                  <Card key={group.groupId} className="border-purple-200 bg-purple-50/50">
                    <CardHeader
                      className="cursor-pointer"
                      onClick={() => setExpandedGroup(isExpanded ? null : group.groupId)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <CardTitle className="text-base">
                            Group {group.groupId.split('-')[0]}
                          </CardTitle>
                          <Badge variant="outline">{group.tasks.length} tasks</Badge>
                          {group.canRunSimultaneously && (
                            <Badge variant="secondary" className="bg-green-100">
                              Can run in parallel
                            </Badge>
                          )}
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={(e: React.MouseEvent) => {
                            e.stopPropagation();
                            handleApplyAISuggestions(group.groupId);
                          }}
                        >
                          <Sparkles className="h-4 w-4 mr-1" />
                          Apply AI Suggestions
                        </Button>
                      </div>
                    </CardHeader>

                    {isExpanded && (
                      <CardContent className="space-y-3">
                        {group.tasks.map((task: typeof tasks[number]) => {
                          const suggestions = group.suggestedAssignees || [];
                          const topSuggestion = suggestions.find((s: typeof suggestions[number]) =>
                            task.id ? true : false
                          );

                          return (
                            <Card key={task.id} className="bg-white border">
                              <CardContent className="pt-4">
                                <div className="space-y-3">
                                  <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1 min-w-0">
                                      <div className="font-medium mb-1">{task.title}</div>
                                      <div className="flex items-center gap-2 text-xs text-gray-600">
                                        {task.estimatedHours && (
                                          <div className="flex items-center gap-1">
                                            <Clock className="h-3 w-3" />
                                            <span>{task.estimatedHours}h</span>
                                          </div>
                                        )}
                                        <Badge variant="outline" className="text-xs">
                                          {task.type}
                                        </Badge>
                                      </div>
                                    </div>
                                    <div className="min-w-[200px]">
                                      <Select
                                        value={selectedAssignments[task.id] || ''}
                                        onValueChange={(userId: string) =>
                                          handleAssignmentChange(task.id, userId)
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue placeholder="Assign to..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {users.map((user) => (
                                            <SelectItem key={user.id} value={user.id}>
                                              {user.name}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                  </div>

                                  {/* AI Suggestions */}
                                  {suggestions.length > 0 && (
                                    <div className="pt-3 border-t">
                                      <div className="flex items-center gap-2 mb-2">
                                        <Sparkles className="h-4 w-4 text-purple-600" />
                                        <span className="text-sm font-medium">AI Suggestions</span>
                                      </div>
                                      <div className="space-y-2">
                                        {suggestions.slice(0, 3).map((suggestion: typeof parallelTask.assignmentSuggestions[number]) => (
                                          <div
                                            key={suggestion.userId}
                                            className={`flex items-center justify-between p-2 border rounded ${getMatchScoreColor(
                                              suggestion.matchScore
                                            )}`}
                                          >
                                            <div className="flex-1">
                                              <div className="text-sm font-medium">
                                                {suggestion.userName}
                                              </div>
                                              <div className="text-xs mt-0.5">
                                                {suggestion.reasoning}
                                              </div>
                                            </div>
                                            <div className="ml-3 text-right">
                                              <div className="text-sm font-bold">
                                                {suggestion.matchScore}%
                                              </div>
                                              <div className="text-xs">
                                                {suggestion.currentWorkload}h / {suggestion.availableCapacity}h
                                              </div>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </CardContent>
                            </Card>
                          );
                        })}
                      </CardContent>
                    )}
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
