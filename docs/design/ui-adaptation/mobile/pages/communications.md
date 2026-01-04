# Mobile Communications Page

> Email and messaging interface for mobile.

## Overview

Communications is the most complex page to adapt. Desktop uses a 3-panel layout (sidebar + list + detail) which must become a single-panel progressive disclosure on mobile.

## 1. Email List

### Layout

```
┌─────────────────────────────────────────────────┐
│ [safe area]                                     │
├─────────────────────────────────────────────────┤
│ Mesaje                           [🔍] [🔄] [⋮] │
├─────────────────────────────────────────────────┤
│ [Toate] [Primite] [Trimise] [Ciorne]            │
├─────────────────────────────────────────────────┤
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ De la: Ionescu Maria                   Azi  │ │
│ │ RE: Întâlnire programată pentru marți       │ │
│ │ Vă confirm prezența la întâlnirea de...     │ │
│ │ [CAZ-2024-0156]                        📎   │ │
│ ├─────────────────────────────────────────────┤ │
│ │ De la: SC Alpha SRL                   Ieri  │ │
│ │ Documente solicitate                        │ │
│ │ Vă rugăm să ne transmiteți...               │ │
│ │ [CAZ-2024-0156]                        📎   │ │
│ ├─────────────────────────────────────────────┤ │
│ │ Către: Beta Corp                     27 Dec │ │
│ │ Ofertă servicii juridice                    │ │
│ │ Bună ziua, vă transmitem oferta...          │ │
│ │                                             │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│                      [+]                        │ ← FAB (Compose)
├─────────────────────────────────────────────────┤
│  🏠      📁      ✓      📄      ✉️           │
└─────────────────────────────────────────────────┘
```

### Components

#### Header

```css
.messages-header {
  background: var(--bg-secondary);
  padding: 16px;
  padding-top: calc(16px + var(--safe-area-top));
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-subtle);
}

.messages-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
}

.sync-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.sync-btn.syncing svg {
  animation: spin 1s linear infinite;
}
```

#### View Filter

```css
.view-filter {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  overflow-x: auto;
  border-bottom: 1px solid var(--border-subtle);
}

.view-pill {
  flex-shrink: 0;
  padding: 8px 16px;
  border-radius: 20px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
}

.view-pill.active {
  background: var(--accent-secondary);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}
```

#### Email Item

```css
.email-item {
  padding: 16px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-secondary);
}

.email-item.unread {
  background: rgba(94, 106, 210, 0.05);
}

.email-item:active {
  background: var(--bg-hover);
}

.email-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.email-sender {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.email-item.unread .email-sender {
  color: var(--accent-primary);
}

.email-date {
  font-size: 12px;
  color: var(--text-tertiary);
}

.email-subject {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 4px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.email-preview {
  font-size: 13px;
  color: var(--text-tertiary);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.email-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
}

.email-case-badge {
  padding: 2px 8px;
  border-radius: 10px;
  background: var(--accent-secondary);
  color: var(--accent-primary);
  font-size: 11px;
  font-weight: 500;
}

.email-attachment-icon {
  color: var(--text-muted);
  margin-left: auto;
}
```

### Interactions

| Action     | Result                                         |
| ---------- | ---------------------------------------------- |
| Pull down  | Sync emails                                    |
| Tap email  | Push to email detail                           |
| Swipe left | Archive action                                 |
| Long press | Context menu (reply, forward, archive, delete) |
| FAB tap    | Compose new email                              |

---

## 2. Email Detail

### Layout

```
┌─────────────────────────────────────────────────┐
│ [safe area]                                     │
├─────────────────────────────────────────────────┤
│ [←]                              [⬅][➡][🗑][⋮] │
├─────────────────────────────────────────────────┤
│                                                 │
│ RE: Întâlnire programată pentru marți           │
│                                                 │
│ ─────────────────────────────────────────────── │
│                                                 │
│ [👤] Ionescu Maria              Azi, 14:30      │
│      ionescu.maria@email.ro                     │
│                                                 │
│ Către: alexandru@bojin-law.ro                   │
│ Cc: ana@bojin-law.ro                            │
│                                                 │
│ 📎 2 atașamente                          [▼]    │
│ ├─ contract-draft.pdf (2.1 MB)                  │
│ └─ calcul-costuri.xlsx (512 KB)                 │
│                                                 │
│ ─────────────────────────────────────────────── │
│                                                 │
│ Bună ziua domnule Bojin,                        │
│                                                 │
│ Vă confirm prezența la întâlnirea programată    │
│ pentru marți, 30 decembrie, ora 10:00.          │
│                                                 │
│ Am atașat documentele discutate telefonic:      │
│ - Proiectul de contract revizuit                │
│ - Calculul costurilor estimate                  │
│                                                 │
│ Vă mulțumesc pentru disponibilitate.            │
│                                                 │
│ Cu stimă,                                       │
│ Ionescu Maria                                   │
│                                                 │
├─────────────────────────────────────────────────┤
│ [↩ Răspunde]    [↩↩ Răspunde tuturor]    [↪ Redir.]│
└─────────────────────────────────────────────────┘
```

### Components

