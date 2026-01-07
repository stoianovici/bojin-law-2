# Mobile UX Framework

> **Source of Truth**: All mobile UI must match the HTML mockups in `mockups/` folder.
> **Design Direction**: Superhuman-inspired, minimal, high-contrast dark theme.

---

## Quick Reference

```
BEFORE making any mobile UI changes:
1. Read this document
2. Open the relevant mockup in mockups/*.html
3. Match the mockup exactly - pixel-perfect is the goal
4. Verify with screenshots using scripts/capture-mobile.ts
```

---

## Design Tokens

### Colors

```css
/* Backgrounds - Dark to light hierarchy */
--mobile-bg-primary: #0a0a0a; /* Main background */
--mobile-bg-elevated: #141414; /* Tab bar, sheets, inputs */
--mobile-bg-card: #1a1a1a; /* Cards, icon boxes */
--mobile-bg-hover: #242424; /* Hover/press states */

/* Text - High contrast hierarchy */
--mobile-text-primary: #fafafa; /* Primary text, titles */
--mobile-text-secondary: #a1a1a1; /* Secondary text, meta */
--mobile-text-tertiary: #6b6b6b; /* Muted text, labels, icons */

/* Borders */
--mobile-border: #2a2a2a; /* Default borders */
--mobile-border-subtle: #1f1f1f; /* Subtle dividers between items */

/* Semantic Colors */
--mobile-accent: #3b82f6; /* Blue - links, active states, today */
--mobile-warning: #f59e0b; /* Orange - urgent, due soon, attention */
--mobile-success: #22c55e; /* Green - completed, success */
--mobile-purple: #a855f7; /* Purple - court/instanță events */

/* Semantic with opacity */
--mobile-accent-subtle: rgba(59, 130, 246, 0.15);
--mobile-warning-subtle: rgba(245, 158, 11, 0.15);
--mobile-success-subtle: rgba(34, 197, 94, 0.15);
--mobile-purple-subtle: rgba(168, 85, 247, 0.15);
```

### Typography

| Element       | Size | Weight | Letter-spacing | Color            | Example                     |
| ------------- | ---- | ------ | -------------- | ---------------- | --------------------------- |
| Greeting      | 26px | 700    | -0.03em        | primary          | "Bună dimineața, Alexandru" |
| Page title    | 22px | 700    | -0.02em        | primary          | "Dosare", "Calendar"        |
| Detail header | 17px | 600    | -0.02em        | primary          | "Smith v. Jones"            |
| Item title    | 15px | 600    | -0.01em        | primary          | Task/case name              |
| Body text     | 15px | 400    | normal         | primary          | Content text                |
| Meta text     | 13px | 400    | normal         | secondary        | "2024/123 · Ion Popescu"    |
| Section label | 11px | 600    | 0.1em          | tertiary         | "ATENȚIE", "TASKURI AZI"    |
| Tab bar label | 10px | 500    | normal         | tertiary/primary | "Acasă", "Dosare"           |

**Section labels are ALWAYS:**

- UPPERCASE
- 11px font size
- 600 weight
- 0.1em letter-spacing
- text-tertiary color

### Spacing

```
4px   - Tiny gaps (between icon and label)
8px   - Small gaps (between elements in a row)
12px  - Medium gaps (icon-to-content gap, padding in small elements)
16px  - Standard gaps (item vertical padding, section header margin)
24px  - Main content padding (px-6 - ALWAYS use this for page content)
32px  - Section bottom margins
48px  - Header top padding (accounts for status bar safe area)
```

**Critical spacing rules:**

- Page content padding: ALWAYS `px-6` (24px)
- List items: `py-4` (16px vertical)
- Section margin-bottom: `mb-8` (32px)
- Header top padding: `pt-12` (48px) for safe area

---

## Component Patterns

### 1. Page Headers

**Home Page** (superhuman-mobile.html)

```tsx
<header className="flex items-center justify-between px-6 pt-12 pb-4">
  <div className="text-[18px] font-bold tracking-[-0.02em]">Bojin Law</div>
  <div className="flex items-center gap-3">
    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-[#667eea] to-[#764ba2] flex items-center justify-center text-[13px] font-semibold">
      AP
    </div>
    <button className="w-8 h-8 flex items-center justify-center text-mobile-text-secondary">
      <Menu className="w-5 h-5" strokeWidth={2} />
    </button>
  </div>
</header>
```

**Tab Pages** (cases-tab.html, calendar-tab.html)

```tsx
<header className="flex items-center justify-between px-6 pt-12 pb-4">
  <h1 className="text-[22px] font-bold tracking-[-0.02em]">Dosare</h1>
  <button className="w-8 h-8 flex items-center justify-center text-mobile-text-secondary">
    <Menu className="w-5 h-5" strokeWidth={2} />
  </button>
</header>
```

**Detail Pages** (case-detail.html, task-detail.html)

