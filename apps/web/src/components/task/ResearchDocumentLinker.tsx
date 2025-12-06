'use client';

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { FileText, Link as LinkIcon, X, Search } from 'lucide-react';

export type TaskDocumentLinkType = 'Source' | 'Output' | 'Reference';

export interface TaskDocumentLink {
  id: string;
  taskId: string;
  documentId: string;
  document: {
    id: string;
    title: string;
    fileType: string;
    caseId: string;
  };
  linkType: TaskDocumentLinkType;
  notes?: string;
  linkedBy: {
    id: string;
    firstName: string;
    lastName: string;
  };
  linkedAt: Date;
}

export interface ResearchDocumentLinkerProps {
  taskId: string;
  linkedDocuments: TaskDocumentLink[];
  availableDocuments?: Array<{
    id: string;
    title: string;
    fileType: string;
    caseId: string;
  }>;
  onLinkDocument: (documentId: string, linkType: TaskDocumentLinkType, notes?: string) => Promise<void>;
  onUnlinkDocument: (documentId: string) => Promise<void>;
}

export function ResearchDocumentLinker({
  taskId,
  linkedDocuments,
  availableDocuments = [],
  onLinkDocument,
  onUnlinkDocument,
}: ResearchDocumentLinkerProps) {
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [selectedDocumentId, setSelectedDocumentId] = React.useState<string>('');
  const [linkType, setLinkType] = React.useState<TaskDocumentLinkType>('Source');
  const [notes, setNotes] = React.useState('');
  const [isLinking, setIsLinking] = React.useState(false);

  const filteredDocuments = React.useMemo(() => {
    if (!searchQuery) return availableDocuments;

    const query = searchQuery.toLowerCase();
    return availableDocuments.filter((doc) =>
      doc.title.toLowerCase().includes(query) ||
      doc.fileType.toLowerCase().includes(query)
    );
  }, [availableDocuments, searchQuery]);

  const linkedDocumentIds = new Set(linkedDocuments.map((link) => link.documentId));
  const availableUnlinkedDocuments = filteredDocuments.filter(
    (doc) => !linkedDocumentIds.has(doc.id)
  );

  const handleLinkDocument = async () => {
    if (!selectedDocumentId) return;

    setIsLinking(true);
    try {
      await onLinkDocument(selectedDocumentId, linkType, notes);
      setIsModalOpen(false);
      setSelectedDocumentId('');
      setLinkType('Source');
      setNotes('');
      setSearchQuery('');
    } catch (error) {
      console.error('Failed to link document:', error);
    } finally {
      setIsLinking(false);
    }
  };

  const getLinkTypeBadge = (type: TaskDocumentLinkType) => {
    const variants = {
      Source: 'bg-blue-50 text-blue-700 border-blue-200',
      Output: 'bg-green-50 text-green-700 border-green-200',
      Reference: 'bg-purple-50 text-purple-700 border-purple-200',
    };

    return (
      <Badge variant="outline" className={variants[type]}>
        {type}
      </Badge>
    );
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">
          Linked Documents ({linkedDocuments.length})
        </h3>
        <Button type="button" size="sm" onClick={() => setIsModalOpen(true)}>
          <LinkIcon className="w-4 h-4 mr-2" />
          Link Document
        </Button>
      </div>

      {linkedDocuments.length === 0 ? (
        <div className="text-center py-8 border rounded-lg bg-gray-50">
          <FileText className="w-8 h-8 mx-auto text-gray-400 mb-2" />
          <p className="text-sm text-gray-500">No documents linked yet</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="mt-3"
          >
            Link Your First Document
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {linkedDocuments.map((link) => (
            <div
              key={link.id}
              className="flex items-start justify-between p-3 border rounded-lg hover:bg-gray-50"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <p className="font-medium text-sm truncate">{link.document.title}</p>
                  {getLinkTypeBadge(link.linkType)}
                </div>
                {link.notes && (
                  <p className="text-xs text-gray-600 ml-6 mb-1">{link.notes}</p>
                )}
                <p className="text-xs text-gray-500 ml-6">
                  Linked by {link.linkedBy.firstName} {link.linkedBy.lastName} on{' '}
                  {formatDate(link.linkedAt)}
                </p>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onUnlinkDocument(link.documentId)}
                className="h-8 w-8 p-0 flex-shrink-0 ml-2"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      {/* Link Document Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Link Document to Task</DialogTitle>
            <DialogDescription>
              Select a document to link to this research task
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="block text-sm font-medium mb-1">Search Documents</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <Input
                  value={searchQuery}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
                  placeholder="Search by title or file type..."
                  className="pl-9"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Select Document <span className="text-red-500">*</span>
              </label>
              <Select value={selectedDocumentId} onValueChange={setSelectedDocumentId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a document" />
                </SelectTrigger>
                <SelectContent>
                  {availableUnlinkedDocuments.length === 0 ? (
                    <div className="p-2 text-sm text-gray-500 text-center">
                      {searchQuery ? 'No matching documents found' : 'No documents available to link'}
                    </div>
                  ) : (
                    availableUnlinkedDocuments.map((doc) => (
                      <SelectItem key={doc.id} value={doc.id}>
                        <div className="flex items-center gap-2">
                          <FileText className="w-4 h-4" />
                          <span>
                            {doc.title} ({doc.fileType})
                          </span>
                        </div>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Link Type <span className="text-red-500">*</span>
              </label>
              <Select
                value={linkType}
                onValueChange={(val: string) => setLinkType(val as TaskDocumentLinkType)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Source">
                    <div>
                      <p className="font-medium">Source</p>
                      <p className="text-xs text-gray-500">Research source document</p>
                    </div>
                  </SelectItem>
                  <SelectItem value="Output">
                    <div>
                      <p className="font-medium">Output</p>
                      <p className="text-xs text-gray-500">Document created from research</p>
                    </div>
                  </SelectItem>
                  <SelectItem value="Reference">
                    <div>
                      <p className="font-medium">Reference</p>
                      <p className="text-xs text-gray-500">General reference material</p>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label htmlFor="linkNotes" className="block text-sm font-medium mb-1">
                Notes (Optional)
              </label>
              <Textarea
                id="linkNotes"
                value={notes}
                onChange={(e: React.MouseEvent) => setNotes(e.target.value)}
                placeholder="Add notes about this link..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsModalOpen(false)}
              disabled={isLinking}
            >
              Cancel
            </Button>
            <Button onClick={handleLinkDocument} disabled={!selectedDocumentId || isLinking}>
              {isLinking ? 'Linking...' : 'Link Document'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