```css
.email-detail {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.email-detail-header {
  background: var(--bg-secondary);
  padding: 16px;
  padding-top: calc(16px + var(--safe-area-top));
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid var(--border-subtle);
}

.email-nav-btns {
  display: flex;
  gap: 4px;
  margin-left: auto;
}

.email-nav-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
}

.email-nav-btn:active {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.email-content {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.email-detail-subject {
  font-size: 20px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 16px;
}

.email-sender-info {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.sender-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--gradient-accent);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 14px;
  font-weight: 600;
}

.sender-details {
  flex: 1;
}

.sender-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.sender-email {
  font-size: 12px;
  color: var(--text-tertiary);
}

.recipients {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 4px;
}

.email-date-detail {
  font-size: 12px;
  color: var(--text-tertiary);
  text-align: right;
}

.attachments-section {
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
  padding: 12px;
  margin-bottom: 16px;
}

.attachments-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-secondary);
}

.attachment-list {
  margin-top: 8px;
}

.attachment-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  font-size: 13px;
  color: var(--text-primary);
}

.attachment-item:active {
  color: var(--accent-primary);
}

.email-body {
  font-size: 15px;
  line-height: 1.6;
  color: var(--text-primary);
  white-space: pre-wrap;
}

.email-actions {
  display: flex;
  gap: 12px;
  padding: 16px;
  padding-bottom: calc(16px + var(--safe-area-bottom));
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-secondary);
}

.email-action-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px;
  min-height: 48px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
}

.email-action-btn:active {
  background: var(--bg-hover);
}
```

### Interactions

| Action         | Result                      |
| -------------- | --------------------------- |
| Back           | Pop to list                 |
| ⬅/➡          | Navigate prev/next email    |
| Trash          | Delete email (confirmation) |
| Attachment tap | Open/download attachment    |
| Reply buttons  | Open compose with context   |

---

## 3. Compose Email

Full screen compose view.

### Layout

```
┌─────────────────────────────────────────────────┐
│ [safe area]                                     │
├─────────────────────────────────────────────────┤
│ [×]  Email nou                          [Trimite]│
├─────────────────────────────────────────────────┤
│                                                 │
│ CĂTRE *                                         │
│ [ionescu.maria@email.ro              ] [+]      │
│                                                 │
│ CC                                              │
│ [Adaugă destinatari...                ] [+]     │
│                                                 │
│ SUBIECT *                                       │
│ [RE: Întâlnire programată                     ] │
│                                                 │
│ DOSAR (opțional)                                │
│ [CAZ-2024-0156 - Ionescu vs. Alpha        ▼]   │
│                                                 │
│ ─────────────────────────────────────────────── │
│                                                 │
│ [Mesaj...                                     ] │
│                                                 │
│                                                 │
│                                                 │
│ ─────────────────────────────────────────────── │
│                                                 │
│ ATAȘAMENTE                                      │
│ ├─ [📄] document.pdf (2.1 MB)           [×]    │
│ [+ Adaugă atașament]                            │
│                                                 │
│ ─────────────────────────────────────────────── │
│                                                 │
│ [🤖 Generează cu AI]                            │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Components

```css
.compose-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  background: var(--bg-primary);
}

.compose-header {
  background: var(--bg-secondary);
  padding: 16px;
  padding-top: calc(16px + var(--safe-area-top));
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-subtle);
}

.compose-close {
  width: 44px;
  height: 44px;
  margin-left: -8px;
}

.compose-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
}

.compose-send {
  padding: 10px 16px;
  background: var(--accent-primary);
  color: white;
  border-radius: var(--radius-md);
  font-size: 15px;
  font-weight: 500;
}

.compose-send:disabled {
  opacity: 0.5;
}

.compose-body {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.compose-field {
  margin-bottom: 16px;
}

.compose-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.compose-input {
  width: 100%;
  min-height: 48px;
  padding: 12px 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: 16px;
}

.compose-textarea {
  min-height: 200px;
  resize: none;
}

.ai-draft-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: var(--accent-secondary);
  border: 1px solid rgba(94, 106, 210, 0.3);
  border-radius: var(--radius-lg);
  color: var(--accent-primary);
  font-size: 14px;
  font-weight: 500;
}

.ai-draft-btn svg {
  box-shadow: 0 0 12px var(--accent-glow);
}
```

### AI Draft Flow

1. Tap "Generează cu AI"
2. Bottom sheet opens with prompt options
3. Select template or describe email
4. AI generates draft inline
5. User reviews and edits

---

## 4. Case Context

When viewing messages within a case detail.

Uses same list components but filtered to case.

---

## States

### Syncing

```css
.sync-indicator {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  background: var(--accent-secondary);
  font-size: 13px;
  color: var(--accent-primary);
}
```

### Empty

```
┌─────────────────────────────────────────────────┐
│                                                 │
│              [✉️]                               │
│                                                 │
│         Niciun mesaj                            │
│                                                 │
│    Nu aveți mesaje în această categorie.        │
│                                                 │
│           [Sincronizează acum]                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Error (Sync Failed)

Toast notification with retry action.

---

## Comparison: Desktop vs Mobile

| Aspect        | Desktop                           | Mobile                      |
| ------------- | --------------------------------- | --------------------------- |
| Layout        | 3-panel (sidebar + list + detail) | List → Detail push          |
| Email list    | Sidebar + main area               | Full screen list            |
| Email detail  | Right panel                       | Full screen push            |
| Compose       | Modal overlay                     | Full screen                 |
| Attachments   | Inline in detail panel            | Collapsible section         |
| Context panel | Always visible                    | Hidden (case badge instead) |
| Sync button   | Header                            | Header (same)               |
| AI draft      | Inline panel                      | Bottom sheet                |
