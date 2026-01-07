# Mobile Navigation Patterns

> Navigation structure and patterns for the mobile experience.

## Overview

Mobile navigation uses a bottom tab bar as the primary navigation method, replacing the desktop sidebar.

## 1. Bottom Tab Bar

### Structure

```
┌────────────────────────────────────────────────┐
│                                                │
│              [Page Content]                    │
│                                                │
├────────────────────────────────────────────────┤
│  🏠      📁      ✓      📄      ✉️           │
│ Acasă   Cazuri  Sarcini  Doc.  Mesaje         │
└────────────────────────────────────────────────┘
```

### Tabs

| Icon | Label     | Route             | Badge               |
| ---- | --------- | ----------------- | ------------------- |
| 🏠   | Acasă     | `/`               | -                   |
| 📁   | Cazuri    | `/cases`          | Urgent cases count  |
| ✓    | Sarcini   | `/tasks`          | Overdue tasks count |
| 📄   | Documente | `/documents`      | -                   |
| ✉️   | Mesaje    | `/communications` | Unread count        |

### Styling

```css
.bottom-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-subtle);
  padding: 8px 16px;
  padding-bottom: calc(8px + var(--safe-area-bottom));
  z-index: 100;
  display: flex;
  justify-content: space-around;
}

.nav-tab {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  min-width: 56px;
  border-radius: var(--radius-md);
  color: var(--text-tertiary);
  background: transparent;
  border: none;
  cursor: pointer;
  position: relative;
}

.nav-tab:active {
  background: var(--bg-hover);
}

.nav-tab.active {
  color: var(--accent-primary);
}

.nav-tab-icon {
  width: 24px;
  height: 24px;
}

.nav-tab-label {
  font-size: 10px;
  font-weight: 500;
}

.nav-badge {
  position: absolute;
  top: 4px;
  right: 8px;
  min-width: 16px;
  height: 16px;
  padding: 0 5px;
  background: var(--status-error);
  color: white;
  font-size: 10px;
  font-weight: 600;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

### Height Calculation

```css
/* Total height: icon (24) + gap (4) + label (12) + padding (16) + safe area */
/* Approximately 88px + safe area */

.page-content {
  padding-bottom: calc(88px + var(--safe-area-bottom));
}
```

---

## 2. Floating Action Button (FAB)

For primary creation actions on certain screens.

### Position

```
┌────────────────────────────────────────────────┐
│                                                │
│              [Page Content]                    │
│                                                │
│                                          [+]   │ ← FAB
├────────────────────────────────────────────────┤
│  🏠      📁      ✓      📄      ✉️           │
└────────────────────────────────────────────────┘
```

### Styling

```css
.fab {
  position: fixed;
  right: 16px;
  bottom: calc(100px + var(--safe-area-bottom));
  width: 56px;
  height: 56px;
  border-radius: 16px;
  background: var(--accent-primary);
  color: white;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(94, 106, 210, 0.4);
  z-index: 90;
  cursor: pointer;
}

.fab:active {
  background: var(--accent-primary-hover);
  transform: scale(0.95);
}

.fab-icon {
  width: 24px;
  height: 24px;
}
```

### Usage by Page

| Page           | FAB Action     |
| -------------- | -------------- |
| Home           | - (not needed) |
| Cases          | + Caz Nou      |
| Tasks          | + Sarcină      |
| Documents      | + Încarcă      |
| Communications | + Email Nou    |

---

## 3. Page Header

Each page has a header with title and actions.

### Simple Header

```
┌────────────────────────────────────────────────┐
│ Sarcini                                 [🔍] [⋮]│
├────────────────────────────────────────────────┤
```

```css
.page-header {
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-subtle);
  padding: 16px;
  padding-top: calc(16px + var(--safe-area-top));
  display: flex;
  align-items: center;
  justify-content: space-between;
  position: sticky;
  top: 0;
  z-index: 50;
}

.page-title {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
}

.header-actions {
  display: flex;
  gap: 8px;
}

.header-icon-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background: transparent;
  border: none;
  color: var(--text-secondary);
}

.header-icon-btn:active {
  background: var(--bg-hover);
}
```

### Header with Back Button

For detail pages and nested navigation.

```
┌────────────────────────────────────────────────┐
│ [←]  Ionescu vs. Alpha SRL                     │
├────────────────────────────────────────────────┤
```

```css
.back-button {
  width: 44px;
  height: 44px;
  margin-left: -8px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  background: transparent;
  border: none;
  color: var(--text-secondary);
}

.back-button:active {
  background: var(--bg-hover);
}
```

### Header with Search

Expandable search bar.

**Collapsed:**

```
┌────────────────────────────────────────────────┐
│ Cazuri                                 [🔍] [⋮]│
├────────────────────────────────────────────────┤
```

**Expanded:**

```
┌────────────────────────────────────────────────┐
│ [←]  [🔍 Caută cazuri...              ] [Anulează]│
├────────────────────────────────────────────────┤
```

```css
.search-expanded {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 12px;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-default);
  border-radius: var(--radius-lg);
  padding: 10px 16px;
}

