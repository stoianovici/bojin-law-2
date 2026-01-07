# Plan: Team Chat UI (Frontend)

**Status**: Approved
**Date**: 2026-01-02
**Input**: `research-team-chat.md`
**Next step**: `/implement plan-team-chat-ui`

---

## Context Summary

**Project**: bojin-law-ui - AI-powered legal case management UI
**Path**: `/Users/mio/Developer/bojin-law-ui`
**Tech Stack**: Next.js 16 (App Router), TypeScript, Tailwind CSS, Zustand
**Design**: Linear-inspired dark theme

**Key Files**:

- `src/components/layout/ContextPanel.tsx` - Container for activity panel (320-384px wide)
- `src/components/tasks/TeamActivityFeed.tsx` - Existing activity feed (reference for patterns)
- `src/components/email/MessageBubble.tsx` - Reference for bubble styling
- `src/components/ui/Avatar.tsx` - Has status indicator support (online/offline/busy)

**Design Tokens**:

```
Backgrounds: #0a0a0a (primary) → #141414 (elevated) → #1a1a1a (card)
Text: #fafafa (primary) → #a1a1a1 (secondary) → #6b6b6b (tertiary)
Accent: #3b82f6 (blue for own messages)
```

## Approach Summary

Build the team chat UI components with mock data, integrated into the ContextPanel as a stacked layout (collapsible activity feed + chat). Uses iMessage-style message bubbles (own messages right-aligned in blue, others left-aligned in dark gray). Includes presence indicators (online dots) and typing indicator. This is UI-only; backend integration comes in the next plan.

---

## Parallel Group 1: Foundation Components

> These 4 tasks run simultaneously via sub-agents

### Task 1.1: Chat TypeScript Types

- **File**: `src/types/chat.ts` (CREATE)
- **Do**: Create TypeScript interfaces for the chat feature:

  ```typescript
  interface ChatMessage {
    id: string;
    content: string;
    userId: string;
    userName: string;
    userInitials: string;
    timestamp: string;
    isOwn: boolean;
  }

  interface ChatUser {
    id: string;
    name: string;
    initials: string;
    status: 'online' | 'offline' | 'busy';
    isTyping?: boolean;
  }

  interface TypingState {
    userId: string;
    userName: string;
  }
  ```

- **Done when**: File exists with exported interfaces, no TypeScript errors

### Task 1.2: Chat Message Bubble

- **File**: `src/components/chat/ChatMessage.tsx` (CREATE)
- **Do**: Create iMessage-style message bubble component:
  - Props: `message: ChatMessage`
  - Own messages: right-aligned, blue background (#3b82f6), white text, rounded `16px 16px 4px 16px`
  - Other messages: left-aligned, dark background (#18181B), light text, rounded `16px 16px 16px 4px`
  - Show avatar (32px) with gradient for other messages only (use existing gradient map from TeamActivityFeed)
  - Show timestamp below message in muted text (`text-[11px]`)
  - Use Romanian date format: "Azi, 14:32" / "Ieri, 09:15"
  - Reference: `src/components/email/MessageBubble.tsx` for patterns
- **Done when**: Component renders correctly for both own/other message types

### Task 1.3: Chat Input

- **File**: `src/components/chat/ChatInput.tsx` (CREATE)
- **Do**: Create message input component:
  - Props: `onSend: (message: string) => void`, `disabled?: boolean`
  - Textarea (auto-grow, max 4 lines) with placeholder "Scrie un mesaj..."
  - Send button (paper plane icon) - disabled when empty
  - Keyboard shortcut: Cmd/Ctrl + Enter to send
  - Dark theme styling matching Linear aesthetic
  - Clear input after send
  - Reference: `src/components/email/ReplyArea.tsx` for patterns
- **Done when**: Input works with keyboard shortcut and button, clears after send

### Task 1.4: Typing Indicator

- **File**: `src/components/chat/ChatTypingIndicator.tsx` (CREATE)
- **Do**: Create animated typing indicator:
  - Props: `typingUsers: TypingState[]`
  - Show "Ana scrie..." or "Ana și Mihai scriu..." format
  - Animated dots (3 bouncing dots)
  - Muted text color, small font (`text-[12px]`)
  - Return null if no users typing
- **Done when**: Shows animated indicator with correct Romanian text

---

## Sequential: After Group 1

### Task 2: TeamChat Container

- **Depends on**: Task 1.1, 1.2, 1.3, 1.4
- **File**: `src/components/chat/TeamChat.tsx` (CREATE)
- **Do**: Create main chat container component:
  - Import and use ChatMessage, ChatInput, ChatTypingIndicator
  - Mock data: 5-6 sample messages from different users
  - Mock typing state (one user typing)
  - Scrollable message area with auto-scroll to bottom
  - Messages sorted by timestamp (newest at bottom)
  - Gap between messages: `gap-3` (12px)
  - Padding: `px-4 py-3`
  - Show online team members at top (horizontal avatar row with status dots)
  - Use `useAuth` hook to get current user for `isOwn` comparison
  - Mock online users: 3-4 users with varying status
- **Done when**: Component renders message list, input, typing indicator, and online users bar

---

## Sequential: Integration

### Task 3: ContextPanel Integration

- **Depends on**: Task 2
- **File**: `src/components/layout/ContextPanel.tsx` (MODIFY)
- **Do**: Modify ContextPanel to show stacked layout:
  - Add collapsible sections with headers:
    - "Activitate Echipa" (activity feed) - collapsible, expanded by default
    - "Chat Echipa" (team chat) - collapsible, expanded by default
  - Section headers: clickable with chevron icon (rotates on collapse)
  - Activity feed in top section (existing TeamActivityFeed)
  - TeamChat in bottom section
  - Use `useState` for section collapse state
  - Smooth height animation on collapse (optional: use CSS transitions)
  - Each section should have equal flex when both expanded, or flex-1 when one collapsed
- **Done when**: Both sections visible, collapsible, TeamChat integrated

---

## Final Steps

### Task 4: Verification

- **Depends on**: Task 3
- **Do**:
  - Run `npm run type-check` - fix any TypeScript errors
  - Run `npm run lint` - fix any linting issues
  - Run `npm run dev` and visually verify:
    - Chat appears in ContextPanel below activity
    - Messages display correctly (own right, others left)
    - Input works and "sends" messages (to mock list)
    - Typing indicator animates
    - Online users show with status dots
    - Sections collapse/expand smoothly
- **Done when**: No type/lint errors, UI works as expected

---

## Session Scope Assessment

- **Total tasks**: 4 parallel + 2 sequential + 1 verification = 7 logical tasks
- **Estimated complexity**: Medium
- **Files created**: 6 new files
- **Files modified**: 1 (ContextPanel.tsx)

## Mock Data Reference

Include in TeamChat.tsx:

```typescript
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
```

## Avatar Gradient Map (reuse from TeamActivityFeed)

```typescript
const avatarGradients: Record<string, string> = {
  ab: 'bg-gradient-to-br from-[#5E6AD2] to-[#8B5CF6]',
  mp: 'bg-gradient-to-br from-[#EC4899] to-[#F472B6]',
  ed: 'bg-gradient-to-br from-[#22C55E] to-[#4ADE80]',
  cv: 'bg-gradient-to-br from-[#3B82F6] to-[#60A5FA]',
  default: 'bg-gradient-to-br from-[#F59E0B] to-[#FBBF24]',
};
```

---

## Next Step

Start a new session and run:

```
/implement plan-team-chat-ui
```

After completing this plan, proceed with:

```
/plan research-team-chat-backend
```
