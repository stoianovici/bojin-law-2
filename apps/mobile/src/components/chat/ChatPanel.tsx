'use client';

import { useEffect, useRef } from 'react';
import { clsx } from 'clsx';
import { X, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { createPortal } from 'react-dom';
import { useTeamChat } from '@/hooks/useTeamChat';
import { useAuthStore } from '@/store/auth';
import { useRealtimeStore } from '@/store/realtime';
import { ChatBubble } from './ChatBubble';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { Skeleton } from '@/components/ui/Skeleton';

// ============================================================================
// Component
// ============================================================================

export function ChatPanel() {
  const { user } = useAuthStore();
  const { chatOpen, setChatOpen, resetUnreadChat } = useRealtimeStore();
  const { messages, loading, typingUsers, sendMessage, setTyping } = useTeamChat();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (chatOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, chatOpen]);

  // Reset unread count when opening
  useEffect(() => {
    if (chatOpen) {
      resetUnreadChat();
    }
  }, [chatOpen, resetUnreadChat]);

  // Lock body scroll when open
  useEffect(() => {
    if (chatOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [chatOpen]);

  const handleClose = () => setChatOpen(false);

  const handleSend = async (content: string) => {
    try {
      await sendMessage(content);
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  if (typeof window === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {chatOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/60"
            onClick={handleClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className={clsx(
              'fixed bottom-0 left-0 right-0 z-50',
              'bg-bg-elevated rounded-t-2xl',
              'flex flex-col',
              'h-[85vh]'
            )}
            style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-accent" />
                </div>
                <div>
                  <h2 className="text-base font-semibold text-text-primary">Chat echipă</h2>
                  <p className="text-xs text-text-secondary">{messages.length} mesaje</p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="w-10 h-10 rounded-full flex items-center justify-center text-text-secondary hover:bg-bg-hover active:bg-bg-card transition-colors"
                aria-label="Închide"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto overscroll-contain px-4 py-4">
              {loading && messages.length === 0 ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className={clsx('flex', i % 2 === 0 && 'justify-end')}>
                      <Skeleton
                        className={clsx('h-16 rounded-2xl', i % 2 === 0 ? 'w-48' : 'w-56')}
                      />
                    </div>
                  ))}
                </div>
              ) : messages.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <Users className="w-12 h-12 text-text-tertiary mb-3" />
                  <p className="text-text-secondary">Niciun mesaj încă</p>
                  <p className="text-sm text-text-tertiary mt-1">Începe o conversație cu echipa</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {messages.map((message) => (
                    <ChatBubble
                      key={message.id}
                      message={message}
                      isOwn={message.author.id === user?.id}
                    />
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Typing indicator */}
            <TypingIndicator users={typingUsers} />

            {/* Input */}
            <ChatInput onSend={handleSend} onTyping={setTyping} />
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
