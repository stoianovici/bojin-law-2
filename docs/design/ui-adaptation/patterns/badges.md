# Status Badges Pattern

> Extracted from: home-desktop.html, tasks-page.html, documents-page.html

## Status Dots

Small circular indicators showing state at a glance.

```
Size: 8px × 8px
Border-radius: 50%
```

| Status  | Color                        | Effect          |
| ------- | ---------------------------- | --------------- |
| Active  | `--status-success` (#22C55E) | Box-shadow glow |
| Pending | `--status-warning` (#F59E0B) | None            |
| At-risk | `--status-error` (#EF4444)   | Pulse animation |

**CSS:**

```css
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.status-dot.active {
  background: var(--status-success);
  box-shadow: 0 0 8px var(--status-success);
}

.status-dot.pending {
  background: var(--status-warning);
}

.status-dot.at-risk {
  background: var(--status-error);
  animation: pulse 2s infinite;
}
```

**Usage:** Case status in dashboard widgets, inline status indicators.

---

## Priority Bars

Vertical colored bars indicating task priority.

```
Size: 3px × 40px
Border-radius: 2px
```

| Priority | Color                         |
| -------- | ----------------------------- |
| Urgent   | `--priority-urgent` (#EF4444) |
| High     | `--priority-high` (#F97316)   |
| Medium   | `--priority-medium` (#EAB308) |
| Low      | `--priority-low` (#22C55E)    |

**Usage:** Left side of task items in task list.

---

## Priority Pills

Rounded badges with background + text color for inline priority display.

```
Padding: 2px 8px
Border-radius: 10px
Font-size: 11px
Font-weight: 500
```

| Priority | Background                 | Text    |
| -------- | -------------------------- | ------- |
| Urgent   | `rgba(239, 68, 68, 0.15)`  | #EF4444 |
| High     | `rgba(245, 158, 11, 0.15)` | #F59E0B |
| Medium   | `rgba(59, 130, 246, 0.15)` | #3B82F6 |

**Usage:** Task meta row in dashboard widgets, inline priority labels.

---

## Status Pills

Workflow status with dot + text label.

```
Padding: 4px 10px
Border-radius: 12px
Font-size: 11px
Font-weight: 500
```

| Status     | Dot Color | Background                  | Text    |
| ---------- | --------- | --------------------------- | ------- |
| Planificat | #71717A   | `rgba(113, 113, 122, 0.15)` | #71717A |
| În lucru   | #6366F1   | `rgba(99, 102, 241, 0.15)`  | #6366F1 |
| Review     | #A855F7   | `rgba(168, 85, 247, 0.15)`  | #A855F7 |
| Finalizat  | #22C55E   | `rgba(34, 197, 94, 0.15)`   | #22C55E |

**Structure:**

```html
<span class="task-status in-progress">
  <span class="task-status-dot"></span>
  În lucru
</span>
```

**Usage:** Task list items, task detail panel.

---

## File Type Badges

Colored badges indicating document type.

```
Position: absolute, top-right of thumbnail
Padding: 3px 8px
Border-radius: 6px
Font-size: 10px
Font-weight: 700
Text-transform: uppercase
Letter-spacing: 0.5px
```

| Type          | Background                 | Text    |
| ------------- | -------------------------- | ------- |
| PDF           | `rgba(239, 68, 68, 0.15)`  | #EF4444 |
| DOC/DOCX      | `rgba(59, 130, 246, 0.15)` | #3B82F6 |
| XLS/XLSX      | `rgba(34, 197, 94, 0.15)`  | #22C55E |
| IMG (JPG/PNG) | `rgba(245, 158, 11, 0.15)` | #F59E0B |

**Usage:** Document cards in documents page, attachment previews.

---

## Count Badges

Numeric badges for counts/notifications.

### Navigation Badge

```
Background: var(--bg-tertiary) or accent for active
Font-size: 11px
Padding: 2px 6px
Border-radius: 10px
```

### Status Toggle Badge

```
Min-width: 18px
Height: 18px
Padding: 0 5px
Border-radius: 9px
Font-size: 10px
Font-weight: 600
```

**Usage:** Sidebar nav items (unread count), status toggle buttons (Review/Final counts).
