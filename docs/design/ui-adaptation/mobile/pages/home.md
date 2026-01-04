# Mobile Home Page

> Dashboard experience optimized for mobile.

## Overview

The mobile home page prioritizes quick access to urgent items and daily briefing, replacing the desktop's multi-column dashboard layout.

## Layout Structure

```
┌─────────────────────────────────────────────────┐
│ [safe area]                                     │
├─────────────────────────────────────────────────┤
│ Bună dimineața, Alexandru                   [🔔]│
│ 29 Decembrie 2024                               │
├─────────────────────────────────────────────────┤
│                                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ 📋 REZUMAT ZILNIC                           │ │
│ │ 3 sarcini urgente • 2 termene azi           │ │
│ │                                             │ │
│ │ [4] Sarcini  [2] Termene  [5] Mesaje noi    │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ ACȚIUNI RAPIDE                                  │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────┐ │
│ │ + Caz    │ │ + Sarcină│ │ + Timp   │ │ AI  │ │
│ └──────────┘ └──────────┘ └──────────┘ └─────┘ │
│                                                 │
│ SARCINI URGENTE                    Vezi tot → │
│ ┌─────────────────────────────────────────────┐ │
│ │ [□] │ Revizuire contract        Azi 14:00  │ │
│ │     │ CAZ-2024-0156                        │ │
│ ├─────────────────────────────────────────────┤ │
│ │ [□] │ Depunere cerere           Azi 17:00  │ │
│ │     │ CAZ-2024-0142                        │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ CAZURI ACTIVE                      Vezi tot → │
│ ┌─────────────────────────────────────────────┐ │
│ │ ● CAZ-2024-0156                      Activ  │ │
│ │ Ionescu vs. SC Alpha SRL                   │ │
│ ├─────────────────────────────────────────────┤ │
│ │ ● CAZ-2024-0142                      Activ  │ │
│ │ Contract Beta Corp                         │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
├─────────────────────────────────────────────────┤
│  🏠      📁      ✓      📄      ✉️           │
│ Acasă   Cazuri  Sarcini  Doc.  Mesaje         │
└─────────────────────────────────────────────────┘
```

## Components

### Header

Personalized greeting with notification access.

```css
.home-header {
  padding: 16px;
  padding-top: calc(16px + var(--safe-area-top));
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.greeting {
  flex: 1;
}

.greeting-text {
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
}

.greeting-date {
  font-size: 14px;
  color: var(--text-tertiary);
  margin-top: 2px;
}

.notification-btn {
  width: 44px;
  height: 44px;
  position: relative;
}

.notification-badge {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 8px;
  height: 8px;
  background: var(--status-error);
  border-radius: 50%;
  border: 2px solid var(--bg-primary);
}
```

### Briefing Card

Daily summary with key stats.

```css
.briefing-card {
  margin: 0 16px 16px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  padding: 16px;
  position: relative;
  overflow: hidden;
}

.briefing-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--gradient-accent);
}

.briefing-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 8px;
}

.briefing-summary {
  font-size: 15px;
  color: var(--text-secondary);
  margin-bottom: 16px;
}

.briefing-stats {
  display: flex;
  gap: 24px;
}

.stat {
  text-align: center;
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
  color: var(--text-primary);
}

.stat-label {
  font-size: 12px;
  color: var(--text-tertiary);
}
```

### Quick Actions

Horizontal scroll of primary actions.

```css
.quick-actions {
  padding: 0 16px 24px;
}

.quick-actions-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 12px;
}

.quick-actions-grid {
  display: flex;
  gap: 12px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  margin: 0 -16px;
  padding: 0 16px;
}

.quick-action {
  flex-shrink: 0;
  width: 80px;
  padding: 16px 12px;
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.quick-action:active {
  background: var(--bg-hover);
  transform: scale(0.98);
}

.quick-action-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: var(--accent-secondary);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--accent-primary);
}

.quick-action-icon.ai {
  box-shadow: 0 0 12px var(--accent-glow);
}

.quick-action-label {
  font-size: 12px;
  font-weight: 500;
  color: var(--text-secondary);
  text-align: center;
}
```

### Section Widget

Reusable pattern for task/case lists.

```css
.section-widget {
  margin-bottom: 24px;
}

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 12px;
}

.section-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.section-action {
  font-size: 13px;
  color: var(--accent-primary);
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px;
  margin: -8px;
}

.section-list {
  background: var(--bg-secondary);
  border-top: 1px solid var(--border-subtle);
  border-bottom: 1px solid var(--border-subtle);
}
```

## Interactions

### Pull to Refresh

Standard pull-to-refresh on the entire page content.

### Tap Actions

| Element           | Action                               |
| ----------------- | ------------------------------------ |
| Task item         | Push to task detail or inline expand |
| Task checkbox     | Toggle complete (optimistic)         |
| Case item         | Push to case detail                  |
| Quick action      | Open relevant sheet/page             |
| "Vezi tot"        | Push to full list view               |
| Notification bell | Push to notifications list           |

### Swipe Actions

No swipe actions on home page - keep it simple.

## States

### Loading

Show skeleton for:

- Briefing card stats
- Task list (3 skeleton items)
- Case list (3 skeleton items)

### Empty States

**No urgent tasks:**

```
┌─────────────────────────────────────────────────┐
│ SARCINI URGENTE                                 │
│ ┌─────────────────────────────────────────────┐ │
│ │      ✓ Totul e la zi!                       │ │
│ │      Nu ai sarcini urgente                  │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Error State

If data fails to load, show retry button inline.

## Comparison: Desktop vs Mobile

| Aspect        | Desktop           | Mobile                  |
| ------------- | ----------------- | ----------------------- |
| Layout        | 3-column grid     | Single column scroll    |
| Widgets       | 5 widgets visible | 2-3 widgets + scroll    |
| Briefing      | Full width card   | Compact card with stats |
| Quick actions | Dropdown/buttons  | Horizontal scroll pills |
| Navigation    | Click             | Tap, pull-to-refresh    |
