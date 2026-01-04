# Brainstorm: Internal Chat in Team Activity Panel

**Status**: Complete
**Date**: 2026-01-02
**Next step**: `/research brainstorm-team-chat`

---

## Context

**Project**: bojin-law-ui - AI-powered legal case management UI
**Tech Stack**: Next.js 16 (App Router), TypeScript, Tailwind CSS, Apollo Client 4 (GraphQL), Zustand
**Backend**: bojin-law-2 (GraphQL gateway at localhost:4000)
**Design**: Linear-inspired dark theme

The "Activitate Echipă" (Team Activity) panel currently displays a feed of team actions:

- Task completed/added
- Events created
- Due dates changed
- (Potential additions: case status changes, document uploads, client communications, court dates, deadlines)

---

## Problem Statement

Add an internal team chat to the "Activitate Echipă" panel so team members can communicate in real-time alongside the activity feed. Chat should be simple, ephemeral (daily cleanup), and not distract from the activity log.

---

## Decisions

### 1. Layout: Stacked Sections with Collapsible Activity

```
┌─────────────────────────────┐
│  Activitate Echipă    [−]   │  ← Collapse button
├─────────────────────────────┤
│  ○ Ana a finalizat task...  │
│  ○ Ion a schimbat deadline..│
│  ○ Maria a adăugat event... │  ← Scrollable activity feed
│                             │
├─────────────────────────────┤
│  Chat                       │
├─────────────────────────────┤
│  [AM] Bună dimineața!       │  ← Others: left-aligned
│       Salut! [EU]           │  ← Own: right-aligned (iMessage)
│                   10:32     │  ← Grouped timestamp
├─────────────────────────────┤
│  [Type message...]  [Send]  │  ← Always visible input
└─────────────────────────────┘
```

- Activity section on top, collapsible (minimize to show only chat)
- Chat section below, always visible
- Input field pinned at bottom

### 2. Chat Functionality

| Feature         | Decision                               |
| --------------- | -------------------------------------- |
| Message type    | Simple text only                       |
| Send action     | Enter to send, Shift+Enter for newline |
| Character limit | None                                   |
| Real-time       | WebSocket / GraphQL subscriptions      |

### 3. Message Display

| Feature       | Decision                                              |
| ------------- | ----------------------------------------------------- |
| Timestamps    | Grouped by time cluster, not per-message              |
| User identity | Initials in avatar circle                             |
| Alignment     | iMessage style: own messages right, others left       |
| Colors        | Own messages: accent/blue bubble. Others: elevated bg |

### 4. Presence & Typing

- Show online users (green dot or list)
- Typing indicator: "Ana scrie..." when someone is typing

### 5. Storage & Persistence

| Aspect      | Decision                                                   |
| ----------- | ---------------------------------------------------------- |
| Persistence | Backend stores messages                                    |
| Retention   | Daily cleanup at midnight (cron job)                       |
| Rationale   | Messages survive page refresh but don't accumulate forever |

### 6. Scope

- Team-wide chat (entire organization)
- NOT per-case (no case linking)

---

## Rationale

### Why Stacked Layout (Option C)?

- Activity log is important for awareness but doesn't need constant interaction
- Chat input must be always visible to encourage quick communication
- Legal teams coordinate frequently while tracking case progress
- Collapsible activity gives flexibility when chat is the focus

### Why Ephemeral (Daily Cleanup)?

- Reduces storage burden
- Chat is for quick coordination, not record-keeping
- Important decisions should go in case notes, not chat
- Simpler compliance (no long-term message retention concerns)

### Why iMessage Style?

- Familiar pattern for most users
- Clear visual distinction between own and others' messages
- Works well in narrow panel widths

---

## Open Questions for Research

- [ ] Does bojin-law-2 backend have GraphQL subscriptions infrastructure?
- [ ] What WebSocket setup exists (Apollo subscriptions, socket.io, etc.)?
- [ ] How is user authentication/identity passed to subscriptions?
- [ ] Current user presence tracking mechanism (if any)?
- [ ] Best storage for ephemeral messages: Redis (with TTL) vs PostgreSQL (with cron)?
- [ ] What is the current "Activitate Echipă" component structure?

---

## Next Step

Start a new session and run:

```
/research brainstorm-team-chat
```
