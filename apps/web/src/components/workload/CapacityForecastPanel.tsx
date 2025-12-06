'use client';

/**
 * Capacity Forecast Panel Component
 * Story 4.5: Team Workload Management
 *
 * AC: 6 - Capacity planning shows future bottlenecks based on deadlines
 */

import { useMemo } from 'react';
import {
  AlertTriangle,
  AlertCircle,
  TrendingUp,
  Calendar,
  Clock,
  ArrowRight,
  Lightbulb,
} from 'lucide-react';
import type { CapacityForecast, CapacityBottleneck } from '@legal-platform/types';

interface CapacityForecastPanelProps {
  forecast: CapacityForecast;
  onBottleneckClick?: (bottleneck: CapacityBottleneck) => void;
  isLoading?: boolean;
}

const RISK_CONFIG = {
  Low: {
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    label: 'Low Risk',
    icon: TrendingUp,
  },
  Medium: {
    color: 'text-orange-600',
    bgColor: 'bg-orange-50',
    borderColor: 'border-orange-200',
    label: 'Medium Risk',
    icon: AlertTriangle,
  },
  High: {
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    label: 'High Risk',
    icon: AlertCircle,
  },
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('ro-RO', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(date));
}

function BottleneckCard({
  bottleneck,
  onClick,
}: {
  bottleneck: CapacityBottleneck;
  onClick?: () => void;
}) {
  const isCritical = bottleneck.severity === 'Critical';

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-4 rounded-lg border transition-all ${
        isCritical
          ? 'border-red-200 bg-red-50 hover:border-red-300'
          : 'border-orange-200 bg-orange-50 hover:border-orange-300'
      }`}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          {isCritical ? (
            <AlertCircle className="h-5 w-5 text-red-500" />
          ) : (
            <AlertTriangle className="h-5 w-5 text-orange-500" />
          )}
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded ${
              isCritical ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'
            }`}
          >
            {bottleneck.severity}
          </span>
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <Calendar className="h-3 w-3" />
          {formatDate(bottleneck.date)}
        </div>
      </div>

      <div className="mb-2">
        <div className="font-medium text-gray-900">
          {bottleneck.user.firstName} {bottleneck.user.lastName}
        </div>
        <div className="text-sm text-gray-600 flex items-center gap-1">
          <Clock className="h-3 w-3" />
          {bottleneck.overageHours.toFixed(1)}h over capacity
        </div>
      </div>

      {/* Impacted Tasks */}
      {bottleneck.impactedTasks.length > 0 && (
        <div className="mb-2">
          <div className="text-xs text-gray-500 mb-1">
            {bottleneck.impactedTasks.length} impacted task
            {bottleneck.impactedTasks.length !== 1 ? 's' : ''}
          </div>
          <div className="space-y-1">
            {bottleneck.impactedTasks.slice(0, 2).map((task: typeof upcomingTasks[number]) => (
              <div
                key={task.id}
                className={`text-sm px-2 py-1 rounded ${
                  task.isCriticalPath ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'
                }`}
              >
                {task.title}
                {task.isCriticalPath && (
                  <span className="ml-1 text-xs font-medium">(Critical Path)</span>
                )}
              </div>
            ))}
            {bottleneck.impactedTasks.length > 2 && (
              <div className="text-xs text-gray-400">
                +{bottleneck.impactedTasks.length - 2} more
              </div>
            )}
          </div>
        </div>
      )}

      {/* Suggested Action */}
      <div className="text-sm text-gray-600 italic flex items-start gap-1">
        <Lightbulb className="h-4 w-4 mt-0.5 flex-shrink-0" />
        {bottleneck.suggestedAction}
      </div>
    </button>
  );
}

