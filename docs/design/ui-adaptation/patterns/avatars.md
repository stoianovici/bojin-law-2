# Avatars Pattern

> Extracted from: home-desktop.html, tasks-page.html, tasks-new-task.html

## Overview

Avatars display user identity through initials on gradient backgrounds. Used in navigation, task assignments, activity feeds, and user selectors.

---

## Sizes

| Size | Dimensions | Font Size | Usage                          |
| ---- | ---------- | --------- | ------------------------------ |
| xs   | `20px`     | `9px`     | Inline mentions, compact lists |
| sm   | `24px`     | `10px`    | Task assignees, activity feed  |
| md   | `32px`     | `12px`    | Comment authors, user cards    |
| lg   | `40px`     | `14px`    | User menu, profile sections    |
| xl   | `48px`     | `16px`    | Profile pages, team overview   |

---

## Structure

```html
<div class="avatar avatar-sm">
  <span class="avatar-initials">AB</span>
</div>
```

With image fallback:

```html
<div class="avatar avatar-sm">
  <img src="..." alt="Alexandru Bojin" class="avatar-image" />
  <span class="avatar-initials">AB</span>
  <!-- Hidden when image loads -->
</div>
```

---

## Styling

### Base Avatar

```css
.avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  font-weight: 600;
  color: white;
  flex-shrink: 0;
  overflow: hidden;
  /* Default gradient */
  background: linear-gradient(135deg, #5e6ad2, #8b5cf6);
}

.avatar-initials {
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
```

### Size Variants

```css
.avatar-xs {
  width: 20px;
  height: 20px;
  font-size: 9px;
}

.avatar-sm {
  width: 24px;
  height: 24px;
  font-size: 10px;
}

.avatar-md {
  width: 32px;
  height: 32px;
  font-size: 12px;
}

.avatar-lg {
  width: 40px;
  height: 40px;
  font-size: 14px;
}

.avatar-xl {
  width: 48px;
  height: 48px;
  font-size: 16px;
}
```

---

## Gradient Colors

Each user gets a consistent gradient based on their ID/name. Pre-defined gradient palette:

| Gradient         | Start     | End       | Assignment          |
| ---------------- | --------- | --------- | ------------------- |
| Purple (default) | `#5E6AD2` | `#8B5CF6` | Primary, unassigned |
| Pink             | `#EC4899` | `#F43F5E` | User pool           |
| Teal             | `#14B8A6` | `#22C55E` | User pool           |
| Orange           | `#F97316` | `#FACC15` | User pool           |
| Blue             | `#3B82F6` | `#6366F1` | User pool           |
| Rose             | `#FB7185` | `#F472B6` | User pool           |

### Gradient Assignment

```css
.avatar-gradient-1 {
  background: linear-gradient(135deg, #5e6ad2, #8b5cf6);
}
.avatar-gradient-2 {
  background: linear-gradient(135deg, #ec4899, #f43f5e);
}
.avatar-gradient-3 {
  background: linear-gradient(135deg, #14b8a6, #22c55e);
}
.avatar-gradient-4 {
  background: linear-gradient(135deg, #f97316, #facc15);
}
.avatar-gradient-5 {
  background: linear-gradient(135deg, #3b82f6, #6366f1);
}
.avatar-gradient-6 {
  background: linear-gradient(135deg, #fb7185, #f472b6);
}
```

Assign gradient based on hash of user ID to ensure consistency:

```js
const gradientIndex = (userId.charCodeAt(0) % 6) + 1;
```

---

## Avatar Group (Stack)

For showing multiple assignees in limited space.

### Structure

```html
<div class="avatar-group">
  <div class="avatar avatar-sm">AB</div>
  <div class="avatar avatar-sm">MP</div>
  <div class="avatar avatar-sm">ED</div>
  <div class="avatar avatar-sm avatar-overflow">+2</div>
</div>
```

### Styling

```css
.avatar-group {
  display: flex;
  flex-direction: row-reverse; /* Stack right to left */
  align-items: center;
}

.avatar-group .avatar {
  margin-left: -8px; /* Overlap */
  border: 2px solid var(--bg-secondary);
  box-sizing: content-box;
}

.avatar-group .avatar:last-child {
  margin-left: 0;
}

.avatar-overflow {
  background: var(--bg-tertiary);
  color: var(--text-secondary);
  font-weight: 500;
}
```

### Max Display

- Show max 3 avatars + overflow count
- Overflow shows "+N" for remaining

---

## Avatar with Status

For showing online/offline or activity status.

### Structure

```html
<div class="avatar-wrapper">
  <div class="avatar avatar-md">AB</div>
  <span class="avatar-status avatar-status-online"></span>
</div>
```

### Styling

```css
.avatar-wrapper {
  position: relative;
  display: inline-flex;
}

.avatar-status {
  position: absolute;
  bottom: 0;
  right: 0;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 2px solid var(--bg-secondary);
}

.avatar-status-online {
  background: var(--status-success);
}

.avatar-status-offline {
  background: var(--text-muted);
}

.avatar-status-busy {
  background: var(--status-error);
}
```

---

## Avatar in Sidebar (User Menu)

Used at bottom of sidebar navigation.

### Structure

```html
<div class="user-menu">
  <div class="avatar avatar-md">AB</div>
  <div class="user-info">
    <span class="user-name">Alexandru Bojin</span>
    <span class="user-role">Partener</span>
  </div>
</div>
```

### Styling

```css
.user-menu {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border-top: 1px solid var(--border-subtle);
  cursor: pointer;
}

.user-menu:hover {
  background: var(--bg-hover);
}

.user-info {
  flex: 1;
  min-width: 0;
}

.user-name {
  display: block;
  font-size: 13px;
  font-weight: 500;
  color: var(--text-primary);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.user-role {
  display: block;
  font-size: 11px;
  color: var(--text-tertiary);
}
```

---

## Initials Extraction

Generate initials from name:

```js
function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase();
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Examples:
// "Alexandru Bojin" → "AB"
// "Maria Elena Popescu" → "MP"
// "Elena" → "EL"
```

---

## Accessibility

- Always include `aria-label` or `title` with full name
- For avatar groups, include count in aria-label
- Images should have meaningful `alt` text

```html
<div class="avatar avatar-sm" aria-label="Alexandru Bojin" title="Alexandru Bojin">AB</div>

<div class="avatar-group" aria-label="Assigned to Alexandru Bojin, Maria Popescu, and 2 others">
  ...
</div>
```
