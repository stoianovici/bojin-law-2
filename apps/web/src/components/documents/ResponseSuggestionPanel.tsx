'use client';

/**
 * Response Suggestion Panel Component
 * Story 3.5: Semantic Version Control System - Task 12
 *
 * Displays AI-generated response suggestions for document changes
 * with options to accept, reject, or counter-propose.
 */

import React, { useState } from 'react';
import { useMutation, useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  CheckCircle,
  XCircle,
  MessageSquare,
  HelpCircle,
  Loader2,
  Copy,
  FileInput,
  ChevronDown,
  ChevronRight,
  Sparkles,
  Globe,
} from 'lucide-react';

// GraphQL Operations
const GENERATE_RESPONSE_SUGGESTIONS = gql`
  mutation GenerateResponseSuggestions($input: GenerateResponseSuggestionsInput!) {
    generateResponseSuggestions(input: $input) {
      id
      changeId
      suggestionType
      suggestedText
      reasoning
      language
      createdAt
    }
  }
`;

const GET_RESPONSE_SUGGESTIONS = gql`
  query GetResponseSuggestions($changeId: UUID!) {
    responseSuggestions(changeId: $changeId) {
      id
      changeId
      suggestionType
      suggestedText
      reasoning
      language
      createdAt
    }
  }
`;

interface ResponseSuggestion {
  id: string;
  changeId: string;
  suggestionType: 'ACCEPT' | 'REJECT' | 'COUNTER_PROPOSAL' | 'CLARIFICATION';
  suggestedText: string;
  reasoning?: string;
  language: string;
  createdAt: string;
}

interface SemanticChange {
  id: string;
  changeType: 'ADDED' | 'REMOVED' | 'MODIFIED' | 'MOVED';
  significance: 'FORMATTING' | 'MINOR_WORDING' | 'SUBSTANTIVE' | 'CRITICAL';
  beforeText: string;
  afterText: string;
  sectionPath?: string;
  plainSummary: string;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
}

interface ResponseSuggestionsData {
  responseSuggestions: ResponseSuggestion[];
}

interface ResponseSuggestionPanelProps {
  selectedChange: SemanticChange | null;
  documentId: string;
  onInsertResponse?: (text: string) => void;
}

