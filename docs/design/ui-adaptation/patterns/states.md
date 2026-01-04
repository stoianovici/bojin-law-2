# Empty / Loading / Error States

> Extracted from: states-exploration.html, 403-page.html

## Overview

Three categories of non-ideal states, each with context-appropriate variants:

| Category    | Variants                                   |
| ----------- | ------------------------------------------ |
| **Empty**   | Page, Widget, Inline, Search               |
| **Loading** | Spinner, Skeleton, Progress, Overlay       |
| **Error**   | Page (404/403/500), Section, Inline, Toast |

---

## 1. Empty States

### Page Empty

Full-page empty state with icon, title, description, and call-to-action.

```
┌─────────────────────────────────────────┐
│                                         │
│              ┌───────┐                  │
│              │  📄   │  ← Accent icon   │
│              └───────┘                  │
│                                         │
│           Niciun document               │
│                                         │
│    Nu ați adăugat încă documente        │
│    la acest dosar.                      │
│                                         │
│         [+ Încarcă document]            │
│                                         │
└─────────────────────────────────────────┘
```

```css
.empty-state {
  text-align: center;
  max-width: 280px;
  margin: 0 auto;
  padding: 40px 24px;
}

.empty-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 20px;
  background: var(--accent-muted);
  border-radius: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent);
}

.empty-icon svg {
  width: 28px;
  height: 28px;
}

.empty-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.empty-description {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.5;
  margin-bottom: 20px;
}
```

**When to use:** First-time user experience, no data created yet, actionable state.

### Widget Empty

Simpler empty state for cards/widgets. No CTA needed.

```css
.empty-icon.neutral {
  background: var(--bg-tertiary);
  color: var(--text-muted);
}
```

**When to use:** Dashboard widgets, sections with no data. Often positive ("All done!").

### Inline Empty

Compact empty for lists, comments, activity feeds.

```css
.empty-inline {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: var(--bg-tertiary);
  border-radius: 8px;
}

.empty-inline-icon {
  width: 40px;
  height: 40px;
  background: var(--bg-hover);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-muted);
}

.empty-inline-text {
  font-size: 13px;
  color: var(--text-tertiary);
}
```

**When to use:** Comments section, activity feed, any compact space.

### Search No Results

Empty state specific to search with query shown.

```css
/* Same as page empty, but with secondary action */
.empty-action.secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
}
```

**Copy pattern:**

- Title: "Niciun rezultat"
- Description: Include the search query: `Nu am găsit rezultate pentru "{query}".`
- Action: "Șterge căutarea" (secondary button)

---

## 2. Loading States

### Spinner

Simple rotating indicator for general loading.

```css
.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid var(--bg-tertiary);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

/* Size variants */
.spinner-sm {
  width: 16px;
  height: 16px;
  border-width: 2px;
}
.spinner-md {
  width: 32px;
  height: 32px;
  border-width: 3px;
}
.spinner-lg {
  width: 48px;
  height: 48px;
  border-width: 4px;
}
```

**With text:**

```html
<div class="loading-center">
  <div class="spinner"></div>
  <span class="loading-text">Se încarcă...</span>
</div>
```

```css
.loading-text {
  font-size: 13px;
  color: var(--text-secondary);
  margin-top: 12px;
}
```

### Skeleton

Content placeholder that mirrors the structure of real content.

```css
.skeleton {
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

@keyframes shimmer {
  0% {
    background-position: 200% 0;
  }
  100% {
    background-position: -200% 0;
  }
}

/* Common skeleton shapes */
.skeleton-text {
  height: 14px;
  margin-bottom: 8px;
}

.skeleton-title {
  height: 20px;
  width: 40%;
  margin-bottom: 16px;
}

.skeleton-avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
}
```

**When to use:** Initial page load where structure is known. Reduces perceived load time.

### Progress Bar

For uploads, long processes with known progress.

```css
.progress-bar {
  width: 200px;
  height: 4px;
  background: var(--bg-tertiary);
  border-radius: 2px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: var(--accent);
  border-radius: 2px;
  transition: width 0.3s ease;
}

/* Indeterminate (unknown progress) */
.progress-indeterminate .progress-fill {
  width: 30%;
  animation: progress-slide 1.5s infinite;
}

@keyframes progress-slide {
  0% {
    transform: translateX(-100%);
  }
  100% {
    transform: translateX(400%);
  }
}
```

### Loading Overlay

For refreshing existing content without removing it.

```css
.loading-overlay {
  position: relative;
}

.loading-overlay::after {
  content: '';
  position: absolute;
  inset: 0;
  background: var(--bg-primary);
  opacity: 0.5;
  border-radius: inherit;
}

.loading-overlay .loading-center {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
}
```

**When to use:** Refreshing a table, reloading a section. Content stays visible but dimmed.

