# Cards Pattern

> Extracted from: home-desktop.html, tasks-page.html, documents-page.html

## Widget Card

Standard card for dashboard widgets and content sections.

```
Background: var(--bg-secondary)
Border: 1px solid var(--border-subtle)
Border-radius: 12px (--radius-lg)
Overflow: hidden
```

**Hover State:**

```css
.card:hover {
  border-color: var(--border-default);
  box-shadow: var(--shadow-md);
}
```

### Structure

```
┌─────────────────────────────────────┐
│ HEADER                              │
│ [icon] Title            [actions]   │
├─────────────────────────────────────┤
│ BODY                                │
│                                     │
│ [content]                           │
│                                     │
└─────────────────────────────────────┘
```

### Header

```css
.card-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}
```

### Body

```css
.card-body {
  padding: 16px 20px;
}
```

### Actions

```css
.card-action-btn {
  font-size: 12px;
  color: var(--text-tertiary);
  background: transparent;
  border: none;
  padding: 4px 8px;
  border-radius: 6px;
}

.card-action-btn:hover {
  color: var(--text-primary);
  background: var(--bg-hover);
}
```

---

## Document Card

Card for displaying documents in grid view.

```
Background: var(--bg-secondary)
Border: 1px solid var(--border-subtle)
Border-radius: 12px
Cursor: pointer
```

**Hover State:**

```css
.doc-card:hover {
  border-color: var(--border-default);
  box-shadow: var(--shadow-md);
  transform: translateY(-2px);
}
```

**Selected State:**

```css
.doc-card.selected {
  border: 2px dashed var(--accent-primary);
}
```

### Structure

```
┌─────────────────────────────┐
│ [Thumbnail/Preview]    [PDF]│  ← file type badge
├─────────────────────────────┤
│ filename.pdf                │
│ 2.1 MB          [Mapă][Word]│  ← size + actions
└─────────────────────────────┘
```

### Thumbnail

```css
.doc-thumbnail {
  aspect-ratio: 4/3;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
```

### Info Section

```css
.doc-info {
  padding: 12px;
  border-top: 1px solid var(--border-subtle);
}

.doc-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 4px;
}

.doc-size {
  font-size: 12px;
  color: var(--text-tertiary);
}
```

### Action Buttons

```css
.action-btn {
  padding: 4px 8px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 6px;
  color: var(--text-tertiary);
  font-size: 11px;
}
```

---

## Task Item

Row-based card for task lists.

```
Background: var(--bg-secondary)
Border: 1px solid transparent
Border-radius: 8px
Padding: 12px 16px
```

**Hover State:**

```css
.task-item:hover {
  background: var(--bg-hover);
}
```

**Selected State:**

```css
.task-item.selected {
  background: var(--bg-selected);
  border-color: var(--accent);
}
```

**Completed State:**

```css
.task-item.completed .task-title {
  color: var(--text-muted);
  text-decoration: line-through;
}
```

### Structure

```
┌──────────────────────────────────────────────────────────────┐
│ [□] │ │ Title                         │ [Status] │ Due │ [AB]│
│     │ │ CAZ-XXX • Description         │          │     │     │
└──────────────────────────────────────────────────────────────┘
  ↑     ↑
checkbox  priority bar
```

### Checkbox

```css
.task-checkbox {
  width: 18px;
  height: 18px;
  border: 1.5px solid var(--border-default);
  border-radius: 4px;
  flex-shrink: 0;
}

.task-checkbox:hover {
  border-color: var(--accent);
}

.task-checkbox.checked {
  background: var(--status-done);
  border-color: var(--status-done);
}
```

### Content

```css
.task-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.task-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
}

.task-case {
  color: var(--accent);
}
```

---

## Case Item

Minimal row for case lists in dashboard widgets.

### Structure

```
┌─────────────────────────────────────────┐
│ CAZ-2024-0156                       [●] │
│ Ionescu vs. SC Alpha SRL                │
│ Ionescu Maria                           │
└─────────────────────────────────────────┘
```

### Styling

```css
.case-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid var(--border-subtle);
  cursor: pointer;
}

.case-number {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-primary);
  font-family: var(--font-mono);
}

.case-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.case-client {
  font-size: 12px;
  color: var(--text-tertiary);
}
```

---

## Briefing Card

Special card for morning briefing with accent top border.

```css
.briefing-card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 20px;
  position: relative;
  overflow: hidden;
}

.briefing-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--gradient-accent);
  opacity: 0.5;
}
```

### Stats Row

```css
.briefing-stats {
  display: flex;
  gap: 24px;
  margin-top: 20px;
  padding-top: 16px;
  border-top: 1px solid var(--border-subtle);
}

.briefing-stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

.briefing-stat-label {
  font-size: 12px;
  color: var(--text-tertiary);
}
```
