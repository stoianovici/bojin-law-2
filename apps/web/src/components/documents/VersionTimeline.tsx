'use client';

/**
 * Version Timeline Component
 * Story 3.5: Semantic Version Control System - Task 9
 *
 * Displays chronological list of document versions with comparison features.
 */

import React, { useState } from 'react';
import { useQuery, useMutation } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  GitCompare,
  RotateCcw,
  MoreVertical,
  AlertTriangle,
  CheckCircle,
  AlertCircle,
  Loader2,
  Calendar,
  FileText,
} from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';

// GraphQL Operations
const GET_VERSION_TIMELINE = gql`
  query GetVersionTimeline($documentId: UUID!) {
    documentVersionTimeline(documentId: $documentId) {
      documentId
      totalVersions
      versions {
        id
        documentId
        versionNumber
        oneDriveVersionId
        changesSummary
        createdAt
        riskLevel
        createdBy {
          id
          firstName
          lastName
          email
        }
      }
    }
  }
`;

const ROLLBACK_TO_VERSION = gql`
  mutation RollbackToVersion($input: RollbackVersionInput!) {
    rollbackToVersion(input: $input) {
      success
      newVersionId
      newVersionNumber
      message
    }
  }
`;

interface DocumentVersion {
  id: string;
  documentId: string;
  versionNumber: number;
  oneDriveVersionId?: string;
  changesSummary?: string;
  createdAt: string;
  riskLevel?: 'LOW' | 'MEDIUM' | 'HIGH';
  createdBy: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
}

interface VersionTimeline {
  documentId: string;
  totalVersions: number;
  versions: DocumentVersion[];
}

interface VersionTimelineProps {
  documentId: string;
  onCompare?: (fromVersionId: string, toVersionId: string) => void;
}

