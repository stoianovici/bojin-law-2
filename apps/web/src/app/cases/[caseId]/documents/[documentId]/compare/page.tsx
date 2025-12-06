'use client';

/**
 * Version Comparison Page
 * Story 3.5: Semantic Version Control System - Task 13
 *
 * Full-page comparison view with semantic diff, summary panel, and response suggestions.
 */

import React, { useState, Suspense } from 'react';
import { useParams, useSearchParams, useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  ArrowLeft,
  FileText,
  Loader2,
  PanelRightClose,
  PanelRightOpen,
  Printer,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { SemanticDiffViewer } from '@/components/documents/SemanticDiffViewer';
import { ChangeSummaryPanel } from '@/components/documents/ChangeSummaryPanel';
import { ResponseSuggestionPanel } from '@/components/documents/ResponseSuggestionPanel';

// GraphQL Operations
const COMPARE_VERSIONS = gql`
  query CompareVersions($input: CompareVersionsInput!) {
    compareVersions(input: $input) {
      fromVersion {
        id
        documentId
        versionNumber
        oneDriveVersionId
        changesSummary
        createdAt
        createdBy {
          id
          firstName
          lastName
          email
        }
      }
      toVersion {
        id
        documentId
        versionNumber
        oneDriveVersionId
        changesSummary
        createdAt
        createdBy {
          id
          firstName
          lastName
          email
        }
      }
      changes {
        id
        changeType
        significance
        beforeText
        afterText
        sectionPath
        plainSummary
        legalClassification
        riskLevel
        riskExplanation
      }
      executiveSummary
      aggregateRisk
      totalChanges
      changeBreakdown {
        formatting
        minorWording
        substantive
        critical
      }
      comparedAt
    }
  }
`;

const GET_VERSION_TIMELINE = gql`
  query GetVersionTimelineForCompare($documentId: UUID!) {
    documentVersionTimeline(documentId: $documentId) {
      versions {
        id
        versionNumber
        changesSummary
        createdAt
        createdBy {
          firstName
          lastName
        }
      }
    }
  }
`;

const GET_DOCUMENT = gql`
  query GetDocumentForCompare($id: UUID!) {
    document(id: $id) {
      id
      fileName
      fileType
      client {
        name
      }
    }
  }
`;

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

interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  oneDriveVersionId?: string;
  changesSummary?: string;
  createdAt: string;
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface ChangeBreakdown {
  formatting: number;
  minorWording: number;
  substantive: number;
  critical: number;
}

interface VersionComparison {
  fromVersion: DocumentVersion;
  toVersion: DocumentVersion;
  changes: SemanticChange[];
  executiveSummary: string;
  aggregateRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  totalChanges: number;
  changeBreakdown: ChangeBreakdown;
  comparedAt: string;
}

interface VersionTimelineData {
  documentVersionTimeline: {
    versions: Array<{
      id: string;
      versionNumber: number;
      changesSummary?: string;
      createdAt: string;
      createdBy: {
        firstName: string;
        lastName: string;
      };
    }>;
  };
}

interface CompareVersionsData {
  compareVersions: VersionComparison;
}

interface DocumentData {
  document: {
    id: string;
    fileName: string;
    fileType: string;
    client?: {
      name: string;
    };
  };
}

function VersionCompareContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();

  const documentId = params.documentId as string;
  const caseId = params.caseId as string;
  const fromVersionId = searchParams.get('from');
  const toVersionId = searchParams.get('to');

  const [selectedChange, setSelectedChange] = useState<SemanticChange | null>(null);
  const [showSummaryPanel, setShowSummaryPanel] = useState(true);
  const [showResponsePanel, setShowResponsePanel] = useState(false);
  const [selectedFromVersion, setSelectedFromVersion] = useState(fromVersionId || '');
  const [selectedToVersion, setSelectedToVersion] = useState(toVersionId || '');

  // Fetch document info
  const { data: documentData } = useQuery<DocumentData>(GET_DOCUMENT, {
    variables: { id: documentId },
    skip: !documentId,
  });

  // Fetch version timeline for selector
  const { data: timelineData } = useQuery<VersionTimelineData>(GET_VERSION_TIMELINE, {
    variables: { documentId },
    skip: !documentId,
  });

  // Fetch comparison if we have both versions
  const { data: comparisonData, loading: comparisonLoading, error: comparisonError } = useQuery<CompareVersionsData>(
    COMPARE_VERSIONS,
    {
      variables: {
        input: {
          documentId,
          fromVersionId: selectedFromVersion,
          toVersionId: selectedToVersion,
        },
      },
      skip: !selectedFromVersion || !selectedToVersion || !documentId,
    }
  );

  const versions = timelineData?.documentVersionTimeline?.versions || [];
  const comparison = comparisonData?.compareVersions;
  const document = documentData?.document;

  // Update URL when versions change
  const handleVersionChange = (type: 'from' | 'to', versionId: string) => {
    if (type === 'from') {
      setSelectedFromVersion(versionId);
    } else {
      setSelectedToVersion(versionId);
    }

    const newFrom = type === 'from' ? versionId : selectedFromVersion;
    const newTo = type === 'to' ? versionId : selectedToVersion;

    if (newFrom && newTo) {
      router.push(
        `/cases/${caseId}/documents/${documentId}/compare?from=${newFrom}&to=${newTo}`
      );
    }
  };

  const handleChangeClick = (change: SemanticChange) => {
    setSelectedChange(change);
    setShowResponsePanel(true);
  };

  const handlePrint = () => {
    window.print();
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
          <Badge className="flex items-center gap-1 bg-yellow-100 text-yellow-800">
            <AlertCircle className="h-3 w-3" />
            Medium Risk
          </Badge>
        );
      case 'LOW':
        return (
          <Badge className="flex items-center gap-1 bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3" />
            Low Risk
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b bg-card px-4 py-3 flex items-center justify-between print:hidden">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/cases/${caseId}/documents/${documentId}`)}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <div>
              <h1 className="font-semibold">{document?.fileName || 'Document'}</h1>
              <p className="text-sm text-muted-foreground">Version Comparison</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Version Selectors */}
          <div className="flex items-center gap-2">
            <Select value={selectedFromVersion} onValueChange={(v: string) => handleVersionChange('from', v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="From version" />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v: VersionTimelineData['documentVersionTimeline']['versions'][number]) => (
                  <SelectItem
                    key={v.id}
                    value={v.id}
                    disabled={v.id === selectedToVersion}
                  >
                    Version {v.versionNumber} - {v.createdBy?.firstName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <span className="text-muted-foreground">→</span>

            <Select value={selectedToVersion} onValueChange={(v: string) => handleVersionChange('to', v)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="To version" />
              </SelectTrigger>
              <SelectContent>
                {versions.map((v: VersionTimelineData['documentVersionTimeline']['versions'][number]) => (
                  <SelectItem
                    key={v.id}
                    value={v.id}
                    disabled={v.id === selectedFromVersion}
                  >
                    Version {v.versionNumber} - {v.createdBy?.firstName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {comparison && getRiskBadge(comparison.aggregateRisk)}

          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowSummaryPanel(!showSummaryPanel)}
              title={showSummaryPanel ? 'Hide summary panel' : 'Show summary panel'}
            >
              {showSummaryPanel ? (
                <PanelRightClose className="h-5 w-5" />
              ) : (
                <PanelRightOpen className="h-5 w-5" />
              )}
            </Button>
            <Button variant="ghost" size="icon" onClick={handlePrint} title="Print">
              <Printer className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Loading State */}
        {comparisonLoading && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin mx-auto text-muted-foreground" />
              <p className="mt-2 text-muted-foreground">Analyzing changes...</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {comparisonError && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-destructive">
              <AlertTriangle className="h-8 w-8 mx-auto" />
              <p className="mt-2">Failed to load comparison</p>
              <p className="text-sm text-muted-foreground">{comparisonError.message}</p>
            </div>
          </div>
        )}

        {/* No Versions Selected */}
        {!comparisonLoading && !comparisonError && (!selectedFromVersion || !selectedToVersion) && (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto opacity-50" />
              <p className="mt-4">Select two versions to compare</p>
              <p className="text-sm">Use the dropdowns above to choose versions</p>
            </div>
          </div>
        )}

        {/* Comparison Content */}
        {comparison && !comparisonLoading && (
          <>
            {/* Diff Viewer */}
            <div className={`flex-1 overflow-hidden ${showSummaryPanel ? '' : 'w-full'}`}>
              <SemanticDiffViewer
                changes={comparison.changes}
                fromVersionNumber={comparison.fromVersion.versionNumber}
                toVersionNumber={comparison.toVersion.versionNumber}
                onChangeClick={handleChangeClick}
              />
            </div>

            {/* Summary Panel (Collapsible) */}
            {showSummaryPanel && (
              <div className="w-[400px] border-l overflow-hidden">
                <ChangeSummaryPanel
                  executiveSummary={comparison.executiveSummary}
                  aggregateRisk={comparison.aggregateRisk}
                  changes={comparison.changes}
                  changeBreakdown={comparison.changeBreakdown}
                  onViewChange={handleChangeClick}
                />
              </div>
            )}
          </>
        )}
      </div>

      {/* Response Suggestion Drawer */}
      {showResponsePanel && selectedChange && (
        <div className="h-[300px] border-t print:hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
            <span className="font-medium text-sm">Response Suggestions</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setShowResponsePanel(false);
                setSelectedChange(null);
              }}
            >
              Close
            </Button>
          </div>
          <div className="h-[calc(100%-44px)] overflow-hidden">
            <ResponseSuggestionPanel
              selectedChange={selectedChange}
              documentId={documentId}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default function VersionComparePage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <VersionCompareContent />
    </Suspense>
  );
}
