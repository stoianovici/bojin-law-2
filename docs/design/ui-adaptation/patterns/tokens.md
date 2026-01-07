# Design Tokens

> Consolidated from all mockups. Single source of truth for Linear-style design system.

## Colors

### Background

| Token            | Value     | Usage                                 |
| ---------------- | --------- | ------------------------------------- |
| `--bg-primary`   | `#0A0A0B` | Page background, app shell            |
| `--bg-secondary` | `#111113` | Cards, sidebar, elevated surfaces     |
| `--bg-tertiary`  | `#18181B` | Input backgrounds, nested elements    |
| `--bg-elevated`  | `#1C1C1F` | Modals, popovers, tooltips            |
| `--bg-hover`     | `#232326` | Hover states                          |
| `--bg-active`    | `#2A2A2E` | Active/pressed states, selected items |

### Border

| Token              | Value                       | Usage                        |
| ------------------ | --------------------------- | ---------------------------- |
| `--border-subtle`  | `rgba(255, 255, 255, 0.06)` | Default borders, dividers    |
| `--border-default` | `rgba(255, 255, 255, 0.1)`  | Hover borders, emphasized    |
| `--border-strong`  | `rgba(255, 255, 255, 0.15)` | Active borders, focus states |

### Text

| Token              | Value     | Usage                     |
| ------------------ | --------- | ------------------------- |
| `--text-primary`   | `#EEEFF1` | Headings, primary content |
| `--text-secondary` | `#A1A1AA` | Body text, descriptions   |
| `--text-tertiary`  | `#71717A` | Labels, hints, metadata   |
| `--text-muted`     | `#52525B` | Disabled, placeholder     |

### Accent (Linear Purple)

| Token                    | Value                      | Usage                                  |
| ------------------------ | -------------------------- | -------------------------------------- |
| `--accent-primary`       | `#5E6AD2`                  | Primary buttons, links, active states  |
| `--accent-primary-hover` | `#6B76DC`                  | Hover on accent elements               |
| `--accent-secondary`     | `rgba(94, 106, 210, 0.15)` | Accent backgrounds, selected nav items |
| `--accent-glow`          | `rgba(94, 106, 210, 0.4)`  | Glow effects, AI indicators            |

### Status

| Token              | Value     | Background                 | Usage                     |
| ------------------ | --------- | -------------------------- | ------------------------- |
| `--status-success` | `#22C55E` | `rgba(34, 197, 94, 0.15)`  | Success, completed, done  |
| `--status-warning` | `#F59E0B` | `rgba(245, 158, 11, 0.15)` | Warning, attention needed |
| `--status-error`   | `#EF4444` | `rgba(239, 68, 68, 0.15)`  | Error, danger, urgent     |
| `--status-info`    | `#3B82F6` | `rgba(59, 130, 246, 0.15)` | Info, in progress         |

### Priority

| Token               | Value     | Usage           |
| ------------------- | --------- | --------------- |
| `--priority-urgent` | `#EF4444` | Urgent priority |
| `--priority-high`   | `#F59E0B` | High priority   |
| `--priority-medium` | `#3B82F6` | Medium priority |
| `--priority-low`    | `#71717A` | Low priority    |

### Calendar Event Colors

| Event Type                     | Color     | Background                 |
| ------------------------------ | --------- | -------------------------- |
| Court dates (Termene Instanță) | `#EF4444` | `rgba(239, 68, 68, 0.15)`  |
| Deadlines (Termene Limită)     | `#F97316` | `rgba(249, 115, 22, 0.15)` |
| Meetings (Întâlniri)           | `#3B82F6` | `rgba(59, 130, 246, 0.15)` |
| Tasks (Sarcini)                | `#8B5CF6` | `rgba(139, 92, 246, 0.15)` |
| Hearings (Audieri)             | `#EC4899` | `rgba(236, 72, 153, 0.15)` |
| Reminders (Mementouri)         | `#22C55E` | `rgba(34, 197, 94, 0.15)`  |

---

## Typography

### Font Family

```css
--font-sans: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
--font-mono: 'SF Mono', 'Fira Code', 'Fira Mono', monospace;
```

### Font Sizes

| Size | Value  | Usage                              |
| ---- | ------ | ---------------------------------- |
| xs   | `11px` | Badges, shortcuts, tiny labels     |
| sm   | `12px` | Metadata, section titles, captions |
| base | `13px` | Body text, nav items, buttons      |
| md   | `14px` | Input text, card content           |
| lg   | `15px` | Modal titles, subheadings          |
| xl   | `16px` | Form title inputs                  |
| 2xl  | `18px` | Modal/dialog headings              |
| 3xl  | `20px` | Page headings                      |
| 4xl  | `24px` | Dashboard stats, large numbers     |

### Font Weights

| Weight   | Value | Usage                        |
| -------- | ----- | ---------------------------- |
| regular  | `400` | Body text                    |
| medium   | `500` | Nav items, buttons, emphasis |
| semibold | `600` | Headings, titles, labels     |
| bold     | `700` | Stats, important numbers     |

### Line Heights

