# Mobile Component Patterns

> Adaptation of desktop components for mobile touch interfaces.

All components inherit desktop tokens. This document covers mobile-specific adaptations.

---

## 1. Cards

### Widget Card → Mobile Card

Desktop widget cards become full-width or inset cards.

**Desktop:**

```
┌─────────────────────────────┐
│ HEADER            [action]  │
├─────────────────────────────┤
│ Content                     │
└─────────────────────────────┘
```

**Mobile (Full-width):**

```
┌─────────────────────────────────────────────────┐
│ HEADER                                  [action]│
├─────────────────────────────────────────────────┤
│ Content                                         │
└─────────────────────────────────────────────────┘
```

```css
/* Full-width card (edge-to-edge) */
.card-mobile-full {
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-subtle);
  border-bottom: 1px solid var(--border-subtle);
  /* No horizontal border, no border-radius */
}

/* Inset card (with margins) */
.card-mobile-inset {
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  margin: 0 16px;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-bottom: 1px solid var(--border-subtle);
}

.card-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.card-action {
  font-size: 13px;
  color: var(--accent-primary);
  min-height: 44px;
  display: flex;
  align-items: center;
  padding: 0 8px;
  margin-right: -8px;
}

.card-body {
  padding: 16px;
}
```

---

### Case Item Card

For case lists.

**Desktop:** Row with columns
**Mobile:** Stacked card with key info

```
┌─────────────────────────────────────────────────┐
│ ● CAZ-2024-0156                         Activ   │
│ Ionescu vs. SC Alpha SRL                        │
│ Ionescu Maria                          4 zile   │
└─────────────────────────────────────────────────┘
```

```css
.case-card-mobile {
  padding: 16px;
  border-bottom: 1px solid var(--border-subtle);
  min-height: 72px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.case-card-mobile:active {
  background: var(--bg-hover);
}

.case-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.case-number {
  font-size: 12px;
  font-weight: 600;
  color: var(--accent-primary);
  font-family: var(--font-mono);
  display: flex;
  align-items: center;
  gap: 8px;
}

.case-status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.case-status-dot.active {
  background: var(--status-success);
}

.case-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.case-meta {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: var(--text-tertiary);
}
```

---

### Task Item

For task lists with checkbox, priority, and swipe actions.

```
┌─────────────────────────────────────────────────┐
│ [□] │ Titlu sarcină                    Mâine   │
│     │ CAZ-2024-0156 • Descriere...    [În lucru]│
└─────────────────────────────────────────────────┘
```

With swipe:

```
┌─────────────────────────────────────────────────┐
│ ← Șterge │ [□] │ Titlu sarcină         │ Gata → │
└─────────────────────────────────────────────────┘
```

```css
.task-item-mobile {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  min-height: 64px;
  border-bottom: 1px solid var(--border-subtle);
  background: var(--bg-secondary);
}

.task-item-mobile:active {
  background: var(--bg-hover);
}

.task-checkbox {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: -10px;
  flex-shrink: 0;
}

.task-checkbox-inner {
  width: 22px;
  height: 22px;
  border: 2px solid var(--border-strong);
  border-radius: 6px;
}

.task-checkbox-inner.checked {
  background: var(--status-success);
  border-color: var(--status-success);
}

.priority-bar {
  width: 3px;
  height: 40px;
  border-radius: 2px;
  flex-shrink: 0;
}

.priority-bar.urgent {
  background: var(--priority-urgent);
}
.priority-bar.high {
  background: var(--priority-high);
}
.priority-bar.medium {
  background: var(--priority-medium);
}
.priority-bar.low {
  background: var(--priority-low);
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

.task-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-tertiary);
}

.task-case-link {
  color: var(--accent-primary);
}

.task-due {
  margin-left: auto;
  font-size: 13px;
  color: var(--text-tertiary);
}

.task-due.overdue {
  color: var(--status-error);
}
```

---

### Document Card

Grid layout on mobile, 2 columns.

```
┌─────────────────────┐  ┌─────────────────────┐
│ [Thumbnail]    [PDF]│  │ [Thumbnail]   [DOCX]│
│─────────────────────│  │─────────────────────│
│ contract.pdf        │  │ cerere.docx         │
│ 2.1 MB              │  │ 512 KB              │
└─────────────────────┘  └─────────────────────┘
```

