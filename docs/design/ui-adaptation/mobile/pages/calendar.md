# Mobile Calendar Page

> Calendar and schedule view for mobile.

## 1. Calendar View

### Layout Options

Mobile calendar offers two views:

- **Week view** (default) - Similar to desktop but simplified
- **Agenda view** - List of upcoming events

### Week View

```
┌─────────────────────────────────────────────────┐
│ [safe area]                                     │
├─────────────────────────────────────────────────┤
│ Calendar                           [☰][📅] [⋮] │
├─────────────────────────────────────────────────┤
│ [← Săpt. ant.]  28 Dec - 3 Ian  [Săpt. urm. →] │
├─────────────────────────────────────────────────┤
│ LUN  MAR  MIE  JOI  VIN                         │
│ 28   29   30   31    1                          │
├─────────────────────────────────────────────────┤
│                                                 │
│ 09:00 ┼─────────────────────────────────────────│
│       │ [🔴 Termen instanță]                    │
│       │ CAZ-2024-0156 • 09:00-10:00             │
│ 10:00 ┼─────────────────────────────────────────│
│       │                      [🔵 Întâlnire]     │
│       │                      Client • 10:00     │
│ 11:00 ┼─────────────────────────────────────────│
│       │                                         │
│ 12:00 ┼─────────────────────────────────────────│
│       │                                         │
│ ...                                             │
│                                                 │
│                      [+]                        │
├─────────────────────────────────────────────────┤
│  🏠      📁      ✓      📄      ✉️           │
└─────────────────────────────────────────────────┘
```

### Agenda View

```
┌─────────────────────────────────────────────────┐
│ Calendar                           [☰][📅] [⋮] │
├─────────────────────────────────────────────────┤
│                                                 │
│ AZI, 29 DECEMBRIE                               │
│ ┌─────────────────────────────────────────────┐ │
│ │ 🔴 09:00-10:00  Termen Instanță             │ │
│ │    Tribunalul București • CAZ-2024-0156     │ │
│ ├─────────────────────────────────────────────┤ │
│ │ 🔵 14:00-15:00  Întâlnire client            │ │
│ │    Ionescu Maria • CAZ-2024-0156            │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ MÂINE, 30 DECEMBRIE                             │
│ ┌─────────────────────────────────────────────┐ │
│ │ 🟠 10:00  Termen limită                     │ │
│ │    Depunere cerere • CAZ-2024-0142          │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ MARȚI, 31 DECEMBRIE                             │
│ ┌─────────────────────────────────────────────┐ │
│ │ 🟣 Toată ziua  Task                         │ │
│ │    Pregătire documente • CAZ-2024-0156      │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
└─────────────────────────────────────────────────┘
```

### Components

#### Header with View Toggle

```css
.calendar-header {
  background: var(--bg-secondary);
  padding: 16px;
  padding-top: calc(16px + var(--safe-area-top));
  display: flex;
  align-items: center;
  justify-content: space-between;
  border-bottom: 1px solid var(--border-subtle);
}

.view-toggle {
  display: flex;
  gap: 4px;
}

.view-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-sm);
  color: var(--text-tertiary);
}

.view-btn.active {
  color: var(--accent-primary);
  background: var(--accent-secondary);
}
```

#### Week Navigation

```css
.week-nav {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--border-subtle);
}

.week-nav-btn {
  width: 44px;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary);
}

.week-nav-btn:active {
  background: var(--bg-hover);
  border-radius: var(--radius-md);
}

.week-range {
  font-size: 15px;
  font-weight: 600;
  color: var(--text-primary);
}
```

#### Day Headers (Week View)

```css
.day-headers {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  border-bottom: 1px solid var(--border-subtle);
  position: sticky;
  top: 0;
  background: var(--bg-secondary);
}

.day-header {
  text-align: center;
  padding: 12px 4px;
}

.day-name {
  font-size: 11px;
  font-weight: 500;
  color: var(--text-tertiary);
  text-transform: uppercase;
}

.day-number {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-primary);
  margin-top: 2px;
}

.day-header.today .day-number {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--accent-primary);
  color: white;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 2px auto 0;
}
```

#### Time Grid (Week View)

