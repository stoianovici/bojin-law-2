'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { toast } from '@/components/ui/toast';
import type { ChatMessage, ChatUser, TypingState } from '@/types/chat';
import { ChatMessage as ChatMessageComponent } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { ChatTypingIndicator } from './ChatTypingIndicator';

// Avatar gradient mapping
const avatarGradients: Record<string, string> = {
  ab: 'bg-gradient-to-br from-[#5E6AD2] to-[#8B5CF6]',
  mp: 'bg-gradient-to-br from-[#EC4899] to-[#F472B6]',
  ed: 'bg-gradient-to-br from-[#22C55E] to-[#4ADE80]',
  cv: 'bg-gradient-to-br from-[#3B82F6] to-[#60A5FA]',
  default: 'bg-gradient-to-br from-[#F59E0B] to-[#FBBF24]',
};

function getAvatarGradient(initials: string): string {
  const key = initials.toLowerCase();
  return avatarGradients[key] || avatarGradients.default;
}

// Mock data
const mockMessages: ChatMessage[] = [
  {
    id: '1',
    content: 'Bună dimineața! Ați văzut dosarul nou?',
    userId: 'ab',
    userName: 'Ana Boboc',
    userInitials: 'AB',
    timestamp: '2026-01-02T08:30:00Z',
    isOwn: false,
  },
  {
    id: '2',
    content: 'Da, tocmai mă uitam. Trebuie să depunem cererea până vineri.',
    userId: 'current',
    userName: 'You',
    userInitials: 'EU',
    timestamp: '2026-01-02T08:32:00Z',
    isOwn: true,
  },
  {
    id: '3',
    content: 'Am pregătit deja documentele. Le trimit pe email?',
    userId: 'mp',
    userName: 'Mihai Pop',
    userInitials: 'MP',
    timestamp: '2026-01-02T08:35:00Z',
    isOwn: false,
  },
  {
    id: '4',
    content: 'Perfect, mulțumesc Mihai! 👍',
    userId: 'current',
    userName: 'You',
    userInitials: 'EU',
    timestamp: '2026-01-02T08:36:00Z',
    isOwn: true,
  },
  {
    id: '5',
    content: 'De nimic. Dacă mai aveți nevoie de ceva, spuneți-mi.',
    userId: 'mp',
    userName: 'Mihai Pop',
    userInitials: 'MP',
    timestamp: '2026-01-02T08:37:00Z',
    isOwn: false,
  },
];

const mockOnlineUsers: ChatUser[] = [
  { id: 'ab', name: 'Ana Boboc', initials: 'AB', status: 'online' },
  { id: 'mp', name: 'Mihai Pop', initials: 'MP', status: 'online' },
  { id: 'ed', name: 'Elena Dinu', initials: 'ED', status: 'busy' },
  { id: 'cv', name: 'Cristian Vasile', initials: 'CV', status: 'offline' },
];

const mockTyping: TypingState[] = [{ userId: 'ab', userName: 'Ana' }];

// Status indicator component
function StatusIndicator({ status }: { status: ChatUser['status'] }) {
  const statusColors = {
    online: 'bg-green-500',
    busy: 'bg-yellow-500',
    offline: 'bg-zinc-600',
  };

  return (
    <div
      className={cn(
        'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0a0a0a]',
        statusColors[status]
      )}
    />
  );
}

// Online users bar
function OnlineUsersBar({ users }: { users: ChatUser[] }) {
  // Sort: online first, then busy, then offline
  const sortedUsers = [...users].sort((a, b) => {
    const order = { online: 0, busy: 1, offline: 2 };
    return order[a.status] - order[b.status];
  });

  return (
    <div className="flex items-center gap-1 px-4 py-2 border-b border-zinc-800">
      <span className="text-[11px] text-zinc-500 mr-2">Echipa:</span>
      <div className="flex -space-x-1">
        {sortedUsers.map((user) => (
          <div key={user.id} className="relative" title={`${user.name} (${user.status})`}>
            <div
              className={cn(
                'w-7 h-7 rounded-full flex items-center justify-center',
                'text-[10px] font-medium text-white border-2 border-[#0a0a0a]',
                getAvatarGradient(user.initials)
              )}
            >
              {user.initials}
            </div>
            <StatusIndicator status={user.status} />
          </div>
        ))}
      </div>
    </div>
  );
}

interface TeamChatProps {
  className?: string;
}

export function TeamChat({ className }: TeamChatProps) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(mockMessages);
  const [typingUsers] = useState<TypingState[]>(mockTyping);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  // Show toast notification for incoming messages
  const showMessageToast = useCallback((message: ChatMessage) => {
    if (!message.isOwn) {
      toast({
        title: message.userName,
        description:
          message.content.length > 50 ? message.content.slice(0, 50) + '...' : message.content,
      });
    }
  }, []);

  // Handle receiving a message (from WebSocket in real implementation)
  const handleReceiveMessage = useCallback(
    (message: ChatMessage) => {
      setMessages((prev) => [...prev, message]);
      showMessageToast(message);
    },
    [showMessageToast]
  );

  // Handle sending a new message
  const handleSendMessage = useCallback(
    (content: string) => {
      const newMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        content,
        userId: user?.id || 'current',
        userName: user?.name || 'You',
        userInitials: user?.name
          ? user.name
              .split(' ')
              .map((n) => n[0])
              .join('')
              .toUpperCase()
              .slice(0, 2)
          : 'EU',
        timestamp: new Date().toISOString(),
        isOwn: true,
      };
      setMessages((prev) => [...prev, newMessage]);
    },
    [user]
  );

  // Demo simulation removed - was causing useEffect dependency array issues
  // TODO: Replace with real WebSocket/subscription for team chat

  return (
    <div className={cn('flex flex-col h-full bg-[#0a0a0a]', className)}>
      {/* Online users bar */}
      <OnlineUsersBar users={mockOnlineUsers} />

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        <div className="flex flex-col gap-3">
          {messages.map((message) => (
            <ChatMessageComponent key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Typing indicator */}
      {typingUsers.length > 0 && (
        <div className="px-4 py-2">
          <ChatTypingIndicator typingUsers={typingUsers} />
        </div>
      )}

      {/* Chat input */}
      <ChatInput onSend={handleSendMessage} />
    </div>
  );
}

export default TeamChat;