| Value | Usage                     |
| ----- | ------------------------- |
| `1.0` | Single-line headings      |
| `1.4` | Compact text, nav items   |
| `1.5` | Body text (default)       |
| `1.6` | Descriptions, longer text |

### Letter Spacing

| Value    | Usage                    |
| -------- | ------------------------ |
| `0.5px`  | Uppercase section titles |
| `normal` | Everything else          |

---

## Spacing

### Scale

| Token        | Value  | Tailwind |
| ------------ | ------ | -------- |
| `--space-1`  | `4px`  | `p-1`    |
| `--space-2`  | `8px`  | `p-2`    |
| `--space-3`  | `12px` | `p-3`    |
| `--space-4`  | `16px` | `p-4`    |
| `--space-5`  | `20px` | `p-5`    |
| `--space-6`  | `24px` | `p-6`    |
| `--space-8`  | `32px` | `p-8`    |
| `--space-10` | `40px` | `p-10`   |

### Common Patterns

| Context            | Padding                           | Gap       |
| ------------------ | --------------------------------- | --------- |
| Card header/footer | `16px 20px`                       | -         |
| Card body          | `16px 20px` or `20px`             | -         |
| Modal padding      | `20px` or `24px`                  | -         |
| Button             | `8px 14px` (sm), `10px 16px` (md) | `6-8px`   |
| Input              | `10px 12px`                       | -         |
| Nav item           | `8px 12px`                        | `12px`    |
| Icon + text        | -                                 | `6-8px`   |
| Button group       | -                                 | `8-12px`  |
| Section gap        | -                                 | `16-24px` |

---

## Border Radius

| Token         | Value  | Usage                         |
| ------------- | ------ | ----------------------------- |
| `--radius-sm` | `6px`  | Badges, small buttons, inputs |
| `--radius-md` | `8px`  | Buttons, nav items, inputs    |
| `--radius-lg` | `12px` | Cards, sections               |
| `--radius-xl` | `16px` | Modals, large surfaces        |
| `50%`         | -      | Avatars, status dots          |

---

## Shadows

| Token           | Value                               | Usage                      |
| --------------- | ----------------------------------- | -------------------------- |
| `--shadow-sm`   | `0 1px 2px rgba(0, 0, 0, 0.3)`      | Subtle elevation (buttons) |
| `--shadow-md`   | `0 4px 12px rgba(0, 0, 0, 0.4)`     | Cards on hover             |
| `--shadow-lg`   | `0 8px 24px rgba(0, 0, 0, 0.5)`     | Modals, dropdowns          |
| `--shadow-glow` | `0 0 40px rgba(94, 106, 210, 0.15)` | Accent glow effect         |

---

## Gradients

```css
/* Accent gradient for special elements */
--gradient-accent: linear-gradient(135deg, #5e6ad2 0%, #8b5cf6 100%);

/* Subtle card surface gradient */
--gradient-card: linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, transparent 100%);

/* Top glow for page headers */
--gradient-glow: radial-gradient(ellipse at top, rgba(94, 106, 210, 0.15) 0%, transparent 50%);
```

---

## Transitions

| Property          | Duration | Easing |
| ----------------- | -------- | ------ |
| Colors, opacity   | `0.15s`  | `ease` |
| Transform, shadow | `0.2s`   | `ease` |
| Modal enter       | `0.15s`  | `ease` |
| Slide-over enter  | `0.2s`   | `ease` |

---

## Z-Index Scale

| Layer          | Value | Usage               |
| -------------- | ----- | ------------------- |
| Base           | `0`   | Normal content      |
| Dropdown       | `10`  | Dropdowns, popovers |
| Sticky         | `20`  | Sticky headers      |
| Modal backdrop | `40`  | Modal overlays      |
| Modal          | `50`  | Modal content       |
| Toast          | `100` | Toast notifications |

---

## Layout Constants

| Element           | Value    |
| ----------------- | -------- |
| Sidebar width     | `240px`  |
| Max content width | `1200px` |
| Card min-width    | `300px`  |
| Modal width (sm)  | `400px`  |
| Modal width (md)  | `520px`  |
| Slide-over width  | `400px`  |
| Toast width       | `380px`  |

---

## Tailwind Mapping

For implementation, map these tokens to Tailwind custom colors:

```js
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        linear: {
          bg: {
            primary: '#0A0A0B',
            secondary: '#111113',
            tertiary: '#18181B',
            elevated: '#1C1C1F',
            hover: '#232326',
            active: '#2A2A2E',
          },
          border: {
            subtle: 'rgba(255, 255, 255, 0.06)',
            DEFAULT: 'rgba(255, 255, 255, 0.1)',
            strong: 'rgba(255, 255, 255, 0.15)',
          },
          text: {
            primary: '#EEEFF1',
            secondary: '#A1A1AA',
            tertiary: '#71717A',
            muted: '#52525B',
          },
          accent: {
            DEFAULT: '#5E6AD2',
            hover: '#6B76DC',
            muted: 'rgba(94, 106, 210, 0.15)',
          },
        },
      },
    },
  },
};
```
