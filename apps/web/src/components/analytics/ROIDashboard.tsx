/**
 * ROI Dashboard Component
 * Story 4.7: Task Analytics and Optimization - Task 27
 * Extended: Story 5.7: Platform Intelligence Dashboard - Task 18
 *
 * Displays automation ROI metrics and time savings.
 * AC: 6 - ROI dashboard shows automation time savings
 * Extended AC: 6 - ROI calculation based on billable hours recovered
 */

'use client';

import React from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
  ReferenceLine,
} from 'recharts';
import type { ROIDashboardResponse, ROISummary } from '@legal-platform/types';

// ============================================================================
// Types
// ============================================================================

interface ROIDashboardProps {
  data: ROIDashboardResponse | undefined;
  loading: boolean;
  /** Platform Intelligence ROI Summary (optional extension for Story 5.7) */
  platformROI?: ROISummary;
  /** Firm's monthly subscription cost in currency (for ROI comparison) */
  subscriptionCost?: number;
  /** Firm's target utilization rate (default: 0.7 = 70%) */
  utilizationRate?: number;
  /** Show extended Platform Intelligence view */
  showExtendedView?: boolean;
}

// ============================================================================
// Constants
// ============================================================================

const COLORS = [
  '#3B82F6', // blue-500
  '#10B981', // emerald-500
  '#F59E0B', // amber-500
  '#8B5CF6', // violet-500
  '#EC4899', // pink-500
];

