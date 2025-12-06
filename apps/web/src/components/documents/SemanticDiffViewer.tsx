'use client';

/**
 * Semantic Diff Viewer Component
 * Story 3.5: Semantic Version Control System - Task 10
 *
 * Displays side-by-side diff with color-coded changes and semantic highlighting.
 */

import React, { useState, useRef, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  ChevronUp,
  ChevronDown,
  Eye,
  EyeOff,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  Minus,
  Plus,
  Edit2,
  MoveHorizontal,
} from 'lucide-react';

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

interface SemanticDiffViewerProps {
  changes: SemanticChange[];
  fromVersionNumber: number;
  toVersionNumber: number;
  onChangeClick?: (change: SemanticChange) => void;
}

export function SemanticDiffViewer({
  changes,
  fromVersionNumber,
  toVersionNumber,
  onChangeClick,
}: SemanticDiffViewerProps) {
  const [currentChangeIndex, setCurrentChangeIndex] = useState(0);
  const [showFormatting, setShowFormatting] = useState(false);
  const [significanceFilter, setSignificanceFilter] = useState<string>('all');

  const leftScrollRef = useRef<HTMLDivElement>(null);
  const rightScrollRef = useRef<HTMLDivElement>(null);
  const changeRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Filter changes based on settings
  const filteredChanges = changes.filter((change) => {
    if (!showFormatting && change.significance === 'FORMATTING') {
      return false;
    }
    if (significanceFilter !== 'all' && change.significance !== significanceFilter) {
      return false;
    }
    return true;
  });

  // Sync scroll between panels
  const handleScroll = useCallback((source: 'left' | 'right') => {
    const sourceRef = source === 'left' ? leftScrollRef.current : rightScrollRef.current;
    const targetRef = source === 'left' ? rightScrollRef.current : leftScrollRef.current;

    if (sourceRef && targetRef) {
      targetRef.scrollTop = sourceRef.scrollTop;
    }
  }, []);

  // Navigate to change
  const navigateToChange = (index: number) => {
    if (index >= 0 && index < filteredChanges.length) {
      setCurrentChangeIndex(index);
      const change = filteredChanges[index];
      const element = changeRefs.current.get(change.id);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  };

  const getChangeIcon = (changeType: string) => {
    switch (changeType) {
      case 'ADDED':
        return <Plus className="h-4 w-4" />;
      case 'REMOVED':
        return <Minus className="h-4 w-4" />;
      case 'MODIFIED':
        return <Edit2 className="h-4 w-4" />;
      case 'MOVED':
        return <MoveHorizontal className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getChangeColor = (changeType: string, significance: string) => {
    if (significance === 'FORMATTING') {
      return {
        bg: 'bg-gray-100 dark:bg-gray-800',
        text: 'text-gray-500 dark:text-gray-400',
        border: 'border-gray-300 dark:border-gray-600',
      };
    }

    switch (changeType) {
      case 'ADDED':
        return {
          bg: 'bg-green-100 dark:bg-green-900/30',
          text: 'text-green-800 dark:text-green-200',
          border: 'border-green-300 dark:border-green-700',
        };
      case 'REMOVED':
        return {
          bg: 'bg-red-100 dark:bg-red-900/30',
          text: 'text-red-800 dark:text-red-200',
          border: 'border-red-300 dark:border-red-700',
        };
      case 'MODIFIED':
        return {
          bg: 'bg-yellow-100 dark:bg-yellow-900/30',
          text: 'text-yellow-800 dark:text-yellow-200',
          border: 'border-yellow-300 dark:border-yellow-700',
        };
      default:
        return {
          bg: 'bg-blue-100 dark:bg-blue-900/30',
          text: 'text-blue-800 dark:text-blue-200',
          border: 'border-blue-300 dark:border-blue-700',
        };
    }
  };

  const getRiskBadge = (riskLevel?: string) => {
    switch (riskLevel) {
      case 'HIGH':
        return (
          <Badge variant="destructive" className="flex items-center gap-1 text-xs">
            <AlertTriangle className="h-3 w-3" />
            High
          </Badge>
        );
      case 'MEDIUM':
        return (
          <Badge className="flex items-center gap-1 text-xs bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            <AlertCircle className="h-3 w-3" />
            Medium
          </Badge>
        );
      case 'LOW':
        return (
          <Badge className="flex items-center gap-1 text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            <CheckCircle className="h-3 w-3" />
            Low
          </Badge>
        );
      default:
        return null;
    }
  };

  const getSignificanceBadge = (significance: string) => {
    switch (significance) {
      case 'CRITICAL':
        return <Badge variant="destructive">Critical</Badge>;
      case 'SUBSTANTIVE':
        return <Badge className="bg-orange-100 text-orange-800">Substantive</Badge>;
      case 'MINOR_WORDING':
        return <Badge variant="secondary">Minor</Badge>;
      case 'FORMATTING':
        return <Badge variant="outline">Formatting</Badge>;
      default:
        return null;
    }
  };

  return (
    <Card className="h-full">
      <CardHeader className="border-b pb-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <CardTitle className="text-lg font-medium">
            Comparing Version {fromVersionNumber} → {toVersionNumber}
          </CardTitle>

          <div className="flex items-center gap-4">
            {/* Change Navigation */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateToChange(currentChangeIndex - 1)}
                disabled={currentChangeIndex <= 0 || filteredChanges.length === 0}
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <span className="text-sm min-w-[80px] text-center">
                {filteredChanges.length > 0
                  ? `${currentChangeIndex + 1} of ${filteredChanges.length}`
                  : 'No changes'}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => navigateToChange(currentChangeIndex + 1)}
                disabled={currentChangeIndex >= filteredChanges.length - 1}
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
            </div>

            {/* Significance Filter */}
            <Select value={significanceFilter} onValueChange={setSignificanceFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Changes</SelectItem>
                <SelectItem value="CRITICAL">Critical Only</SelectItem>
                <SelectItem value="SUBSTANTIVE">Substantive</SelectItem>
                <SelectItem value="MINOR_WORDING">Minor</SelectItem>
              </SelectContent>
            </Select>

            {/* Show Formatting Toggle */}
            <Button
              variant={showFormatting ? 'default' : 'outline'}
              size="sm"
              onClick={() => setShowFormatting(!showFormatting)}
              className="gap-2"
            >
              {showFormatting ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              Formatting
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-0 h-[calc(100%-80px)]">
        <div className="grid grid-cols-2 h-full">
          {/* Left Panel - Previous Version */}
          <div className="border-r">
            <div className="bg-muted px-4 py-2 text-sm font-medium border-b">
              Version {fromVersionNumber} (Previous)
            </div>
            <ScrollArea
              className="h-[calc(100%-40px)]"
              ref={leftScrollRef}
              onScrollCapture={() => handleScroll('left')}
            >
              <div className="p-4 space-y-4 font-mono text-sm">
                {filteredChanges.map((change, index) => {
                  const colors = getChangeColor(change.changeType, change.significance);
                  const isActive = index === currentChangeIndex;

                  if (change.changeType === 'ADDED') {
                    return (
                      <div
                        key={`left-${change.id}`}
                        ref={(el) => {
                          if (el) changeRefs.current.set(`left-${change.id}`, el);
                        }}
                        className="h-4"
                      />
                    );
                  }

                  return (
                    <TooltipProvider key={`left-${change.id}`}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            ref={(el) => {
                              if (el) changeRefs.current.set(change.id, el);
                            }}
                            className={`p-3 rounded-lg border-l-4 cursor-pointer transition-all ${colors.bg} ${colors.border} ${
                              isActive ? 'ring-2 ring-primary' : ''
                            }`}
                            onClick={() => {
                              setCurrentChangeIndex(index);
                              onChangeClick?.(change);
                            }}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              {getChangeIcon(change.changeType)}
                              <span className={`text-xs font-medium ${colors.text}`}>
                                {change.sectionPath || `Change ${index + 1}`}
                              </span>
                              {getRiskBadge(change.riskLevel)}
                            </div>
                            <p className={`whitespace-pre-wrap break-words ${colors.text}`}>
                              {change.beforeText}
                            </p>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-sm">
                          <div className="space-y-2">
                            <p className="font-medium">{change.plainSummary}</p>
                            {change.riskExplanation && (
                              <p className="text-sm text-muted-foreground">
                                {change.riskExplanation}
                              </p>
                            )}
                            <div className="flex items-center gap-2">
                              {getSignificanceBadge(change.significance)}
                              {change.legalClassification && (
                                <Badge variant="outline">{change.legalClassification}</Badge>
                              )}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            </ScrollArea>
          </div>

          {/* Right Panel - Current Version */}
          <div>
            <div className="bg-muted px-4 py-2 text-sm font-medium border-b">
              Version {toVersionNumber} (Current)
            </div>
            <ScrollArea
              className="h-[calc(100%-40px)]"
              ref={rightScrollRef}
              onScrollCapture={() => handleScroll('right')}
            >
              <div className="p-4 space-y-4 font-mono text-sm">
                {filteredChanges.map((change, index) => {
                  const colors = getChangeColor(change.changeType, change.significance);
                  const isActive = index === currentChangeIndex;

                  if (change.changeType === 'REMOVED') {
                    return (
                      <div
                        key={`right-${change.id}`}
                        ref={(el) => {
                          if (el) changeRefs.current.set(`right-${change.id}`, el);
                        }}
                        className="h-4"
                      />
                    );
                  }

                  return (
                    <TooltipProvider key={`right-${change.id}`}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div
                            className={`p-3 rounded-lg border-l-4 cursor-pointer transition-all ${colors.bg} ${colors.border} ${
                              isActive ? 'ring-2 ring-primary' : ''
                            }`}
                            onClick={() => {
                              setCurrentChangeIndex(index);
                              onChangeClick?.(change);
                            }}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              {getChangeIcon(change.changeType)}
                              <span className={`text-xs font-medium ${colors.text}`}>
                                {change.sectionPath || `Change ${index + 1}`}
                              </span>
                              {getRiskBadge(change.riskLevel)}
                            </div>
                            <p className={`whitespace-pre-wrap break-words ${colors.text}`}>
                              {change.afterText}
                            </p>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="left" className="max-w-sm">
                          <div className="space-y-2">
                            <p className="font-medium">{change.plainSummary}</p>
                            {change.riskExplanation && (
                              <p className="text-sm text-muted-foreground">
                                {change.riskExplanation}
                              </p>
                            )}
                            <div className="flex items-center gap-2">
                              {getSignificanceBadge(change.significance)}
                              {change.legalClassification && (
                                <Badge variant="outline">{change.legalClassification}</Badge>
                              )}
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default SemanticDiffViewer;
