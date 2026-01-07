# Modals & Dialogs Pattern

> Extracted from: tasks-new-task.html, command-palette.html, card-modal-components.html, modals-exploration.html

## Overview

Five modal patterns, each for specific use cases:

| Pattern             | Width     | Position     | Backdrop | Use Case                         |
| ------------------- | --------- | ------------ | -------- | -------------------------------- |
| Confirmation Dialog | 400px     | Center       | 80%      | Destructive/irreversible actions |
| Form Modal          | 520-560px | Center       | 80%      | Create/edit entities             |
| Command Palette     | 520px     | Top-center   | 60%      | Global search & quick actions    |
| Slide-Over          | 400px     | Right edge   | 60%      | View/edit with context           |
| Toast               | 380px     | Bottom-right | None     | Ephemeral feedback               |

---

## 1. Confirmation Dialog

For destructive or irreversible actions: delete, disconnect, logout.

### Structure

```
┌─────────────────────────────────────┐
│ [!] Icon (colored by severity)      │
│                                     │
│ Title                               │
│ Description text explaining         │
│ consequences of the action.         │
│                                     │
│              [Cancel] [Danger Btn]  │
└─────────────────────────────────────┘
```

### Styling

```css
.modal-confirm {
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 16px;
  padding: 24px;
  width: 400px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}

.modal-confirm-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* Icon colors by severity */
.modal-confirm-icon.danger {
  background: rgba(239, 68, 68, 0.15);
  color: var(--danger);
}

.modal-confirm-icon.warning {
  background: rgba(245, 158, 11, 0.15);
  color: var(--warning);
}

.modal-confirm-icon.info {
  background: var(--accent-muted);
  color: var(--accent);
}
```

### Title & Description

```css
.modal-confirm h3 {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.modal-confirm p {
  font-size: 14px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 24px;
}
```

### Actions

```css
.modal-confirm-actions {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}
```

**Button order:** Secondary (Cancel) → Primary/Danger (Action)

---

## 2. Form Modal

For creating or editing entities: tasks, cases, time entries, notes.

### Structure

```
┌─────────────────────────────────────────┐
│ HEADER: Title                       [×] │
├─────────────────────────────────────────┤
│ BODY (scrollable)                       │
│                                         │
│ [Title input - larger]                  │
│                                         │
│ [Description textarea]                  │
│                                         │
│ ─────────────────────────               │
│                                         │
│ [Field]          [Field]                │
│ [Field]          [Field]                │
│                                         │
├─────────────────────────────────────────┤
│ FOOTER: ⌘+Enter saves    [Cancel][Save] │
└─────────────────────────────────────────┘
```

### Container

```css
.modal-form {
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  width: 520px;
  max-width: 90vw;
  max-height: 90vh;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
```

### Header

```css
.modal-form-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.modal-form-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.modal-close {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-tertiary);
  border-radius: 6px;
  cursor: pointer;
}

.modal-close:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}
```

### Body

```css
.modal-form-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.form-group {
  margin-bottom: 20px;
}

.form-group:last-child {
  margin-bottom: 0;
}

.form-label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  color: var(--text-tertiary);
  margin-bottom: 8px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.form-input {
  width: 100%;
  padding: 10px 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  color: var(--text-primary);
  font-size: 14px;
}

.form-input:focus {
  outline: none;
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-muted);
}

.form-input.title-input {
  font-size: 16px;
  font-weight: 500;
  padding: 12px 14px;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.form-divider {
  height: 1px;
  background: var(--border-subtle);
  margin: 20px 0;
}
```

### Footer

```css
.modal-form-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-tertiary);
  flex-shrink: 0;
}

.footer-hint {
  font-size: 12px;
  color: var(--text-muted);
}

.footer-hint kbd {
  display: inline-flex;
  padding: 2px 6px;
  background: var(--bg-hover);
  border: 1px solid var(--border-subtle);
  border-radius: 4px;
  font-size: 11px;
  font-family: inherit;
  color: var(--text-tertiary);
}

.footer-actions {
  display: flex;
  gap: 10px;
}
```

