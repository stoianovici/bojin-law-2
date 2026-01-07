# Mobile Tasks Page

> Task list and task management for mobile.

## 1. Tasks List

### Layout

```
┌─────────────────────────────────────────────────┐
│ [safe area]                                     │
├─────────────────────────────────────────────────┤
│ Sarcini                                [🔍] [⋮] │
├─────────────────────────────────────────────────┤
│ [Toate] [Urgente] [Azi] [Săptămâna] [Finalizate]│
├─────────────────────────────────────────────────┤
│                                                 │
│ ▼ URGENTE                                    2  │
│ ┌─────────────────────────────────────────────┐ │
│ │ [□] │ Revizuire contract Alpha     Azi 14:00│ │
│ │     │ CAZ-2024-0156           [●] În lucru  │ │
│ ├─────────────────────────────────────────────┤ │
│ │ [□] │ Depunere cerere instanță     Expirat  │ │
│ │     │ CAZ-2024-0142           [●] Planificat│ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ▼ ACEASTĂ SĂPTĂMÂNĂ                          4  │
│ ┌─────────────────────────────────────────────┐ │
│ │ [□] │ Pregătire documente          Mar 14   │ │
│ │     │ CAZ-2024-0156           [●] Planificat│ │
│ ├─────────────────────────────────────────────┤ │
│ │ [□] │ Întâlnire client              Joi 10  │ │
│ │     │ CAZ-2024-0142           [●] Planificat│ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ▶ FINALIZATE RECENT                          3  │
│                                                 │
│                      [+]                        │ ← FAB
├─────────────────────────────────────────────────┤
│  🏠      📁      ✓      📄      ✉️           │
└─────────────────────────────────────────────────┘
```

### Components

#### Header

Standard page header with search and menu.

#### Filter Pills

```css
.task-filters {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  border-bottom: 1px solid var(--border-subtle);
}
```

#### Collapsible Sections

```css
.task-section {
  padding: 0 16px;
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 0;
}

.section-toggle {
  width: 44px;
  height: 44px;
  margin: -12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-count {
  margin-left: auto;
  font-size: 12px;
  color: var(--text-muted);
  background: var(--bg-tertiary);
  padding: 2px 8px;
  border-radius: 10px;
}

.section-list {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.section-list.collapsed {
  display: none;
}
```

#### Task Item

```css
.task-item {
  display: flex;
  align-items: flex-start;
  gap: 0;
  padding: 12px 16px;
  min-height: 64px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-secondary);
}

.task-item:last-child {
  border-bottom: none;
}

.task-item:active {
  background: var(--bg-hover);
}

.task-checkbox-area {
  width: 44px;
  height: 44px;
  margin: -8px 0 -8px -8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkbox {
  width: 22px;
  height: 22px;
  border: 2px solid var(--border-strong);
  border-radius: 6px;
}

.checkbox.checked {
  background: var(--status-success);
  border-color: var(--status-success);
}

.priority-indicator {
  width: 3px;
  height: 36px;
  border-radius: 2px;
  margin-right: 12px;
  flex-shrink: 0;
}

.task-content {
  flex: 1;
  min-width: 0;
}

.task-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.task-title.completed {
  color: var(--text-muted);
  text-decoration: line-through;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
}

.task-case {
  color: var(--accent-primary);
}

.task-status {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 500;
}

.task-due {
  margin-left: auto;
  font-size: 13px;
  color: var(--text-tertiary);
  text-align: right;
}

.task-due.overdue {
  color: var(--status-error);
  font-weight: 500;
}
```

### Swipe Actions

```
← Swipe Left →
┌─────────────────────────────────────────────────┐
│ [Șterge] │ Task content...          │ [Gata ✓] │
│  (red)   │                          │  (green) │
└─────────────────────────────────────────────────┘
```

```css
.swipe-container {
  position: relative;
  overflow: hidden;
}

.swipe-action-left {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 80px;
  background: var(--status-error);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.swipe-action-right {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 80px;
  background: var(--status-success);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}
```

### Interactions

| Action             | Result                       |
| ------------------ | ---------------------------- |
| Pull down          | Refresh list                 |
| Tap checkbox       | Toggle complete (optimistic) |
| Tap task row       | Open task detail sheet       |
| Swipe left         | Delete action                |
| Swipe right        | Complete action              |
| Long press         | Context menu                 |
| Section header tap | Toggle collapse              |
| FAB tap            | New task sheet               |

---

## 2. Task Detail Sheet

Bottom sheet for viewing/editing task.

