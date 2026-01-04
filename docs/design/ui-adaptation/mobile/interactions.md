# Touch Interactions & Gestures

> Standard gesture patterns for the mobile experience.

## Core Gestures

### 1. Tap

Single finger tap for primary actions.

| Context   | Action             |
| --------- | ------------------ |
| Button    | Trigger action     |
| List item | Navigate to detail |
| Checkbox  | Toggle state       |
| Tab       | Switch view        |
| Card      | Open detail/expand |

**Feedback:**

- Background color change (`:active` state)
- Optional scale transform (0.98) for buttons
- Immediate response (no delay)

```css
.tappable:active {
  background: var(--bg-hover);
}

.tappable-scale:active {
  transform: scale(0.98);
}
```

---

### 2. Long Press

Press and hold (300-500ms) for secondary actions.

| Context       | Action                      |
| ------------- | --------------------------- |
| List item     | Context menu (action sheet) |
| Task          | Reorder mode                |
| Document      | Multi-select mode           |
| Text          | Text selection              |
| Calendar slot | Quick create event          |

**Feedback:**

- Subtle scale up (1.02) on press
- Haptic feedback (if available)
- Context menu/action sheet appears

```css
.long-pressable:active {
  transform: scale(1.02);
  transition: transform 0.3s ease;
}
```

**Implementation:**

```javascript
// Long press detection
let pressTimer;
element.addEventListener('touchstart', () => {
  pressTimer = setTimeout(() => {
    // Trigger long press action
    navigator.vibrate?.(10); // Haptic
  }, 400);
});
element.addEventListener('touchend', () => clearTimeout(pressTimer));
element.addEventListener('touchmove', () => clearTimeout(pressTimer));
```

---

### 3. Swipe (Horizontal)

Horizontal swipe on list items for quick actions.

#### Left Swipe → Reveal Right Actions

Destructive/secondary actions.

```
┌─────────────────────────────────────────────────┐
│ ← Swipe                                         │
├─────────────────────────────────────────────────┤
│ [Content...                    ] [Archive][🗑] │
└─────────────────────────────────────────────────┘
```

| Context  | Actions         |
| -------- | --------------- |
| Task     | Archive, Delete |
| Email    | Archive, Delete |
| Case     | Archive         |
| Document | Delete          |

#### Right Swipe → Reveal Left Actions

Primary/positive actions.

```
┌─────────────────────────────────────────────────┐
│                              Swipe → │
├─────────────────────────────────────────────────┤
│ [✓ Done] [                    Content...] │
└─────────────────────────────────────────────────┘
```

| Context | Actions   |
| ------- | --------- |
| Task    | Complete  |
| Email   | Mark read |

**Thresholds:**

- Start detection: 10px horizontal movement
- Reveal action: 80px swipe
- Trigger action: Release beyond threshold or full swipe

**Styling:**

```css
.swipe-container {
  position: relative;
  overflow: hidden;
}

.swipe-actions-left {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  display: flex;
  transform: translateX(-100%);
}

.swipe-actions-right {
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  display: flex;
  transform: translateX(100%);
}

.swipe-action {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 80px;
  color: white;
  font-weight: 500;
}

.swipe-action.delete {
  background: var(--status-error);
}

.swipe-action.archive {
  background: var(--status-warning);
}

.swipe-action.complete {
  background: var(--status-success);
}
```

---

### 4. Swipe (Vertical)

#### Pull to Refresh

Pull down from top to refresh content.

**Thresholds:**

- Start detection: 40px from top
- Show indicator: 60px pull
- Trigger refresh: 100px release

**States:**

| State      | Visual                                                |
| ---------- | ----------------------------------------------------- |
| Pulling    | Arrow pointing down, grows with pull                  |
| Ready      | Arrow pointing up, "Eliberează pentru reîmprospătare" |
| Refreshing | Spinner, "Se încarcă..."                              |
| Complete   | Fade out                                              |

```css
.pull-indicator {
  position: absolute;
  top: -60px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  opacity: 0;
  transition:
    opacity 0.2s,
    top 0.2s;
}

.pull-indicator.visible {
  opacity: 1;
  top: 16px;
}

.pull-arrow {
  width: 24px;
  height: 24px;
  color: var(--accent-primary);
  transition: transform 0.2s;
}

.pull-indicator.ready .pull-arrow {
  transform: rotate(180deg);
}

.pull-text {
  font-size: 12px;
  color: var(--text-secondary);
}
```

#### Scroll

Standard vertical scroll with momentum.

- Scroll content areas
- Sticky headers remain visible
- Bottom nav remains fixed
- Fade scroll indicators on edges

---

### 5. Page Navigation Swipe

#### Swipe from Left Edge → Back

iOS-style back gesture.

