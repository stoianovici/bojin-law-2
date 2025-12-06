'use client';

/**
 * Document Detail Page with Semantic Version Control
 * Story 3.5: Semantic Version Control System - Task 14
 *
 * Document viewer with version timeline, comparison tools, and AI-powered analysis.
 */

import React, { useState, Suspense } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  FileText,
  Download,
  ExternalLink,
  MoreVertical,
  History,
  GitCompare,
  User,
  Calendar,
  Loader2,
  ArrowLeft,
  FileType,
  Building2,
  AlertTriangle,
} from 'lucide-react';
import { format } from 'date-fns';
import { VersionTimeline } from '@/components/documents/VersionTimeline';

// GraphQL Operations
const GET_DOCUMENT_DETAIL = gql`
  query GetDocumentDetail($id: UUID!) {
    document(id: $id) {
      id
      fileName
      fileType
      fileSize
      storagePath
      status
      uploadedAt
      createdAt
      updatedAt
      oneDriveId
      oneDrivePath
      metadata
      uploader {
        id
        firstName
        lastName
        email
      }
      client {
        id
        name
      }
      caseLinks {
        id
        caseId
        linkedAt
        isOriginal
        case {
          id
          caseNumber
          title
        }
      }
      versions {
        id
        versionNumber
        changesSummary
        createdAt
        creator {
          firstName
          lastName
        }
      }
    }
  }
`;

const GET_LATEST_COMPARISON = gql`
  query GetLatestComparison($documentId: UUID!) {
    documentVersionTimeline(documentId: $documentId) {
      versions {
        id
        versionNumber
      }
    }
  }
`;

// Type definitions for GraphQL queries
interface DocumentDetailData {
  document: {
    id: string;
    fileName: string;
    fileType: string;
    fileSize: number;
    storagePath: string;
    status: string;
    uploadedAt: string;
    createdAt: string;
    updatedAt: string;
    oneDriveId?: string;
    oneDrivePath?: string;
    metadata?: Record<string, unknown>;
    uploader: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
    client?: {
      id: string;
      name: string;
    };
    caseLinks: Array<{
      id: string;
      caseId: string;
      linkedAt: string;
      isOriginal: boolean;
      case: {
        id: string;
        caseNumber: string;
        title: string;
      };
    }>;
    versions: Array<{
      id: string;
      versionNumber: number;
      changesSummary?: string;
      createdAt: string;
      creator: {
        firstName: string;
        lastName: string;
      };
    }>;
  };
}

interface VersionTimelineData {
  documentVersionTimeline: {
    versions: Array<{
      id: string;
      versionNumber: number;
    }>;
  };
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function DocumentDetailContent() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.documentId as string;
  const caseId = params.caseId as string;

  const [activeTab, setActiveTab] = useState('overview');

  const { data, loading, error } = useQuery<DocumentDetailData>(GET_DOCUMENT_DETAIL, {
    variables: { id: documentId },
    skip: !documentId,
  });

  const { data: timelineData } = useQuery<VersionTimelineData>(GET_LATEST_COMPARISON, {
    variables: { documentId },
    skip: !documentId,
  });

  const document = data?.document;
  const versions = timelineData?.documentVersionTimeline?.versions || [];

  const handleCompare = (fromVersionId: string, toVersionId: string) => {
    router.push(
      `/cases/${caseId}/documents/${documentId}/compare?from=${fromVersionId}&to=${toVersionId}`
    );
  };

  const handleCompareLatest = () => {
    if (versions.length >= 2) {
      const sorted = [...versions].sort((a: any, b: any) => b.versionNumber - a.versionNumber);
      handleCompare(sorted[1].id, sorted[0].id);
    }
  };

  const handleDownload = () => {
    // Placeholder for download functionality
    console.log('Download document:', documentId);
  };

