# Data Tables Pattern

> Extracted from mockups/tables-exploration.html

## Table Styles

We use different table styles depending on context:

### 1. Minimal Table (Primary Style)

**Use for:** Case lists, document lists, simple data views

```
┌─────────────────────────────────────────────────────────┐
│ Dosar          Client              Status       Ore     │  ← Light header, no bg
├─────────────────────────────────────────────────────────┤
│ 123/2024       SC Example SRL      ● Activ      24.5   │  ← Row with subtle border
│ Litigiu civil  ↑ subtitle in muted                      │
├─────────────────────────────────────────────────────────┤
│ 456/2024       Tech Solutions      ○ În așteptare 8.0  │
│ Contract IT                                             │
└─────────────────────────────────────────────────────────┘
```

**CSS characteristics:**

- No header background color
- Light bottom border only (`border-subtle`)
- Row hover: `bg-hover`
- Title + description in first column
- Status dot + label

### 2. Grouped Table

**Use for:** Time entries, activity logs, tasks by date

```
┌─────────────────────────────────────────────────────────┐
│ [▼] ACEASTĂ SĂPTĂMÂNĂ  3 înregistrări  ─────────────── │  ← Collapsible header
├─────────────────────────────────────────────────────────┤
│ Luni    Ana Bojin    Cercetare juridică    4.5h   ✓    │
│ Marți   Maria C.     Redactare contract    3.0h   ✓    │
├─────────────────────────────────────────────────────────┤
│ [▶] SĂPTĂMÂNA TRECUTĂ  12 înregistrări  ────────────── │  ← Collapsed
├─────────────────────────────────────────────────────────┤
│ [▶] DECEMBRIE 2024  45 înregistrări  ───────────────── │
└─────────────────────────────────────────────────────────┘
```

**Grouping options:**

- By date: Azi, Ieri, Această săptămână, [Month Year]
- By status: Urgente, În progress, Finalizate
- By case: Group entries per case

**Behavior:**

- Recent groups expanded by default
- Older groups collapsed
- Click header to toggle
- Show count in header

### 3. Report Table

**Use for:** Billing reports, AI usage analytics, exports

```
┌─────────────────────────────────────────────────────────┐
│ Raport Activitate Echipă                    [CSV] [⚙]  │  ← Header with actions
│ Decembrie 2024 · 156 înregistrări                       │
├─────────────────────────────────────────────────────────┤
│ [Toate] [Facturabile] [Non-fact] │ [Ana] [Maria] [+]   │  ← Filter bar
├─────────────────────────────────────────────────────────┤
│ DATA     UTILIZATOR    DOSAR    ACTIVITATE   ORE  ST   │  ← Classic header
├─────────────────────────────────────────────────────────┤
│ 27 Dec   Ana Bojin     123/24   Cercetare    4.5  ✓    │
│ 27 Dec   Maria C.      456/24   Contract     3.0  ◐    │
├─────────────────────────────────────────────────────────┤
│ Total perioada                               156.5h     │  ← Footer totals
│                                              €7,825     │
└─────────────────────────────────────────────────────────┘
```

**Components:**

- Report header with title, subtitle, action buttons
- Filter bar with chips (toggle filters)
- Classic table with sortable columns
- Footer with totals

---

## Usage by Page

| Page                  | Table Style | Notes                           |
| --------------------- | ----------- | ------------------------------- |
| /cases                | Minimal     | Title + description, status dot |
| /cases/[id]/documents | Minimal     | Or grid view - user toggle      |
| /cases/[id]/time      | Grouped     | By date (week/day)              |
| /tasks                | Grouped     | By urgency/due date             |
| /admin/ai-ops         | Report      | Filters, export, totals         |
| /admin/users          | Minimal     | Avatar, role, status            |
| /reports/\*           | Report      | Full report layout              |

---

## Shared Elements

### Sortable Column Header

```html
<th class="cursor-pointer hover:bg-hover" onclick="sort('column')">
  Coloană <span class="sort-icon">↕</span>
</th>
```

- Unsorted: `↕` muted
- Sorted asc: `↑` accent
- Sorted desc: `↓` accent

### Row Hover

```css
tbody tr:hover {
  background: var(--bg-hover);
}
```

### Numeric Alignment

- Numbers: `text-right font-mono`
- Currency: `€24.50` (Euro symbol, 2 decimals)
- Hours: `24.5h` or `24.5` (context provides unit)

### Empty State

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│              [icon]                                     │
│         Nu există date                                  │
│   pentru perioada selectată                             │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Loading State

- Skeleton rows with `animate-pulse`
- Match column widths
- Show 3-5 skeleton rows

---

## Implementation Notes

1. **No separate DataTable component** - Each table is built inline with these patterns
2. **Mobile**: Tables with 4+ columns → card view on mobile (like CaseListTable)
3. **Pagination**: Prefer infinite scroll or "Load more" over page numbers
4. **Selection**: Only add checkboxes if bulk actions exist