```css
.document-grid-mobile {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 16px;
}

.document-card-mobile {
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.document-card-mobile:active {
  border-color: var(--border-default);
}

.doc-thumbnail {
  aspect-ratio: 4/3;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}

.doc-type-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
}

.doc-type-badge.pdf {
  background: var(--status-error-bg);
  color: var(--status-error);
}

.doc-type-badge.docx {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.doc-info {
  padding: 12px;
}

.doc-name {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 2px;
}

.doc-size {
  font-size: 12px;
  color: var(--text-tertiary);
}
```

---

## 2. Badges

Same visual design as desktop, no size changes needed.

### Status Dot

```css
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
```

### Priority Pill

```css
.priority-pill {
  display: inline-flex;
  align-items: center;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.priority-pill.urgent {
  background: rgba(239, 68, 68, 0.15);
  color: var(--status-error);
}
```

### Status Pill

```css
.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 500;
}

.status-pill-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}
```

### Count Badge

Used on tabs, nav items.

```css
.count-badge {
  min-width: 18px;
  height: 18px;
  padding: 0 6px;
  background: var(--status-error);
  color: white;
  font-size: 11px;
  font-weight: 600;
  border-radius: 9px;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

---

## 3. Buttons

All buttons must meet 44px touch target minimum.

### Primary Button

```css
.btn-primary-mobile {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 52px;
  padding: 14px 20px;
  background: var(--accent-primary);
  color: white;
  border: none;
  border-radius: var(--radius-lg);
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary-mobile:active {
  background: var(--accent-primary-hover);
  transform: scale(0.98);
}
```

### Secondary Button

```css
.btn-secondary-mobile {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 52px;
  padding: 14px 20px;
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  font-size: 16px;
  font-weight: 500;
}

.btn-secondary-mobile:active {
  background: var(--bg-hover);
  transform: scale(0.98);
}
```

### Icon Button (Header)

```css
.icon-btn-mobile {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
}

.icon-btn-mobile:active {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.icon-btn-mobile svg {
  width: 24px;
  height: 24px;
}
```

### Floating Action Button

See [navigation.md](navigation.md) for FAB pattern.

### Action Pills (Filter, Toggle)

```css
.action-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  min-height: 40px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 20px;
  color: var(--text-secondary);
  font-size: 14px;
  font-weight: 500;
  white-space: nowrap;
}

.action-pill.active {
  background: var(--accent-secondary);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}

.action-pill:active {
  background: var(--bg-hover);
}
```

---

## 4. Form Inputs

All inputs must use 16px font to prevent iOS zoom.

### Text Input

```css
.input-mobile {
  width: 100%;
  min-height: 52px;
  padding: 14px 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: 16px;
  font-family: inherit;
}

.input-mobile::placeholder {
  color: var(--text-muted);
}

.input-mobile:focus {
  outline: none;
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--accent-secondary);
}

.input-mobile.error {
  border-color: var(--status-error);
}
```

### Select

```css
.select-mobile {
  width: 100%;
  min-height: 52px;
  padding: 14px 48px 14px 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: 16px;
  font-family: inherit;
  appearance: none;
  background-image: url('data:image/svg+xml,...'); /* Chevron */
  background-repeat: no-repeat;
  background-position: right 16px center;
  background-size: 20px;
}
```

### Textarea

```css
.textarea-mobile {
  width: 100%;
  min-height: 120px;
  padding: 14px 16px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  font-size: 16px;
  font-family: inherit;
  resize: none;
}
```

### Checkbox (Large Touch Area)

```css
.checkbox-mobile {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}

.checkbox-inner {
  width: 24px;
  height: 24px;
  border: 2px solid var(--border-strong);
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.checkbox-inner.checked {
  background: var(--accent-primary);
  border-color: var(--accent-primary);
}

.checkbox-inner.checked svg {
  color: white;
  width: 14px;
  height: 14px;
}
```

### Form Field with Label

```css
.form-field-mobile {
  margin-bottom: 20px;
}

.form-label-mobile {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-tertiary);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.form-label-mobile .required {
  color: var(--status-error);
  margin-left: 2px;
}

.form-error-mobile {
  font-size: 13px;
  color: var(--status-error);
  margin-top: 6px;
}

.form-helper-mobile {
  font-size: 13px;
  color: var(--text-muted);
  margin-top: 6px;
}
```

---

## 5. Lists

### Simple List

```css
.list-mobile {
  background: var(--bg-secondary);
}

.list-item-mobile {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  min-height: 52px;
  border-bottom: 1px solid var(--border-subtle);
}

.list-item-mobile:active {
  background: var(--bg-hover);
}

.list-item-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
  flex-shrink: 0;
}

