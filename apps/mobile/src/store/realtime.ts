/**
 * Real-time Store for Mobile
 * Unified state management for chat and notifications
 */

import { create } from 'zustand';

// ============================================================================
// Types
// ============================================================================

export interface ChatAuthor {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface ChatMessage {
  id: string;
  content: string;
  author: ChatAuthor;
  parentId: string | null;
  mentions: string[];
  type: 'User' | 'System';
  createdAt: string;
  expiresAt: string;
}

export interface TypingUser {
  userId: string;
  userName: string;
}

export interface InAppNotification {
  id: string;
  title: string;
  body: string;
  icon: string | null;
  read: boolean;
  action: {
    type: string;
    entityId?: string;
    caseId?: string;
  } | null;
  createdAt: string;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

// ============================================================================
// Store Interface
// ============================================================================

interface RealtimeState {
  // Connection
  connectionStatus: ConnectionStatus;
  setConnectionStatus: (status: ConnectionStatus) => void;

  // Chat
  chatMessages: ChatMessage[];
  typingUsers: TypingUser[];
  unreadChatCount: number;
  chatOpen: boolean;
  setChatMessages: (messages: ChatMessage[]) => void;
  addChatMessage: (message: ChatMessage) => void;
  removeChatMessage: (id: string) => void;
  setTypingUsers: (users: TypingUser[]) => void;
  setChatOpen: (open: boolean) => void;
  incrementUnreadChat: () => void;
  resetUnreadChat: () => void;

  // Notifications
  notifications: InAppNotification[];
  unreadNotificationCount: number;
  notificationsOpen: boolean;
  setNotifications: (notifications: InAppNotification[]) => void;
  addNotification: (notification: InAppNotification) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  setUnreadNotificationCount: (count: number) => void;
  setNotificationsOpen: (open: boolean) => void;
}

// ============================================================================
// Store
// ============================================================================

export const useRealtimeStore = create<RealtimeState>((set) => ({
  // Connection
  connectionStatus: 'disconnected',
  setConnectionStatus: (status) => set({ connectionStatus: status }),

  // Chat
  chatMessages: [],
  typingUsers: [],
  unreadChatCount: 0,
  chatOpen: false,
  setChatMessages: (messages) => set({ chatMessages: messages }),
  addChatMessage: (message) =>
    set((state) => {
      // Avoid duplicates
      if (state.chatMessages.some((m) => m.id === message.id)) {
        return state;
      }
      return {
        chatMessages: [...state.chatMessages, message],
        // Increment unread if chat is closed
        unreadChatCount: state.chatOpen ? state.unreadChatCount : state.unreadChatCount + 1,
      };
    }),
  removeChatMessage: (id) =>
    set((state) => ({
      chatMessages: state.chatMessages.filter((m) => m.id !== id),
    })),
  setTypingUsers: (users) => set({ typingUsers: users }),
  setChatOpen: (open) =>
    set({
      chatOpen: open,
      // Reset unread when opening
      unreadChatCount: open ? 0 : undefined,
    }),
  incrementUnreadChat: () =>
    set((state) => ({
      unreadChatCount: state.unreadChatCount + 1,
    })),
  resetUnreadChat: () => set({ unreadChatCount: 0 }),

  // Notifications
  notifications: [],
  unreadNotificationCount: 0,
  notificationsOpen: false,
  setNotifications: (notifications) => set({ notifications }),
  addNotification: (notification) =>
    set((state) => {
      // Avoid duplicates
      if (state.notifications.some((n) => n.id === notification.id)) {
        return state;
      }
      return {
        notifications: [notification, ...state.notifications],
        unreadNotificationCount: state.unreadNotificationCount + 1,
      };
    }),
  markNotificationRead: (id) =>
    set((state) => ({
      notifications: state.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
      unreadNotificationCount: Math.max(0, state.unreadNotificationCount - 1),
    })),
  markAllNotificationsRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadNotificationCount: 0,
    })),
  setUnreadNotificationCount: (count) => set({ unreadNotificationCount: count }),
  setNotificationsOpen: (open) => set({ notificationsOpen: open }),
}));
