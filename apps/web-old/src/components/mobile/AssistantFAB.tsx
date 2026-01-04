/**
 * AssistantFAB Component
 * OPS-299: AssistantFAB Component
 *
 * Floating action button for persistent AI assistant access on mobile.
 * Positioned at bottom-right, shows unread badge, tap triggers toggleOpen.
 */

'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import { useAssistantStore } from '../../stores/assistant.store';
import { useIsMobile } from '../../hooks/useIsMobile';

export function AssistantFAB() {
  const { toggleOpen, unreadCount, isOpen } = useAssistantStore();
  const isMobile = useIsMobile();

  // Only show on mobile, and not when assistant sheet is already open
  if (!isMobile || isOpen) {
    return null;
  }

  return (
    <motion.button
      onClick={toggleOpen}
      className="fixed z-50 flex h-14 w-14 items-center justify-center rounded-full text-white"
      style={{
        bottom: 'calc(1.5rem + env(safe-area-inset-bottom, 0px))',
        right: '1rem',
        background: 'linear-gradient(135deg, #5E6AD2, #6B76DC)',
        boxShadow: '0 0 40px rgba(94, 106, 210, 0.3), 0 4px 12px rgba(0, 0, 0, 0.3)',
      }}
      whileTap={{ scale: 0.92 }}
      whileHover={{ scale: 1.05 }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      aria-label="Deschide asistentul AI"
    >
      <Sparkles className="h-6 w-6" />

      {/* Unread badge */}
      {unreadCount > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-linear-error px-1.5 text-xs font-bold text-white">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </motion.button>
  );
}
