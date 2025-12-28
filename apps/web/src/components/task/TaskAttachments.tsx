/**
 * TaskAttachments Component
 * Story 4.6: Task Collaboration and Updates (AC: 3)
 *
 * Displays and manages task file attachments
 */

'use client';

import React, { useState } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ro } from 'date-fns/locale';
import {
  useTaskAttachments,
  useDeleteTaskAttachment,
  formatFileSize,
  getFileIcon,
  type TaskAttachment,
} from '@/hooks/useTaskAttachments';
import { AttachmentUploadModal } from './AttachmentUploadModal';

interface TaskAttachmentsProps {
  taskId: string;
  currentUserId: string;
  canEdit?: boolean;
}

export function TaskAttachments({ taskId, currentUserId, canEdit = true }: TaskAttachmentsProps) {
  const { data, loading, error, refetch } = useTaskAttachments(taskId);
  const [deleteAttachment] = useDeleteTaskAttachment();

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedAttachment, setSelectedAttachment] = useState<TaskAttachment | null>(null);

  const attachments = data?.taskAttachments || [];

  const handleDelete = async (attachment: TaskAttachment) => {
    if (window.confirm(`Sigur doriți să ștergeți "${attachment.fileName}"?`)) {
      await deleteAttachment({ variables: { attachmentId: attachment.id } });
    }
  };

  const handleUploadComplete = () => {
    setShowUploadModal(false);
    refetch();
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 p-3 bg-linear-bg-tertiary rounded-lg">
            <div className="w-10 h-10 bg-linear-bg-hover rounded" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-linear-bg-hover rounded w-1/2" />
              <div className="h-3 bg-linear-bg-hover rounded w-1/3" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return <div className="text-linear-error text-sm">Eroare la încărcarea atașamentelor</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold text-linear-text-primary">Atașamente ({attachments.length})</h3>
        {canEdit && (
          <button
            onClick={() => setShowUploadModal(true)}
            className="px-3 py-1.5 text-sm bg-linear-accent text-white rounded-md hover:bg-linear-accent-hover flex items-center gap-1"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            Adaugă
          </button>
        )}
      </div>

      {attachments.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-linear-border-subtle rounded-lg">
          <svg
            className="w-12 h-12 mx-auto text-linear-text-muted mb-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"
            />
          </svg>
          <p className="text-linear-text-tertiary text-sm">Fără atașamente</p>
          {canEdit && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="mt-2 text-sm text-linear-accent hover:text-linear-accent-hover"
            >
              Adaugă primul atașament
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map((attachment) => (
            <AttachmentItem
              key={attachment.id}
              attachment={attachment}
              currentUserId={currentUserId}
              canEdit={canEdit}
              onDelete={() => handleDelete(attachment)}
              onViewVersions={() => setSelectedAttachment(attachment)}
            />
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <AttachmentUploadModal
          taskId={taskId}
          onClose={() => setShowUploadModal(false)}
          onUploadComplete={handleUploadComplete}
        />
      )}

      {/* Version History Modal */}
      {selectedAttachment && (
        <VersionHistoryModal
          attachment={selectedAttachment}
          onClose={() => setSelectedAttachment(null)}
        />
      )}
    </div>
  );
}

interface AttachmentItemProps {
  attachment: TaskAttachment;
  currentUserId: string;
  canEdit: boolean;
  onDelete: () => void;
  onViewVersions: () => void;
}

function AttachmentItem({
  attachment,
  currentUserId,
  canEdit,
  onDelete,
  onViewVersions,
}: AttachmentItemProps) {
  const icon = getFileIcon(attachment.mimeType);
  const isOwner = attachment.uploadedBy === currentUserId;

  return (
    <div className="flex items-center gap-3 p-3 bg-linear-bg-tertiary rounded-lg hover:bg-linear-bg-hover transition-colors group">
      {/* File icon */}
      <div className="flex-shrink-0 w-10 h-10 bg-linear-bg-secondary rounded border border-linear-border-subtle flex items-center justify-center text-xl">
        {icon}
      </div>

      {/* File info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <a
            href={attachment.storageUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-linear-text-primary hover:text-linear-accent truncate"
          >
            {attachment.fileName}
          </a>
          {attachment.version > 1 && (
            <button onClick={onViewVersions} className="text-xs text-linear-text-tertiary hover:text-linear-accent">
              v{attachment.version}
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-xs text-linear-text-tertiary">
          <span>{formatFileSize(attachment.fileSize)}</span>
          <span>•</span>
          <span>
            {attachment.uploader.firstName} {attachment.uploader.lastName}
          </span>
          <span>•</span>
          <span>
            {formatDistanceToNow(new Date(attachment.createdAt), {
              addSuffix: true,
              locale: ro,
            })}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <a
          href={attachment.storageUrl}
          download={attachment.fileName}
          className="p-1.5 text-linear-text-tertiary hover:text-linear-accent rounded"
          title="Descarcă"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
        </a>
        {canEdit && isOwner && (
          <button
            onClick={onDelete}
            className="p-1.5 text-linear-text-tertiary hover:text-linear-error rounded"
            title="Șterge"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

interface VersionHistoryModalProps {
  attachment: TaskAttachment;
  onClose: () => void;
}

function VersionHistoryModal({ attachment, onClose }: VersionHistoryModalProps) {
  // In a real implementation, this would fetch version history
  // For now, just show the current version

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-linear-bg-secondary rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-linear-text-primary">Istoric Versiuni</h3>
          <button onClick={onClose} className="text-linear-text-muted hover:text-linear-text-secondary">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          <div className="p-3 bg-linear-accent/10 border border-linear-accent/30 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-linear-text-primary">Versiunea {attachment.version}</span>
              <span className="text-xs text-linear-accent">Curentă</span>
            </div>
            <p className="text-xs text-linear-text-tertiary mt-1">
              Încărcat de {attachment.uploader.firstName} {attachment.uploader.lastName}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-linear-text-secondary hover:bg-linear-bg-hover rounded-md"
          >
            Închide
          </button>
        </div>
      </div>
    </div>
  );
}

export default TaskAttachments;
