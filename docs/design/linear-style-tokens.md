# Linear Style Design Tokens

Design system tokens for implementing Linear-style UI in the legal platform.

## Color Palette

### Background Colors

| Token            | Hex       | Usage                   |
| ---------------- | --------- | ----------------------- |
| `--bg-primary`   | `#0A0A0B` | Main app background     |
| `--bg-secondary` | `#111113` | Sidebar, cards          |
| `--bg-tertiary`  | `#18181B` | Nested elements, inputs |
| `--bg-elevated`  | `#1C1C1F` | Modals, dropdowns       |
| `--bg-hover`     | `#232326` | Hover states            |
| `--bg-active`    | `#2A2A2E` | Active/pressed states   |

### Border Colors

| Token              | Value                       | Usage                     |
| ------------------ | --------------------------- | ------------------------- |
| `--border-subtle`  | `rgba(255, 255, 255, 0.06)` | Default borders           |
| `--border-default` | `rgba(255, 255, 255, 0.1)`  | Emphasized borders        |
| `--border-strong`  | `rgba(255, 255, 255, 0.15)` | Focus states, interactive |

### Text Colors

| Token              | Hex       | Usage                    |
| ------------------ | --------- | ------------------------ |
| `--text-primary`   | `#EEEFF1` | Headings, important text |
| `--text-secondary` | `#A1A1AA` | Body text, descriptions  |
| `--text-tertiary`  | `#71717A` | Muted text, labels       |
| `--text-muted`     | `#52525B` | Disabled, placeholders   |

### Accent Colors (Linear Purple)

| Token                    | Value                      | Usage                  |
| ------------------------ | -------------------------- | ---------------------- |
| `--accent-primary`       | `#5E6AD2`                  | Primary actions, links |
| `--accent-primary-hover` | `#6B76DC`                  | Hover state            |
| `--accent-secondary`     | `rgba(94, 106, 210, 0.15)` | Background highlights  |
| `--accent-glow`          | `rgba(94, 106, 210, 0.4)`  | Glow effects           |

### Status Colors

| Status  | Color     | Background                 |
| ------- | --------- | -------------------------- |
| Success | `#22C55E` | `rgba(34, 197, 94, 0.15)`  |
| Warning | `#F59E0B` | `rgba(245, 158, 11, 0.15)` |
| Error   | `#EF4444` | `rgba(239, 68, 68, 0.15)`  |
| Info    | `#3B82F6` | `rgba(59, 130, 246, 0.15)` |

## Typography

### Font Stack

```css
font-family:
  'Inter',
  -apple-system,
  BlinkMacSystemFont,
  'Segoe UI',
  Roboto,
  sans-serif;
```

### Font Sizes

| Name    | Size    | Weight | Usage                        |
| ------- | ------- | ------ | ---------------------------- |
| Display | 24-28px | 700    | Large numbers, metrics       |
| Title   | 16px    | 600    | Page titles                  |
| Heading | 13px    | 600    | Card titles, section headers |
| Body    | 14px    | 400    | Default text                 |
| Small   | 13px    | 500    | List items, navigation       |
| Caption | 12px    | 400    | Meta text, labels            |
| Micro   | 11px    | 600    | Badges, shortcuts            |

### Letter Spacing

- Section titles (uppercase): `0.5px`
- Default: `0` (Inter has good default spacing)

## Spacing Scale

```css
--space-1: 4px;
--space-2: 8px;
--space-3: 12px;
--space-4: 16px;
--space-5: 20px;
--space-6: 24px;
--space-8: 32px;
--space-10: 40px;
```

## Border Radius

| Token         | Value  | Usage                |
| ------------- | ------ | -------------------- |
| `--radius-sm` | `6px`  | Buttons, badges      |
| `--radius-md` | `8px`  | Cards, inputs        |
| `--radius-lg` | `12px` | Larger cards, modals |
| `--radius-xl` | `16px` | Feature sections     |

## Shadows