```tsx
<header className="flex items-center gap-3 px-6 pt-12 pb-4 border-b border-mobile-border-subtle">
  <button className="w-8 h-8 -ml-2 flex items-center justify-center text-mobile-text-secondary">
    <ChevronLeft className="w-5 h-5" strokeWidth={2} />
  </button>
  <h1 className="flex-1 text-[17px] font-semibold tracking-[-0.02em] truncate">Smith v. Jones</h1>
  <button className="w-8 h-8 flex items-center justify-center text-mobile-text-secondary">
    <MoreHorizontal className="w-5 h-5" strokeWidth={2} />
  </button>
</header>
```

### 2. Section Headers

```tsx
<div className="flex items-center justify-between mb-4">
  <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-mobile-text-tertiary">
    Taskuri azi
  </span>
  {/* Optional count badge */}
  <span className="text-[12px] font-medium text-mobile-text-tertiary bg-mobile-bg-elevated px-2 py-0.5 rounded-[10px]">
    3
  </span>
</div>
```

### 3. List Items

**Standard list item** (cases, recent items):

```tsx
<Link
  href="/m/cases/1"
  className="flex items-center gap-3 py-4 -mx-6 px-6 border-b border-[#1f1f1f] hover:bg-mobile-bg-elevated transition-colors"
>
  {/* Icon box - 40x40, rounded-10, bg-card with border */}
  <div className="w-10 h-10 rounded-[10px] bg-mobile-bg-card border border-mobile-border flex items-center justify-center flex-shrink-0">
    <Folder className="w-5 h-5 text-mobile-text-secondary" strokeWidth={2} />
  </div>

  {/* Content */}
  <div className="flex-1 min-w-0">
    <p className="text-[15px] font-semibold tracking-[-0.01em] mb-0.5">Smith v. Jones</p>
    <p className="text-[13px] text-mobile-text-secondary flex items-center gap-2">
      <span>Litigiu comercial</span>
      <span className="w-[3px] h-[3px] rounded-full bg-mobile-text-tertiary" />
      <span>12 taskuri</span>
    </p>
  </div>

  {/* Chevron */}
  <ChevronRight className="w-4 h-4 text-mobile-text-tertiary flex-shrink-0" />
</Link>
```

### 4. Attention Cards

```tsx
<div
  className={cn(
    'flex items-start gap-3 p-4 rounded-xl',
    'bg-mobile-bg-card border border-mobile-border',
    isUrgent && 'border-l-[3px] border-l-[#f59e0b]'
  )}
>
  {/* Icon - 36x36 with colored background */}
  <div
    className={cn(
      'w-9 h-9 rounded-[10px] flex items-center justify-center flex-shrink-0',
      isUrgent ? 'bg-[#f59e0b]/15' : 'bg-blue-500/15'
    )}
  >
    <Zap className={cn('w-4 h-4', isUrgent ? 'text-[#f59e0b]' : 'text-blue-500')} />
  </div>

  {/* Content */}
  <div className="flex-1 min-w-0">
    <p className="text-[15px] font-semibold tracking-[-0.01em] mb-0.5">
      Întârziat: Contract Popescu
    </p>
    <p className="text-[13px] text-mobile-text-secondary">Termen depășit cu 1 zi</p>
  </div>
</div>
```

### 5. Task Items (with checkbox)

```tsx
<div className="flex items-start gap-3 py-4 -mx-6 px-6 border-b border-[#1f1f1f]">
  {/* Round checkbox - 20x20 */}
  <div
    className={cn(
      'w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 flex items-center justify-center',
      completed ? 'bg-[#22c55e] border-[#22c55e]' : 'border-mobile-border'
    )}
  >
    {completed && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
  </div>

  {/* Content */}
  <div className="flex-1 min-w-0">
    <p
      className={cn(
        'text-[15px] font-medium tracking-[-0.01em] mb-1',
        completed && 'line-through text-mobile-text-tertiary'
      )}
    >
      Revizuire contract Smith
    </p>
    <p className="text-[13px] text-mobile-text-secondary flex items-center gap-2">
      <span>Smith v. Jones</span>
      <span className="w-[3px] h-[3px] rounded-full bg-mobile-text-tertiary" />
      <span className={cn(dueSoon && 'text-[#f59e0b]')}>Până la 17:00</span>
    </p>
  </div>
</div>
```

### 6. FAB Button

```tsx
<button
  onClick={handleCreate}
  className={cn(
    'fixed bottom-24 left-1/2 -translate-x-1/2 z-40',
    'flex items-center gap-2 px-7 py-3.5 rounded-full',
    'bg-mobile-text-primary text-mobile-bg-primary',
    'font-semibold text-[15px]',
    'shadow-lg shadow-black/40',
    'hover:scale-105 active:scale-95 transition-transform'
  )}
>
  <Plus className="w-[18px] h-[18px]" strokeWidth={2.5} />
  Nou
</button>
```

### 7. Bottom Tab Bar

