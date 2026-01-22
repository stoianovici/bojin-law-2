'use client';

import { X } from 'lucide-react';
import { useUIStore } from '@/store/uiStore';
import { TeamChat } from '@/components/chat/TeamChat';

/**
 * Context Panel - Unified Team Chat with Activity Feed
 *
 * Shows team chat messages alongside system-generated activity notifications.
 * Activity events (document uploads, task changes, etc.) appear as system messages
 * in the chat, creating a unified feed of team communication and activity.
 */
export function ContextPanel() {
  const setContextPanelVisible = useUIStore((state) => state.setContextPanelVisible);

  const handleClose = () => {
    setContextPanelVisible(false);
  };

  return (
    <div className="flex flex-col h-full bg-linear-bg-secondary">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-linear-border-subtle animate-fadeIn">
        <h2 className="text-sm font-normal text-linear-text-primary">Chat Echipă</h2>
        <button
          onClick={handleClose}
          className="p-1.5 rounded-md text-linear-text-tertiary hover:text-linear-text-secondary hover:bg-linear-bg-hover transition-all duration-150"
          aria-label="Închide panoul"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Unified Team Chat with Activity Feed */}
      <div className="flex-1 min-h-0 overflow-hidden animate-slideInRight">
        <TeamChat className="h-full" />
      </div>
    </div>
  );
}

export default ContextPanel;