export function VersionTimeline({ documentId, onCompare }: VersionTimelineProps) {
  const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
  const [rollbackTarget, setRollbackTarget] = useState<DocumentVersion | null>(null);

  const { data, loading, error, refetch } = useQuery<{ documentVersionTimeline: VersionTimeline }>(
    GET_VERSION_TIMELINE,
    { variables: { documentId } }
  );

  const [rollbackMutation, { loading: rollbackLoading }] = useMutation(ROLLBACK_TO_VERSION, {
    onCompleted: () => {
      setRollbackTarget(null);
      refetch();
    },
  });

  const handleVersionSelect = (versionId: string) => {
    setSelectedVersions((prev) => {
      if (prev.includes(versionId)) {
        return prev.filter((id) => id !== versionId);
      }
      if (prev.length >= 2) {
        return [prev[1], versionId];
      }
      return [...prev, versionId];
    });
  };

  const handleCompare = () => {
    if (selectedVersions.length === 2 && onCompare) {
      // Sort by version number to ensure from < to
      const versions = data?.documentVersionTimeline.versions || [];
      const v1 = versions.find((v) => v.id === selectedVersions[0]);
      const v2 = versions.find((v) => v.id === selectedVersions[1]);

      if (v1 && v2) {
        if (v1.versionNumber < v2.versionNumber) {
          onCompare(v1.id, v2.id);
        } else {
          onCompare(v2.id, v1.id);
        }
      }
    }
  };

  const handleRollback = () => {
    if (rollbackTarget) {
      rollbackMutation({
        variables: {
          input: {
            documentId,
            targetVersionId: rollbackTarget.id,
          },
        },
      });
    }
  };

  const getRiskBadge = (riskLevel?: string) => {
    switch (riskLevel) {
      case 'HIGH':
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            High Risk
          </Badge>
        );
      case 'MEDIUM':
        return (
          <Badge variant="secondary" className="flex items-center gap-1 bg-yellow-100 text-yellow-800">
            <AlertCircle className="h-3 w-3" />
            Medium Risk
          </Badge>
        );
      case 'LOW':
        return (
          <Badge variant="secondary" className="flex items-center gap-1 bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3" />
            Low Risk
          </Badge>
        );
      default:
        return null;
    }
  };

  const getInitials = (firstName: string, lastName: string) => {
    return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8 text-destructive">
          Failed to load version history
        </CardContent>
      </Card>
    );
  }

  const timeline = data?.documentVersionTimeline;
  const versions = timeline?.versions || [];

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="text-lg font-medium flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Version History
          <Badge variant="outline">{timeline?.totalVersions || 0}</Badge>
        </CardTitle>
        <Button
          onClick={handleCompare}
          disabled={selectedVersions.length !== 2}
          size="sm"
          className="gap-2"
        >
          <GitCompare className="h-4 w-4" />
          Compare Selected
        </Button>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px]">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-border" />

            {versions.map((version, index) => (
              <div key={version.id} className="relative pl-12 pb-6">
                {/* Timeline dot */}
                <div
                  className={`absolute left-4 w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer transition-colors ${
                    selectedVersions.includes(version.id)
                      ? 'bg-primary border-primary text-primary-foreground'
                      : 'bg-background border-border hover:border-primary'
                  }`}
                  onClick={() => handleVersionSelect(version.id)}
                >
                  {selectedVersions.includes(version.id) && (
                    <span className="text-xs font-bold">
                      {selectedVersions.indexOf(version.id) + 1}
                    </span>
                  )}
                </div>

                {/* Version card */}
                <div
                  className={`rounded-lg border p-4 transition-colors ${
                    selectedVersions.includes(version.id)
                      ? 'border-primary bg-primary/5'
                      : 'hover:border-muted-foreground/20'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium">Version {version.versionNumber}</span>
                        {index === 0 && (
                          <Badge variant="default" className="text-xs">
                            Current
                          </Badge>
                        )}
                        {version.riskLevel && getRiskBadge(version.riskLevel)}
                      </div>

                      {version.changesSummary && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {version.changesSummary}
                        </p>
                      )}

                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Avatar className="h-5 w-5">
                            <AvatarFallback className="text-[10px]">
                              {getInitials(version.createdBy.firstName, version.createdBy.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <span>
                            {version.createdBy.firstName} {version.createdBy.lastName}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span title={format(new Date(version.createdAt), 'PPpp')}>
                            {formatDistanceToNow(new Date(version.createdAt), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {index > 0 && (
                          <DropdownMenuItem
                            onClick={() => onCompare?.(version.id, versions[index - 1].id)}
                          >
                            <GitCompare className="h-4 w-4 mr-2" />
                            Compare with previous
                          </DropdownMenuItem>
                        )}
                        {index !== 0 && (
                          <DropdownMenuItem
                            onClick={() => setRollbackTarget(version)}
                            className="text-destructive focus:text-destructive"
                          >
                            <RotateCcw className="h-4 w-4 mr-2" />
                            Rollback to this version
                          </DropdownMenuItem>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>

        {selectedVersions.length === 1 && (
          <p className="text-sm text-muted-foreground text-center mt-4">
            Select one more version to compare
          </p>
        )}
      </CardContent>

      {/* Rollback Confirmation Dialog */}
      <Dialog open={!!rollbackTarget} onOpenChange={() => setRollbackTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Confirm Rollback
            </DialogTitle>
            <DialogDescription>
              This will create a new version with the content from Version{' '}
              {rollbackTarget?.versionNumber}. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-lg border p-4 bg-muted/50">
              <p className="font-medium">Rolling back to:</p>
              <p className="text-sm text-muted-foreground mt-1">
                Version {rollbackTarget?.versionNumber} by {rollbackTarget?.createdBy.firstName}{' '}
                {rollbackTarget?.createdBy.lastName}
              </p>
              {rollbackTarget?.changesSummary && (
                <p className="text-sm mt-2">{rollbackTarget.changesSummary}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRollbackTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleRollback}
              disabled={rollbackLoading}
              className="gap-2"
            >
              {rollbackLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirm Rollback
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

export default VersionTimeline;