```tsx
<nav className="fixed bottom-0 left-0 right-0 bg-mobile-bg-elevated border-t border-mobile-border z-50">
  <div className="flex justify-around py-2 pb-6">
    {' '}
    {/* pb-6 for home indicator */}
    {tabs.map((tab) => (
      <Link
        key={tab.href}
        href={tab.href}
        className={cn(
          'flex flex-col items-center gap-1 px-4 py-2',
          isActive ? 'text-mobile-text-primary' : 'text-mobile-text-tertiary'
        )}
      >
        <tab.icon className="w-[22px] h-[22px]" strokeWidth={2} />
        <span className="text-[10px] font-medium">{tab.label}</span>
      </Link>
    ))}
  </div>
</nav>
```

### 8. Search Input

```tsx
<div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-mobile-bg-elevated border border-mobile-border">
  <Search className="w-[18px] h-[18px] text-mobile-text-tertiary" strokeWidth={2} />
  <input
    type="text"
    placeholder="Caută..."
    className="flex-1 bg-transparent text-[15px] text-mobile-text-primary placeholder:text-mobile-text-tertiary outline-none"
  />
</div>
```

### 9. Filter Chips

```tsx
<div className="flex gap-2 overflow-x-auto pb-2">
  {filters.map((filter) => (
    <button
      key={filter.id}
      className={cn(
        'px-4 py-2 rounded-full text-[14px] font-medium whitespace-nowrap transition-colors',
        isActive
          ? 'bg-mobile-accent/15 text-mobile-accent border border-mobile-accent'
          : 'bg-mobile-bg-elevated text-mobile-text-secondary border border-mobile-border'
      )}
    >
      {filter.label}
    </button>
  ))}
</div>
```

---

## Page Structure

### Standard Tab Page Layout

```tsx
export default function MobilePage() {
  return (
    <div className="animate-fadeIn">
      {/* Header - sticky, with safe area padding */}
      <header className="...">...</header>

      {/* Content - px-6 padding, pb-24 for tab bar */}
      <main className="px-6 pb-24">
        {/* Sections with mb-8 spacing */}
        <section className="mb-8">
          <SectionHeader label="Section Name" count={3} />
          <div>{/* List items */}</div>
        </section>
      </main>

      {/* Optional FAB */}
      <FAB />
    </div>
  );
}
```

---

## Mockup Reference

| Page         | Mockup File            | Key Elements                                 |
| ------------ | ---------------------- | -------------------------------------------- |
| Home         | superhuman-mobile.html | Greeting, attention cards, tasks, FAB        |
| Cases List   | cases-tab.html         | Search bar, sections, folder icons           |
| Case Detail  | case-detail.html       | Info section, tabs, task list, bottom action |
| Calendar     | calendar-tab.html      | Month grid, legend, event list               |
| Search       | search-tab.html        | Input with cancel, filters, results          |
| Bottom Sheet | bottom-sheet.html      | Handle, action items                         |
| Task Detail  | task-detail.html       | Large checkbox, metadata, notes              |

---

## Verification Process

After making changes to mobile UI:

1. **Run the capture script:**

   ```bash
   npx ts-node scripts/capture-mobile.ts
   ```

2. **Compare screenshots:**
   - Screenshots saved to `.claude/work/screenshots/iterate-mobile-mockups-v2/`
   - Open the corresponding mockup HTML in browser
   - Compare side-by-side

3. **Check for:**
   - Correct spacing (24px padding)
   - Correct typography (sizes, weights, colors)
   - Correct colors (use exact hex values)
   - Component patterns match mockup
   - No visual regressions on other pages

---

## Common Mistakes to Avoid

1. **Wrong padding**: Always use `px-6` (24px) for main content, not `px-4`
2. **Wrong font sizes**: Check the typography table - titles are 15px, not 14px
3. **Missing letter-spacing**: Section labels need `tracking-[0.1em]`
4. **Wrong icon sizes**: Tab bar icons are 22x22, list icons are 20x20
5. **Missing stroke width**: Icons should have `strokeWidth={2}`
6. **Wrong border colors**: Use `#1f1f1f` for subtle dividers, `#2a2a2a` for borders
7. **Forgetting safe area**: Headers need `pt-12` for status bar
8. **Wrong checkbox style**: Tasks use round checkboxes (20px), not square

---

## File Locations

```
Mobile Pages:
  src/app/m/page.tsx           # Home
  src/app/m/cases/page.tsx     # Cases list
  src/app/m/cases/[id]/page.tsx # Case detail
  src/app/m/calendar/page.tsx  # Calendar
  src/app/m/search/page.tsx    # Search

Mobile Components:
  src/components/layout/MobileHeader.tsx
  src/components/layout/BottomTabBar.tsx
  src/components/layout/BottomSheet.tsx
  src/components/mobile/CreateSheet.tsx

Mockups:
  mockups/superhuman-mobile.html
  mockups/cases-tab.html
  mockups/case-detail.html
  mockups/calendar-tab.html
  mockups/search-tab.html
  mockups/bottom-sheet.html
  mockups/task-detail.html
```

---

_Last updated: 2025-12-31_