```css
/* Subtle shadow */
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.3);

/* Card shadow */
--shadow-md: 0 4px 12px rgba(0, 0, 0, 0.4);

/* Modal/dropdown shadow */
--shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.5);

/* Accent glow (for primary buttons) */
--shadow-glow: 0 0 40px rgba(94, 106, 210, 0.15);
```

## Gradients

```css
/* Primary accent gradient */
--gradient-accent: linear-gradient(135deg, #5e6ad2 0%, #8b5cf6 100%);

/* Subtle card gradient (top shine effect) */
--gradient-card: linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, transparent 100%);

/* Background glow (for dashboard header area) */
--gradient-glow: radial-gradient(ellipse at top, rgba(94, 106, 210, 0.15) 0%, transparent 50%);
```

## Animation

### Transitions

- Default: `all 0.15s ease`
- Slow: `all 0.2s ease`
- Quick: `all 0.1s ease`

### Hover Effects

- Scale: `transform: scale(1.02)` (subtle, optional)
- Brightness: `filter: brightness(1.1)` (for icons)

## Component Patterns

### Cards

```css
.card {
  background: var(--bg-secondary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-lg);
  overflow: hidden;
  transition: all 0.2s ease;
}

.card:hover {
  border-color: var(--border-default);
  box-shadow: var(--shadow-md);
}
```

### Navigation Items

```css
.nav-item {
  padding: 8px 12px;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 500;
}

.nav-item:hover {
  background: var(--bg-hover);
  color: var(--text-primary);
}

.nav-item.active {
  background: var(--accent-secondary);
  color: var(--accent-primary);
}
```

### Buttons

```css
/* Primary */
.btn-primary {
  background: var(--accent-primary);
  color: white;
  padding: 8px 16px;
  border-radius: var(--radius-md);
  font-weight: 500;
}

.btn-primary:hover {
  background: var(--accent-primary-hover);
  box-shadow: var(--shadow-glow);
}

/* Secondary */
.btn-secondary {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  border: 1px solid var(--border-default);
}
```

### Status Indicators

```css
/* Pulsing dot for at-risk items */
.status-dot.at-risk {
  background: var(--status-error);
  animation: pulse 2s infinite;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}

/* Active dot with glow */
.status-dot.active {
  background: var(--status-success);
  box-shadow: 0 0 8px var(--status-success);
}
```

## Tailwind CSS Configuration

To implement in Tailwind, extend your config:

```js
module.exports = {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Background
        'linear-bg': {
          primary: '#0A0A0B',
          secondary: '#111113',
          tertiary: '#18181B',
          elevated: '#1C1C1F',
          hover: '#232326',
        },
        // Accent
        'linear-accent': {
          DEFAULT: '#5E6AD2',
          hover: '#6B76DC',
          muted: 'rgba(94, 106, 210, 0.15)',
        },
        // Text
        'linear-text': {
          primary: '#EEEFF1',
          secondary: '#A1A1AA',
          tertiary: '#71717A',
          muted: '#52525B',
        },
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
      borderColor: {
        linear: {
          subtle: 'rgba(255, 255, 255, 0.06)',
          default: 'rgba(255, 255, 255, 0.1)',
          strong: 'rgba(255, 255, 255, 0.15)',
        },
      },
    },
  },
};
```

## Key Design Principles

1. **Minimal borders** - Use subtle transparency-based borders, not solid colors
2. **Hierarchy through color** - Use text color shades to create hierarchy, not size
3. **Subtle hover states** - Background changes on hover, not dramatic effects
4. **Accent sparingly** - Purple accent only for key actions and active states
5. **Glow for emphasis** - Use box-shadow glow for primary buttons and active elements
6. **Dark but not black** - Primary background is very dark gray, not pure black
7. **High contrast text** - Primary text should be nearly white for readability

## Files

- **Desktop Mockup**: `docs/design/linear-style-mockup.html`
- **Mobile Mockup**: `docs/design/linear-style-mobile-mockup.html`
- **This file**: `docs/design/linear-style-tokens.md` - Reference for implementation

