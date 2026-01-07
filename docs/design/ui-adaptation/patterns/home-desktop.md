# Desktop Home Page Pattern

**Status**: Discovery Complete
**Reference**: `docs/design/linear-style-mockup.html`
**Mockup**: `docs/design/ui-adaptation/mockups/home-desktop.html`

## Current vs Target Comparison

### Sidebar Navigation

| Aspect            | Current                    | Target (Mockup)                          | Decision                                |
| ----------------- | -------------------------- | ---------------------------------------- | --------------------------------------- |
| Logo              | Text only "Legal Platform" | Icon + "Bojin Law"                       | **Hardcode "Bojin Law" + icon**         |
| Sections          | Single "Navigare" section  | Two sections: "Principal" + "Management" | **Hybrid: group existing items**        |
| Nav items         | 9 items in flat list       | Split by purpose                         | **Keep current, reorganize**            |
| User menu         | None (QuickActions)        | Avatar + name + role at bottom           | **Replace QuickActions with user menu** |
| Collapse behavior | Overlay with backdrop      | Fixed 240px                              | **Fixed 240px**                         |

**Current nav items:**

- Tablou de Bord, Analiză, Cazuri, Cazurile Mele, Documente, Sarcini, Comunicări, Pontaj, Activitate Echipă

**Mockup nav items:**

- Principal: Dashboard, Cazuri, Sarcini, Calendar, Documente
- Management: Clienți, Facturare, Pontaj, Rapoarte

### Dashboard Layout

| Aspect            | Current                             | Target (Mockup)                       | Decision                                 |
| ----------------- | ----------------------------------- | ------------------------------------- | ---------------------------------------- |
| Morning Briefing  | Complex collapsible sections        | Greeting + summary + 4 stats row      | **Simplify to mockup style**             |
| Widget grid       | DashboardGrid (12-col)              | 3-column CSS grid                     | **Static CSS grid**                      |
| Card style        | Various widget components           | Unified card pattern with header/body | **Unified card pattern**                 |
| Case items        | Detailed (badges, icons, team size) | Minimal (case#, title, client, dot)   | **Minimal style**                        |
| Task items        | Various styles                      | Checkbox + title + meta row           | **Match mockup style**                   |
| Status indicators | Text badges for all                 | Dots for status, pills for priority   | **Dots + pills pattern**                 |
| Widgets           | 5 widgets                           | 4 widgets                             | **Match mockup, drop FirmCasesOverview** |

**Current widgets (Partner):**

- MorningBriefing
- SupervisedCasesWidget
- TodayTasksWidget
- FirmTasksOverviewWidget
- FirmCasesOverviewWidget
- EmployeeWorkloadWidget

**Mockup widgets:**

- Morning Briefing (with stats)
- Cazuri Supravegheate (case items with status dots)
- Sarcinile Mele (task list with checkboxes + priority badges)
- Metrici Firmă (2x2 metric grid)
- Utilizare Echipă (workload bars)

## Gaps Identified

### 1. Sidebar Structure

- [ ] Need grouped navigation sections
- [ ] Need user menu with avatar at bottom
- [ ] Logo should have icon + customizable firm name

### 2. Card Pattern

- [ ] Unified `.card` with `.card-header` and `.card-body`
- [ ] Header has icon + title + optional actions
- [ ] Hover states that expand into padding

### 3. List Item Patterns

- [ ] Case items: case number (accent, mono), title, client, status dot
- [ ] Task items: checkbox, title, meta row with priority badge
- [ ] Hover: expand to fill padding

### 4. Status Indicators

- [ ] Status dots: active (green glow), pending (yellow), at-risk (red pulse)
- [ ] Priority badges: urgent (red), high (orange), medium (blue)

## Decisions Summary

### Sidebar

1. **Logo**: Hardcode "Bojin Law" with icon
2. **Sections**: Two groups - "Principal" + "Management"
3. **Nav items**: Keep current, reorganize into sections
4. **User menu**: Replace QuickActions with user avatar + name + role
5. **Behavior**: Fixed 240px (no collapse)

### Navigation Grouping

```
Principal:
  - Tablou de Bord
  - Cazuri / Cazurile Mele (role-based)
  - Sarcini
  - Documente
  - Comunicări

Management:
  - Analiză (Partner only)
  - Pontaj
  - Activitate Echipă (Partner only)
```

### Dashboard

1. **Morning Briefing**: Simplify to greeting + summary + 4 stats
2. **Widget grid**: Static 3-column CSS grid
3. **Widgets**: 4 widgets (drop FirmCasesOverview)
   - Cazuri Supravegheate
   - Sarcinile Mele
   - Metrici Firmă
   - Utilizare Echipă (spans 2 cols)

### Component Patterns

1. **Cards**: Unified pattern with header (icon + title + action) and body
2. **Case items**: Minimal - case# (accent mono), title, client, status dot
3. **Task items**: Checkbox + title + meta row (priority pill + case + due)
4. **Status dots**: Green (glow), Yellow, Red (pulse) for case status
5. **Priority pills**: Urgent (red), High (orange), Medium (blue) for tasks

## Session Notes

### Session 1 (2024-12-29)

- Compared mockup to current implementation
- Made 10 decisions covering sidebar, dashboard, and component patterns
- Ready for implementation planning