// ============================================================================
// Helper Functions
// ============================================================================

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('ro-RO', {
    style: 'currency',
    currency: 'RON',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatHours(hours: number): string {
  if (hours < 1) return `${Math.round(hours * 60)}m`;
  return `${hours.toFixed(1)}h`;
}

// ============================================================================
// Extended Components for Platform Intelligence (Story 5.7)
// ============================================================================

interface BillableHoursCardProps {
  totalTimeSavedHours: number;
  utilizationRate: number;
  hourlyRate: number;
}

function BillableHoursCard({
  totalTimeSavedHours,
  utilizationRate,
  hourlyRate,
}: BillableHoursCardProps) {
  const billableHours = totalTimeSavedHours * utilizationRate;
  const recoveredRevenue = billableHours * hourlyRate;

  return (
    <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-lg p-6 text-white">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm opacity-80 mb-1">Ore facturabile recuperate</div>
          <div className="text-4xl font-bold">
            {formatHours(billableHours)}
          </div>
          <div className="mt-2 text-sm opacity-70">
            {formatHours(totalTimeSavedHours)} economisit × {(utilizationRate * 100).toFixed(0)}% utilizare
          </div>
        </div>
        <div className="text-right">
          <div className="text-sm opacity-80 mb-1">Venit recuperat</div>
          <div className="text-3xl font-bold">
            {formatCurrency(recoveredRevenue)}
          </div>
          <div className="text-sm opacity-70 mt-1">
            @ {formatCurrency(hourlyRate)}/oră
          </div>
        </div>
      </div>
    </div>
  );
}

interface SubscriptionComparisonProps {
  monthlySavings: number;
  subscriptionCost: number;
  projectedAnnualSavings: number;
}

function SubscriptionComparison({
  monthlySavings,
  subscriptionCost,
  projectedAnnualSavings,
}: SubscriptionComparisonProps) {
  const monthlyROI = subscriptionCost > 0 ? ((monthlySavings - subscriptionCost) / subscriptionCost) * 100 : 0;
  const annualSubscriptionCost = subscriptionCost * 12;
  const netAnnualBenefit = projectedAnnualSavings - annualSubscriptionCost;
  const isPositiveROI = monthlyROI > 0;

  const comparisonData = [
    { name: 'Economii', value: monthlySavings, fill: '#10B981' },
    { name: 'Abonament', value: subscriptionCost, fill: '#EF4444' },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <h4 className="text-md font-semibold mb-4">Comparație cost abonament</h4>

      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="text-center p-3 bg-emerald-50 rounded-lg">
          <div className="text-xs text-gray-500 mb-1">Economii lunare</div>
          <div className="text-xl font-bold text-emerald-600">
            {formatCurrency(monthlySavings)}
          </div>
        </div>
        <div className="text-center p-3 bg-red-50 rounded-lg">
          <div className="text-xs text-gray-500 mb-1">Cost abonament</div>
          <div className="text-xl font-bold text-red-600">
            {formatCurrency(subscriptionCost)}
          </div>
        </div>
        <div className={`text-center p-3 rounded-lg ${isPositiveROI ? 'bg-blue-50' : 'bg-amber-50'}`}>
          <div className="text-xs text-gray-500 mb-1">ROI lunar</div>
          <div className={`text-xl font-bold ${isPositiveROI ? 'text-blue-600' : 'text-amber-600'}`}>
            {monthlyROI > 0 ? '+' : ''}{monthlyROI.toFixed(0)}%
          </div>
        </div>
      </div>

      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={comparisonData} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" horizontal={false} />
            <XAxis type="number" tickFormatter={(v) => formatCurrency(v)} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={80} tick={{ fontSize: 12 }} />
            <Tooltip formatter={(value: number) => formatCurrency(value)} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {comparisonData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
            <ReferenceLine x={0} stroke="#9CA3AF" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex justify-between items-center">
          <span className="text-sm text-gray-600">Beneficiu net anual estimat:</span>
          <span className={`text-lg font-bold ${netAnnualBenefit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
            {netAnnualBenefit >= 0 ? '+' : ''}{formatCurrency(netAnnualBenefit)}
          </span>
        </div>
      </div>
    </div>
  );
}

interface YearlyProjectionChartProps {
  currentMonthSavings: number;
  projectedAnnualSavings: number;
  subscriptionCost?: number;
}

function YearlyProjectionChart({
  currentMonthSavings,
  projectedAnnualSavings,
  subscriptionCost,
}: YearlyProjectionChartProps) {
  // Generate monthly projection data
  const monthNames = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const currentMonth = new Date().getMonth();

  const projectionData = monthNames.map((month, index) => {
    const isPast = index <= currentMonth;
    const monthlyGrowth = 1 + (index * 0.02); // 2% growth assumption per month
    const projected = currentMonthSavings * monthlyGrowth;
    // Use deterministic variation based on month index for past months
    const variationFactor = 0.9 + (index % 3) * 0.1; // 0.9, 1.0, or 1.1

    return {
      month,
      savings: isPast ? currentMonthSavings * variationFactor : projected,
      subscriptionCost: subscriptionCost || 0,
      isPast,
    };
  });

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-md font-semibold">Proiecție anuală economii</h4>
        <div className="text-right">
          <div className="text-xs text-gray-500">Total anual proiectat</div>
          <div className="text-lg font-bold text-emerald-600">
            {formatCurrency(projectedAnnualSavings)}
          </div>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={projectionData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(value: number, name: string) => [
                formatCurrency(value),
                name === 'savings' ? 'Economii' : 'Cost abonament',
              ]}
            />
            <Legend formatter={(value) => (value === 'savings' ? 'Economii lunare' : 'Cost abonament')} />
            <Area
              type="monotone"
              dataKey="savings"
              stroke="#10B981"
              fill="#D1FAE5"
              fillOpacity={0.5}
              strokeWidth={2}
            />
            {subscriptionCost && subscriptionCost > 0 && (
              <ReferenceLine
                y={subscriptionCost}
                stroke="#EF4444"
                strokeDasharray="5 5"
                label={{ value: 'Cost abonament', position: 'right', fontSize: 11, fill: '#EF4444' }}
              />
            )}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function ROIDashboard({
  data,
  loading,
  platformROI,
  subscriptionCost,
  utilizationRate = 0.7,
  showExtendedView = false,
}: ROIDashboardProps) {
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-100 animate-pulse rounded-lg" />
          ))}
        </div>
        <div className="h-64 bg-gray-100 animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-8 text-gray-500">
        Nu există date ROI disponibile
      </div>
    );
  }

  const { currentPeriod } = data;

  const timeSeriesData = data.timeSeries.map((point) => ({
    date: new Date(point.date).toLocaleDateString('ro-RO', {
      month: 'short',
      day: 'numeric',
    }),
    hours: point.timeSavedHours,
    value: point.valueSaved,
  }));

  const categoryData = data.topSavingsCategories.map((cat, index) => ({
    name: cat.category,
    value: cat.hoursSaved,
    valueSaved: cat.valueSaved,
    percentage: cat.percentageOfTotal,
    color: COLORS[index % COLORS.length],
  }));

  const growthIsPositive = (currentPeriod.savingsGrowthPercent ?? 0) >= 0;

  return (
    <div className="space-y-6">
      {/* Main Value Card */}
      <div className="bg-gradient-to-r from-emerald-500 to-teal-600 rounded-lg p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm opacity-80 mb-1">Valoare totală economisită în această perioadă</div>
            <div className="text-4xl font-bold">
              {formatCurrency(currentPeriod.totalValueSaved)}
            </div>
            <div className="mt-2 flex items-center gap-2">
              <span className={`text-sm ${growthIsPositive ? 'text-emerald-200' : 'text-red-200'}`}>
                {growthIsPositive ? '↑' : '↓'} {Math.abs(currentPeriod.savingsGrowthPercent ?? 0).toFixed(1)}%
              </span>
              <span className="text-sm opacity-70">vs. perioada anterioară</span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm opacity-80 mb-1">Timp economisit</div>
            <div className="text-3xl font-bold">
              {formatHours(currentPeriod.totalTimeSavedHours)}
            </div>
            <div className="text-sm opacity-70 mt-1">
              @ {formatCurrency(currentPeriod.avgHourlyRate)}/oră
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Template Tasks */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <span className="text-sm text-gray-500">Șabloane</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {currentPeriod.templateTasksCreated}
          </div>
          <div className="text-sm text-gray-500">
            {formatHours(currentPeriod.estimatedTemplateTimeSavedHours)} economisit
          </div>
          <div className="mt-2 text-xs text-gray-400">
            {currentPeriod.manualTasksCreated} sarcini manuale
          </div>
          <div className="text-xs text-blue-600">
            {(currentPeriod.templateAdoptionRate * 100).toFixed(0)}% adoptare
          </div>
        </div>

        {/* NLP Tasks */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <span className="text-sm text-gray-500">Parsare NLP</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {currentPeriod.nlpTasksCreated}
          </div>
          <div className="text-sm text-gray-500">
            {formatHours(currentPeriod.estimatedNLPTimeSavedHours)} economisit
          </div>
          <div className="mt-2 text-xs text-violet-600">
            Creare sarcini în limbaj natural
          </div>
        </div>

        {/* Automation */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <span className="text-sm text-gray-500">Automatizare</span>
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {currentPeriod.autoRemindersSet + currentPeriod.autoDependencyTriggers + currentPeriod.autoReassignments}
          </div>
          <div className="text-sm text-gray-500">
            {formatHours(currentPeriod.estimatedAutomationTimeSavedHours)} economisit
          </div>
          <div className="mt-2 grid grid-cols-3 gap-1 text-xs text-gray-400">
            <span>{currentPeriod.autoRemindersSet} memento</span>
            <span>{currentPeriod.autoDependencyTriggers} dep.</span>
            <span>{currentPeriod.autoReassignments} reasig.</span>
          </div>
        </div>

        {/* Projected Annual */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <svg className="w-4 h-4 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <span className="text-sm text-gray-500">Proiecție anuală</span>
          </div>
          <div className="text-2xl font-bold text-emerald-600">
            {formatCurrency(data.projectedAnnualSavings)}
          </div>
          <div className="text-sm text-gray-500">economii estimate</div>
          <div className="mt-2 text-xs text-gray-400">
            Pe baza tendințelor curente
          </div>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid md:grid-cols-2 gap-6">
        {/* Time Series Chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-md font-semibold mb-4">Economii în timp</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeSeriesData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis
                  yAxisId="left"
                  tickFormatter={(v) => formatHours(v)}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => [
                    name === 'hours' ? formatHours(value) : formatCurrency(value),
                    name === 'hours' ? 'Timp economisit' : 'Valoare economisită',
                  ]}
                />
                <Area
                  yAxisId="left"
                  type="monotone"
                  dataKey="hours"
                  name="hours"
                  fill="#6EE7B7"
                  stroke="#10B981"
                  fillOpacity={0.3}
                />
                <Area
                  yAxisId="right"
                  type="monotone"
                  dataKey="value"
                  name="value"
                  fill="#93C5FD"
                  stroke="#3B82F6"
                  fillOpacity={0.3}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h4 className="text-md font-semibold mb-4">Economii pe categorie</h4>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={categoryData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  label={({ name, payload }) => `${name}: ${(payload?.percentage ?? 0).toFixed(0)}%`}
                  labelLine={{ stroke: '#94A3B8' }}
                >
                  {categoryData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number, name: string, props) => [
                    `${formatHours(value)} (${formatCurrency(props.payload.valueSaved)})`,
                    name,
                  ]}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Category Details */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <h4 className="text-md font-semibold mb-4">Defalcare pe categorii</h4>
        <div className="space-y-4">
          {data.topSavingsCategories.map((category, index) => (
            <div key={category.category} className="flex items-center gap-4">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: COLORS[index % COLORS.length] }}
              />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium">{category.category}</span>
                  <span className="text-sm text-gray-500">
                    {formatHours(category.hoursSaved)} • {formatCurrency(category.valueSaved)}
                  </span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${category.percentageOfTotal}%`,
                      backgroundColor: COLORS[index % COLORS.length],
                    }}
                  />
                </div>
              </div>
              <span className="text-sm font-medium text-gray-600 w-12 text-right">
                {category.percentageOfTotal.toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Extended Platform Intelligence View (Story 5.7) */}
      {showExtendedView && (
        <>
          {/* Billable Hours Recovered Card */}
          <BillableHoursCard
            totalTimeSavedHours={platformROI?.billableHoursRecovered || currentPeriod.totalTimeSavedHours}
            utilizationRate={utilizationRate}
            hourlyRate={currentPeriod.avgHourlyRate}
          />

          {/* Extended Charts Row */}
          <div className="grid md:grid-cols-2 gap-6">
            {/* Yearly Projection */}
            <YearlyProjectionChart
              currentMonthSavings={currentPeriod.totalValueSaved}
              projectedAnnualSavings={platformROI?.projectedAnnualSavings || data.projectedAnnualSavings}
              subscriptionCost={subscriptionCost}
            />

            {/* Subscription Comparison */}
            {subscriptionCost !== undefined && subscriptionCost > 0 && (
              <SubscriptionComparison
                monthlySavings={currentPeriod.totalValueSaved}
                subscriptionCost={subscriptionCost}
                projectedAnnualSavings={platformROI?.projectedAnnualSavings || data.projectedAnnualSavings}
              />
            )}
          </div>

          {/* Platform ROI Savings by Category (if provided) */}
          {platformROI?.savingsByCategory && platformROI.savingsByCategory.length > 0 && (
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h4 className="text-md font-semibold mb-4">Economii pe categorii platformă</h4>
              <div className="space-y-4">
                {platformROI.savingsByCategory.map((category, index) => (
                  <div key={category.category} className="flex items-center gap-4">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-medium">{category.category}</span>
                        <span className="text-sm text-gray-500">
                          {formatHours(category.hoursSaved)} • {formatCurrency(category.valueInCurrency)}
                        </span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${category.percentOfTotal}%`,
                            backgroundColor: COLORS[index % COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                    <span className="text-sm font-medium text-gray-600 w-12 text-right">
                      {category.percentOfTotal.toFixed(0)}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default ROIDashboard;
