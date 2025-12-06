'use client';

/**
 * Change Summary Panel Component
 * Story 3.5: Semantic Version Control System - Task 11
 *
 * Displays executive summary, aggregate risk, and grouped changes
 * with visualization of change breakdown.
 */

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  FileText,
  ExternalLink,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

interface SemanticChange {
  id: string;
  changeType: 'ADDED' | 'REMOVED' | 'MODIFIED' | 'MOVED';
  significance: 'FORMATTING' | 'MINOR_WORDING' | 'SUBSTANTIVE' | 'CRITICAL';
  beforeText: string;
  afterText: string;
  sectionPath?: string;
  plainSummary: string;
  legalClassification?: string;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  riskExplanation?: string;
}

interface ChangeBreakdown {
  formatting: number;
  minorWording: number;
  substantive: number;
  critical: number;
}

interface ChangeSummaryPanelProps {
  executiveSummary: string;
  aggregateRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  changes: SemanticChange[];
  changeBreakdown: ChangeBreakdown;
  onViewChange?: (change: SemanticChange) => void;
}

const SIGNIFICANCE_COLORS = {
  critical: '#EF4444', // red-500
  substantive: '#F97316', // orange-500
  minorWording: '#3B82F6', // blue-500
  formatting: '#9CA3AF', // gray-400
};

export function ChangeSummaryPanel({
  executiveSummary,
  aggregateRisk,
  changes,
  changeBreakdown,
  onViewChange,
}: ChangeSummaryPanelProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    critical: true,
    substantive: true,
    minorWording: false,
  });

  // Group changes by significance
  const groupedChanges = {
    critical: changes.filter((c) => c.significance === 'CRITICAL'),
    substantive: changes.filter((c) => c.significance === 'SUBSTANTIVE'),
    minorWording: changes.filter((c) => c.significance === 'MINOR_WORDING'),
    formatting: changes.filter((c) => c.significance === 'FORMATTING'),
  };

  // Chart data
  const chartData = [
    { name: 'Critical', value: changeBreakdown.critical, color: SIGNIFICANCE_COLORS.critical },
    { name: 'Substantive', value: changeBreakdown.substantive, color: SIGNIFICANCE_COLORS.substantive },
    { name: 'Minor', value: changeBreakdown.minorWording, color: SIGNIFICANCE_COLORS.minorWording },
    { name: 'Formatting', value: changeBreakdown.formatting, color: SIGNIFICANCE_COLORS.formatting },
  ].filter((d) => d.value > 0);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  const getRiskBadge = (risk: string) => {
    switch (risk) {
      case 'HIGH':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            High Risk
          </Badge>
        );
      case 'MEDIUM':
        return (
          <Badge className="flex items-center gap-1 bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            <AlertCircle className="h-3 w-3" />
            Medium Risk
          </Badge>
        );
      case 'LOW':
        return (
          <Badge className="flex items-center gap-1 bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckCircle className="h-3 w-3" />
            Low Risk
          </Badge>
        );
      default:
        return null;
    }
  };

  const renderChangeCard = (change: SemanticChange) => (
    <div
      key={change.id}
      className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={() => onViewChange?.(change)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium text-sm">{change.plainSummary || 'Change detected'}</p>
          {change.sectionPath && (
            <p className="text-xs text-muted-foreground mt-1">{change.sectionPath}</p>
          )}
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {change.riskLevel && getRiskBadge(change.riskLevel)}
            {change.legalClassification && (
              <Badge variant="outline" className="text-xs">
                {change.legalClassification.replace(/_/g, ' ')}
              </Badge>
            )}
          </div>
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
          <ExternalLink className="h-4 w-4" />
        </Button>
      </div>
      {change.beforeText && change.afterText && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
          <div className="p-2 rounded bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 line-clamp-2">
            {change.beforeText.substring(0, 100)}...
          </div>
          <div className="p-2 rounded bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 line-clamp-2">
            {change.afterText.substring(0, 100)}...
          </div>
        </div>
      )}
    </div>
  );

  const renderSection = (
    title: string,
    color: string,
    sectionChanges: SemanticChange[],
    sectionKey: string
  ) => {
    if (sectionChanges.length === 0) return null;

    return (
      <Collapsible
        open={expandedSections[sectionKey]}
        onOpenChange={() => toggleSection(sectionKey)}
      >
        <CollapsibleTrigger className="flex items-center justify-between w-full py-2 hover:bg-accent/50 rounded-lg px-2 transition-colors">
          <div className="flex items-center gap-2">
            {expandedSections[sectionKey] ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            <span className="font-medium">{title}</span>
            <Badge
              variant="secondary"
              style={{ backgroundColor: color, color: 'white' }}
              className="text-xs"
            >
              {sectionChanges.length}
            </Badge>
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="space-y-2 mt-2 pl-6">
            {sectionChanges.map(renderChangeCard)}
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Change Summary
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 space-y-6">
            {/* Executive Summary */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Overview</h3>
                {getRiskBadge(aggregateRisk)}
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {executiveSummary || 'No summary available.'}
              </p>
            </div>

            {/* Change Breakdown Chart */}
            {chartData.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-medium">Change Breakdown</h3>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius={40}
                        outerRadius={70}
                        paddingAngle={2}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                        labelLine={false}
                      >
                        {chartData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value: number) => [`${value} changes`, 'Count']}
                      />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value) => (
                          <span className="text-sm text-muted-foreground">{value}</span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>

                {/* Stats Row */}
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/20">
                    <p className="text-lg font-bold text-red-600 dark:text-red-400">
                      {changeBreakdown.critical}
                    </p>
                    <p className="text-xs text-muted-foreground">Critical</p>
                  </div>
                  <div className="p-2 rounded-lg bg-orange-50 dark:bg-orange-900/20">
                    <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                      {changeBreakdown.substantive}
                    </p>
                    <p className="text-xs text-muted-foreground">Substantive</p>
                  </div>
                  <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/20">
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">
                      {changeBreakdown.minorWording}
                    </p>
                    <p className="text-xs text-muted-foreground">Minor</p>
                  </div>
                  <div className="p-2 rounded-lg bg-gray-50 dark:bg-gray-800">
                    <p className="text-lg font-bold text-gray-600 dark:text-gray-400">
                      {changeBreakdown.formatting}
                    </p>
                    <p className="text-xs text-muted-foreground">Formatting</p>
                  </div>
                </div>
              </div>
            )}

            {/* Grouped Changes */}
            <div className="space-y-2">
              <h3 className="font-medium">All Changes</h3>

              {renderSection(
                'Critical Changes',
                SIGNIFICANCE_COLORS.critical,
                groupedChanges.critical,
                'critical'
              )}

              {renderSection(
                'Substantive Changes',
                SIGNIFICANCE_COLORS.substantive,
                groupedChanges.substantive,
                'substantive'
              )}

              {renderSection(
                'Minor Changes',
                SIGNIFICANCE_COLORS.minorWording,
                groupedChanges.minorWording,
                'minorWording'
              )}

              {changes.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No changes detected between these versions.
                </p>
              )}
            </div>
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default ChangeSummaryPanel;
