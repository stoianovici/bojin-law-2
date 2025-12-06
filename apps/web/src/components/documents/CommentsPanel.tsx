'use client';

/**
 * Comments Panel Component
 * Story 3.4: Word Integration with Live AI Assistance - Task 19
 *
 * Displays and manages document comments synced with Word.
 */

import React, { useState } from 'react';
import { useQuery, useMutation, useSubscription } from '@apollo/client/react';
import { gql } from '@apollo/client/core';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  MessageSquare,
  Plus,
  Check,
  MoreVertical,
  Trash2,
  RefreshCw,
  Loader2,
  RotateCcw,
  Cloud,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

// GraphQL Operations
const GET_DOCUMENT_COMMENTS = gql`
  query GetDocumentComments($documentId: UUID!, $unresolvedOnly: Boolean) {
    documentComments(documentId: $documentId, unresolvedOnly: $unresolvedOnly) {
      id
      content
      anchorText
      resolved
      resolvedAt
      createdAt
      updatedAt
      author {
        id
        firstName
        lastName
        email
      }
      resolvedBy {
        id
        firstName
        lastName
      }
    }
  }
`;

const ADD_COMMENT = gql`
  mutation AddDocumentComment($input: CreateCommentInput!) {
    addDocumentComment(input: $input) {
      id
      content
      anchorText
      createdAt
      author {
        id
        firstName
        lastName
      }
    }
  }
`;

const RESOLVE_COMMENT = gql`
  mutation ResolveComment($commentId: UUID!) {
    resolveComment(commentId: $commentId) {
      id
      resolved
      resolvedAt
      resolvedBy {
        id
        firstName
        lastName
      }
    }
  }
`;

const UNRESOLVE_COMMENT = gql`
  mutation UnresolveComment($commentId: UUID!) {
    unresolveComment(commentId: $commentId) {
      id
      resolved
    }
  }
`;

const DELETE_COMMENT = gql`
  mutation DeleteComment($commentId: UUID!) {
    deleteComment(commentId: $commentId)
  }
`;

const SYNC_COMMENTS_FROM_WORD = gql`
  mutation SyncCommentsFromWord($documentId: UUID!) {
    syncCommentsFromWord(documentId: $documentId)
  }
`;

const COMMENT_ADDED = gql`
  subscription OnCommentAdded($documentId: UUID!) {
    commentAdded(documentId: $documentId) {
      id
      content
      anchorText
      createdAt
      author {
        id
        firstName
        lastName
      }
    }
  }
`;

const COMMENT_RESOLVED = gql`
  subscription OnCommentResolved($documentId: UUID!) {
    commentResolved(documentId: $documentId) {
      id
      resolved
      resolvedAt
      resolvedBy {
        id
        firstName
        lastName
      }
    }
  }
`;

interface Author {
  id: string;
  firstName: string;
  lastName: string;
  email?: string;
}

interface Comment {
  id: string;
  content: string;
  anchorText?: string;
  resolved: boolean;
  resolvedAt?: string;
  createdAt: string;
  updatedAt: string;
  author: Author;
  resolvedBy?: Author;
}

interface CommentsPanelProps {
  documentId: string;
  className?: string;
}

