'use client';

import { clsx } from 'clsx';
import { MessageCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useRealtimeStore } from '@/store/realtime';

// ============================================================================
// Component
// ============================================================================

export function ChatFAB() {
  const { unreadChatCount, chatOpen, setChatOpen } = useRealtimeStore();

  const handleClick = () => setChatOpen(true);

  // Don't show FAB when chat is open
  if (chatOpen) return null;

  return (
    <motion.button
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      exit={{ scale: 0, opacity: 0 }}
      whileTap={{ scale: 0.9 }}
      onClick={handleClick}
      className={clsx(
        'fixed z-40',
        'w-14 h-14 rounded-full',
        'bg-accent shadow-lg shadow-accent/30',
        'flex items-center justify-center',
        'active:bg-accent/90',
        'transition-colors'
      )}
      style={{
        right: 20,
        bottom: 'calc(env(safe-area-inset-bottom) + 80px)', // Above TabBar
      }}
      aria-label="Deschide chat"
    >
      <MessageCircle className="w-6 h-6 text-white" />

      {/* Unread badge */}
      <AnimatePresence>
        {unreadChatCount > 0 && (
          <motion.span
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className={clsx(
              'absolute -top-1 -right-1',
              'min-w-5 h-5 px-1.5 rounded-full',
              'bg-red-500 text-white',
              'text-xs font-semibold',
              'flex items-center justify-center'
            )}
          >
            {unreadChatCount > 99 ? '99+' : unreadChatCount}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.button>
  );
}
