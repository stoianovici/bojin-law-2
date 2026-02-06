import { useEffect, useRef } from 'react';

interface Message {
  role: 'user' | 'assistant' | 'error';
  content: string;
}

interface ConversationHistoryProps {
  messages: Message[];
  onReset: () => void;
  isLoading?: boolean;
}

export function ConversationHistory({
  messages,
  onReset,
  isLoading = false,
}: ConversationHistoryProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  const renderIcon = (role: Message['role']) => {
    switch (role) {
      case 'user':
        return (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
            <circle cx="12" cy="7" r="4" />
          </svg>
        );
      case 'assistant':
        return (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        );
      case 'error':
        return (
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        );
    }
  };

  return (
    <div className="edit-panel__history">
      {/* Reset button */}
      {messages.length > 0 && (
        <div className="edit-panel__history-header">
          <button onClick={onReset} className="btn-link" disabled={isLoading}>
            Resetează
          </button>
        </div>
      )}

      {/* Messages */}
      <div ref={containerRef} className="edit-panel__history-messages">
        {messages.length === 0 ? (
          <div className="edit-panel__history-empty">
            Începe prin a descrie ce vrei să modifici în document.
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={`edit-panel__message edit-panel__message--${msg.role}`}>
              <span className="edit-panel__message-icon">{renderIcon(msg.role)}</span>
              <span className="edit-panel__message-content">{msg.content}</span>
            </div>
          ))
        )}

        {/* Loading indicator */}
        {isLoading && (
          <div className="edit-panel__message edit-panel__message--assistant">
            <span className="edit-panel__message-icon">{renderIcon('assistant')}</span>
            <span className="edit-panel__message-content edit-panel__message-loading">
              Se procesează...
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
