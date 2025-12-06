/**
 * ResponsePatternsCard - Display response time patterns and analytics
 * Story 5.6: AI Learning and Personalization (Task 35)
 * Shows productivity metrics and time patterns with visualizations
 */

'use client';

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  useResponsePatternManagement,
  formatHours,
  formatDayOfWeek,
  formatTimeOfDay,
  formatTaskType,
  getHoursColor,
  calculateProductivityScore,
  type DayOfWeekPattern,
  type TimeOfDayPattern,
} from '@/hooks/useResponsePatterns';
import type { ResponseTimePattern } from '@legal-platform/types';

// Icons
const ClockIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="20"
    height="20"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

const TrendUpIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"
    />
  </svg>
);

const TrendDownIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="16"
    height="16"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6"
    />
  </svg>
);

interface ResponsePatternsCardProps {
  className?: string;
}

/**
 * Day of week heatmap component
 */
function DayOfWeekHeatmap({
  patterns,
}: {
  patterns: ResponseTimePattern[];
}) {
  // Aggregate day patterns
  const aggregatedPattern = useMemo(() => {
    const dayData: Record<string, number[]> = {
      monday: [],
      tuesday: [],
      wednesday: [],
      thursday: [],
      friday: [],
    };

    patterns.forEach((pattern) => {
      if (pattern.dayOfWeekPattern) {
        const dayPattern = pattern.dayOfWeekPattern as DayOfWeekPattern;
        Object.entries(dayPattern).forEach(([day, hours]) => {
          if (dayData[day] && typeof hours === 'number') {
            dayData[day].push(hours);
          }
        });
      }
    });

    const result: Record<string, number> = {};
    Object.entries(dayData).forEach(([day, hoursList]) => {
      if (hoursList.length > 0) {
        result[day] = hoursList.reduce((a, b) => a + b, 0) / hoursList.length;
      }
    });
    return result;
  }, [patterns]);

  const maxHours = Math.max(...Object.values(aggregatedPattern), 1);
  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

  if (Object.keys(aggregatedPattern).length === 0) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        Date insuficiente pentru heatmap
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Timp mediu de răspuns pe zi</div>
      <div className="flex gap-2">
        {days.map((day) => {
          const hours = aggregatedPattern[day] || 0;
          return (
            <div
              key={day}
              className={`
                flex-1 p-2 rounded text-center text-xs
                ${getHoursColor(hours, maxHours)}
              `}
              title={`${formatDayOfWeek(day)}: ${formatHours(hours)}`}
            >
              <div className="font-medium">{formatDayOfWeek(day).slice(0, 2)}</div>
              <div className="mt-1">{hours > 0 ? formatHours(hours) : '-'}</div>
            </div>
          );
        })}
      </div>
      {/* Legend */}
      <div className="flex justify-center gap-4 text-xs text-muted-foreground mt-2">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-green-100 rounded" />
          <span>Rapid</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-yellow-100 rounded" />
          <span>Mediu</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 bg-red-100 rounded" />
          <span>Lent</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Time of day chart component
 */
function TimeOfDayChart({
  patterns,
}: {
  patterns: ResponseTimePattern[];
}) {
  // Aggregate time of day patterns
  const aggregatedPattern = useMemo(() => {
    const timeData: Record<string, number[]> = {
      morning: [],
      afternoon: [],
      evening: [],
    };

    patterns.forEach((pattern) => {
      if (pattern.timeOfDayPattern) {
        const timePattern = pattern.timeOfDayPattern as TimeOfDayPattern;
        Object.entries(timePattern).forEach(([time, hours]) => {
          if (timeData[time] && typeof hours === 'number') {
            timeData[time].push(hours);
          }
        });
      }
    });

    const result: Record<string, number> = {};
    Object.entries(timeData).forEach(([time, hoursList]) => {
      if (hoursList.length > 0) {
        result[time] = hoursList.reduce((a, b) => a + b, 0) / hoursList.length;
      }
    });
    return result;
  }, [patterns]);

  const maxHours = Math.max(...Object.values(aggregatedPattern), 1);
  const times = ['morning', 'afternoon', 'evening'];

  if (Object.keys(aggregatedPattern).length === 0) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        Date insuficiente pentru grafic
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="text-sm font-medium">Productivitate pe timp de zi</div>
      <div className="space-y-2">
        {times.map((time) => {
          const hours = aggregatedPattern[time] || 0;
          const percentage = maxHours > 0 ? (hours / maxHours) * 100 : 0;
          // Invert: lower hours = more productive
          const productivityPercentage = 100 - percentage;

          return (
            <div key={time} className="space-y-1">
              <div className="flex justify-between text-xs">
                <span>{formatTimeOfDay(time)}</span>
                <span className="text-muted-foreground">
                  {hours > 0 ? formatHours(hours) : '-'}
                </span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all"
                  style={{ width: `${productivityPercentage}%` }}
                  role="progressbar"
                  aria-valuenow={productivityPercentage}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
            </div>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground text-center mt-2">
        Bară mai lungă = răspuns mai rapid = productivitate mai mare
      </p>
    </div>
  );
}

/**
 * Task type breakdown component
 */
function TaskTypeBreakdown({
  patterns,
}: {
  patterns: ResponseTimePattern[];
}) {
  const sortedPatterns = useMemo(() => {
    return [...patterns].sort((a, b) => a.averageResponseHours - b.averageResponseHours);
  }, [patterns]);

  if (patterns.length === 0) {
    return (
      <div className="text-center py-4 text-sm text-muted-foreground">
        Niciun pattern de tip task
      </div>
    );
  }

  const maxHours = Math.max(...patterns.map((p) => p.averageResponseHours), 1);

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">Timp mediu pe tip de task</div>
      <div className="space-y-2">
        {sortedPatterns.map((pattern, index) => {
          const isFirst = index === 0;
          const isLast = index === sortedPatterns.length - 1;
          const percentage = (pattern.averageResponseHours / maxHours) * 100;
          const score = calculateProductivityScore(pattern);

          return (
            <div key={pattern.id} className="space-y-1">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <span>{formatTaskType(pattern.taskType)}</span>
                  {isFirst && sortedPatterns.length > 1 && (
                    <Badge className="bg-green-100 text-green-800 text-[10px]">
                      <TrendUpIcon className="mr-1" />
                      Cel mai rapid
                    </Badge>
                  )}
                  {isLast && sortedPatterns.length > 1 && (
                    <Badge className="bg-red-100 text-red-800 text-[10px]">
                      <TrendDownIcon className="mr-1" />
                      Cel mai lent
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {formatHours(pattern.averageResponseHours)}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {pattern.sampleCount} sample{pattern.sampleCount !== 1 ? 's' : ''}
                  </Badge>
                </div>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    score >= 70
                      ? 'bg-green-500'
                      : score >= 40
                        ? 'bg-yellow-500'
                        : 'bg-red-500'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Summary stats component
 */
function SummaryStats({
  summary,
}: {
  summary: {
    averageResponseTime: string;
    fastestTaskType?: string;
    slowestTaskType?: string;
    peakProductivityTime?: string;
    totalSamples: number;
  };
}) {
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="p-3 bg-muted/30 rounded-lg">
        <div className="text-xs text-muted-foreground">Timp mediu răspuns</div>
        <div className="text-lg font-semibold mt-1">
          {summary.averageResponseTime}
        </div>
      </div>
      <div className="p-3 bg-muted/30 rounded-lg">
        <div className="text-xs text-muted-foreground">Total task-uri analizate</div>
        <div className="text-lg font-semibold mt-1">{summary.totalSamples}</div>
      </div>
      {summary.fastestTaskType && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="text-xs text-muted-foreground">Cel mai rapid la</div>
          <div className="text-sm font-medium mt-1 text-green-700 dark:text-green-400">
            {formatTaskType(summary.fastestTaskType)}
          </div>
        </div>
      )}
      {summary.peakProductivityTime && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <div className="text-xs text-muted-foreground">Cea mai productivă zi</div>
          <div className="text-sm font-medium mt-1 text-blue-700 dark:text-blue-400">
            {summary.peakProductivityTime}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Accessibility table for screen readers
 */
function AccessibilityTable({
  patterns,
}: {
  patterns: ResponseTimePattern[];
}) {
  return (
    <table className="sr-only">
      <caption>Tabel cu pattern-uri de timp de răspuns</caption>
      <thead>
        <tr>
          <th scope="col">Tip task</th>
          <th scope="col">Timp mediu</th>
          <th scope="col">Timp minim</th>
          <th scope="col">Timp maxim</th>
          <th scope="col">Număr sample-uri</th>
        </tr>
      </thead>
      <tbody>
        {patterns.map((pattern) => (
          <tr key={pattern.id}>
            <td>{formatTaskType(pattern.taskType)}</td>
            <td>{formatHours(pattern.averageResponseHours)}</td>
            <td>{formatHours(pattern.minResponseHours)}</td>
            <td>{formatHours(pattern.maxResponseHours)}</td>
            <td>{pattern.sampleCount}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Main ResponsePatternsCard component
 */
export function ResponsePatternsCard({
  className = '',
}: ResponsePatternsCardProps) {
  const {
    patterns,
    summary,
    loading,
    error,
    hasPatterns,
  } = useResponsePatternManagement();

  if (loading && patterns.length === 0) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-pulse text-muted-foreground">
              Se încarcă pattern-urile...
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="text-center text-destructive">
            <p>Eroare la încărcarea pattern-urilor</p>
            <p className="text-sm">{error.message}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <ClockIcon className="text-primary" />
          </div>
          <div>
            <CardTitle className="text-lg">Pattern-uri Răspuns</CardTitle>
            <p className="text-sm text-muted-foreground">
              Analiză bazată pe {summary?.totalSamples || 0} task-uri completate
            </p>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {!hasPatterns ? (
          <div className="text-center py-8 text-muted-foreground">
            <ClockIcon className="mx-auto mb-3 h-12 w-12 opacity-50" />
            <p>Nu există date suficiente pentru analiză</p>
            <p className="text-sm mt-1">
              Completează mai multe task-uri pentru a genera pattern-uri
            </p>
          </div>
        ) : (
          <Tabs defaultValue="summary" className="space-y-4">
            <TabsList className="grid grid-cols-4 w-full">
              <TabsTrigger value="summary">Sumar</TabsTrigger>
              <TabsTrigger value="tasks">Pe task</TabsTrigger>
              <TabsTrigger value="days">Pe zile</TabsTrigger>
              <TabsTrigger value="times">Pe oră</TabsTrigger>
            </TabsList>

            <TabsContent value="summary">
              {summary && <SummaryStats summary={summary} />}
            </TabsContent>

            <TabsContent value="tasks">
              <TaskTypeBreakdown patterns={patterns} />
            </TabsContent>

            <TabsContent value="days">
              <DayOfWeekHeatmap patterns={patterns} />
            </TabsContent>

            <TabsContent value="times">
              <TimeOfDayChart patterns={patterns} />
            </TabsContent>
          </Tabs>
        )}

        {/* Accessibility table */}
        {hasPatterns && <AccessibilityTable patterns={patterns} />}
      </CardContent>
    </Card>
  );
}

ResponsePatternsCard.displayName = 'ResponsePatternsCard';

/**
 * Compact version for dashboard widgets
 */
export function ResponsePatternsCompact({ className = '' }: { className?: string }) {
  const { summary, hasPatterns, loading } = useResponsePatternManagement();

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-4">
          <div className="animate-pulse h-20" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <ClockIcon className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-medium">Timp Răspuns</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {hasPatterns && summary ? (
          <>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Timp mediu</span>
              <span className="font-medium">{summary.averageResponseTime}</span>
            </div>
            {summary.fastestTaskType && (
              <div className="text-xs text-muted-foreground">
                Cel mai rapid la:{' '}
                <span className="font-medium text-green-600">
                  {formatTaskType(summary.fastestTaskType)}
                </span>
              </div>
            )}
            {summary.peakProductivityTime && (
              <div className="text-xs text-muted-foreground">
                Cea mai productivă zi:{' '}
                <span className="font-medium text-blue-600">
                  {summary.peakProductivityTime}
                </span>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">
            Date insuficiente
          </p>
        )}
      </CardContent>
    </Card>
  );
}

ResponsePatternsCompact.displayName = 'ResponsePatternsCompact';