---

## Implementation Plan (Desktop + Mobile)

### Unified Approach

Both desktop and mobile share the **same design tokens**. The only differences are:

| Aspect       | Desktop           | Mobile                            |
| ------------ | ----------------- | --------------------------------- |
| Layout       | Sidebar + grid    | Tab bar + drawer                  |
| Navigation   | Fixed sidebar     | Bottom tabs + swipe drawer        |
| Cards        | Multi-column grid | Single column + horizontal scroll |
| Interactions | Hover states      | Touch/active states               |

### Phase 1: Foundation (Day 1)

```
1. Update Tailwind config with Linear tokens
2. Add dark mode class to root (or use ThemeProvider)
3. Update globals.css with CSS variables
4. Test with one component (e.g., Button)
```

**Files to modify:**

- `apps/web/tailwind.config.js`
- `apps/web/src/app/globals.css`
- `apps/web/src/providers/ThemeProvider.tsx`

### Phase 2: Shared Components (Days 2-3)

Style these components ONCE, they work on both platforms:

```
Priority 1 (Core):
├── Card (packages/ui or apps/web/src/components/ui/card.tsx)
├── Button
├── Badge / Status indicators
├── Input / Search
└── Progress bar

Priority 2 (Content):
├── List items (task rows, case rows)
├── Section headers
├── Avatar
└── Icons (swap to Heroicons outline style)
```

### Phase 3: Desktop Layout (Day 4)

```
├── Sidebar navigation
├── Header bar
├── Dashboard grid
└── Widget containers
```

**Files:**

- `apps/web/src/components/layout/Sidebar.tsx`
- `apps/web/src/components/layout/Header.tsx`
- `apps/web/src/components/dashboard/DashboardGrid.tsx`

### Phase 4: Mobile Layout (Day 5)

```
├── MobileTabBar
├── MobileDrawer
├── MobileHome (masthead, briefing)
├── BriefRow / FeedSection
└── AssistantFAB
```

**Files:**

- `apps/web/src/components/mobile/MobileTabBar.tsx`
- `apps/web/src/components/mobile/MobileDrawer.tsx`
- `apps/web/src/components/mobile/MobileHome.tsx`
- `apps/web/src/components/mobile/BriefRow.tsx`

### Phase 5: Polish (Day 6)

```
├── Transitions and animations
├── Focus states (accessibility)
├── Loading skeletons (dark mode versions)
├── Empty states
└── Error states
```

---

## Mobile-Specific Considerations

### Touch Targets

- Minimum 44x44px for all interactive elements
- Tab bar items: full height tap area

### Safe Areas

```css
padding-top: env(safe-area-inset-top);
padding-bottom: env(safe-area-inset-bottom);
```

### Active States (instead of hover)

```css
.item:active {
  background: var(--bg-hover);
  transform: scale(0.98);
}
```

### Horizontal Scrolling

Use for case cards on mobile:

```css
.scroll-container {
  display: flex;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
}
```

---

## Tailwind Classes Mapping

| Linear Token       | Tailwind Class             |
| ------------------ | -------------------------- |
| `--bg-primary`     | `bg-linear-bg-primary`     |
| `--bg-secondary`   | `bg-linear-bg-secondary`   |
| `--text-primary`   | `text-linear-text-primary` |
| `--accent-primary` | `text-linear-accent`       |
| `--border-subtle`  | `border-linear-subtle`     |

Or use the `dark:` prefix with standard Tailwind colors configured for dark mode.

---

## Additional Component Patterns (Extended Mockup)

The expanded mockup (`linear-style-mockup.html`) now includes these additional sections:

### Calendar Items

Compact date display with event details and type badges.