```
┌───┬─────────────────────────────────────────────┐
│   │                                             │
│ ← │  [Page Content]                             │
│   │                                             │
└───┴─────────────────────────────────────────────┘
  ↑
Edge swipe zone (20px)
```

**Thresholds:**

- Start zone: 20px from left edge
- Gesture start: 10px horizontal movement
- Trigger back: 50% of screen width or velocity

```css
.page-transition-back {
  animation: slide-out-right 0.3s ease;
}

@keyframes slide-out-right {
  to {
    transform: translateX(100%);
    opacity: 0.5;
  }
}
```

#### Horizontal Swipe → Tab Navigation

On tab bars or segmented content.

| Context            | Action           |
| ------------------ | ---------------- |
| Calendar week view | Navigate weeks   |
| Case detail tabs   | Switch tabs      |
| Kanban columns     | Navigate columns |

---

### 6. Pinch

Two-finger pinch for zoom (optional, specific contexts).

| Context           | Action          |
| ----------------- | --------------- |
| Document preview  | Zoom in/out     |
| Image preview     | Zoom in/out     |
| Calendar (future) | Zoom time scale |

**Constraints:**

- Min zoom: 1.0x (fit to screen)
- Max zoom: 3.0x
- Snap back on release if below min

---

### 7. Double Tap

Two quick taps for zoom toggle.

| Context          | Action               |
| ---------------- | -------------------- |
| Document preview | Toggle 1x ↔ 2x zoom |
| Image preview    | Toggle fit ↔ fill   |

```javascript
let lastTap = 0;
element.addEventListener('touchend', (e) => {
  const now = Date.now();
  if (now - lastTap < 300) {
    // Double tap detected
    toggleZoom();
  }
  lastTap = now;
});
```

---

## Gesture Feedback

### Visual Feedback

| Gesture    | Feedback              |
| ---------- | --------------------- |
| Tap        | Background highlight  |
| Long press | Scale up + haptic     |
| Swipe      | Reveal action buttons |
| Pull       | Indicator animation   |
| Pinch      | Real-time scale       |

### Haptic Feedback

Use sparingly for important actions:

| Action             | Pattern    |
| ------------------ | ---------- |
| Task complete      | Light tap  |
| Delete confirm     | Medium tap |
| Error              | Double tap |
| Long press trigger | Light tap  |

```javascript
// Light tap
navigator.vibrate?.(10);

// Medium tap
navigator.vibrate?.(20);

// Double tap (error)
navigator.vibrate?.([10, 30, 10]);
```

### Animation Timing

| Gesture         | Duration | Easing      |
| --------------- | -------- | ----------- |
| Tap feedback    | 0.1s     | ease        |
| Swipe reveal    | 0.2s     | ease-out    |
| Pull indicator  | 0.2s     | ease        |
| Page transition | 0.3s     | ease-in-out |
| Modal/sheet     | 0.25s    | ease        |

---

## Gesture Conflicts

### Preventing Conflicts

1. **Scroll vs Horizontal Swipe**
   - Detect initial direction
   - Lock to primary axis after 10px

2. **Tap vs Long Press**
   - Clear timeout on move/end
   - Delay tap action slightly for disambiguation

3. **Edge Swipe vs Content Swipe**
   - Check touch start position
   - Prioritize edge gesture in zone

### Disabling Gestures

Some contexts should disable default gestures:

```css
/* Disable pull-to-refresh in scroll containers */
.no-pull-refresh {
  overscroll-behavior-y: contain;
}

/* Disable horizontal scroll for vertical lists */
.vertical-list {
  overflow-x: hidden;
  touch-action: pan-y;
}
```

---

## Gesture Summary by Page

| Page              | Gestures Used                                      |
| ----------------- | -------------------------------------------------- |
| Home              | Pull-to-refresh, tap                               |
| Cases list        | Pull-to-refresh, tap, swipe-left (archive)         |
| Case detail       | Tab swipe, tap                                     |
| Tasks             | Pull-to-refresh, tap, swipe-left/right, long-press |
| Documents         | Pull-to-refresh, tap, long-press                   |
| Doc preview       | Pinch, double-tap, swipe (pages)                   |
| Communications    | Pull-to-refresh, tap, swipe-left                   |
| Calendar          | Horizontal swipe (weeks), tap                      |
| All detail sheets | Swipe-down to dismiss                              |

---

## Accessibility

### Large Touch Targets

All interactive elements: minimum 44×44px.

### Alternative Actions

Every swipe action should also be available via:

- Long press context menu
- Tap → detail → action buttons

### Reduced Motion

```css
@media (prefers-reduced-motion: reduce) {
  .swipe-container,
  .pull-indicator,
  .page-transition {
    transition: none;
    animation: none;
  }
}
```

### VoiceOver/TalkBack

- Announce swipe actions: "Glisează pentru a șterge"
- Custom actions for swipe equivalents