.search-expanded input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  color: var(--text-primary);
  font-size: 16px;
}
```

---

## 4. Tab Bar (Within Page)

For switching views within a page (e.g., case details).

### Structure

```
┌────────────────────────────────────────────────┐
│ [←]  Ionescu vs. Alpha SRL              [⋮]    │
├────────────────────────────────────────────────┤
│  Detalii │ Documente │ Timp │ Mesaje │ Istoric │
├────────────────────────────────────────────────┤
│                                                │
│              [Tab Content]                     │
│                                                │
└────────────────────────────────────────────────┘
```

### Styling

```css
.tab-bar {
  display: flex;
  gap: 0;
  padding: 0 16px;
  border-bottom: 1px solid var(--border-subtle);
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}

.tab-bar::-webkit-scrollbar {
  display: none;
}

.tab {
  flex-shrink: 0;
  padding: 14px 16px;
  font-size: 14px;
  font-weight: 500;
  color: var(--text-tertiary);
  background: transparent;
  border: none;
  position: relative;
  white-space: nowrap;
}

.tab:active {
  color: var(--text-primary);
}

.tab.active {
  color: var(--text-primary);
}

.tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 16px;
  right: 16px;
  height: 2px;
  background: var(--accent-primary);
}

.tab-badge {
  margin-left: 6px;
  font-size: 11px;
  color: var(--text-muted);
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 10px;
}
```

### Scrollable Tabs

When tabs overflow, they scroll horizontally with momentum.

---

## 5. Filter/Sort Pills

Horizontal scrollable filter options.

### Structure

```
┌────────────────────────────────────────────────┐
│ [Toate] [Urgente] [Astăzi] [Săptămâna aceasta] →│
├────────────────────────────────────────────────┤
```

### Styling

```css
.filter-pills {
  display: flex;
  gap: 8px;
  padding: 12px 16px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  border-bottom: 1px solid var(--border-subtle);
}

.filter-pill {
  flex-shrink: 0;
  padding: 8px 14px;
  min-height: 36px;
  font-size: 14px;
  font-weight: 500;
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: 18px;
  color: var(--text-secondary);
  white-space: nowrap;
}

.filter-pill:active {
  background: var(--bg-hover);
}

.filter-pill.active {
  background: var(--accent-secondary);
  border-color: var(--accent-primary);
  color: var(--accent-primary);
}
```

---

## 6. Pull-to-Refresh

Standard refresh pattern for list views.

### Visual

```
           ↓ Trage pentru a reîmprospăta
┌────────────────────────────────────────────────┐
│              [Spinner]                         │
│         Se încarcă...                          │
├────────────────────────────────────────────────┤
│              [List Content]                    │
```

### States

| State      | Visual                                  |
| ---------- | --------------------------------------- |
| Idle       | Hidden                                  |
| Pulling    | Arrow pointing down, progress indicator |
| Ready      | Arrow pointing up, "Eliberează"         |
| Refreshing | Spinner, "Se încarcă..."                |
| Done       | Hidden (smooth transition)              |

---

## 7. Modal/Sheet Navigation

### Bottom Sheet

For detail views, filters, actions.

```
┌────────────────────────────────────────────────┐
│              [Page Content]                    │
│              (dimmed)                          │
├────────────────────────────────────────────────┤
│       ════════════════════                     │ ← Drag handle
│ Sheet Title                              [×]   │
├────────────────────────────────────────────────┤
│                                                │
│              [Sheet Content]                   │
│                                                │
│              [Action Button]                   │
│                                                │
└────────────────────────────────────────────────┘
```

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
  animation: sheet-up 0.3s ease;
}

@keyframes sheet-up {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.sheet-handle {
  width: 32px;
  height: 4px;
  background: var(--bg-hover);
  border-radius: 2px;
  margin: 8px auto 16px;
}

.sheet-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 16px;
  border-bottom: 1px solid var(--border-subtle);
}

.sheet-body {
  padding: 16px;
  overflow-y: auto;
  max-height: calc(90vh - 120px);
}
```

### Full Screen Modal

For forms, wizards.

```css
.fullscreen-modal {
  position: fixed;
  inset: 0;
  background: var(--bg-primary);
  z-index: 200;
  display: flex;
  flex-direction: column;
}
```

---

## 8. Navigation Patterns by Context

### From Home

| Action               | Navigation                           |
| -------------------- | ------------------------------------ |
| Tap case widget item | Push to case detail                  |
| Tap task item        | Inline expand or push to task detail |
| Tap "Vezi tot"       | Push to full list                    |
| Tap quick action     | Open sheet or push to form           |

### From Lists

| Action          | Navigation         |
| --------------- | ------------------ |
| Tap list item   | Push to detail     |
| Swipe item      | Reveal actions     |
| Long press item | Context menu sheet |
| Pull down       | Refresh list       |

### From Detail Pages

| Action               | Navigation                   |
| -------------------- | ---------------------------- |
| Back button          | Pop to list                  |
| Swipe from left edge | Pop to list (iOS gesture)    |
| Tab switch           | Stay on page, change content |
| Action button        | Open sheet or navigate       |

---

## Comparison: Desktop vs Mobile

| Element       | Desktop                 | Mobile              |
| ------------- | ----------------------- | ------------------- |
| Primary nav   | Left sidebar            | Bottom tab bar      |
| Secondary nav | Tabs in header          | Scrollable tab bar  |
| Search        | Header search box       | Expandable search   |
| Filters       | Dropdown/toggle buttons | Scrollable pills    |
| Detail view   | Side panel              | Full page push      |
| Actions       | Inline buttons          | FAB + swipe actions |
| Context menu  | Right-click / dropdown  | Long press sheet    |