```css
.time-grid {
  flex: 1;
  overflow-y: auto;
  position: relative;
}

.time-slot {
  display: flex;
  min-height: 60px;
  border-bottom: 1px solid var(--border-subtle);
}

.time-label {
  width: 48px;
  padding: 4px 8px;
  font-size: 11px;
  color: var(--text-tertiary);
  text-align: right;
  flex-shrink: 0;
}

.slot-content {
  flex: 1;
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  padding: 4px;
}
```

#### Event Card (Week View)

```css
.event-card {
  padding: 4px 8px;
  border-radius: 4px;
  border-left: 3px solid;
  font-size: 11px;
  overflow: hidden;
}

.event-card.court {
  background: rgba(239, 68, 68, 0.15);
  border-color: #ef4444;
  color: #ef4444;
}

.event-card.deadline {
  background: rgba(249, 115, 22, 0.15);
  border-color: #f97316;
  color: #f97316;
}

.event-card.meeting {
  background: rgba(59, 130, 246, 0.15);
  border-color: #3b82f6;
  color: #3b82f6;
}

.event-card.task {
  background: rgba(139, 92, 246, 0.15);
  border-color: #8b5cf6;
  color: #8b5cf6;
}

.event-card.hearing {
  background: rgba(236, 72, 153, 0.15);
  border-color: #ec4899;
  color: #ec4899;
}

.event-card.reminder {
  background: rgba(34, 197, 94, 0.15);
  border-color: #22c55e;
  color: #22c55e;
}

.event-title {
  font-weight: 500;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.event-time {
  font-size: 10px;
  opacity: 0.8;
}
```

#### Agenda Item

```css
.agenda-section {
  padding: 0 16px;
  margin-bottom: 24px;
}

.agenda-date {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 12px 0;
  position: sticky;
  top: 0;
  background: var(--bg-primary);
}

.agenda-list {
  background: var(--bg-secondary);
  border-radius: var(--radius-lg);
  overflow: hidden;
}

.agenda-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--border-subtle);
}

.agenda-item:last-child {
  border-bottom: none;
}

.agenda-item:active {
  background: var(--bg-hover);
}

.agenda-indicator {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  margin-top: 4px;
  flex-shrink: 0;
}

.agenda-content {
  flex: 1;
}

.agenda-time {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 2px;
}

.agenda-title {
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 4px;
}

.agenda-meta {
  font-size: 13px;
  color: var(--text-tertiary);
}
```

### Interactions

| Action              | Result                  |
| ------------------- | ----------------------- |
| Swipe left/right    | Navigate weeks          |
| Tap event           | Open event detail sheet |
| Tap day (week view) | Scroll to that day      |
| Pull down           | Refresh                 |
| FAB tap             | New event sheet         |
| View toggle         | Switch week/agenda      |

---

## 2. Event Detail Sheet

```
┌─────────────────────────────────────────────────┐
│       ═══════════════════                       │
│ Termen Instanță                            [×]  │
├─────────────────────────────────────────────────┤
│                                                 │
│ 🔴 Termen Instanță                              │
│                                                 │
│ CÂND                                            │
│ Duminică, 29 Decembrie 2024                     │
│ 09:00 - 10:00                                   │
│                                                 │
│ UNDE                                            │
│ Tribunalul București                            │
│ Bd. Unirii nr. 37, Sector 3                     │
│ [🗺 Deschide în Maps]                           │
│                                                 │
│ DOSAR                                           │
│ CAZ-2024-0156 - Ionescu vs. Alpha SRL           │
│                                                 │
│ DESCRIERE                                       │
│ Ședință de judecată pentru contestația          │
│ depusă la data de 15.11.2024                    │
│                                                 │
│ PARTICIPANȚI                                    │
│ [AB] Alexandru Bojin                            │
│ [MC] Maria Constantinescu                       │
│                                                 │
│ NOTIFICĂRI                                      │
│ ✓ 1 zi înainte                                  │
│ ✓ 2 ore înainte                                 │
│                                                 │
├─────────────────────────────────────────────────┤
│ [Șterge]                        [Editează]      │
└─────────────────────────────────────────────────┘
```

---

## 3. New Event Sheet

