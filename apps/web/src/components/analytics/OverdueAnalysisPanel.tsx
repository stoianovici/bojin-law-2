/**
 * Overdue Analysis Panel Component
 * Story 4.7: Task Analytics and Optimization - Task 21
 *
 * Displays overdue task analytics with bottleneck patterns and critical tasks.
 * AC: 2 - Overdue analysis identifies bottleneck patterns
 */

'use client';

import React, { useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { OverdueAnalyticsResponse } from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

interface OverdueAnalysisPanelProps {
  data: OverdueAnalyticsResponse | undefined;
  loading: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const COLORS = [
  '#EF4444', // red-500
  '#F59E0B', // amber-500
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
];

const TASK_TYPE_LABELS: Record<string, string> = {
  CourtAppearance: 'Ședință instanță',
  DocumentDrafting: 'Redactare document',
  ClientMeeting: 'Întâlnire client',
  Research: 'Cercetare',
  Filing: 'Depunere',
  Correspondence: 'Corespondență',
  InternalMeeting: 'Întâlnire internă',
  Deadline: 'Termen',
  Review: 'Revizie',
  Other: 'Altele',
};

const PATTERN_ICONS: Record<string, string> = {
  overloaded_user: '👤',
  blocking_dependency: '🔗',
  recurring_type: '🔄',
  cascade_risk: '⚠️',
};

const PRIORITY_BADGES: Record<string, { bg: string; text: string }> = {
  Critical: { bg: 'bg-red-100', text: 'text-red-800' },
  High: { bg: 'bg-orange-100', text: 'text-orange-800' },
  Medium: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  Low: { bg: 'bg-gray-100', text: 'text-gray-800' },
};

// ============================================================================
// Component
// ============================================================================

export function OverdueAnalysisPanel({ data, loading }: OverdueAnalysisPanelProps) {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'patterns' | 'critical'>('overview');

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-32 bg-gray-100 animate-pulse rounded-lg" />
        <div className="h-64 bg-gray-100 animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-8 text-gray-500">Nu există date despre întârzieri</div>;
  }

  const byTypeData = data.overdueByType.map((item, index) => ({
    name: TASK_TYPE_LABELS[item.taskType] || item.taskType,
    value: item.count,
    avgDays: item.avgDaysOverdue,
    color: COLORS[index % COLORS.length],
  }));

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-red-800">Sarcini întârziate</h3>
            <p className="text-sm text-red-600">Sarcini cu termen depășit care necesită atenție</p>
          </div>
          <div className="text-4xl font-bold text-red-600">{data.totalOverdue}</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {[
            { id: 'overview', label: 'Sumar' },
            { id: 'patterns', label: `Blocaje (${data.bottleneckPatterns.length})` },
            { id: 'critical', label: `Sarcini critice (${data.criticalTasks.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedTab(tab.id as typeof selectedTab)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                selectedTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {selectedTab === 'overview' && (
        <div className="grid md:grid-cols-2 gap-6">
          {/* By Type Chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="text-md font-semibold mb-4">Pe tip de sarcină</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={byTypeData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, value }) => `${name}: ${value}`}
                    labelLine={{ stroke: '#94A3B8' }}
                  >
                    {byTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string, props) => [
                      `${value} sarcini (medie ${props.payload.avgDays.toFixed(1)} zile întârziere)`,
                      name,
                    ]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* By User */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="text-md font-semibold mb-4">Pe responsabil</h4>
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {data.overdueByUser.map((user, index) => (
                <div
                  key={user.userId}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white font-medium"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    >
                      {user.userName.charAt(0)}
                    </div>
                    <span className="font-medium">{user.userName}</span>
                  </div>
                  <span className="text-red-600 font-semibold">{user.count} întârziate</span>
                </div>
              ))}
              {data.overdueByUser.length === 0 && (
                <div className="text-center py-4 text-gray-500">
                  Nicio sarcină întârziată pe utilizator
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedTab === 'patterns' && (
        <div className="space-y-4">
          {data.bottleneckPatterns.map((pattern, index) => (
            <div key={index} className="bg-white rounded-lg border border-amber-200 p-6">
              <div className="flex items-start gap-4">
                <div className="text-3xl">{PATTERN_ICONS[pattern.patternType] || '📊'}</div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs uppercase font-semibold text-amber-600 bg-amber-100 px-2 py-1 rounded">
                      {pattern.patternType.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm text-gray-500">
                      {pattern.affectedTasks} sarcini afectate
                    </span>
                  </div>
                  <p className="text-gray-700 mb-3">{pattern.description}</p>
                  <div className="bg-blue-50 border border-blue-200 rounded p-3">
                    <span className="text-sm font-medium text-blue-800">Acțiune sugerată:</span>
                    <p className="text-sm text-blue-700 mt-1">{pattern.suggestedAction}</p>
                  </div>
                  {pattern.relatedUsers && pattern.relatedUsers.length > 0 && (
                    <div className="mt-3 text-sm text-gray-500">
                      Utilizatori implicați: {pattern.relatedUsers.join(', ')}
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
          {data.bottleneckPatterns.length === 0 && (
            <div className="text-center py-8 text-gray-500">Niciun blocaj detectat</div>
          )}
        </div>
      )}

      {selectedTab === 'critical' && (
        <div className="space-y-4">
          {data.criticalTasks.map((task) => {
            const priority = PRIORITY_BADGES[task.estimatedImpact] || PRIORITY_BADGES.Medium;
            return (
              <div key={task.taskId} className="bg-white rounded-lg border border-red-200 p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <h4 className="font-semibold text-gray-900">{task.taskTitle}</h4>
                      <span className={`text-xs px-2 py-1 rounded ${priority.bg} ${priority.text}`}>
                        {task.estimatedImpact}
                      </span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-500">Tip:</span>{' '}
                        <span className="font-medium">
                          {TASK_TYPE_LABELS[task.taskType] || task.taskType}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Responsabil:</span>{' '}
                        <span className="font-medium">{task.assigneeName}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Dosar:</span>{' '}
                        <span className="font-medium">{task.caseTitle}</span>
                      </div>
                      <div>
                        <span className="text-gray-500">Termen:</span>{' '}
                        <span className="font-medium text-red-600">
                          {new Date(task.dueDate).toLocaleDateString('ro-RO')}
                        </span>
                      </div>
                    </div>
                    {task.blockedBy && task.blockedBy.length > 0 && (
                      <div className="mt-3 text-sm">
                        <span className="text-gray-500">Blocat de:</span>{' '}
                        <span className="text-amber-600">{task.blockedBy.join(', ')}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-red-600">{task.daysOverdue}</div>
                    <div className="text-sm text-gray-500">zile întârziere</div>
                  </div>
                </div>
              </div>
            );
          })}
          {data.criticalTasks.length === 0 && (
            <div className="text-center py-8 text-gray-500">Nicio sarcină critică întârziată</div>
          )}
        </div>
      )}
    </div>
  );
}

export default OverdueAnalysisPanel;