---

## 3. Command Palette

Global keyboard-driven navigation and quick actions. Triggered by `⌘K`.

### Structure

```
┌─────────────────────────────────────────┐
│ [icon] Acțiuni rapide              ⌘K   │
├─────────────────────────────────────────┤
│ [🔍] Caută sau execută o comandă...     │
├─────────────────────────────────────────┤
│ ACȚIUNI FRECVENTE                       │
│ ┌───────────────────────────────────┐   │
│ │ [+] Caz nou                   ⌘N  │   │
│ │ [□] Sarcină nouă              ⌘T  │ ← │
│ │ [◎] Înregistrare timp         ⌘L  │   │
│ │ [✦] Întreabă AI               ⌘J  │   │
│ └───────────────────────────────────┘   │
│ NAVIGARE                                │
│ ┌───────────────────────────────────┐   │
│ │ [📁] Salt la caz...           ⌘G  │   │
│ └───────────────────────────────────┘   │
└─────────────────────────────────────────┘
```

### Container

```css
.command-palette {
  width: 520px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-default);
  border-radius: 16px;
  box-shadow:
    0 8px 24px rgba(0, 0, 0, 0.5),
    0 0 60px rgba(0, 0, 0, 0.5);
  overflow: hidden;
}
```

### Header

```css
.palette-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
}

.palette-title {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
}

.palette-title svg {
  width: 20px;
  height: 20px;
  color: var(--accent);
}

.palette-shortcut {
  font-size: 12px;
  color: var(--text-muted);
  background: var(--bg-tertiary);
  padding: 4px 8px;
  border-radius: 6px;
  font-family: 'SF Mono', monospace;
}
```

### Search

```css
.palette-search {
  padding: 16px 20px;
}

.palette-search-input {
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 8px;
  padding: 12px 16px;
}

.palette-search-input:focus-within {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-muted);
}

.palette-search-input input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 14px;
}
```

### Body & Items

```css
.palette-body {
  padding: 8px 0;
  max-height: 400px;
  overflow-y: auto;
}

.palette-section {
  padding: 8px 20px;
}

.palette-section-title {
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--text-tertiary);
  padding: 8px 0;
}

.palette-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  margin: 0 -16px;
  border-radius: 8px;
  cursor: pointer;
}

.palette-item:hover,
.palette-item.selected {
  background: var(--bg-hover);
}

.palette-item.selected {
  background: var(--bg-active);
}

.palette-item-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--bg-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.palette-item-icon.ai {
  background: var(--accent-muted);
  color: var(--accent);
  box-shadow: 0 0 12px var(--accent-glow);
}

.palette-item-label {
  flex: 1;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-primary);
}

.palette-item-shortcut {
  font-size: 12px;
  color: var(--text-muted);
  background: var(--bg-tertiary);
  padding: 3px 8px;
  border-radius: 6px;
  font-family: 'SF Mono', monospace;
}
```

---

## 4. Slide-Over Panel

For viewing/editing details while keeping page context visible.

### Structure

```
┌────────────────────┬────────────────────┐
│                    │ HEADER: Title   [×]│
│    Page content    ├────────────────────┤
│    (dimmed)        │ BODY (scrollable)  │
│                    │                    │
│                    │ [Fields...]        │
│                    │                    │
│                    ├────────────────────┤
│                    │ FOOTER: [Cancel]   │
│                    │         [Save]     │
└────────────────────┴────────────────────┘
         ↑                    ↑
    60% backdrop         400px panel
```

### Backdrop

```css
.slide-over-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 40;
}
```

### Panel

```css
.slide-over {
  position: fixed;
  right: 0;
  top: 0;
  bottom: 0;
  width: 400px;
  max-width: 90vw;
  background: var(--bg-secondary);
  border-left: 1px solid var(--border-subtle);
  display: flex;
  flex-direction: column;
  z-index: 50;
  animation: slide-in 0.2s ease;
}

@keyframes slide-in {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}
```

