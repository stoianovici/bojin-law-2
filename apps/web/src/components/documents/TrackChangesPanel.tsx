'use client';

/**
 * Track Changes Panel Component
 * Story 3.4: Word Integration with Live AI Assistance - Task 18
 *
 * Displays track changes extracted from Word documents.
 */

import React, { useState } from 'react';
import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Plus,
  Minus,
  Edit3,
  Type,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Loader2,
  User,
  Calendar,
  FileText,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

// GraphQL Operations
const GET_TRACK_CHANGES = gql`
  query GetDocumentTrackChanges($documentId: UUID!) {
    documentTrackChanges(documentId: $documentId) {
      id
      type
      authorName
      content
      originalContent
      timestamp
      paragraphIndex
    }
  }
`;

const GET_TRACK_CHANGES_SUMMARY = gql`
  query GetDocumentTrackChangesSummary($documentId: UUID!) {
    documentTrackChangesSummary(documentId: $documentId) {
      totalChanges
      insertions
      deletions
      modifications
      formatChanges
      authors
      summary
    }
  }
`;

interface TrackChange {
  id: string;
  type: 'INSERTION' | 'DELETION' | 'MODIFICATION' | 'FORMAT_CHANGE';
  authorName: string;
  content: string;
  originalContent?: string;
  timestamp: string;
  paragraphIndex?: number;
}

interface TrackChangesSummary {
  totalChanges: number;
  insertions: number;
  deletions: number;
  modifications: number;
  formatChanges: number;
  authors: string[];
  summary: string;
}

interface TrackChangesPanelProps {
  documentId: string;
  className?: string;
}

interface TrackChangesData {
  documentTrackChanges: TrackChange[];
}

interface TrackChangesSummaryData {
  documentTrackChangesSummary: TrackChangesSummary;
}

