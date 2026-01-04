export interface ChatMessage {
  id: string;
  content: string;
  userId: string;
  userName: string;
  userInitials: string;
  timestamp: string;
  isOwn: boolean;
}

export interface ChatUser {
  id: string;
  name: string;
  initials: string;
  status: 'online' | 'offline' | 'busy';
  isTyping?: boolean;
}

export interface TypingState {
  userId: string;
  userName: string;
}
