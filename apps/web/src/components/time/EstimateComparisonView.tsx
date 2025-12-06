'use client';

import * as React from 'react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { TrendingUp, TrendingDown, Minus, Target, AlertTriangle, CheckCircle, Lightbulb } from 'lucide-react';
import type { EstimateVsActualReport, TaskTypeComparison } from '@legal-platform/types';

export interface EstimateComparisonViewProps {
  report: EstimateVsActualReport | null;
  isLoading?: boolean;
  onPeriodChange?: (periodStart: Date, periodEnd: Date) => void;
}

type PeriodOption = 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months';

export function EstimateComparisonView({
  report,
  isLoading = false,
  onPeriodChange,
}: EstimateComparisonViewProps) {
  const [selectedPeriod, setSelectedPeriod] = React.useState<PeriodOption>('this_month');

  const handlePeriodChange = (period: PeriodOption) => {
    setSelectedPeriod(period);

    const today = new Date();
    let periodStart: Date;
    let periodEnd: Date;

    switch (period) {
      case 'this_month':
        periodStart = startOfMonth(today);
        periodEnd = endOfMonth(today);
        break;
      case 'last_month':
        const lastMonth = subMonths(today, 1);
        periodStart = startOfMonth(lastMonth);
        periodEnd = endOfMonth(lastMonth);
        break;
      case 'last_3_months':
        periodStart = startOfMonth(subMonths(today, 2));
        periodEnd = endOfMonth(today);
        break;
      case 'last_6_months':
        periodStart = startOfMonth(subMonths(today, 5));
        periodEnd = endOfMonth(today);
        break;
    }

    onPeriodChange?.(periodStart, periodEnd);
  };

  // Accuracy color coding
  const getAccuracyColor = (accuracy: number): string => {
    if (accuracy >= 80 && accuracy <= 120) return '#16a34a'; // Green - good
    if (accuracy >= 60 && accuracy <= 140) return '#eab308'; // Yellow - acceptable
    return '#dc2626'; // Red - needs improvement
  };

  const getAccuracyIcon = (accuracy: number) => {
    if (accuracy >= 80 && accuracy <= 120) return <CheckCircle className="h-5 w-5 text-green-600" />;
    if (accuracy >= 60 && accuracy <= 140) return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
    return <AlertTriangle className="h-5 w-5 text-red-600" />;
  };

  // Chart data
  const chartData = React.useMemo(() => {
    if (!report) return [];

    return report.byTaskType.map((item) => ({
      taskType: item.taskType,
      'Estimated Hours': parseFloat(item.avgEstimatedHours.toFixed(2)),
      'Actual Hours': parseFloat(item.avgActualHours.toFixed(2)),
      accuracy: item.accuracy,
    }));
  }, [report]);

  // Trend icon
  const TrendIcon = React.useMemo(() => {
    if (!report) return Minus;
    switch (report.improvementTrend) {
      case 'up':
        return TrendingUp;
      case 'down':
        return TrendingDown;
      default:
        return Minus;
    }
  }, [report]);

  const trendColor = React.useMemo(() => {
    if (!report) return 'text-gray-500';
    switch (report.improvementTrend) {
      case 'up':
        return 'text-green-600';
      case 'down':
        return 'text-red-600';
      default:
        return 'text-gray-500';
    }
  }, [report]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="h-8 w-48 bg-gray-200 animate-pulse rounded"></div>
          <div className="h-10 w-48 bg-gray-200 animate-pulse rounded"></div>
        </div>
        <div className="h-32 bg-gray-200 animate-pulse rounded"></div>
        <div className="h-80 bg-gray-200 animate-pulse rounded"></div>
        <div className="h-64 bg-gray-200 animate-pulse rounded"></div>
      </div>
    );
  }

  if (!report || report.byTaskType.length === 0) {
    return (
      <div className="text-center py-12">
        <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <p className="text-gray-600">No completed tasks with estimates for this period</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Estimate vs Actual Analysis</h2>
          <p className="text-sm text-gray-600">
            {format(new Date(report.periodStart), 'MMM d, yyyy')} -{' '}
            {format(new Date(report.periodEnd), 'MMM d, yyyy')}
          </p>
        </div>
        <Select value={selectedPeriod} onValueChange={(value: string) => handlePeriodChange(value as PeriodOption)}>
          <SelectTrigger className="w-48">
            <SelectValue placeholder="Select period" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="this_month">This Month</SelectItem>
            <SelectItem value="last_month">Last Month</SelectItem>
            <SelectItem value="last_3_months">Last 3 Months</SelectItem>
            <SelectItem value="last_6_months">Last 6 Months</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Overall Accuracy Card */}
      <Card className="p-6 bg-gradient-to-r from-blue-50 to-indigo-50">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 mb-2">Overall Accuracy</p>
            <div className="flex items-center space-x-3">
              {getAccuracyIcon(report.overallAccuracy)}
              <p className="text-4xl font-bold text-gray-900">
                {report.overallAccuracy.toFixed(0)}%
              </p>
            </div>
            <p className="text-sm text-gray-600 mt-2">
              {report.overallAccuracy > 100 ? 'Overestimating' : report.overallAccuracy < 100 ? 'Underestimating' : 'On target'}
            </p>
          </div>
          <div className={`flex flex-col items-end ${trendColor}`}>
            <div className="flex items-center space-x-1">
              <TrendIcon className="h-5 w-5" />
              <span className="text-sm font-medium">Improvement Trend</span>
            </div>
            <p className="text-xs text-gray-600 mt-1">vs previous period</p>
          </div>
        </div>
      </Card>

      {/* Comparison Chart */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Average Hours by Task Type</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="taskType"
              tick={{ fontSize: 12 }}
              angle={-15}
              textAnchor="end"
              height={80}
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
                      <p className="font-semibold text-sm mb-2">{data.taskType}</p>
                      <p className="text-sm text-blue-600">
                        Estimated: {data['Estimated Hours']}h
                      </p>
                      <p className="text-sm text-purple-600">
                        Actual: {data['Actual Hours']}h
                      </p>
                      <p className="text-sm text-gray-700 font-semibold mt-1">
                        Accuracy: {data.accuracy.toFixed(0)}%
                      </p>
                    </div>
                  );
                }
                return null;
              }}
            />
            <Legend />
            <Bar dataKey="Estimated Hours" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="Actual Hours" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      {/* Task Type Breakdown Table */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Detailed Breakdown</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 px-2 font-semibold text-gray-700">Task Type</th>
                <th className="text-right py-3 px-2 font-semibold text-gray-700">Count</th>
                <th className="text-right py-3 px-2 font-semibold text-gray-700">Avg Est.</th>
                <th className="text-right py-3 px-2 font-semibold text-gray-700">Avg Actual</th>
                <th className="text-right py-3 px-2 font-semibold text-gray-700">Accuracy</th>
                <th className="text-right py-3 px-2 font-semibold text-gray-700">Variance</th>
              </tr>
            </thead>
            <tbody>
              {report.byTaskType.map((item) => {
                const accuracyColor = getAccuracyColor(item.accuracy);
                const varianceSign = item.variance >= 0 ? '+' : '';

                return (
                  <tr key={item.taskType} className="border-b hover:bg-gray-50">
                    <td className="py-3 px-2 font-medium">{item.taskType}</td>
                    <td className="text-right py-3 px-2">{item.taskCount}</td>
                    <td className="text-right py-3 px-2">{item.avgEstimatedHours.toFixed(1)}h</td>
                    <td className="text-right py-3 px-2">{item.avgActualHours.toFixed(1)}h</td>
                    <td className="text-right py-3 px-2">
                      <span
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold"
                        style={{ backgroundColor: `${accuracyColor}20`, color: accuracyColor }}
                      >
                        {item.accuracy.toFixed(0)}%
                      </span>
                    </td>
                    <td className="text-right py-3 px-2">
                      <span className={item.variance >= 0 ? 'text-red-600' : 'text-green-600'}>
                        {varianceSign}{item.variance.toFixed(1)}h ({varianceSign}{item.variancePercent.toFixed(0)}%)
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* AI Recommendations */}
      {report.recommendations.length > 0 && (
        <Card className="p-6 bg-gradient-to-r from-purple-50 to-pink-50">
          <div className="flex items-start space-x-3">
            <Lightbulb className="h-6 w-6 text-purple-600 mt-1" />
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">AI Recommendations</h3>
              <ul className="space-y-2">
                {report.recommendations.map((rec, index) => (
                  <li key={index} className="flex items-start space-x-2">
                    <span className="text-purple-600 font-bold">•</span>
                    <span className="text-sm text-gray-700">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}