### Header/Body/Footer

```css
.slide-over-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--border-subtle);
  flex-shrink: 0;
}

.slide-over-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}

.slide-over-body {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.slide-over-footer {
  padding: 16px 20px;
  border-top: 1px solid var(--border-subtle);
  background: var(--bg-tertiary);
  display: flex;
  gap: 12px;
  justify-content: flex-end;
  flex-shrink: 0;
}
```

---

## 5. Toast Notifications

Ephemeral feedback for actions. Auto-dismiss after 5 seconds.

### Structure

```
┌─────────────────────────────────────┐
│ [●] Title                       [×] │
│     Description message             │
└─────────────────────────────────────┘
```

### Container

```css
.toast-container {
  position: fixed;
  bottom: 20px;
  right: 20px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  z-index: 100;
}
```

### Toast

```css
.toast {
  width: 380px;
  background: var(--bg-elevated);
  border: 1px solid var(--border-subtle);
  border-radius: 12px;
  padding: 16px;
  display: flex;
  align-items: flex-start;
  gap: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
  animation: toast-in 0.2s ease;
}

@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```

### Icon

```css
.toast-icon {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.toast-icon.success {
  background: rgba(34, 197, 94, 0.15);
  color: var(--success);
}

.toast-icon.error {
  background: rgba(239, 68, 68, 0.15);
  color: var(--danger);
}

.toast-icon.warning {
  background: rgba(245, 158, 11, 0.15);
  color: var(--warning);
}

.toast-icon.info {
  background: var(--accent-muted);
  color: var(--accent);
}
```

### Content

```css
.toast-content {
  flex: 1;
}

.toast-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.toast-message {
  font-size: 13px;
  color: var(--text-secondary);
}

.toast-close {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  border: none;
  color: var(--text-muted);
  cursor: pointer;
  border-radius: 6px;
}

.toast-close:hover {
  background: var(--bg-hover);
  color: var(--text-secondary);
}
```

---

## Backdrop

Shared backdrop styling for centered modals.

```css
.modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.8);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 50;
  animation: backdrop-in 0.15s ease;
}

@keyframes backdrop-in {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

/* Command palette uses lighter backdrop, positioned at top */
.modal-backdrop.palette {
  background: rgba(0, 0, 0, 0.6);
  align-items: flex-start;
  padding-top: 15vh;
}

/* Slide-over uses lighter backdrop */
.modal-backdrop.slide-over {
  background: rgba(0, 0, 0, 0.6);
}
```

---

## Buttons

Standard button styles used across all modals.

```css
.btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
  border: none;
  font-family: inherit;
}

.btn-primary {
  background: var(--accent);
  color: white;
}

.btn-primary:hover {
  background: var(--accent-hover);
}

.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
}

.btn-secondary:hover {
  background: var(--bg-hover);
  border-color: var(--border-strong);
}

.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
}

.btn-ghost:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.btn-danger {
  background: var(--danger);
  color: white;
}

.btn-danger:hover {
  background: var(--danger-hover);
}
```

---

## Keyboard Shortcuts

| Action               | Shortcut |
| -------------------- | -------- |
| Open command palette | `⌘K`     |
| Close modal          | `Escape` |
| Submit form          | `⌘Enter` |
| Navigate items       | `↑` `↓`  |
| Select item          | `Enter`  |

---

## Animation

```css
/* Modal enter */
@keyframes modal-enter {
  from {
    opacity: 0;
    transform: scale(0.95);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.modal {
  animation: modal-enter 0.15s ease;
}

/* Slide-over enter */
@keyframes slide-in {
  from {
    transform: translateX(100%);
  }
  to {
    transform: translateX(0);
  }
}

/* Toast enter */
@keyframes toast-in {
  from {
    opacity: 0;
    transform: translateX(100%);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}
```
