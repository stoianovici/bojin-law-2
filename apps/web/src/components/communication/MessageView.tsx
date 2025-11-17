'use client';

// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { useCommunicationStore } from '../../stores/communication.store';
import { format } from 'date-fns';
import type { CommunicationMessage } from '@legal-platform/types';
import { Paperclip, Reply } from 'lucide-react';

function Message({ message, threadId, isExpanded, onToggle, onReply }: {
  message: CommunicationMessage;
  threadId: string;
  isExpanded: boolean;
  onToggle: () => void;
  onReply: (threadId: string) => void;
}) {
  const handleReplyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onReply(threadId);
  };

  const handleReplyKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      e.stopPropagation();
      onReply(threadId);
    }
  };

  return (
    <div className="border-b p-4">
      <div
        className="flex items-start justify-between cursor-pointer"
        onClick={onToggle}
      >
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-blue-500 text-white flex items-center justify-center text-sm">
              {message.senderName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-semibold text-sm">{message.senderName}</div>
              <div className="text-xs text-gray-500">{message.senderEmail}</div>
            </div>
          </div>
        </div>
        <div className="text-xs text-gray-500">
          {format(message.sentDate, 'dd.MM.yyyy HH:mm')}
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 pl-10">
          <div className="text-sm whitespace-pre-wrap">{message.body}</div>
          {message.attachments.length > 0 && (
            <div className="mt-3 space-y-1">
              {message.attachments.map(att => (
                <div key={att.id} className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-700 cursor-pointer">
                  <Paperclip className="h-4 w-4" />
                  <span>{att.filename}</span>
                  <span className="text-xs text-gray-500">
                    ({Math.round(att.fileSize / 1024)} KB)
                  </span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 flex items-center gap-2">
            <button
              onClick={handleReplyClick}
              onKeyDown={handleReplyKeyDown}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1"
              aria-label="Răspunde la acest mesaj"
            >
              <Reply className="h-4 w-4" />
              <span>Răspunde</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export function MessageView() {
  const { getSelectedThread, expandedMessageIds, toggleMessageExpanded, expandAllMessages, collapseAllMessages, openCompose, threads, setThreads } = useCommunicationStore();
  const thread = getSelectedThread();

  if (!thread) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Selectați o conversație</p>
      </div>
    );
  }

  const allExpanded = thread.messages.every(m => expandedMessageIds.has(m.id));

  const handleReply = (threadId: string) => {
    openCompose('reply', threadId);
  };

  const handleMarkAsProcessed = () => {
    if (thread) {
      // Update thread to mark as processed
      const updatedThreads = threads.map(t =>
        t.id === thread.id
          ? { ...t, isProcessed: true, processedAt: new Date() }
          : t
      );
      setThreads(updatedThreads);

      // Show success message (in production, this would be a toast)
      alert('Comunicare mutată în dosar');
    }
  };

  // Calculate stats for processed decision
  const totalExtractedItems =
    (thread.extractedItems.deadlines?.length || 0) +
    (thread.extractedItems.commitments?.length || 0) +
    (thread.extractedItems.actionItems?.length || 0);

  // For prototype, we can't track converted items across components
  // In production, this would be tracked in the store
  const unconvertedCount = totalExtractedItems;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b p-4 bg-white space-y-3">
        <div>
          <h2 className="font-semibold text-lg mb-1">{thread.subject}</h2>
          <div className="text-sm text-gray-600">
            {thread.caseName} • {thread.messages.length} mesaje
          </div>
        </div>

        {/* Processing Stats */}
        {unconvertedCount > 0 && (
          <div className="p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
            <p className="text-yellow-800">
              ⚠️ Au mai rămas {unconvertedCount} elemente neconvertite
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3">
          <button
            onClick={allExpanded ? collapseAllMessages : expandAllMessages}
            className="text-sm text-blue-600 hover:underline"
          >
            {allExpanded ? 'Restrânge tot' : 'Extinde tot'}
          </button>
          <button
            onClick={handleMarkAsProcessed}
            className="px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
          >
            Marchează ca Procesat
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {thread.messages.map(message => (
          <Message
            key={message.id}
            message={message}
            threadId={thread.id}
            isExpanded={expandedMessageIds.has(message.id)}
            onToggle={() => toggleMessageExpanded(message.id)}
            onReply={handleReply}
          />
        ))}
      </div>
    </div>
  );
}