```css
.calendar-item {
  display: flex;
  align-items: flex-start;
  gap: var(--space-3);
  padding: var(--space-3) 0;
  border-bottom: 1px solid var(--border-subtle);
}

.calendar-date {
  background: var(--bg-tertiary);
  border-radius: var(--radius-md);
  padding: var(--space-2) var(--space-3);
  text-align: center;
}

.calendar-badge.court {
  background: var(--status-error-bg);
  color: var(--status-error);
}
.calendar-badge.meeting {
  background: var(--status-info-bg);
  color: var(--status-info);
}
.calendar-badge.deadline {
  background: var(--status-warning-bg);
  color: var(--status-warning);
}
```

### Communication Items

Email/message previews with unread indicators.

```css
.comm-item.unread {
  background: rgba(94, 106, 210, 0.05);
}

.comm-unread-dot {
  width: 8px;
  height: 8px;
  background: var(--accent-primary);
  border-radius: 50%;
}
```

### AI Insights Panel

Distinctive card with gradient border and categorized insights.

```css
.ai-card::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 2px;
  background: var(--gradient-accent);
}

.ai-insight.urgent {
  background: var(--status-error-bg);
}
.ai-insight.suggestion {
  background: var(--accent-secondary);
}
.ai-insight.info {
  background: var(--bg-tertiary);
}
```

### Document Activity

Document changes with action-type icons (added, modified, shared, signed).

```css
.doc-icon.added {
  background: var(--status-success-bg);
  color: var(--status-success);
}
.doc-icon.modified {
  background: var(--status-warning-bg);
  color: var(--status-warning);
}
.doc-icon.shared {
  background: var(--status-info-bg);
  color: var(--status-info);
}
.doc-icon.signed {
  background: var(--accent-secondary);
  color: var(--accent-primary);
}
```

### Financial Overview

Revenue display with mini bar chart and stat grid.

```css
.finance-chart {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 60px;
}

.chart-bar {
  width: 12px;
  background: var(--bg-hover);
  border-radius: 3px;
}

.chart-bar.active {
  background: var(--gradient-accent);
}
```

### Pipeline Visualization

Horizontal progress bars for case stages.

```css
.pipeline-bar {
  height: 8px;
  border-radius: 4px;
  transition: width 0.5s ease;
}

.pipeline-bar.new {
  background: var(--text-tertiary);
}
.pipeline-bar.analysis {
  background: var(--status-info);
}
.pipeline-bar.active {
  background: var(--gradient-accent);
}
.pipeline-bar.pending {
  background: var(--status-warning);
}
.pipeline-bar.closing {
  background: var(--status-success);
}
```

### Notifications

Color-coded notification items with subtle hover animation.

```css
.notif-item {
  padding: var(--space-3);
  border-radius: var(--radius-md);
  transition: all 0.15s ease;
}

.notif-item:hover {
  transform: translateX(4px);
}

.notif-item.urgent {
  background: var(--status-error-bg);
}
.notif-item.warning {
  background: var(--status-warning-bg);
}
.notif-item.info {
  background: var(--status-info-bg);
}
.notif-item.success {
  background: var(--status-success-bg);
}
```

### Command Palette Preview

Search input with action shortcuts (⌘K style).

```css
.command-search {
  background: var(--bg-tertiary);
  border: 1px solid var(--border-subtle);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
}

.command-item-shortcut {
  font-family: var(--font-mono);
  background: var(--bg-tertiary);
  padding: 2px 6px;
  border-radius: 4px;
}
```

---

## Key Interaction Patterns

### Hover States

Linear uses subtle, consistent hover patterns:

```css
/* List item expansion on hover */
.list-item:hover {
  background: var(--bg-hover);
  margin: 0 calc(-1 * var(--space-5));
  padding-left: var(--space-5);
  padding-right: var(--space-5);
}

/* Slide right for actionable items */
.ai-insight:hover,
.notif-item:hover {
  transform: translateX(4px);
}
```

### Focus States

For keyboard accessibility:

```css
.search-box:focus-within {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px var(--accent-secondary);
}
```

### Active/Press States (Mobile)

```css
.item:active {
  background: var(--bg-hover);
  transform: scale(0.98);
}
```
