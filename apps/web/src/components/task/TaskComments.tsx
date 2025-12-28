/**
 * TaskComments Component
 * Story 4.6: Task Collaboration and Updates (AC: 1)
 *
 * Displays and manages task comments with threaded replies and @mentions
 */

'use client';

import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import {
  useTaskComments,
  useCreateTaskComment,
  useUpdateTaskComment,
  useDeleteTaskComment,
  type TaskComment,
} from '@/hooks/useTaskComments';
import { MentionAutocomplete } from './MentionAutocomplete';

interface TaskCommentsProps {
  taskId: string;
  currentUserId: string;
}

export function TaskComments({ taskId, currentUserId }: TaskCommentsProps) {
  const { data, loading, error } = useTaskComments(taskId);
  const [createComment, { loading: creating }] = useCreateTaskComment();
  const [updateComment] = useUpdateTaskComment();
  const [deleteComment] = useDeleteTaskComment();

  const [newComment, setNewComment] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  const comments = data?.taskComments || [];

  const handleSubmit = async (e: React.FormEvent | React.MouseEvent, parentId?: string) => {
    e.preventDefault();
    const content = parentId ? editContent : newComment;
    if (!content.trim()) return;

    await createComment({
      variables: {
        input: {
          taskId,
          content: content.trim(),
          parentId,
        },
      },
    });

    if (parentId) {
      setReplyingTo(null);
      setEditContent('');
    } else {
      setNewComment('');
    }
  };

  const handleUpdate = async (commentId: string) => {
    if (!editContent.trim()) return;

    await updateComment({
      variables: {
        commentId,
        input: { content: editContent.trim() },
      },
    });

    setEditingId(null);
    setEditContent('');
  };

  const handleDelete = async (commentId: string) => {
    if (window.confirm('Sigur doriți să ștergeți acest comentariu?')) {
      await deleteComment({ variables: { commentId } });
    }
  };

  const startEditing = (comment: TaskComment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  };

  const renderComment = (comment: TaskComment, isReply = false) => {
    const isAuthor = comment.authorId === currentUserId;
    const isEditing = editingId === comment.id;

    return (
      <div
        key={comment.id}
        className={`${isReply ? 'ml-8 mt-3' : 'mt-4'} ${isReply ? 'border-l-2 border-linear-border-subtle pl-4' : ''}`}
      >
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-linear-accent/15 flex items-center justify-center text-linear-accent text-sm font-medium">
            {comment.author.firstName[0]}
            {comment.author.lastName[0]}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-linear-text-primary text-sm">
                {comment.author.firstName} {comment.author.lastName}
              </span>
              <span className="text-xs text-linear-text-tertiary">
                {formatDistanceToNow(new Date(comment.createdAt), {
                  addSuffix: true,
                  locale: ro,
                })}
              </span>
              {comment.editedAt && <span className="text-xs text-linear-text-muted">(editat)</span>}
            </div>

            {isEditing ? (
              <div className="space-y-2">
                <MentionAutocomplete
                  value={editContent}
                  onChange={setEditContent}
                  placeholder="Editează comentariul..."
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => handleUpdate(comment.id)}
                    className="px-3 py-1 text-sm bg-linear-accent text-white rounded hover:bg-linear-accent-hover"
                  >
                    Salvează
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(null);
                      setEditContent('');
                    }}
                    className="px-3 py-1 text-sm text-linear-text-secondary hover:text-linear-text-primary"
                  >
                    Anulează
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-linear-text-secondary text-sm whitespace-pre-wrap">
                  {renderContentWithMentions(comment.content, comment.mentionedUsers)}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-3 mt-2">
                  {!isReply && (
                    <button
                      onClick={() => {
                        setReplyingTo(comment.id);
                        setEditContent('');
                      }}
                      className="text-xs text-linear-text-tertiary hover:text-linear-accent"
                    >
                      Răspunde
                    </button>
                  )}
                  {isAuthor && (
                    <>
                      <button
                        onClick={() => startEditing(comment)}
                        className="text-xs text-linear-text-tertiary hover:text-linear-accent"
                      >
                        Editează
                      </button>
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="text-xs text-linear-text-tertiary hover:text-linear-error"
                      >
                        Șterge
                      </button>
                    </>
                  )}
                </div>
              </>
            )}

            {/* Reply section */}
            {replyingTo === comment.id && (
              <div className="mt-3 space-y-2">
                <MentionAutocomplete
                  value={editContent}
                  onChange={setEditContent}
                  placeholder="Scrie un răspuns..."
                  autoFocus
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={(e) => handleSubmit(e, comment.id)}
                    disabled={creating || !editContent.trim()}
                    className="px-3 py-1 text-sm bg-linear-accent text-white rounded hover:bg-linear-accent-hover disabled:opacity-50"
                  >
                    Răspunde
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyingTo(null);
                      setEditContent('');
                    }}
                    className="px-3 py-1 text-sm text-linear-text-secondary hover:text-linear-text-primary"
                  >
                    Anulează
                  </button>
                </div>
              </div>
            )}

            {/* Replies */}
            {comment.replies?.map((reply) => renderComment(reply, true))}
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="w-8 h-8 rounded-full bg-linear-bg-hover" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-linear-bg-hover rounded w-1/4" />
              <div className="h-3 bg-linear-bg-hover rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-linear-error text-sm">Eroare la încărcarea comentariilor</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-linear-text-primary">Comentarii ({comments.length})</h3>

      {/* New comment section */}
      <div className="space-y-2">
        <MentionAutocomplete
          value={newComment}
          onChange={setNewComment}
          placeholder="Adaugă un comentariu... (folosește @ pentru mențiuni)"
        />
        <div className="flex justify-end">
          <button
            type="button"
            onClick={(e) => handleSubmit(e)}
            disabled={creating || !newComment.trim()}
            className="px-4 py-2 text-sm bg-linear-accent text-white rounded-md hover:bg-linear-accent-hover disabled:opacity-50"
          >
            {creating ? 'Se trimite...' : 'Comentează'}
          </button>
        </div>
      </div>

      {/* Comments list */}
      <div className="divide-y divide-gray-100">
        {comments.length === 0 ? (
          <p className="text-linear-text-tertiary text-sm py-4 text-center">
            Fără comentarii încă. Fiți primul care comentează!
          </p>
        ) : (
          comments.map((comment) => renderComment(comment))
        )}
      </div>
    </div>
  );
}

/**
 * Render content with @mentions highlighted
 */
function renderContentWithMentions(
  content: string,
  _mentionedUsers: Array<{ id: string; firstName: string; lastName: string }>
): React.ReactNode {
  if (!content) return null;

  const mentionRegex = /@[\w.-]+/g;
  const parts = content.split(mentionRegex);
  const mentions = content.match(mentionRegex) || [];

  return parts.map((part, index) => (
    <React.Fragment key={index}>
      {part}
      {mentions[index] && (
        <span className="text-linear-accent font-medium bg-linear-accent/10 px-1 rounded">{mentions[index]}</span>
      )}
    </React.Fragment>
  ));
}

export default TaskComments;
