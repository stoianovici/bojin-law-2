'use client';

import { useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/toast';
import { useTeamChat } from '@/hooks/useTeamChat';
import type { ChatMessage, TypingState } from '@/types/chat';
import { ChatMessage as ChatMessageComponent } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ChatTypingIndicator } from './ChatTypingIndicator';

// ============================================================================
// Helpers
// ============================================================================

function getInitialsFromName(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}

function getFullName(firstName: string, lastName: string): string {
  return `${firstName} ${lastName}`.trim();
}

// ============================================================================
// Component
// ============================================================================

interface TeamChatProps {
  className?: string;
}

export function TeamChat({ className }: TeamChatProps) {
  const {
    messages,
    loading,
    error,
    sending,
    typingUsers,
    sendMessage,
    deleteMessage,
    setTyping,
    currentUserId,
  } = useTeamChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessagesLengthRef = useRef(0);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    // Only scroll and show toast when new messages are added
    if (messages.length > prevMessagesLengthRef.current) {
      scrollToBottom();

      // Show toast for the latest message if it's from another user
      const latestMessage = messages[messages.length - 1];
      if (latestMessage && latestMessage.author.id !== currentUserId) {
        const authorName = getFullName(
          latestMessage.author.firstName,
          latestMessage.author.lastName
        );
        toast({
          title: authorName,
          description:
            latestMessage.content.length > 50
              ? latestMessage.content.slice(0, 50) + '...'
              : latestMessage.content,
        });
      }
    }
    prevMessagesLengthRef.current = messages.length;
  }, [messages, scrollToBottom, currentUserId]);

  // Handle sending a new message
  const handleSendMessage = useCallback(
    async (content: string) => {
      try {
        // Clear typing indicator when sending
        setTyping(false);
        await sendMessage(content);
      } catch (err) {
        console.error('Failed to send message:', err);
        toast({
          title: 'Eroare',
          description: 'Nu s-a putut trimite mesajul. Încearcă din nou.',
          variant: 'error',
        });
      }
    },
    [sendMessage, setTyping]
  );

  // Handle typing indicator changes
  const handleTypingChange = useCallback(
    (isTyping: boolean) => {
      setTyping(isTyping);
    },
    [setTyping]
  );

  // Handle deleting a message
  const handleDeleteMessage = useCallback(
    async (id: string) => {
      try {
        await deleteMessage(id);
      } catch (err) {
        console.error('Failed to delete message:', err);
        toast({
          title: 'Eroare',
          description: 'Nu s-a putut șterge mesajul. Încearcă din nou.',
          variant: 'error',
        });
      }
    },
    [deleteMessage]
  );

  // Transform messages to the ChatMessage component format
  const transformedMessages: ChatMessage[] = messages.map((msg) => ({
    id: msg.id,
    content: msg.content,
    userId: msg.author.id,
    userName: getFullName(msg.author.firstName, msg.author.lastName),
    userInitials: getInitialsFromName(msg.author.firstName, msg.author.lastName),
    timestamp: msg.createdAt,
    isOwn: msg.author.id === currentUserId,
  }));

  // Transform typing users to the TypingState format
  const transformedTypingUsers: TypingState[] = typingUsers.map((user) => ({
    userId: user.userId,
    userName: user.userName.split(' ')[0], // Use first name only for typing indicator
  }));

  // Show loading state
  if (loading && messages.length === 0) {
    return (
      <div
        className={cn('flex flex-col h-full bg-[#0a0a0a] items-center justify-center', className)}
      >
        <div className="text-sm text-zinc-500">Se încarcă mesajele...</div>
      </div>
    );
  }

  // Show error state
  if (error && messages.length === 0) {
    return (
      <div
        className={cn('flex flex-col h-full bg-[#0a0a0a] items-center justify-center', className)}
      >
        <div className="text-sm text-red-500">Eroare la încărcarea mesajelor</div>
        <div className="text-xs text-zinc-600 mt-1">{error.message}</div>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col h-full bg-[#0a0a0a]', className)}>
      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {transformedMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-500">
            <div className="text-sm">Niciun mesaj</div>
            <div className="text-xs mt-1">Trimite primul mesaj echipei tale</div>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {transformedMessages.map((message) => (
              <ChatMessageComponent
                key={message.id}
                message={message}
                onDelete={message.isOwn ? handleDeleteMessage : undefined}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Typing indicator */}
      {transformedTypingUsers.length > 0 && (
        <div className="px-4 py-2">
          <ChatTypingIndicator typingUsers={transformedTypingUsers} />
        </div>
      )}

      {/* Chat input */}
      <ChatInput
        onSend={handleSendMessage}
        onTypingChange={handleTypingChange}
        disabled={sending}
      />
    </div>
  );
}

export default TeamChat;
