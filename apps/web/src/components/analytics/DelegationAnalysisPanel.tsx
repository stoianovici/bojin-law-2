/**
 * Delegation Analysis Panel Component
 * Story 4.7: Task Analytics and Optimization - Task 25
 *
 * Displays delegation patterns and training opportunities.
 * AC: 5 - Delegation patterns reveal training opportunities
 */

'use client';

import React, { useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import type { DelegationAnalyticsResponse } from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

interface DelegationAnalysisPanelProps {
  data: DelegationAnalyticsResponse | undefined;
  loading: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const COLORS = [
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#EF4444', // red-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
];

const PRIORITY_BADGES: Record<string, { bg: string; text: string }> = {
  high: { bg: 'bg-red-100', text: 'text-red-800' },
  medium: { bg: 'bg-yellow-100', text: 'text-yellow-800' },
  low: { bg: 'bg-green-100', text: 'text-green-800' },
};

// ============================================================================
// Component
// ============================================================================

export function DelegationAnalysisPanel({ data, loading }: DelegationAnalysisPanelProps) {
  const [selectedTab, setSelectedTab] = useState<'overview' | 'flows' | 'training'>('overview');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-24 bg-gray-100 animate-pulse rounded-lg" />
        <div className="h-64 bg-gray-100 animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-gray-500">
        Nu există date despre delegări
      </div>
    );
  }

  const successRateData = data.byUser.map((user, index) => ({
    name: user.userName,
    successRate: user.successRate * 100,
    received: user.delegationsReceived,
    given: user.delegationsGiven,
    color: COLORS[index % COLORS.length],
  }));

  const selectedUserData = selectedUser
    ? data.byUser.find((u) => u.userId === selectedUser)
    : null;

  return (
    <div className="space-y-6">
      {/* Summary Header */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-blue-800">Analize delegări</h3>
            <p className="text-sm text-blue-600">
              Tipare de delegare și performanța echipei
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-blue-600">
              {(data.firmWideSuccessRate * 100).toFixed(1)}%
            </div>
            <div className="text-sm text-blue-500">Rata de succes la nivel de firmă</div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {[
            { id: 'overview', label: 'Sumar echipă' },
            { id: 'flows', label: 'Fluxuri delegare' },
            { id: 'training', label: `Oportunități instruire (${data.trainingOpportunities.length})` },
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
        <div className="space-y-6">
          {/* Success Rate Chart */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h4 className="text-md font-semibold mb-4">Rată succes pe membru echipă</h4>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={successRateData} layout="vertical" margin={{ left: 100 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <YAxis dataKey="name" type="category" width={90} tick={{ fontSize: 12 }} />
                  <Tooltip
                    formatter={(value: number) => [`${value.toFixed(1)}%`, 'Rată succes']}
                    labelFormatter={(label) => `${label}`}
                  />
                  <Bar dataKey="successRate" name="Rată succes" radius={[0, 4, 4, 0]}>
                    {successRateData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* User Details Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.byUser.map((user, index) => (
              <div
                key={user.userId}
                className={`bg-white rounded-lg border p-4 cursor-pointer transition-all ${
                  selectedUser === user.userId
                    ? 'border-blue-500 ring-2 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => setSelectedUser(selectedUser === user.userId ? null : user.userId)}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  >
                    {user.userName.charAt(0)}
                  </div>
                  <div>
                    <div className="font-medium">{user.userName}</div>
                    <div className="text-xs text-gray-500">{user.role}</div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-gray-500">Primite:</span>{' '}
                    <span className="font-medium">{user.delegationsReceived}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Date:</span>{' '}
                    <span className="font-medium">{user.delegationsGiven}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Succes:</span>{' '}
                    <span className="font-medium text-green-600">
                      {(user.successRate * 100).toFixed(0)}%
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Zile medii:</span>{' '}
                    <span className="font-medium">{user.avgCompletionDays.toFixed(1)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Selected User Details */}
          {selectedUserData && (
            <div className="bg-gray-50 rounded-lg border border-gray-200 p-6">
              <h4 className="text-md font-semibold mb-4">
                {selectedUserData.userName} - Analiză detaliată
              </h4>
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Puncte forte</h5>
                  <div className="flex flex-wrap gap-2">
                    {selectedUserData.strengthAreas.map((area) => (
                      <span
                        key={area}
                        className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded"
                      >
                        {area}
                      </span>
                    ))}
                    {selectedUserData.strengthAreas.length === 0 && (
                      <span className="text-sm text-gray-500">Încă nu există date</span>
                    )}
                  </div>
                </div>
                <div>
                  <h5 className="text-sm font-medium text-gray-700 mb-2">Arii de îmbunătățit</h5>
                  <div className="flex flex-wrap gap-2">
                    {selectedUserData.struggleAreas.map((area) => (
                      <span
                        key={area}
                        className="text-xs bg-red-100 text-red-800 px-2 py-1 rounded"
                      >
                        {area}
                      </span>
                    ))}
                    {selectedUserData.struggleAreas.length === 0 && (
                      <span className="text-sm text-gray-500">Încă nu există date</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {selectedTab === 'flows' && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-md font-semibold mb-4">Principalele fluxuri de delegare</h4>
          <div className="space-y-3">
            {data.topDelegationFlows.map((flow, index) => (
              <div
                key={`${flow.fromUserId}-${flow.toUserId}`}
                className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg"
              >
                <div className="text-lg font-bold text-gray-400 w-6">
                  {index + 1}
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                    style={{ backgroundColor: COLORS[index % COLORS.length] }}
                  >
                    {flow.fromUserName.charAt(0)}
                  </div>
                  <span className="font-medium">{flow.fromUserName}</span>
                </div>
                <div className="text-gray-400">→</div>
                <div className="flex items-center gap-2 flex-1">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium"
                    style={{ backgroundColor: COLORS[(index + 3) % COLORS.length] }}
                  >
                    {flow.toUserName.charAt(0)}
                  </div>
                  <span className="font-medium">{flow.toUserName}</span>
                </div>
                <div className="text-right">
                  <div className="font-semibold">{flow.count} delegări</div>
                  <div className="text-sm text-green-600">
                    {(flow.avgSuccessRate * 100).toFixed(0)}% succes
                  </div>
                </div>
              </div>
            ))}
            {data.topDelegationFlows.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                Nu există date despre fluxurile de delegare
              </div>
            )}
          </div>
        </div>
      )}

      {selectedTab === 'training' && (
        <div className="space-y-4">
          {data.trainingOpportunities.map((opportunity) => (
            <div
              key={opportunity.userId}
              className="bg-white rounded-lg border border-amber-200 p-6"
            >
              <h4 className="font-semibold text-gray-900 mb-4">{opportunity.userName}</h4>
              <div className="space-y-3">
                {opportunity.suggestions.map((suggestion, index) => {
                  const priority = PRIORITY_BADGES[suggestion.priority] || PRIORITY_BADGES.medium;
                  return (
                    <div
                      key={index}
                      className="bg-gray-50 rounded-lg p-4 border border-gray-200"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {suggestion.skillArea}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded ${priority.bg} ${priority.text}`}>
                            {suggestion.priority}
                          </span>
                        </div>
                      </div>
                      <p className="text-sm text-gray-600 mb-2">{suggestion.reason}</p>
                      <div className="bg-blue-50 border border-blue-200 rounded p-2">
                        <span className="text-xs font-medium text-blue-800">Acțiune sugerată: </span>
                        <span className="text-xs text-blue-700">{suggestion.suggestedAction}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
          {data.trainingOpportunities.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              Nu au fost identificate oportunități de instruire
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default DelegationAnalysisPanel;
