# Mobile Design Principles

> Core rules and adaptations for mobile UI. All patterns extend the desktop Linear design system.

## 1. Touch Target Requirements

Every interactive element must be touch-friendly.

### Minimum Sizes

| Element               | Minimum Size | Recommended    |
| --------------------- | ------------ | -------------- |
| Buttons               | 44 × 44px    | 48 × 48px      |
| Form inputs           | 44px height  | 48px height    |
| Icon buttons          | 44 × 44px    | 44 × 44px      |
| List items            | 44px height  | 52-56px height |
| Checkboxes (tap area) | 44 × 44px    | 44 × 44px      |

### Implementation

```css
/* Button - touch optimized */
.btn-mobile {
  min-height: 48px;
  padding: 14px 20px;
  border-radius: var(--radius-lg);
}

/* Icon button - invisible touch padding */
.icon-btn-mobile {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  /* Visual icon can be 20-24px, touch area is 44px */
}

/* List item - full-row tap */
.list-item-mobile {
  min-height: 52px;
  padding: 14px 16px;
}
```

### Spacing Between Targets

Minimum 8px gap between adjacent touch targets to prevent mis-taps.

---

## 2. Typography

Mobile requires larger base sizes for legibility and iOS zoom prevention.

### Font Sizes

| Context        | Desktop | Mobile  |
| -------------- | ------- | ------- |
| Body text      | 13px    | 16px    |
| Secondary text | 12px    | 14px    |
| Small labels   | 11px    | 12px    |
| Headings       | 16-20px | 18-24px |
| Page titles    | 20px    | 22px    |

### Critical: Input Font Size

```css
/* Prevents iOS auto-zoom on focus */
.form-input {
  font-size: 16px; /* Must be >= 16px */
}
```

### Line Height

- Body: 1.5 (same as desktop)
- Compact lists: 1.4
- Headings: 1.2

---

## 3. Spacing & Layout

### Viewport Constraints

```css
:root {
  /* Safe areas for notch/home indicator */
  --safe-area-top: env(safe-area-inset-top);
  --safe-area-bottom: env(safe-area-inset-bottom);
  --safe-area-left: env(safe-area-inset-left);
  --safe-area-right: env(safe-area-inset-right);
}

.page-container {
  padding-top: var(--safe-area-top);
  padding-bottom: calc(88px + var(--safe-area-bottom)); /* Fixed bottom nav */
}
```

### Common Spacing Values

| Context                 | Value            |
| ----------------------- | ---------------- |
| Page horizontal padding | 16px             |
| Card internal padding   | 16px             |
| Section gap             | 24px             |
| List item gap           | 1px (separator)  |
| Bottom nav height       | 88px + safe area |
| Fixed header height     | ~64px            |

### Full-Width Patterns

On mobile, many elements go edge-to-edge:

```css
/* Full-width card */
.card-mobile {
  margin: 0 -16px; /* Negative margin to escape page padding */
  border-radius: 0;
  border-left: none;
  border-right: none;
}

/* Or keep padding, use full-width within it */
.card-mobile-inset {
  margin: 0;
  border-radius: var(--radius-lg);
}
```

---

## 4. Colors & Contrast

Same tokens as desktop, but with mobile considerations:

### Backgrounds

```css
/* App background */
--bg-primary: #0a0a0b;

/* Cards, headers, bottom nav */
--bg-secondary: #111113;

/* Inputs, nested elements */
--bg-tertiary: #18181b;
```

### OLED Considerations

True black (`#0A0A0B`) works well on OLED screens for:

- Battery savings
- Deeper contrast
- Less eye strain in dark environments

### Status Bar

The app should request light status bar content (white text/icons) to match the dark theme.

---

## 5. Active States (vs Hover)

Mobile has no hover. Use `:active` for touch feedback.

### Pattern

```css
/* Desktop */
.btn:hover {
  background: var(--bg-hover);
}

/* Mobile - add active state */
.btn:active {
  background: var(--bg-active);
  transform: scale(0.98);
}
```

### Feedback Guidelines

| Element       | Active Feedback                  |
| ------------- | -------------------------------- |
| Buttons       | Background change + slight scale |
| Cards         | Background change                |
| List items    | Background highlight             |
| Icon buttons  | Background tint                  |
| Swipe actions | Reveal colored action            |

### Transition

Keep transitions short for responsive feel:

```css
.interactive {
  transition:
    transform 0.1s ease,
    background 0.15s ease;
}
```

---

## 6. Safe Areas

Modern phones have notches, dynamic islands, and home indicators.

### Top Safe Area

```css
.header-mobile {
  padding-top: calc(12px + var(--safe-area-top));
}
```

### Bottom Safe Area

```css
.bottom-nav {
  padding-bottom: calc(16px + var(--safe-area-bottom));
}

.floating-button {
  bottom: calc(100px + var(--safe-area-bottom));
}
```

### Landscape (Optional)

```css
.content {
  padding-left: calc(16px + var(--safe-area-left));
  padding-right: calc(16px + var(--safe-area-right));
}
```

---

## 7. Loading & Performance

### Perceived Performance

- Skeleton loading instead of spinners for content
- Optimistic updates for user actions
- Lazy load below-fold content

### Skeleton Guidelines

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
```

### Image Loading

- Use placeholder colors/gradients
- Progressive loading for large images
- Cache aggressively

---

## 8. Accessibility

### Touch Accessibility

- All touch targets meet 44px minimum
- Sufficient contrast (4.5:1 for text)
- Clear focus states for keyboard navigation

### Screen Readers

```html
<!-- Icon-only buttons need labels -->
<button aria-label="Adaugă sarcină">
  <svg>...</svg>
</button>

<!-- Status updates -->
<div role="status" aria-live="polite">Se încarcă...</div>
```

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 9. Forms on Mobile

### Wizard Pattern

For complex forms (new case, time entry):

1. Split into logical steps
2. One focus per screen
3. Progress indicator at top
4. Fixed bottom navigation

See [../mockups/cases-new-mobile.html](../mockups/cases-new-mobile.html) for reference.

### Input Types

Use correct input types for native keyboards:

| Field  | Input Type                               | Keyboard         |
| ------ | ---------------------------------------- | ---------------- |
| Email  | `type="email"`                           | @ symbol visible |
| Phone  | `type="tel"`                             | Numeric pad      |
| Number | `type="number"` or `inputmode="numeric"` | Numeric          |
| Search | `type="search"`                          | Search button    |
| Date   | `type="date"`                            | Native picker    |

### Validation

- Inline validation on blur
- Error messages below field
- Red border + text for errors
- Don't disable submit - show all errors

---

## 10. Gestures

### Standard Gestures

| Gesture                  | Action                           |
| ------------------------ | -------------------------------- |
| Pull to refresh          | Reload list content              |
| Swipe left on list item  | Reveal actions (edit, delete)    |
| Swipe right on list item | Quick action (complete, archive) |
| Long press               | Context menu                     |
| Pinch (optional)         | Zoom documents                   |

### Swipe Actions

```css
.swipe-action-left {
  background: var(--status-error);
  /* Delete, remove */
}

.swipe-action-right {
  background: var(--status-success);
  /* Complete, approve */
}
```

### Pull to Refresh

Visual indicator at top, accent color spinner.

---

## Summary Checklist

When implementing any mobile component:

- [ ] Touch targets ≥ 44px
- [ ] Font size ≥ 16px for inputs
- [ ] Safe area padding applied
- [ ] Active states defined
- [ ] Loading state defined
- [ ] Error state defined
- [ ] Accessibility labels added
- [ ] Gesture interactions considered