export function TrackChangesPanel({ documentId, className }: TrackChangesPanelProps) {
  const [expandedChanges, setExpandedChanges] = useState<Set<string>>(new Set());
  const [filterType, setFilterType] = useState<string>('all');

  // Query track changes
  const { data, loading, error, refetch } = useQuery<TrackChangesData>(GET_TRACK_CHANGES, {
    variables: { documentId },
  });

  // Query summary
  const { data: summaryData } = useQuery<TrackChangesSummaryData>(GET_TRACK_CHANGES_SUMMARY, {
    variables: { documentId },
  });

  const trackChanges: TrackChange[] = data?.documentTrackChanges || [];
  const summary: TrackChangesSummary | undefined = summaryData?.documentTrackChangesSummary;

  const filteredChanges =
    filterType === 'all' ? trackChanges : trackChanges.filter((c) => c.type === filterType);

  const toggleExpanded = (id: string) => {
    const newExpanded = new Set(expandedChanges);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedChanges(newExpanded);
  };

  const getChangeIcon = (type: TrackChange['type']) => {
    switch (type) {
      case 'INSERTION':
        return <Plus className="h-4 w-4 text-green-600" />;
      case 'DELETION':
        return <Minus className="h-4 w-4 text-red-600" />;
      case 'MODIFICATION':
        return <Edit3 className="h-4 w-4 text-amber-600" />;
      case 'FORMAT_CHANGE':
        return <Type className="h-4 w-4 text-blue-600" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  const getChangeBadgeVariant = (type: TrackChange['type']) => {
    switch (type) {
      case 'INSERTION':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'DELETION':
        return 'bg-red-100 text-red-700 border-red-200';
      case 'MODIFICATION':
        return 'bg-amber-100 text-amber-700 border-amber-200';
      case 'FORMAT_CHANGE':
        return 'bg-blue-100 text-blue-700 border-blue-200';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center py-8 text-center">
          <p className="text-sm text-muted-foreground">Failed to load track changes</p>
          <Button variant="outline" size="sm" className="mt-2" onClick={() => refetch()}>
            <RefreshCw className="h-3 w-3 mr-1" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Edit3 className="h-4 w-4" />
            Track Changes
          </CardTitle>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* Summary */}
        {summary && summary.totalChanges > 0 && (
          <div className="mt-2 p-3 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">{summary.summary}</p>
            <div className="flex flex-wrap gap-2 mt-2">
              {summary.insertions > 0 && (
                <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200">
                  <Plus className="h-3 w-3 mr-1" />
                  {summary.insertions}
                </Badge>
              )}
              {summary.deletions > 0 && (
                <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200">
                  <Minus className="h-3 w-3 mr-1" />
                  {summary.deletions}
                </Badge>
              )}
              {summary.modifications > 0 && (
                <Badge variant="outline" className="bg-amber-100 text-amber-700 border-amber-200">
                  <Edit3 className="h-3 w-3 mr-1" />
                  {summary.modifications}
                </Badge>
              )}
              {summary.formatChanges > 0 && (
                <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">
                  <Type className="h-3 w-3 mr-1" />
                  {summary.formatChanges}
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent>
        {trackChanges.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Edit3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No track changes found</p>
            <p className="text-xs mt-1">
              Changes will appear here when the document is edited in Word with Track Changes
              enabled
            </p>
          </div>
        ) : (
          <>
            {/* Filter Tabs */}
            <Tabs value={filterType} onValueChange={setFilterType} className="mb-4">
              <TabsList className="grid w-full grid-cols-5">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="INSERTION">
                  <Plus className="h-3 w-3" />
                </TabsTrigger>
                <TabsTrigger value="DELETION">
                  <Minus className="h-3 w-3" />
                </TabsTrigger>
                <TabsTrigger value="MODIFICATION">
                  <Edit3 className="h-3 w-3" />
                </TabsTrigger>
                <TabsTrigger value="FORMAT_CHANGE">
                  <Type className="h-3 w-3" />
                </TabsTrigger>
              </TabsList>
            </Tabs>

            {/* Changes List */}
            <ScrollArea className="h-[400px]">
              <div className="space-y-2">
                {filteredChanges.map((change) => {
                  const isExpanded = expandedChanges.has(change.id);

                  return (
                    <div key={change.id} className="border rounded-lg overflow-hidden">
                      <div
                        className="flex items-start gap-3 p-3 cursor-pointer hover:bg-muted/50"
                        onClick={() => toggleExpanded(change.id)}
                      >
                        <div className="flex-shrink-0 mt-0.5">{getChangeIcon(change.type)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className={getChangeBadgeVariant(change.type)}>
                              {change.type.replace('_', ' ')}
                            </Badge>
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {change.authorName}
                            </span>
                          </div>
                          <p className={`text-sm truncate ${!isExpanded ? 'line-clamp-1' : ''}`}>
                            {change.type === 'DELETION' ? (
                              <span className="line-through text-red-600">{change.content}</span>
                            ) : change.type === 'INSERTION' ? (
                              <span className="text-green-600">{change.content}</span>
                            ) : (
                              change.content
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDistanceToNow(new Date(change.timestamp), { addSuffix: true })}
                          </p>
                        </div>
                        <div className="flex-shrink-0">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="px-3 pb-3 border-t bg-muted/30">
                          <div className="pt-3 space-y-2">
                            {change.originalContent && (
                              <div>
                                <span className="text-xs font-medium text-muted-foreground">
                                  Original:
                                </span>
                                <p className="text-sm text-red-600 line-through mt-1 p-2 bg-red-50 rounded">
                                  {change.originalContent}
                                </p>
                              </div>
                            )}
                            <div>
                              <span className="text-xs font-medium text-muted-foreground">
                                {change.type === 'DELETION'
                                  ? 'Deleted:'
                                  : change.type === 'INSERTION'
                                    ? 'Inserted:'
                                    : 'New:'}
                              </span>
                              <p
                                className={`text-sm mt-1 p-2 rounded ${
                                  change.type === 'DELETION'
                                    ? 'bg-red-50 text-red-600 line-through'
                                    : change.type === 'INSERTION'
                                      ? 'bg-green-50 text-green-600'
                                      : 'bg-amber-50'
                                }`}
                              >
                                {change.content}
                              </p>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              <span>
                                Changed by {change.authorName} on{' '}
                                {format(new Date(change.timestamp), 'PPp')}
                              </span>
                              {change.paragraphIndex !== undefined && (
                                <span> · Paragraph {change.paragraphIndex + 1}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default TrackChangesPanel;