  const handleOpenInOneDrive = () => {
    if (document?.oneDrivePath) {
      // Placeholder - actual URL would come from OneDrive API
      console.log('Open in OneDrive:', document.oneDrivePath);
    }
  };

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 mx-auto text-destructive" />
          <h2 className="mt-4 text-lg font-medium">Document not found</h2>
          <p className="text-muted-foreground">
            {error?.message || 'The document you are looking for does not exist.'}
          </p>
          <Button
            variant="outline"
            className="mt-4"
            onClick={() => router.push(`/cases/${caseId}`)}
          >
            Back to Case
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => router.push(`/cases/${caseId}`)}
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h1 className="text-xl font-semibold">{document.fileName}</h1>
                  <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Building2 className="h-4 w-4" />
                      <span>{document.client?.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FileType className="h-4 w-4" />
                      <span>{document.fileType.toUpperCase()}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span>{formatFileSize(document.fileSize)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {versions.length >= 2 && (
                <Button variant="outline" onClick={handleCompareLatest} className="gap-2">
                  <GitCompare className="h-4 w-4" />
                  Compare Latest
                </Button>
              )}
              <Button onClick={handleDownload} className="gap-2">
                <Download className="h-4 w-4" />
                Download
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {document.oneDriveId && (
                    <DropdownMenuItem onClick={handleOpenInOneDrive}>
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Open in OneDrive
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem>Edit Metadata</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview" className="gap-2">
              <FileText className="h-4 w-4" />
              Overview
            </TabsTrigger>
            <TabsTrigger value="versions" className="gap-2">
              <History className="h-4 w-4" />
              Version History
              <Badge variant="secondary" className="ml-1">
                {versions.length}
              </Badge>
            </TabsTrigger>
          </TabsList>

          {/* Overview Tab */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Document Preview Card */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Document Preview</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="aspect-[3/4] bg-muted rounded-lg flex items-center justify-center">
                      <p className="text-muted-foreground">
                        Document preview not available
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Details Sidebar */}
              <div className="space-y-6">
                {/* Document Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Document Details</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Status</label>
                      <div className="mt-1">
                        <Badge
                          variant={document.status === 'FINAL' ? 'default' : 'secondary'}
                        >
                          {document.status}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Uploaded by</label>
                      <div className="mt-1 flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>
                          {document.uploader.firstName} {document.uploader.lastName}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Upload Date</label>
                      <div className="mt-1 flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{format(new Date(document.uploadedAt), 'PPP')}</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-muted-foreground">Last Modified</label>
                      <div className="mt-1 flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>{format(new Date(document.updatedAt), 'PPP')}</span>
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-muted-foreground">File Size</label>
                      <div className="mt-1">{formatFileSize(document.fileSize)}</div>
                    </div>
                  </CardContent>
                </Card>

                {/* Linked Cases */}
                {document.caseLinks.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Linked Cases</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {document.caseLinks.map((link: any) => (
                          <div
                            key={link.id}
                            className="p-3 rounded-lg border hover:bg-accent/50 cursor-pointer transition-colors"
                            onClick={() => router.push(`/cases/${link.caseId}`)}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-sm">{link.case.caseNumber}</p>
                                <p className="text-sm text-muted-foreground line-clamp-1">
                                  {link.case.title}
                                </p>
                              </div>
                              {link.isOriginal && (
                                <Badge variant="outline" className="text-xs">
                                  Original
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Quick Version Info */}
                {versions.length > 0 && (
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <CardTitle className="text-base">Latest Version</CardTitle>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setActiveTab('versions')}
                      >
                        View All
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-2xl font-bold">v{versions[0]?.versionNumber}</span>
                          <Badge variant="outline">Current</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {versions.length} total version{versions.length > 1 ? 's' : ''}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Versions Tab */}
          <TabsContent value="versions">
            <VersionTimeline documentId={documentId} onCompare={handleCompare} />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

export default function DocumentDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="h-screen flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <DocumentDetailContent />
    </Suspense>
  );
}
