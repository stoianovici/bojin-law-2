# Linear UI Adaptation Phase 2

> Pattern-based discovery and implementation of Linear design system.

**Active Issue**: [OPS-344](../../ops/issues/ops-344.md)
**Status**: Discovery Complete
**Last Updated**: 2024-12-29

## Quick Links

- **Desktop Implementation**: [desktop/implementation.md](desktop/implementation.md) - Desktop implementation checklist
- **Desktop Patterns**: [patterns/](patterns/) - Design tokens, components, layouts
- **Mobile Implementation**: [mobile/implementation.md](mobile/implementation.md) - Mobile implementation checklist
- **Mobile Documentation**: [mobile/](mobile/) - Complete mobile UI guide
- **HTML Mockups**: [mockups/](mockups/) - Visual references

## Directory Structure

```
docs/design/ui-adaptation/
├── README.md                 # This file
├── audit/                    # Previous audit work (reference)
│   ├── components.md
│   ├── pages.md
│   └── mobile.md
├── mockups/                  # HTML mockups (reference)
│   └── *.html
├── patterns/                 # Desktop patterns (complete)
│   ├── tokens.md            # Design tokens
│   ├── avatars.md           # User avatars
│   ├── badges.md            # Status, priority badges
│   ├── cards.md             # Widget, document, task cards
│   ├── forms.md             # Inputs, buttons
│   ├── headers.md           # Page headers
│   ├── modals.md            # Dialogs, sheets, toasts
│   ├── navigation.md        # Sidebar, tabs
│   ├── sections.md          # Collapsible sections
│   ├── tables.md            # Data tables
│   └── states.md            # Empty, loading, error
├── desktop/                  # Desktop documentation
│   └── implementation.md    # Desktop implementation checklist
└── mobile/                   # Mobile documentation (complete)
    ├── README.md            # Overview
    ├── principles.md        # Core mobile principles
    ├── navigation.md        # Bottom nav, tabs, sheets
    ├── components.md        # Mobile component adaptations
    ├── interactions.md      # Touch gestures
    ├── implementation.md    # Implementation checklist
    └── pages/               # Page-specific layouts
        ├── home.md
        ├── cases.md
        ├── tasks.md
        ├── documents.md
        ├── communications.md
        └── calendar.md
```

## Desktop Patterns (Complete)

| Pattern        | File                                    | Description                      |
| -------------- | --------------------------------------- | -------------------------------- |
| Design Tokens  | [tokens.md](patterns/tokens.md)         | Colors, typography, spacing      |
| Status Badges  | [badges.md](patterns/badges.md)         | Status dots, priority pills      |
| Cards          | [cards.md](patterns/cards.md)           | Widget, document, task cards     |
| Data Tables    | [tables.md](patterns/tables.md)         | Minimal, grouped, report styles  |
| Forms & Inputs | [forms.md](patterns/forms.md)           | Text fields, buttons, checkboxes |
| Modals/Dialogs | [modals.md](patterns/modals.md)         | Confirmation, form, slide-over   |
| Page Headers   | [headers.md](patterns/headers.md)       | Title, toolbar, breadcrumbs      |
| Navigation     | [navigation.md](patterns/navigation.md) | Sidebar, tabs, toggles           |
| Sections       | [sections.md](patterns/sections.md)     | Collapsible task/period sections |
| States         | [states.md](patterns/states.md)         | Empty, loading, error states     |
| Avatars        | [avatars.md](patterns/avatars.md)       | User avatars, groups             |

## Mobile Documentation (Complete)

| Document                                                  | Description                           |
| --------------------------------------------------------- | ------------------------------------- |
| [README.md](mobile/README.md)                             | Overview and quick reference          |
| [principles.md](mobile/principles.md)                     | Touch targets, typography, safe areas |
| [navigation.md](mobile/navigation.md)                     | Bottom nav, FAB, headers, sheets      |
| [components.md](mobile/components.md)                     | Cards, buttons, inputs, modals        |
| [interactions.md](mobile/interactions.md)                 | Tap, swipe, pull, pinch gestures      |
| [implementation.md](mobile/implementation.md)             | Full implementation checklist         |
| [pages/home.md](mobile/pages/home.md)                     | Mobile dashboard layout               |
| [pages/cases.md](mobile/pages/cases.md)                   | Cases list and detail                 |
| [pages/tasks.md](mobile/pages/tasks.md)                   | Tasks with swipe actions              |
| [pages/documents.md](mobile/pages/documents.md)           | Document grid and preview             |
| [pages/communications.md](mobile/pages/communications.md) | Email list/detail/compose             |
| [pages/calendar.md](mobile/pages/calendar.md)             | Week and agenda views                 |

## Key Decisions

### Desktop

- Linear dark theme as default
- 240px fixed sidebar
- Accent color: Linear purple (#5E6AD2)
- 13px base font size
- Collapsible sections for lists

### Mobile

- Bottom tab bar (5 tabs)
- 44px minimum touch targets
- 16px font for inputs (prevents iOS zoom)
- Bottom sheets replace modals
- Swipe actions for quick operations
- Wizard pattern for complex forms

## Next Steps

Create implementation issues:

- Desktop component implementation
- Mobile component implementation
- Page-by-page migration

## Background

Phase 1 (OPS-331 to OPS-337) established:

- Linear tokens in Tailwind config
- Dark mode as default
- Core layout components (Sidebar, TopBar, PageLayout)
- Dashboard widgets and task components

Phase 2 (OPS-344) completed pattern discovery and mobile documentation.