export function CommentsPanel({ documentId, className }: CommentsPanelProps) {
  const [showResolved, setShowResolved] = useState(false);
  const [newComment, setNewComment] = useState('');
  const [isAddingComment, setIsAddingComment] = useState(false);

  // Query comments
  interface DocumentCommentsData {
    documentComments: Comment[];
  }
  const { data, loading, error, refetch } = useQuery<DocumentCommentsData>(GET_DOCUMENT_COMMENTS, {
    variables: { documentId, unresolvedOnly: !showResolved },
  });

  // Subscriptions
  useSubscription(COMMENT_ADDED, {
    variables: { documentId },
    onData: () => refetch(),
  });

  useSubscription(COMMENT_RESOLVED, {
    variables: { documentId },
    onData: () => refetch(),
  });

  // Mutations
  const [addComment, { loading: addingComment }] = useMutation(ADD_COMMENT, {
    onCompleted: () => {
      setNewComment('');
      setIsAddingComment(false);
      refetch();
      toast.success('Comment added');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const [resolveComment] = useMutation(RESOLVE_COMMENT, {
    onCompleted: () => {
      refetch();
      toast.success('Comment resolved');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const [unresolveComment] = useMutation(UNRESOLVE_COMMENT, {
    onCompleted: () => {
      refetch();
      toast.success('Comment reopened');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const [deleteComment] = useMutation(DELETE_COMMENT, {
    onCompleted: () => {
      refetch();
      toast.success('Comment deleted');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  interface SyncCommentsData {
    syncCommentsFromWord: number;
  }
  const [syncFromWord, { loading: syncing }] = useMutation<SyncCommentsData>(SYNC_COMMENTS_FROM_WORD, {
    variables: { documentId },
    onCompleted: (data) => {
      refetch();
      toast.success(`Synced ${data.syncCommentsFromWord} comments from Word`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const comments: Comment[] = data?.documentComments || [];

  const handleAddComment = () => {
    if (!newComment.trim()) return;

    addComment({
      variables: {
        input: {
          documentId,
          content: newComment.trim(),
        },
      },
    });
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
          <p className="text-sm text-muted-foreground">Failed to load comments</p>
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
            <MessageSquare className="h-4 w-4" />
            Comments
            {comments.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {comments.length}
              </Badge>
            )}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => syncFromWord()}
              disabled={syncing}
              title="Sync from Word"
            >
              {syncing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Cloud className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => refetch()}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Filter Toggle */}
        <div className="flex items-center gap-2 mt-2">
          <Button
            variant={!showResolved ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setShowResolved(false)}
          >
            Open
          </Button>
          <Button
            variant={showResolved ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setShowResolved(true)}
          >
            All
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {/* Add Comment */}
        {isAddingComment ? (
          <div className="mb-4 p-3 border rounded-lg">
            <Textarea
              placeholder="Write a comment..."
              value={newComment}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewComment(e.target.value)}
              className="min-h-[80px] mb-2"
              autoFocus
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setIsAddingComment(false);
                  setNewComment('');
                }}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleAddComment}
                disabled={!newComment.trim() || addingComment}
              >
                {addingComment ? (
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                ) : null}
                Add Comment
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            className="w-full mb-4"
            onClick={() => setIsAddingComment(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Comment
          </Button>
        )}

        {/* Comments List */}
        {comments.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No comments yet</p>
            <p className="text-xs mt-1">Add a comment or sync from Word</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-3">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className={`border rounded-lg p-3 ${comment.resolved ? 'bg-muted/50 opacity-70' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8 flex-shrink-0">
                      <AvatarFallback className="text-xs">
                        {comment.author.firstName?.[0]}{comment.author.lastName?.[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            {comment.author.firstName} {comment.author.lastName}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(comment.createdAt), { addSuffix: true })}
                          </span>
                          {comment.resolved && (
                            <Badge variant="outline" className="text-green-600 border-green-200 text-xs">
                              <Check className="h-2 w-2 mr-1" />
                              Resolved
                            </Badge>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-6 w-6">
                              <MoreVertical className="h-3 w-3" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {comment.resolved ? (
                              <DropdownMenuItem
                                onClick={() => unresolveComment({ variables: { commentId: comment.id } })}
                              >
                                <RotateCcw className="h-4 w-4 mr-2" />
                                Reopen
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem
                                onClick={() => resolveComment({ variables: { commentId: comment.id } })}
                              >
                                <Check className="h-4 w-4 mr-2" />
                                Resolve
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem
                              className="text-red-600"
                              onClick={() => deleteComment({ variables: { commentId: comment.id } })}
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Anchor Text */}
                      {comment.anchorText && (
                        <div className="mt-1 mb-2 px-2 py-1 bg-amber-50 border-l-2 border-amber-400 text-xs italic text-muted-foreground">
                          "{comment.anchorText}"
                        </div>
                      )}

                      {/* Comment Content */}
                      <p className="text-sm mt-1 whitespace-pre-wrap">{comment.content}</p>

                      {/* Resolution Info */}
                      {comment.resolved && comment.resolvedBy && (
                        <p className="text-xs text-muted-foreground mt-2">
                          Resolved by {comment.resolvedBy.firstName} {comment.resolvedBy.lastName}
                          {comment.resolvedAt && ` · ${formatDistanceToNow(new Date(comment.resolvedAt), { addSuffix: true })}`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

export default CommentsPanel;