---

## 3. Error States

### Page Error (404, 403, 500)

Full-page error for navigation/server errors.

```
┌─────────────────────────────────────────┐
│                                         │
│              (●) Error icon             │
│                                         │
│                 404                     │
│                                         │
│          Pagină negăsită                │
│                                         │
│    Pagina pe care o căutați nu          │
│    există sau a fost mutată.            │
│                                         │
│           [← Înapoi acasă]              │
│                                         │
│         Aveți nevoie de ajutor?         │
│                                         │
└─────────────────────────────────────────┘
```

```css
.error-state {
  text-align: center;
  max-width: 320px;
}

.error-icon {
  width: 64px;
  height: 64px;
  margin: 0 auto 20px;
  background: var(--status-error-bg);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--status-error);
}

.error-code {
  font-size: 48px;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 8px;
  letter-spacing: -1px;
}

.error-title {
  font-size: 18px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 8px;
}

.error-description {
  font-size: 13px;
  color: var(--text-secondary);
  line-height: 1.6;
  margin-bottom: 24px;
}

.error-link {
  font-size: 12px;
  color: var(--text-tertiary);
  margin-top: 16px;
}
```

**Error codes:**
| Code | Title | Description |
|------|-------|-------------|
| 403 | Acces Interzis | Nu aveți permisiunea de a accesa această resursă. |
| 404 | Pagină negăsită | Pagina pe care o căutați nu există sau a fost mutată. |
| 500 | Eroare server | A apărut o eroare. Echipa noastră a fost notificată. |

### Section Error

For API failures within a page section.

```css
.error-icon.warning {
  background: var(--status-warning-bg);
  color: var(--status-warning);
}
```

**Copy pattern:**

- Title: "Eroare la încărcare"
- Description: "Nu am putut încărca datele. Verificați conexiunea și încercați din nou."
- Action: "Reîncearcă" (with refresh icon)

### Inline Error

For form validation, section-level errors.

```css
.error-inline {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px;
  background: var(--status-error-bg);
  border: 1px solid rgba(239, 68, 68, 0.2);
  border-radius: 8px;
}

.error-inline-icon {
  width: 18px;
  height: 18px;
  color: var(--status-error);
  flex-shrink: 0;
}

.error-inline-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
}

.error-inline-message {
  font-size: 12px;
  color: var(--text-secondary);
}
```

### Toast Error

See `modals.md` for full toast pattern. Error variant uses:

- Icon: `status-error-bg` background, `status-error` color
- Optional retry action

---

## Usage Guide

| Scenario                 | Pattern       | Details                        |
| ------------------------ | ------------- | ------------------------------ |
| First-time user, no data | Page Empty    | Accent icon, CTA to create     |
| Dashboard widget empty   | Widget Empty  | Neutral icon, positive message |
| No comments              | Inline Empty  | Compact, just text             |
| Search returns nothing   | Search Empty  | Show query, clear action       |
| Page loading first time  | Skeleton      | Mirror content structure       |
| Button/inline loading    | Spinner (sm)  | 16px inside button             |
| Section loading          | Spinner (md)  | 32px centered                  |
| Page loading             | Spinner (lg)  | 48px with text                 |
| File uploading           | Progress Bar  | Show percentage                |
| Refreshing data          | Overlay       | Dim content, spinner on top    |
| Wrong URL                | 404 Page      | Full page error                |
| No permission            | 403 Page      | Full page error                |
| Server down              | 500 Page      | Full page error                |
| API call failed          | Section Error | Warning icon, retry            |
| Form validation          | Inline Error  | Red banner with message        |
| Background action failed | Toast Error   | Bottom-right notification      |

---

## Icons

Common icons for states (using Heroicons outline):

| State           | Icon                   |
| --------------- | ---------------------- |
| Empty documents | `document-text`        |
| Empty tasks     | `clipboard-check`      |
| Empty search    | `magnifying-glass`     |
| Empty comments  | `chat-bubble-left`     |
| Error (danger)  | `exclamation-circle`   |
| Error (warning) | `exclamation-triangle` |
| 404             | `x-circle`             |
| 403             | `shield-exclamation`   |
| 500             | `server`               |
| Success         | `check-circle`         |

---

## Accessibility

- Spinners should have `aria-label="Loading"` or equivalent
- Error states should use `role="alert"` for screen readers
- Progress bars need `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
- Empty states should be announced but not block interaction

```html
<div class="spinner" role="status" aria-label="Se încarcă..."></div>

<div role="alert" class="error-inline">
  <span class="sr-only">Eroare:</span>
  ...
</div>

<div
  class="progress-bar"
  role="progressbar"
  aria-valuenow="65"
  aria-valuemin="0"
  aria-valuemax="100"
>
  ...
</div>
```