```
┌─────────────────────────────────────────────────┐
│       ═══════════════════                       │
│ Eveniment nou                              [×]  │
├─────────────────────────────────────────────────┤
│                                                 │
│ TIP EVENIMENT                                   │
│ [🔴 Termen Instanță ▼]                          │
│                                                 │
│ TITLU *                                         │
│ [Denumire eveniment...                        ] │
│                                                 │
│ DATA ȘI ORA                                     │
│ [29 Dec 2024, 09:00 - 10:00                  ▼] │
│                                                 │
│ LOCAȚIE                                         │
│ [Tribunalul București...                      ] │
│                                                 │
│ DOSAR                                           │
│ [CAZ-2024-0156 - Ionescu vs. Alpha        ▼]   │
│                                                 │
│ DESCRIERE                                       │
│ [Detalii...                                   ] │
│                                                 │
│ PARTICIPANȚI                                    │
│ [+ Adaugă participanți]                         │
│                                                 │
│ NOTIFICĂRI                                      │
│ [✓] 1 zi înainte                                │
│ [✓] 2 ore înainte                               │
│ [+ Adaugă notificare]                           │
│                                                 │
├─────────────────────────────────────────────────┤
│                              [Anulează][Salvează]│
└─────────────────────────────────────────────────┘
```

### Event Type Picker

Bottom sheet with event type options:

```
┌─────────────────────────────────────────────────┐
│       ═══════════════════                       │
│ Tip eveniment                                   │
├─────────────────────────────────────────────────┤
│ 🔴 Termen Instanță                              │
│ 🟠 Termen Limită                                │
│ 🔵 Întâlnire                                    │
│ 🟣 Sarcină                                      │
│ 🩷 Audiere                                      │
│ 🟢 Memento                                      │
├─────────────────────────────────────────────────┤
│ Anulează                                        │
└─────────────────────────────────────────────────┘
```

---

## 4. Filter Sheet

```
┌─────────────────────────────────────────────────┐
│       ═══════════════════                       │
│ Filtre calendar                            [×]  │
├─────────────────────────────────────────────────┤
│                                                 │
│ TIP EVENIMENT                                   │
│ [✓] 🔴 Termene Instanță                         │
│ [✓] 🟠 Termene Limită                           │
│ [✓] 🔵 Întâlniri                                │
│ [✓] 🟣 Sarcini                                  │
│ [✓] 🩷 Audieri                                  │
│ [✓] 🟢 Mementouri                               │
│                                                 │
│ ─────────────────────────────────────────────── │
│                                                 │
│ ECHIPĂ                                          │
│ [✓] Alexandru Bojin                             │
│ [✓] Ana Popescu                                 │
│ [✓] Maria Constantinescu                        │
│ [ ] Ion Vasilescu                               │
│                                                 │
├─────────────────────────────────────────────────┤
│ [Resetează]                     [Aplică filtre] │
└─────────────────────────────────────────────────┘
```

---

## States

### Loading

Skeleton for time grid or agenda items.

### Empty

```
┌─────────────────────────────────────────────────┐
│                                                 │
│              [📅]                               │
│                                                 │
│         Niciun eveniment                        │
│                                                 │
│    Nu aveți evenimente în această perioadă.     │
│                                                 │
│           [+ Adaugă eveniment]                  │
│                                                 │
└─────────────────────────────────────────────────┘
```

---

## Gestures

| Gesture          | Action                       |
| ---------------- | ---------------------------- |
| Horizontal swipe | Navigate weeks               |
| Vertical scroll  | Scroll time slots / agenda   |
| Tap + hold       | Quick add event at time slot |
| Pull down        | Refresh calendar             |
| Pinch (optional) | Zoom week view in/out        |

---

## Comparison: Desktop vs Mobile

| Aspect          | Desktop                     | Mobile                 |
| --------------- | --------------------------- | ---------------------- |
| Default view    | Week (Mon-Fri)              | Week or Agenda toggle  |
| Sidebar filters | Always visible              | Filter sheet           |
| Event density   | High (multi-column per day) | Low (stack events)     |
| Navigation      | Calendar widget             | Swipe + nav buttons    |
| New event       | Sidebar form                | Bottom sheet           |
| Event detail    | Popover                     | Bottom sheet           |
| Time grid       | Full week                   | 5 days visible, scroll |