export function CapacityForecastPanel({
  forecast,
  onBottleneckClick,
  isLoading = false,
}: CapacityForecastPanelProps) {
  const riskConfig = RISK_CONFIG[forecast.overallRisk];
  const RiskIcon = riskConfig.icon;

  // Group bottlenecks by date
  const bottlenecksByDate = useMemo(() => {
    const grouped: Record<string, CapacityBottleneck[]> = {};
    for (const bottleneck of forecast.bottlenecks) {
      const dateKey = new Date(bottleneck.date).toDateString();
      if (!grouped[dateKey]) {
        grouped[dateKey] = [];
      }
      grouped[dateKey].push(bottleneck);
    }
    return grouped;
  }, [forecast.bottlenecks]);

  // Calculate daily utilization for chart
  const dailyUtilization = useMemo(() => {
    return forecast.teamCapacityByDay.map((day: typeof forecast.dailyCapacity[number]) => ({
      date: day.date,
      utilization:
        day.totalCapacity > 0
          ? Math.round((day.totalAllocated / day.totalCapacity) * 100)
          : 0,
    }));
  }, [forecast.teamCapacityByDay]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header with Risk Level */}
      <div className={`px-4 py-3 border-b ${riskConfig.bgColor} ${riskConfig.borderColor}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <RiskIcon className={`h-5 w-5 ${riskConfig.color}`} />
            <h2 className="text-lg font-semibold text-gray-900">Capacity Forecast</h2>
          </div>
          <span
            className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium ${riskConfig.bgColor} ${riskConfig.color}`}
          >
            {riskConfig.label}
          </span>
        </div>
        <div className="mt-1 text-sm text-gray-600">
          {formatDate(forecast.forecastRange.start)} <ArrowRight className="h-3 w-3 inline" />{' '}
          {formatDate(forecast.forecastRange.end)}
        </div>
      </div>

      {/* Utilization Chart (simple bars) */}
      <div className="px-4 py-3 border-b">
        <div className="text-sm font-medium text-gray-700 mb-2">Team Utilization</div>
        <div className="flex gap-1 items-end h-16">
          {dailyUtilization.slice(0, 14).map((day: typeof forecast.dailyCapacity[number], i: number) => {
            const height = Math.min(100, day.utilization);
            const isOverloaded = day.utilization > 100;
            return (
              <div
                key={i}
                className="flex-1 flex flex-col items-center gap-0.5"
                title={`${formatDate(day.date)}: ${day.utilization}%`}
              >
                <div
                  className={`w-full rounded-t ${
                    isOverloaded ? 'bg-red-500' : day.utilization > 80 ? 'bg-orange-400' : 'bg-green-400'
                  }`}
                  style={{ height: `${height}%` }}
                />
              </div>
            );
          })}
        </div>
        <div className="flex justify-between mt-1 text-xs text-gray-400">
          <span>Today</span>
          <span>+14 days</span>
        </div>
      </div>

      {/* Bottlenecks */}
      <div className="p-4">
        {forecast.bottlenecks.length > 0 ? (
          <div className="space-y-3">
            <div className="text-sm font-medium text-gray-700">
              {forecast.bottlenecks.length} Bottleneck
              {forecast.bottlenecks.length !== 1 ? 's' : ''} Detected
            </div>
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {forecast.bottlenecks.slice(0, 5).map((bottleneck: typeof forecast.bottlenecks[number], i: number) => (
                <BottleneckCard
                  key={`${bottleneck.userId}-${bottleneck.date}-${i}`}
                  bottleneck={bottleneck}
                  onClick={() => onBottleneckClick?.(bottleneck)}
                />
              ))}
              {forecast.bottlenecks.length > 5 && (
                <div className="text-center text-sm text-gray-500">
                  +{forecast.bottlenecks.length - 5} more bottlenecks
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <TrendingUp className="h-12 w-12 mx-auto mb-2 text-green-400" />
            <div className="font-medium">No bottlenecks detected</div>
            <div className="text-sm">Team capacity looks healthy for the forecast period</div>
          </div>
        )}
      </div>

      {/* Recommendations */}
      {forecast.recommendations.length > 0 && (
        <div className="px-4 py-3 border-t bg-gray-50">
          <div className="text-sm font-medium text-gray-700 mb-2">Recommendations</div>
          <ul className="space-y-1">
            {forecast.recommendations.map((rec: typeof forecast.recommendations[number], i: number) => (
              <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                <Lightbulb className="h-4 w-4 mt-0.5 text-amber-500 flex-shrink-0" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
