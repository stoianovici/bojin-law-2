/**
 * SuggestionAnalytics - Analytics view for AI suggestion performance
 * Story 5.4: Proactive AI Suggestions System (Task 34)
 *
 * Partner-only view showing suggestion acceptance rates, time saved,
 * and most helpful suggestion types.
 */

'use client';

import React, { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
// Local types for suggestion analytics UI
type SuggestionType =
  | 'PatternMatch'
  | 'DeadlineWarning'
  | 'DocumentCheck'
  | 'TaskSuggestion'
  | 'RiskAlert'
  | 'FollowUp'
  | 'MorningBriefing';

type SuggestionCategory = 'Task' | 'Communication' | 'Document' | 'Calendar' | 'Compliance';

interface TypeMetric {
  type: SuggestionType;
  count: number;
  acceptanceRate: number;
}

interface CategoryMetric {
  category: SuggestionCategory;
  count: number;
  acceptanceRate: number;
}

interface DailyMetric {
  date: string;
  total: number;
  accepted: number;
  dismissed: number;
}

interface SuggestionAnalyticsType {
  totalSuggestions: number;
  acceptedCount: number;
  dismissedCount: number;
  overallAcceptanceRate: number;
  acceptanceRate: number;
  estimatedTimeSavedMinutes: number;
  averageResponseTimeMs: number;
  byType: TypeMetric[];
  byCategory: CategoryMetric[];
  dailyTrend: DailyMetric[];
}

// ====================
// GraphQL Query
// ====================

const GET_SUGGESTION_ANALYTICS = gql`
  query GetSuggestionAnalytics($dateRange: DateRangeInput) {
    suggestionAnalytics(dateRange: $dateRange) {
      totalSuggestions
      acceptedCount
      dismissedCount
      acceptanceRate
      averageResponseTimeMs
      byType {
        type
        count
        acceptanceRate
      }
      byCategory {
        category
        count
        acceptanceRate
      }
    }
  }
`;

// ====================
// Constants
// ====================

const COLORS = {
  primary: '#3B82F6',
  success: '#10B981',
  warning: '#F59E0B',
  danger: '#EF4444',
  purple: '#8B5CF6',
  pink: '#EC4899',
  cyan: '#06B6D4',
};

const TYPE_COLORS: Record<SuggestionType, string> = {
  MorningBriefing: COLORS.primary,
  TaskSuggestion: COLORS.success,
  PatternMatch: COLORS.purple,
  DeadlineWarning: COLORS.warning,
  DocumentCheck: COLORS.pink,
  FollowUp: COLORS.cyan,
  RiskAlert: COLORS.danger,
};

const TYPE_LABELS: Record<SuggestionType, string> = {
  MorningBriefing: 'Briefing Dimineață',
  TaskSuggestion: 'Sugestie Task',
  PatternMatch: 'Tipar Recunoscut',
  DeadlineWarning: 'Avertisment Termen',
  DocumentCheck: 'Verificare Document',
  FollowUp: 'Follow-up',
  RiskAlert: 'Alertă Risc',
};

const CATEGORY_LABELS: Record<SuggestionCategory, string> = {
  Task: 'Task-uri',
  Communication: 'Comunicare',
  Document: 'Documente',
  Calendar: 'Calendar',
  Compliance: 'Conformitate',
};

// ====================
// Types
// ====================

interface SuggestionAnalyticsProps {
  dateRange?: {
    startDate: string;
    endDate: string;
  };
  className?: string;
}

// ====================
// Component
// ====================

/**
 * SuggestionAnalytics displays analytics for AI suggestion performance.
 * Partner-only view with charts and metrics.
 */
export function SuggestionAnalytics({ dateRange, className = '' }: SuggestionAnalyticsProps) {
  const { data, loading, error } = useQuery<{
    suggestionAnalytics: SuggestionAnalyticsType;
  }>(GET_SUGGESTION_ANALYTICS, {
    variables: { dateRange },
    fetchPolicy: 'cache-and-network',
  });

  const analytics = data?.suggestionAnalytics;

  // Transform data for charts
  const typeChartData = useMemo(() => {
    if (!analytics?.byType) return [];
    return analytics.byType.map((stat: TypeMetric) => ({
      name: TYPE_LABELS[stat.type] || stat.type,
      count: stat.count,
      acceptanceRate: Math.round(stat.acceptanceRate * 100),
      fill: TYPE_COLORS[stat.type] || COLORS.primary,
    }));
  }, [analytics?.byType]);

  const categoryChartData = useMemo(() => {
    if (!analytics?.byCategory) return [];
    return analytics.byCategory.map((stat: CategoryMetric) => ({
      name: CATEGORY_LABELS[stat.category] || stat.category,
      count: stat.count,
      acceptanceRate: Math.round(stat.acceptanceRate * 100),
    }));
  }, [analytics?.byCategory]);

  const pieData = useMemo(() => {
    if (!analytics) return [];
    return [
      { name: 'Acceptate', value: analytics.acceptedCount, fill: COLORS.success },
      { name: 'Respinse', value: analytics.dismissedCount, fill: COLORS.danger },
      {
        name: 'Fără acțiune',
        value: analytics.totalSuggestions - analytics.acceptedCount - analytics.dismissedCount,
        fill: COLORS.warning,
      },
    ];
  }, [analytics]);

  // Calculate estimated time saved (rough estimate: 5 min per accepted suggestion)
  const timeSavedMinutes = (analytics?.acceptedCount ?? 0) * 5;
  const timeSavedHours = Math.round((timeSavedMinutes / 60) * 10) / 10;

  if (loading) {
    return (
      <div className={`space-y-6 ${className}`}>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="h-8 bg-muted animate-pulse rounded mb-2" />
                <div className="h-12 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardContent className="h-80 p-6">
              <div className="h-full bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
          <Card>
            <CardContent className="h-80 p-6">
              <div className="h-full bg-muted animate-pulse rounded" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Nu am putut încărca analiza sugestiilor.</p>
        </CardContent>
      </Card>
    );
  }

  if (!analytics) {
    return (
      <Card className={className}>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Nu există date de analiză disponibile.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Total Sugestii</p>
            <p className="text-3xl font-bold mt-1">{analytics.totalSuggestions}</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Rată Acceptare</p>
            <p className="text-3xl font-bold mt-1 text-green-600">
              {Math.round(analytics.acceptanceRate * 100)}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Timp Economisit</p>
            <p className="text-3xl font-bold mt-1 text-blue-600">~{timeSavedHours}h</p>
            <p className="text-xs text-muted-foreground mt-1">
              Estimat din {analytics.acceptedCount} sugestii acceptate
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <p className="text-sm text-muted-foreground">Timp Răspuns Mediu</p>
            <p className="text-3xl font-bold mt-1">
              {analytics.averageResponseTimeMs > 1000
                ? `${(analytics.averageResponseTimeMs / 1000).toFixed(1)}s`
                : `${Math.round(analytics.averageResponseTimeMs)}ms`}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Acceptance by Type */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Acceptare pe Tip Sugestie</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={typeChartData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" domain={[0, 100]} unit="%" />
                <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => [`${value}%`, 'Rată acceptare']} />
                <Bar dataKey="acceptanceRate" name="Rată acceptare" radius={[0, 4, 4, 0]}>
                  {typeChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Distribution Pie Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Distribuție Acțiuni</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={100}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Performanță pe Categorie</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={categoryChartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis yAxisId="left" orientation="left" stroke={COLORS.primary} />
              <YAxis yAxisId="right" orientation="right" stroke={COLORS.success} />
              <Tooltip />
              <Legend />
              <Bar
                yAxisId="left"
                dataKey="count"
                name="Număr sugestii"
                fill={COLORS.primary}
                radius={[4, 4, 0, 0]}
              />
              <Bar
                yAxisId="right"
                dataKey="acceptanceRate"
                name="Rată acceptare (%)"
                fill={COLORS.success}
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Most Helpful Types */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Cele Mai Utile Tipuri de Sugestii</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {typeChartData
              .sort((a, b) => b.acceptanceRate - a.acceptanceRate)
              .slice(0, 5)
              .map((type, index) => (
                <div
                  key={type.name}
                  className="flex items-center justify-between p-3 rounded-lg bg-muted/50"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-muted-foreground">#{index + 1}</span>
                    <div>
                      <p className="font-medium">{type.name}</p>
                      <p className="text-sm text-muted-foreground">{type.count} sugestii</p>
                    </div>
                  </div>
                  <Badge
                    className={
                      type.acceptanceRate >= 70
                        ? 'bg-green-100 text-green-800'
                        : type.acceptanceRate >= 50
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                    }
                  >
                    {type.acceptanceRate}% acceptare
                  </Badge>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>

      {/* User Feedback Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rezumat Feedback Utilizatori</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
              <p className="text-sm text-green-600 font-medium">Acceptate</p>
              <p className="text-2xl font-bold text-green-700 mt-1">{analytics.acceptedCount}</p>
              <p className="text-xs text-green-600 mt-1">sugestii implementate</p>
            </div>
            <div className="p-4 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm text-red-600 font-medium">Respinse</p>
              <p className="text-2xl font-bold text-red-700 mt-1">{analytics.dismissedCount}</p>
              <p className="text-xs text-red-600 mt-1">sugestii refuzate</p>
            </div>
            <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
              <p className="text-sm text-gray-600 font-medium">Fără acțiune</p>
              <p className="text-2xl font-bold text-gray-700 mt-1">
                {analytics.totalSuggestions - analytics.acceptedCount - analytics.dismissedCount}
              </p>
              <p className="text-xs text-gray-600 mt-1">expirate sau ignorate</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

SuggestionAnalytics.displayName = 'SuggestionAnalytics';
