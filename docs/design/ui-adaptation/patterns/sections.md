# Collapsible Sections Pattern

> Extracted from: tasks-page.html, documents-page.html

## Task Sections

Grouping tasks by urgency/time period.

### Structure

```
[▼] URGENTE  2  ───────────────────────
├── Task item 1
└── Task item 2

[▼] ACEASTĂ SĂPTĂMÂNĂ  4  ─────────────
├── Task item 3
├── Task item 4
├── Task item 5
└── Task item 6

[▶] FINALIZATE RECENT  2  ─────────────
    (collapsed)
```

### Styling

```css
.task-section {
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  cursor: pointer;
}

.section-toggle {
  width: 16px;
  height: 16px;
  color: var(--text-tertiary);
  transition: transform 0.15s ease;
}

.section-toggle.collapsed {
  transform: rotate(-90deg);
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-count {
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 10px;
}

.task-list {
  display: flex;
  flex-direction: column;
  gap: 1px;
}
```

### Section Groups (Tasks)

| Section           | Purpose                    |
| ----------------- | -------------------------- |
| URGENTE           | Tasks due today or overdue |
| ACEASTĂ SĂPTĂMÂNĂ | Tasks due this week        |
| FINALIZATE RECENT | Completed in last 7 days   |

---

## Period Sections (Documents)

Grouping documents by time period.

### Structure

```
[▼] ACEASTĂ SĂPTĂMÂNĂ  4 documente  ─────────
[Document grid]

[▼] DECEMBRIE 2024  6 documente  ────────────
[Document grid]

[▶] NOIEMBRIE 2024  8 documente  ────────────
    (collapsed)
```

### Styling

```css
.period-section {
  margin-bottom: 24px;
}

.period-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 0;
  margin-bottom: 16px;
  cursor: pointer;
  user-select: none;
}

.period-header:hover .period-title {
  color: var(--text-primary);
}

.period-expand {
  width: 16px;
  height: 16px;
  color: var(--text-tertiary);
  transition: transform 0.15s ease;
}

.period-expand.collapsed {
  transform: rotate(-90deg);
}

.period-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-tertiary);
  transition: color 0.15s ease;
}

.period-count {
  font-size: 11px;
  color: var(--text-muted);
  margin-left: 8px;
}

.period-line {
  flex: 1;
  height: 1px;
  background: var(--border-subtle);
  margin-left: 12px;
}

.document-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
}

.document-grid.collapsed {
  display: none;
}
```

### Default States

| Section           | Default   |
| ----------------- | --------- |
| Această săptămână | Expanded  |
| Current month     | Expanded  |
| Older months      | Collapsed |

---

## Folder Tree (Sidebar)

Expandable folder structure in case sidebar.

### Structure

```
[▶] Ionescu vs. Alpha SRL  24
    ├── Toate documentele   24
    ├── Contracte           8
    ├── Probe               12
    └── Acte Procedurale    4

[▶] Contract Beta Corp  16
[▶] TechStart SRL  9
```

### Styling

```css
.case-item {
  margin-bottom: 4px;
}

.case-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  cursor: pointer;
}

.case-header:hover {
  background: var(--bg-hover);
}

.case-header.active {
  background: var(--accent-secondary);
}

.case-expand {
  width: 16px;
  height: 16px;
  color: var(--text-tertiary);
  transition: transform 0.15s ease;
}

.case-expand.expanded {
  transform: rotate(90deg);
}

.case-name {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.case-count {
  font-size: 11px;
  color: var(--text-tertiary);
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 10px;
}

.folder-tree {
  padding-left: 16px;
}

.folder-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-secondary);
}

.folder-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.folder-item.active {
  background: var(--accent-secondary);
  color: var(--accent-primary);
}
```

---

## Expand/Collapse Icons

| Direction         | Icon          | Transform                     |
| ----------------- | ------------- | ----------------------------- |
| Down (expanded)   | Chevron down  | `rotate(0deg)`                |
| Right (collapsed) | Chevron down  | `rotate(-90deg)`              |
| Right → Down      | Chevron right | `rotate(90deg)` when expanded |

```css
.toggle-icon {
  transition: transform 0.15s ease;
}

.toggle-icon.collapsed {
  transform: rotate(-90deg);
}
```