.list-item-content {
  flex: 1;
  min-width: 0;
}

.list-item-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
}

.list-item-subtitle {
  font-size: 13px;
  color: var(--text-tertiary);
}

.list-item-chevron {
  width: 20px;
  height: 20px;
  color: var(--text-muted);
}
```

### Grouped List

With section headers.

```css
.list-section-header {
  padding: 8px 16px;
  background: var(--bg-primary);
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  position: sticky;
  top: 0;
}
```

---

## 6. Modals & Sheets

### Bottom Sheet

Primary pattern for mobile modals.

```css
.bottom-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-secondary);
  border-radius: 16px 16px 0 0;
  max-height: 90vh;
  z-index: 200;
  display: flex;
  flex-direction: column;
}

.sheet-drag-handle {
  width: 32px;
  height: 4px;
  background: var(--bg-hover);
  border-radius: 2px;
  margin: 8px auto 12px;
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 16px;
  border-bottom: 1px solid var(--border-subtle);
}

.sheet-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
}

.sheet-close {
  width: 44px;
  height: 44px;
  margin-right: -12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-tertiary);
}

.sheet-body {
  flex: 1;
  padding: 16px;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.sheet-footer {
  padding: 16px;
  padding-bottom: calc(16px + var(--safe-area-bottom));
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-tertiary);
}
```

### Action Sheet

For context menus.

```css
.action-sheet {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 8px;
  padding-bottom: calc(8px + var(--safe-area-bottom));
  z-index: 200;
}

.action-group {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  overflow: hidden;
  margin-bottom: 8px;
}

.action-item {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 16px;
  min-height: 56px;
  font-size: 17px;
  color: var(--text-primary);
  border-bottom: 1px solid var(--border-subtle);
}

.action-item:last-child {
  border-bottom: none;
}

.action-item:active {
  background: var(--bg-hover);
}

.action-item.destructive {
  color: var(--status-error);
}

.action-cancel {
  font-weight: 600;
}
```

### Toast

Same as desktop, positioned at bottom.

```css
.toast-container-mobile {
  position: fixed;
  bottom: calc(100px + var(--safe-area-bottom));
  left: 16px;
  right: 16px;
  z-index: 300;
}

.toast-mobile {
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
}
```

---

## 7. Empty & Loading States

### Empty State

Centered, with optional action.

```css
.empty-state-mobile {
  padding: 48px 24px;
  text-align: center;
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 20px;
  background: var(--accent-secondary);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-primary);
}

.empty-icon svg {
  width: 28px;
  height: 28px;
}

.empty-title {
  font-size: 17px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.empty-description {
  font-size: 15px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 24px;
}
```

### Loading Spinner

```css
.spinner-mobile {
  width: 32px;
  height: 32px;
  border: 3px solid var(--bg-tertiary);
  border-top-color: var(--accent-primary);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.loading-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  padding: 48px 24px;
}

.loading-text {
  font-size: 14px;
  color: var(--text-secondary);
}
```

### Skeleton

```css
.skeleton-mobile {
  background: linear-gradient(
    90deg,
    var(--bg-tertiary) 0%,
    var(--bg-hover) 50%,
    var(--bg-tertiary) 100%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: 6px;
}

.skeleton-text {
  height: 16px;
  margin-bottom: 8px;
}

.skeleton-title {
  height: 22px;
  width: 60%;
  margin-bottom: 12px;
}

.skeleton-card {
  height: 72px;
  margin-bottom: 1px;
}
```

---

## Component Comparison Table

| Component     | Desktop          | Mobile Adaptation        |
| ------------- | ---------------- | ------------------------ |
| Widget card   | 300px min-width  | Full-width or 2-col grid |
| Case item     | Table row        | Stacked card             |
| Task item     | Row with columns | Row with priority bar    |
| Document card | 5-col grid       | 2-col grid               |
| Button        | 36-40px height   | 48-52px height           |
| Input         | 40px height      | 52px height, 16px font   |
| Modal         | Center overlay   | Bottom sheet             |
| Dropdown      | Popover          | Action sheet             |
| Sidebar nav   | 240px fixed      | Bottom tab bar           |