```
┌─────────────────────────────────────────────────┐
│              [Content dimmed]                   │
├─────────────────────────────────────────────────┤
│       ═══════════════════                       │
│ Revizuire contract Alpha                   [×]  │
├─────────────────────────────────────────────────┤
│                                                 │
│ [□] Finalizat                                   │
│                                                 │
│ ─────────────────────────────────────────────── │
│                                                 │
│ DOSAR                                           │
│ CAZ-2024-0156 - Ionescu vs. Alpha SRL           │
│                                                 │
│ SCADENȚĂ                                        │
│ Azi, 14:00                                      │
│                                                 │
│ PRIORITATE                                      │
│ ● Urgent                                        │
│                                                 │
│ STATUS                                          │
│ [Planificat ▼]                                  │
│                                                 │
│ DESCRIERE                                       │
│ Verificare clauzelor contractuale...            │
│                                                 │
│ ─────────────────────────────────────────────── │
│                                                 │
│ SUBTASK-URI                           2/5       │
│ ├─ [✓] Citire contract                          │
│ ├─ [✓] Identificare clauze                      │
│ ├─ [□] Analiză riscuri                          │
│ ├─ [□] Propuneri modificări                     │
│ └─ [□] Redactare notă                           │
│                                                 │
│ [+ Adaugă subtask]                              │
│                                                 │
│ ─────────────────────────────────────────────── │
│                                                 │
│ ACTIVITATE                                      │
│ Azi 10:30 - Ana a adăugat descriere             │
│ Ieri - Alexandru a creat sarcina               │
│                                                 │
│                                                 │
│ [Adaugă comentariu...]                          │
│                                                 │
├─────────────────────────────────────────────────┤
│ [Șterge]                        [Salvează]      │
└─────────────────────────────────────────────────┘
```

### Components

```css
.task-detail-sheet {
  background: var(--bg-secondary);
  border-radius: 16px 16px 0 0;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}

.sheet-handle {
  width: 32px;
  height: 4px;
  background: var(--bg-hover);
  border-radius: 2px;
  margin: 8px auto 12px;
}

.task-detail-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 16px;
  border-bottom: 1px solid var(--border-subtle);
}

.task-detail-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  flex: 1;
}

.task-detail-body {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
}

.detail-section {
  margin-bottom: 20px;
}

.detail-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
}

.detail-value {
  font-size: 15px;
  color: var(--text-primary);
}

.subtask-list {
  margin-top: 8px;
}

.subtask-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 0;
}

.subtask-checkbox {
  width: 18px;
  height: 18px;
  border: 1.5px solid var(--border-default);
  border-radius: 4px;
}

.subtask-text {
  font-size: 14px;
  color: var(--text-primary);
}

.subtask-text.completed {
  color: var(--text-muted);
  text-decoration: line-through;
}

.task-detail-footer {
  padding: 16px;
  padding-bottom: calc(16px + var(--safe-area-bottom));
  border-top: 1px solid var(--border-subtle);
  display: flex;
  gap: 12px;
}
```

---

## 3. New Task Sheet

Bottom sheet for quick task creation.

```
┌─────────────────────────────────────────────────┐
│       ═══════════════════                       │
│ Sarcină nouă                               [×]  │
├─────────────────────────────────────────────────┤
│                                                 │
│ TITLU *                                         │
│ [Ce trebuie făcut?                            ] │
│                                                 │
│ DOSAR                                           │
│ [Selectează dosar...                        ▼] │
│                                                 │
│ SCADENȚĂ                                        │
│ [Fără scadență                              ▼] │
│                                                 │
│ PRIORITATE                                      │
│ ○ Urgent  ○ High  ● Medium  ○ Low              │
│                                                 │
│ DESCRIERE (opțional)                            │
│ [Detalii adiționale...                        ] │
│                                                 │
├─────────────────────────────────────────────────┤
│ ⌘+Enter salvează             [Anulează][Crează] │
└─────────────────────────────────────────────────┘
```

### Form Fields

- Title (required)
- Case (optional, picker)
- Due date (optional, date picker)
- Priority (segmented control)
- Description (optional, textarea)

---

## 4. Kanban View (Alternative)

If user prefers kanban, swipe between columns.

```
┌─────────────────────────────────────────────────┐
│ Sarcini                          [List] [Kanban]│
├─────────────────────────────────────────────────┤
│ ← PLANIFICAT │ ÎN LUCRU │ REVIEW → (swipe)     │
├─────────────────────────────────────────────────┤
│                                                 │
│         ÎN LUCRU (3)                            │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ Revizuire contract                          │ │
│ │ CAZ-2024-0156                     Azi 14:00 │ │
│ │                               [AB]          │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ Pregătire documente                         │ │
│ │ CAZ-2024-0142                      Mar 14   │ │
│ │                               [MC]          │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Interactions

- Horizontal swipe between columns
- Tap card to open detail
- Long press + drag to move between columns (or use menu)

---

## States

### Loading

Skeleton for:

- Section headers (1 per section)
- Task items (3 per visible section)

### Empty

**No tasks:**

```
┌─────────────────────────────────────────────────┐
│                                                 │
│              [✓]                                │
│                                                 │
│         Nicio sarcină                           │
│                                                 │
│    Nu aveți sarcini în această vizualizare.     │
│                                                 │
│           [+ Creează sarcină]                   │
│                                                 │
└─────────────────────────────────────────────────┘
```

**All done:**

```
┌─────────────────────────────────────────────────┐
│                                                 │
│              [🎉]                               │
│                                                 │
│         Totul e rezolvat!                       │
│                                                 │
│    Nu ai sarcini urgente sau scadente.          │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Comparison: Desktop vs Mobile

| Aspect       | Desktop                      | Mobile                |
| ------------ | ---------------------------- | --------------------- |
| Layout       | List with fixed detail panel | List + detail sheet   |
| Sections     | Collapsible, all visible     | Collapsible, scroll   |
| Task actions | Inline buttons               | Swipe + long press    |
| New task     | Modal                        | Bottom sheet          |
| Kanban       | Side-by-side columns         | Swipe between columns |
| Subtasks     | In detail panel              | In detail sheet       |
| Priority     | Colored bar                  | Colored bar (same)    |
