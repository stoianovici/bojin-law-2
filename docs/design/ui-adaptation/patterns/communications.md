# Communications Page Pattern

**Status**: Discovery Complete
**Reference**: `docs/design/linear-style-communications-v2.html`
**Mockup**: `docs/design/ui-adaptation/mockups/communications-v3.html`

## Layout Decision

**2-column layout** (remove right context panel):

- Case Sidebar (320px fixed)
- Message Panel (flex-1)
- ❌ No right panel (AI assistant, summary, case info - not needed)

## Page Header

| Current                          | Decision                                                                |
| -------------------------------- | ----------------------------------------------------------------------- |
| Sync button + status             | **Keep** - essential functionality                                      |
| View toggle (Conversation/Cards) | **Keep** - user preference                                              |
| Outlook link                     | **Keep** - quick access to compose in Outlook                           |
| Backfill Folders button          | **Remove** - admin-only, not frequently used                            |
| MS reconnect prompt              | **Remove** - rely on background sync, show reconnect inline when needed |
| Sync prompt (when no emails)     | **Remove** - sync should happen automatically                           |

## Case Sidebar (Left Panel)

Keep all current functionality with Linear styling:

| Feature                             | Status                       |
| ----------------------------------- | ---------------------------- |
| Search bar                          | Keep                         |
| DOSARE section (cases with threads) | Keep - expandable case items |
| FOLDERE OUTLOOK section             | Keep                         |
| INSTANȚE section (court emails)     | Keep                         |
| NECLAR section (uncertain emails)   | Keep                         |
| Thread selection                    | Keep                         |
| Move thread functionality           | Keep                         |
| Load more support                   | Keep                         |

## Message Panel (Center)

### Header Section

**Current Structure**:

```
ConversationHeader:
├── Subject + New Compose button
├── Metadata row:
│   ├── Case badge
│   ├── Participants
│   └── Message counts
```

**Target Structure** (add attachments):

```
Message Header:
├── Subject
├── Case link (clickable to case page)
├── Participants (with avatars)
├── Attachments row (if any) ← NEW
└── Action buttons (archive, bookmark, more)
```

### Attachments Display

**Current**: AttachmentPreviewPanel slides in from right
**Target**: Inline row below participants

```
┌─────────────────────────────────────────────┐
│ Subject                           [actions] │
│ Case: CAZ-2024-0156 • Ionescu vs. Alpha SRL │
│ 👤 Ionescu Maria, Alexandru Bojin           │
├─────────────────────────────────────────────┤
│ 📎 Contract_125.pdf (2.1MB)  📎 Facturi.xlsx│  ← Inline attachments
└─────────────────────────────────────────────┘
```

- Click attachment → DocumentPreviewModal (existing)
- Compact display with file type icons
- Scrollable if many attachments

### Banners

Keep existing banners (simplified styling):

- Private email indicator
- Unassigned email banner
- Multi-case confirmation banner

### Messages Area

Keep ConversationBubble component:

- Chat-style bubbles (sent right-aligned, received left-aligned)
- Message metadata (sender, timestamp)
- Per-message attachments (keep current)
- Hover actions (reply, forward, more)

### Action Bar → Inline Compose

**Current**: Action bar with buttons (Reply, Forward, Notify, Privat) + ComposeInterface modal

**Target**: Inline compose area at bottom, always visible

```
┌─────────────────────────────────────────────┐
│ [toolbar: bold, italic, link, AI, attach]   │
├─────────────────────────────────────────────┤
│                                             │
│ Compose area (textarea)                     │
│                                             │
├─────────────────────────────────────────────┤
│ [Cmd+Enter to send]           [Send button] │
└─────────────────────────────────────────────┘
```

**Compose Functionality to Preserve**:

1. To/Subject fields (pre-filled for reply)
2. AI draft generation with tone selection (Formal, Professional, Brief)
3. Include original message toggle (for replies)
4. Attachment upload (max 3MB per file, max 10 files)
5. Auto-save draft every 30 seconds
6. Manual save draft
7. Send via MS Graph (or save to Drafts)
8. Validation (to, subject, body required)

**Compose Modes**:

- Reply: Pre-filled to/subject, show AI draft panel
- Forward: Pre-filled subject
- New: Empty fields

**NECLAR Mode Action Bar**:
Keep specialized action bar for NECLAR emails:

- SplitAssignmentButton or CasePickerDropup
- Răspunde (opens Outlook)
- Privat (blocks sender)

## Decisions Summary

### Layout

1. **2-column**: Case sidebar + message panel (no right panel)
2. **Sidebar width**: 320px fixed

### Header

1. **Sync**: Keep sync button + status
2. **View toggle**: Keep Conversation/Cards toggle
3. **Outlook link**: Keep
4. **Remove**: Backfill button, MS reconnect prompt, sync prompt

### Attachments

1. **Location**: Inline in message header, below participants
2. **Interaction**: Click to preview (DocumentPreviewModal)
3. **Display**: Compact row with file icons and sizes

### Compose

1. **Style**: Inline at bottom of message panel (not modal)
2. **Always visible**: Show compose area when thread is selected
3. **AI draft**: Keep - expandable panel above textarea
4. **Attachments**: Keep drag-drop + file picker
5. **NECLAR mode**: Keep specialized action bar (assignment buttons)

## Implementation Notes

1. Refactor ComposeInterface from modal to inline component
2. Move thread attachments from right panel to message header
3. Simplify page header (remove conditional prompts)
4. Apply Linear design tokens throughout

## Session Notes

### Session 2 (2024-12-29)

- Compared mockup to current implementation
- Decided on 2-column layout (no right panel)
- Attachments move to message header inline
- Compose becomes inline (not modal) while keeping all functionality
- Remove conditional prompts from header (rely on background sync)
