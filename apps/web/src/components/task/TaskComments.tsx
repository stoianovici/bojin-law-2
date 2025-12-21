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
        className={`${isReply ? 'ml-8 mt-3' : 'mt-4'} ${isReply ? 'border-l-2 border-gray-200 pl-4' : ''}`}
      >
        <div className="flex items-start gap-3">
          {/* Avatar */}
          <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-sm font-medium">
            {comment.author.firstName[0]}
            {comment.author.lastName[0]}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="font-medium text-gray-900 text-sm">
                {comment.author.firstName} {comment.author.lastName}
              </span>
              <span className="text-xs text-gray-500">
                {formatDistanceToNow(new Date(comment.createdAt), {
                  addSuffix: true,
                  locale: ro,
                })}
              </span>
              {comment.editedAt && <span className="text-xs text-gray-400">(editat)</span>}
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
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
                  >
                    Salvează
                  </button>
                  <button
                    onClick={() => {
                      setEditingId(null);
                      setEditContent('');
                    }}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                  >
                    Anulează
                  </button>
                </div>
              </div>
            ) : (
              <>
                <p className="text-gray-700 text-sm whitespace-pre-wrap">
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
                      className="text-xs text-gray-500 hover:text-blue-600"
                    >
                      Răspunde
                    </button>
                  )}
                  {isAuthor && (
                    <>
                      <button
                        onClick={() => startEditing(comment)}
                        className="text-xs text-gray-500 hover:text-blue-600"
                      >
                        Editează
                      </button>
                      <button
                        onClick={() => handleDelete(comment.id)}
                        className="text-xs text-gray-500 hover:text-red-600"
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
                    className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                  >
                    Răspunde
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setReplyingTo(null);
                      setEditContent('');
                    }}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
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
            <div className="w-8 h-8 rounded-full bg-gray-200" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-gray-200 rounded w-1/4" />
              <div className="h-3 bg-gray-200 rounded w-3/4" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-red-600 text-sm">Eroare la încărcarea comentariilor</div>;
  }

  return (
    <div className="space-y-4">
      <h3 className="font-semibold text-gray-900">Comentarii ({comments.length})</h3>

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
            className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? 'Se trimite...' : 'Comentează'}
          </button>
        </div>
      </div>

      {/* Comments list */}
      <div className="divide-y divide-gray-100">
        {comments.length === 0 ? (
          <p className="text-gray-500 text-sm py-4 text-center">
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
        <span className="text-blue-600 font-medium bg-blue-50 px-1 rounded">{mentions[index]}</span>
      )}
    </React.Fragment>
  ));
}

export default TaskComments;
