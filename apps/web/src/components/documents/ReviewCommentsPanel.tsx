'use client';

/**
 * Review Comments Panel
 * Story 3.6: Document Review and Approval Workflow
 *
 * Panel for displaying and adding inline comments during review
 */

import * as React from 'react';
import {
  MessageSquare,
  Send,
  Check,
  Reply,
  AtSign,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

interface ReviewComment {
  id: string;
  author: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  content: string;
  anchorText?: string;
  anchorStart?: number;
  anchorEnd?: number;
  sectionPath?: string;
  resolved: boolean;
  resolvedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
  resolvedAt?: string;
  suggestionText?: string;
  isAISuggestion: boolean;
  replies: Array<{
    id: string;
    author: {
      id: string;
      firstName: string;
      lastName: string;
    };
    content: string;
    createdAt: string;
  }>;
  createdAt: string;
}

interface ReviewCommentsPanelProps {
  comments: ReviewComment[];
  currentUserId: string;
  onAddComment: (data: {
    content: string;
    anchorText?: string;
    anchorStart?: number;
    anchorEnd?: number;
    suggestionText?: string;
  }) => Promise<void>;
  onReply: (commentId: string, content: string) => Promise<void>;
  onResolve: (commentId: string) => Promise<void>;
  selectedText?: {
    text: string;
    start: number;
    end: number;
  };
  onNavigateToComment?: (anchorStart: number, anchorEnd: number) => void;
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function getInitials(firstName: string, lastName: string): string {
  return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
}

export function ReviewCommentsPanel({
  comments,
  currentUserId,
  onAddComment,
  onReply,
  onResolve,
  selectedText,
  onNavigateToComment,
}: ReviewCommentsPanelProps) {
  const [newComment, setNewComment] = React.useState('');
  const [newSuggestion, setNewSuggestion] = React.useState('');
  const [replyingTo, setReplyingTo] = React.useState<string | null>(null);
  const [replyContent, setReplyContent] = React.useState('');
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [expandedComments, setExpandedComments] = React.useState<Set<string>>(
    new Set(comments.filter((c) => !c.resolved).map((c) => c.id))
  );

  const activeComments = comments.filter((c) => !c.resolved);
  const resolvedComments = comments.filter((c) => c.resolved);

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    try {
      await onAddComment({
        content: newComment,
        anchorText: selectedText?.text,
        anchorStart: selectedText?.start,
        anchorEnd: selectedText?.end,
        suggestionText: newSuggestion || undefined,
      });
      setNewComment('');
      setNewSuggestion('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitReply = async (commentId: string) => {
    if (!replyContent.trim()) return;

    setIsSubmitting(true);
    try {
      await onReply(commentId, replyContent);
      setReplyingTo(null);
      setReplyContent('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedComments((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <MessageSquare className="h-4 w-4" />
          Comments ({comments.length})
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* New Comment Form */}
        <div className="space-y-2 p-3 rounded-lg border bg-muted/30">
          {selectedText && (
            <div className="text-xs p-2 bg-background rounded border-l-2 border-primary">
              <span className="font-medium">Selected text:</span>{' '}
              <span className="italic text-muted-foreground">
                &quot;{selectedText.text.substring(0, 100)}
                {selectedText.text.length > 100 ? '...' : ''}&quot;
              </span>
            </div>
          )}

          <Textarea
            value={newComment}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewComment(e.target.value)}
            placeholder={
              selectedText
                ? 'Add a comment on the selected text...'
                : 'Add a general comment...'
            }
            rows={2}
          />

          <Textarea
            value={newSuggestion}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewSuggestion(e.target.value)}
            placeholder="Suggest replacement text (optional)..."
            rows={2}
            className="text-sm"
          />

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Use @username to mention colleagues
            </p>
            <Button
              size="sm"
              onClick={handleSubmitComment}
              disabled={!newComment.trim() || isSubmitting}
            >
              <Send className="mr-2 h-4 w-4" />
              Comment
            </Button>
          </div>
        </div>

        {/* Active Comments */}
        <div className="space-y-3">
          {activeComments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No comments yet. Add comments to provide feedback on the document.
            </p>
          ) : (
            activeComments.map((comment) => {
              const isExpanded = expandedComments.has(comment.id);

              return (
                <div
                  key={comment.id}
                  className={`rounded-lg border p-3 ${
                    comment.isAISuggestion ? 'border-purple-200 bg-purple-50/50' : ''
                  }`}
                >
                  {/* Comment Header */}
                  <div className="flex items-start gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarFallback className="text-xs">
                        {getInitials(comment.author.firstName, comment.author.lastName)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {comment.author.firstName} {comment.author.lastName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {formatRelativeTime(comment.createdAt)}
                        </span>
                        {comment.isAISuggestion && (
                          <Badge variant="secondary" className="text-xs">
                            AI Suggestion
                          </Badge>
                        )}
                      </div>

                      {/* Anchor text reference */}
                      {comment.anchorText && (
                        <button
                          onClick={() =>
                            onNavigateToComment?.(
                              comment.anchorStart || 0,
                              comment.anchorEnd || 0
                            )
                          }
                          className="text-xs text-primary hover:underline mt-1 block text-left"
                        >
                          On: &quot;{comment.anchorText.substring(0, 50)}
                          {comment.anchorText.length > 50 ? '...' : ''}&quot;
                        </button>
                      )}

                      {/* Comment content */}
                      <p className="text-sm mt-2 whitespace-pre-wrap">{comment.content}</p>

                      {/* Suggestion text */}
                      {comment.suggestionText && (
                        <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
                          <span className="font-medium text-xs text-green-700">
                            Suggested change:
                          </span>
                          <p className="text-green-800">{comment.suggestionText}</p>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex items-center gap-2 mt-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => setReplyingTo(comment.id)}
                        >
                          <Reply className="mr-1 h-3 w-3" />
                          Reply
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs"
                          onClick={() => onResolve(comment.id)}
                        >
                          <Check className="mr-1 h-3 w-3" />
                          Resolve
                        </Button>
                        {comment.replies.length > 0 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => toggleExpanded(comment.id)}
                          >
                            {isExpanded ? (
                              <ChevronDown className="mr-1 h-3 w-3" />
                            ) : (
                              <ChevronRight className="mr-1 h-3 w-3" />
                            )}
                            {comment.replies.length} replies
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Replies */}
                  {isExpanded && comment.replies.length > 0 && (
                    <div className="mt-3 ml-9 space-y-2 border-l-2 pl-3">
                      {comment.replies.map((reply) => (
                        <div key={reply.id} className="flex items-start gap-2">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-xs">
                              {getInitials(reply.author.firstName, reply.author.lastName)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-xs">
                                {reply.author.firstName} {reply.author.lastName}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {formatRelativeTime(reply.createdAt)}
                              </span>
                            </div>
                            <p className="text-sm">{reply.content}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Reply Form */}
                  {replyingTo === comment.id && (
                    <div className="mt-3 ml-9 space-y-2">
                      <Textarea
                        value={replyContent}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReplyContent(e.target.value)}
                        placeholder="Write a reply..."
                        rows={2}
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleSubmitReply(comment.id)}
                          disabled={!replyContent.trim() || isSubmitting}
                        >
                          Reply
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setReplyingTo(null);
                            setReplyContent('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Resolved Comments */}
        {resolvedComments.length > 0 && (
          <div className="border-t pt-3 mt-3">
            <button
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
              onClick={() =>
                resolvedComments.forEach((c) =>
                  setExpandedComments((prev) => {
                    const next = new Set(prev);
                    if (next.has(`resolved-${c.id}`)) {
                      next.delete(`resolved-${c.id}`);
                    } else {
                      next.add(`resolved-${c.id}`);
                    }
                    return next;
                  })
                )
              }
            >
              <Check className="h-4 w-4" />
              {resolvedComments.length} resolved comment
              {resolvedComments.length > 1 ? 's' : ''}
            </button>

            <div className="space-y-2 mt-2">
              {resolvedComments.map((comment) => (
                <div
                  key={comment.id}
                  className="rounded-lg border p-2 bg-muted/30 text-sm opacity-60"
                >
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span className="font-medium">
                      {comment.author.firstName} {comment.author.lastName}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Resolved by {comment.resolvedBy?.firstName}{' '}
                      {comment.resolvedBy?.lastName}
                    </span>
                  </div>
                  <p className="ml-6 text-muted-foreground">{comment.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
