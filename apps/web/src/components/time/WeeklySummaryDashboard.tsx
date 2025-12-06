'use client';

import * as React from 'react';
import { format, startOfWeek, endOfWeek, addWeeks, subWeeks } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus, DollarSign, Clock, CheckCircle, XCircle } from 'lucide-react';
import type { WeeklySummary } from '@legal-platform/types';

export interface WeeklySummaryDashboardProps {
  summary: WeeklySummary | null;
  isLoading?: boolean;
  onWeekChange?: (weekStart: Date) => void;
  onViewDetails?: () => void;
}

export function WeeklySummaryDashboard({
  summary,
  isLoading = false,
  onWeekChange,
  onViewDetails,
}: WeeklySummaryDashboardProps) {
  const [currentWeekStart, setCurrentWeekStart] = React.useState(() =>
    startOfWeek(new Date(), { weekStartsOn: 1 })
  );

  const handlePreviousWeek = () => {
    const newWeekStart = subWeeks(currentWeekStart, 1);
    setCurrentWeekStart(newWeekStart);
    onWeekChange?.(newWeekStart);
  };

  const handleNextWeek = () => {
    const newWeekStart = addWeeks(currentWeekStart, 1);
    setCurrentWeekStart(newWeekStart);
    onWeekChange?.(newWeekStart);
  };

  const handleThisWeek = () => {
    const today = startOfWeek(new Date(), { weekStartsOn: 1 });
    setCurrentWeekStart(today);
    onWeekChange?.(today);
  };

  // Format chart data
  const chartData = React.useMemo(() => {
    if (!summary) return [];

    return summary.byDay.map((day) => ({
      name: day.dayOfWeek.substring(0, 3), // Mon, Tue, etc.
      Billable: parseFloat(day.billableHours.toFixed(2)),
      'Non-Billable': parseFloat(day.nonBillableHours.toFixed(2)),
      date: format(new Date(day.date), 'MMM d'),
    }));
  }, [summary]);

  // Trend icon
  const TrendIcon = React.useMemo(() => {
    if (!summary) return Minus;
    switch (summary.trend) {
      case 'up':
        return TrendingUp;
      case 'down':
        return TrendingDown;
      default:
        return Minus;
    }
  }, [summary]);

  const trendColor = React.useMemo(() => {
    if (!summary) return 'text-gray-500';
    switch (summary.trend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  }, [summary]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-gray-200 animate-pulse rounded"></div>
          <div className="flex space-x-2">
            <div className="h-10 w-10 bg-gray-200 animate-pulse rounded"></div>
            <div className="h-10 w-24 bg-gray-200 animate-pulse rounded"></div>
            <div className="h-10 w-10 bg-gray-200 animate-pulse rounded"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 animate-pulse rounded"></div>
          ))}
        </div>
        <div className="h-80 bg-gray-200 animate-pulse rounded"></div>
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="text-center py-12">
        <Clock className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No time entries for this week</p>
      </div>
    );
  }

  const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 1 });
  const billableAmount = summary.billableAmount / 100; // Convert cents to dollars

  return (
    <div className="space-y-6">
      {/* Week Navigator */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Weekly Time Summary</h2>
          <p className="text-sm text-gray-600">
            {format(currentWeekStart, 'MMM d, yyyy')} - {format(weekEnd, 'MMM d, yyyy')}
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handlePreviousWeek}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={handleThisWeek}
          >
            This Week
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={handleNextWeek}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Hours */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Hours</p>
              <p className="text-3xl font-bold text-gray-900 mt-2">
                {summary.totalHours.toFixed(1)}
              </p>
            </div>
            <Clock className="h-8 w-8 text-blue-600" />
          </div>
          <div className={`flex items-center space-x-1 mt-2 ${trendColor}`}>
            <TrendIcon className="h-4 w-4" />
            <span className="text-xs font-medium">vs last week</span>
          </div>
        </Card>

        {/* Billable Hours */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Billable Hours</p>
              <p className="text-3xl font-bold text-green-700 mt-2">
                {summary.billableHours.toFixed(1)}
              </p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {((summary.billableHours / summary.totalHours) * 100).toFixed(0)}% of total
          </p>
        </Card>

        {/* Non-Billable Hours */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Non-Billable</p>
              <p className="text-3xl font-bold text-orange-700 mt-2">
                {summary.nonBillableHours.toFixed(1)}
              </p>
            </div>
            <XCircle className="h-8 w-8 text-orange-600" />
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {((summary.nonBillableHours / summary.totalHours) * 100).toFixed(0)}% of total
          </p>
        </Card>

        {/* Billable Amount */}
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Billable Amount</p>
              <p className="text-3xl font-bold text-blue-700 mt-2">
                ${billableAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <DollarSign className="h-8 w-8 text-blue-600" />
          </div>
          <p className="text-xs text-gray-500 mt-2">{summary.entriesCount} entries</p>
        </Card>
      </div>

      {/* Daily Breakdown Chart */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Daily Breakdown</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 12 }}
            />
            <YAxis
              label={{ value: 'Hours', angle: -90, position: 'insideLeft' }}
              tick={{ fontSize: 12 }}
            />
            <RechartsTooltip
              content={({ active, payload }) => {
                if (active && payload && payload.length) {
                  const data = payload[0].payload;
                  return (
                    <div className="bg-white p-3 border rounded shadow-lg">
                      <p className="font-semibold text-sm mb-2">{data.date}</p>
                      <p className="text-sm text-green-600">
                        Billable: {data.Billable}h
                      </p>
                      <p className="text-sm text-orange-600">
                        Non-Billable: {data['Non-Billable']}h
                      </p>
                      <p className="text-sm text-gray-700 font-semibold mt-1">
                        Total: {(data.Billable + data['Non-Billable']).toFixed(1)}h
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend />
            <Bar dataKey="Billable" fill="#16a34a" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Non-Billable" fill="#ea580c" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* View Details Link */}
      {onViewDetails && (
        <div className="flex justify-center">
          <Button
            type="button"
            variant="outline"
            onClick={onViewDetails}
          >
            View Detailed Timesheet
          </Button>
        </div>
      )}
    </div>
  );
}