export function ResponseSuggestionPanel({
  selectedChange,
  documentId: _documentId,
  onInsertResponse,
}: ResponseSuggestionPanelProps) {
  // documentId is available for future use (e.g., document-level operations)
  void _documentId;
  const [partyRole, setPartyRole] = useState<'CLIENT' | 'OPPOSING'>('CLIENT');
  const [language, setLanguage] = useState<'ro' | 'en'>('ro');
  const [expandedSuggestion, setExpandedSuggestion] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const { data: existingSuggestions, loading: loadingSuggestions, refetch } = useQuery<ResponseSuggestionsData>(
    GET_RESPONSE_SUGGESTIONS,
    {
      variables: { changeId: selectedChange?.id },
      skip: !selectedChange?.id,
    }
  );

  const [generateSuggestions, { loading: generating }] = useMutation(
    GENERATE_RESPONSE_SUGGESTIONS,
    {
      onCompleted: () => {
        refetch();
      },
    }
  );

  const handleGenerateSuggestions = () => {
    if (!selectedChange) return;

    generateSuggestions({
      variables: {
        input: {
          changeId: selectedChange.id,
          partyRole,
          language,
        },
      },
    });
  };

  const handleCopy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const getSuggestionIcon = (type: string) => {
    switch (type) {
      case 'ACCEPT':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'REJECT':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'COUNTER_PROPOSAL':
        return <MessageSquare className="h-4 w-4 text-blue-500" />;
      case 'CLARIFICATION':
        return <HelpCircle className="h-4 w-4 text-yellow-500" />;
      default:
        return null;
    }
  };

  const getSuggestionBadge = (type: string) => {
    switch (type) {
      case 'ACCEPT':
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
            Accept
          </Badge>
        );
      case 'REJECT':
        return (
          <Badge variant="destructive">Reject</Badge>
        );
      case 'COUNTER_PROPOSAL':
        return (
          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            Counter-Proposal
          </Badge>
        );
      case 'CLARIFICATION':
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            Request Clarification
          </Badge>
        );
      default:
        return null;
    }
  };

  const suggestions: ResponseSuggestion[] = existingSuggestions?.responseSuggestions || [];

  if (!selectedChange) {
    return (
      <Card className="h-full flex flex-col">
        <CardHeader className="border-b pb-4">
          <CardTitle className="text-lg font-medium flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Response Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-center text-muted-foreground">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Select a change to generate response suggestions</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="border-b pb-4">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <Sparkles className="h-5 w-5" />
          Response Suggestions
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden flex flex-col">
        {/* Selected Change Preview */}
        <div className="p-4 border-b bg-muted/50">
          <p className="text-sm font-medium mb-2">Selected Change:</p>
          <p className="text-sm text-muted-foreground line-clamp-2">
            {selectedChange.plainSummary || 'Change selected'}
          </p>
          {selectedChange.sectionPath && (
            <Badge variant="outline" className="mt-2 text-xs">
              {selectedChange.sectionPath}
            </Badge>
          )}
        </div>

        {/* Controls */}
        <div className="p-4 border-b space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-1.5 block">Responding as</label>
              <Select
                value={partyRole}
                onValueChange={(v: string) => setPartyRole(v as 'CLIENT' | 'OPPOSING')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CLIENT">Client Representative</SelectItem>
                  <SelectItem value="OPPOSING">Opposing Counsel</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <label className="text-sm font-medium mb-1.5 block">Language</label>
              <Select
                value={language}
                onValueChange={(v: string) => setLanguage(v as 'ro' | 'en')}
              >
                <SelectTrigger>
                  <Globe className="h-4 w-4 mr-2" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ro">Romanian</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button
            onClick={handleGenerateSuggestions}
            disabled={generating}
            className="w-full gap-2"
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generating ? 'Generating...' : 'Generate Suggestions'}
          </Button>
        </div>

        {/* Suggestions List */}
        <ScrollArea className="flex-1">
          <div className="p-4 space-y-4">
            {loadingSuggestions ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : suggestions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No suggestions yet.</p>
                <p className="text-xs">Click "Generate Suggestions" to create AI responses.</p>
              </div>
            ) : (
              suggestions.map((suggestion) => (
                <Collapsible
                  key={suggestion.id}
                  open={expandedSuggestion === suggestion.id}
                  onOpenChange={() =>
                    setExpandedSuggestion(
                      expandedSuggestion === suggestion.id ? null : suggestion.id
                    )
                  }
                >
                  <div className="rounded-lg border bg-card">
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-4 hover:bg-accent/50 transition-colors">
                      <div className="flex items-center gap-3">
                        {getSuggestionIcon(suggestion.suggestionType)}
                        <div className="text-left">
                          {getSuggestionBadge(suggestion.suggestionType)}
                        </div>
                      </div>
                      {expandedSuggestion === suggestion.id ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="px-4 pb-4 space-y-3 border-t pt-3">
                        {/* Suggested Text */}
                        <div>
                          <label className="text-xs font-medium text-muted-foreground mb-1 block">
                            Suggested Response
                          </label>
                          <div className="relative">
                            <Textarea
                              value={suggestion.suggestedText}
                              readOnly
                              className="min-h-[100px] pr-20 resize-none"
                            />
                            <div className="absolute top-2 right-2 flex gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleCopy(suggestion.suggestedText, suggestion.id)}
                              >
                                {copiedId === suggestion.id ? (
                                  <CheckCircle className="h-4 w-4 text-green-500" />
                                ) : (
                                  <Copy className="h-4 w-4" />
                                )}
                              </Button>
                              {onInsertResponse && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => onInsertResponse(suggestion.suggestedText)}
                                  title="Insert into document"
                                >
                                  <FileInput className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Reasoning */}
                        {suggestion.reasoning && (
                          <div>
                            <label className="text-xs font-medium text-muted-foreground mb-1 block">
                              AI Reasoning
                            </label>
                            <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                              {suggestion.reasoning}
                            </p>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center gap-2 pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="flex-1 gap-2"
                            onClick={() => handleCopy(suggestion.suggestedText, suggestion.id)}
                          >
                            <Copy className="h-4 w-4" />
                            Copy to Clipboard
                          </Button>
                          {onInsertResponse && (
                            <Button
                              size="sm"
                              className="flex-1 gap-2"
                              onClick={() => onInsertResponse(suggestion.suggestedText)}
                            >
                              <FileInput className="h-4 w-4" />
                              Insert into Document
                            </Button>
                          )}
                        </div>
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}

export default ResponseSuggestionPanel;
