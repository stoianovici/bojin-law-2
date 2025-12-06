'use client';

/**
 * Review Request Dialog
 * Story 3.6: Document Review and Approval Workflow
 *
 * Dialog for submitting documents for review with priority and reviewer selection
 */

import * as React from 'react';
import { Send, Calendar, AlertTriangle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';

interface ReviewRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  documentName: string;
  versionId: string;
  onSubmit: (data: ReviewRequestData) => Promise<void>;
  reviewers?: Array<{ id: string; name: string; email: string }>;
}

export interface ReviewRequestData {
  documentId: string;
  versionId: string;
  assignedTo?: string;
  priority: 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';
  dueDate?: string;
  message?: string;
}

const priorityOptions = [
  { value: 'LOW', label: 'Low', description: 'No urgency' },
  { value: 'NORMAL', label: 'Normal', description: 'Standard timeline' },
  { value: 'HIGH', label: 'High', description: 'Needs attention soon' },
  { value: 'URGENT', label: 'Urgent', description: 'Immediate review required' },
] as const;

export function ReviewRequestDialog({
  open,
  onOpenChange,
  documentId,
  documentName,
  versionId,
  onSubmit,
  reviewers = [],
}: ReviewRequestDialogProps) {
  const [priority, setPriority] = React.useState<ReviewRequestData['priority']>('NORMAL');
  const [assignedTo, setAssignedTo] = React.useState<string>('');
  const [dueDate, setDueDate] = React.useState<string>('');
  const [message, setMessage] = React.useState<string>('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      await onSubmit({
        documentId,
        versionId,
        assignedTo: assignedTo || undefined,
        priority,
        dueDate: dueDate || undefined,
        message: message || undefined,
      });
      onOpenChange(false);
      // Reset form
      setPriority('NORMAL');
      setAssignedTo('');
      setDueDate('');
      setMessage('');
    } catch (error) {
      console.error('Failed to submit review request:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Request Review
          </DialogTitle>
          <DialogDescription>
            Submit &quot;{documentName}&quot; for review and approval.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Priority Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Priority</label>
            <Select value={priority} onValueChange={(val: string) => setPriority(val as ReviewRequestData['priority'])}>
              <SelectTrigger>
                <SelectValue placeholder="Select priority" />
              </SelectTrigger>
              <SelectContent>
                {priorityOptions.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      {option.value === 'URGENT' && (
                        <AlertTriangle className="h-4 w-4 text-destructive" />
                      )}
                      <span>{option.label}</span>
                      <span className="text-xs text-muted-foreground">
                        - {option.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Reviewer Selection (Optional) */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Assign to (Optional)
            </label>
            <Select value={assignedTo} onValueChange={setAssignedTo}>
              <SelectTrigger>
                <SelectValue placeholder="All Partners will be notified" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Partners</SelectItem>
                {reviewers.map((reviewer) => (
                  <SelectItem key={reviewer.id} value={reviewer.id}>
                    {reviewer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Leave empty to notify all Partners in your firm
            </p>
          </div>

          {/* Due Date (Optional) */}
          <div className="space-y-2">
            <label className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Due Date (Optional)
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            />
          </div>

          {/* Message (Optional) */}
          <div className="space-y-2">
            <label className="text-sm font-medium">
              Message (Optional)
            </label>
            <Textarea
              value={message}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setMessage(e.target.value)}
              placeholder="Add any notes for the reviewer..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>Submitting...</>
            ) : (
              <>
                <Send className="mr-2 h-4 w-4" />
                Submit for Review
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
