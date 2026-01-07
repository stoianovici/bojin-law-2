# Mobile UI Overhaul Guide

> Complete design specification for the mobile experience, built on Linear design principles.

**Parent Issue**: [OPS-344](../../ops/issues/ops-344.md)
**Last Updated**: 2024-12-29
**Platform**: Mobile (iOS/Android via responsive web)

## Overview

This documentation covers everything needed to implement the mobile-first UI redesign. All patterns extend the desktop Linear-style design system with mobile-specific adaptations.

## Key Principles

### 1. Mobile-First, Not Mobile-Compromised

The mobile experience is a first-class citizen, not a responsive afterthought:

- **Purpose-built layouts** - Not just stacked desktop columns
- **Touch-native interactions** - Gestures, not just smaller click targets
- **Contextual information density** - Show what matters for mobile use cases

### 2. Linear Design Language

All components inherit from the desktop pattern library:

- Same color tokens (`--bg-primary`, `--accent-primary`, etc.)
- Same typography scale (adjusted for mobile legibility)
- Same visual language (dark theme, subtle borders, accent glow)

### 3. Progressive Disclosure

Mobile screens are small. Show essential info first, reveal details on demand:

- Collapsed sections by default
- Bottom sheets for detail views
- Pull-to-expand for more content

## Documentation Structure

```
mobile/
├── README.md                  # This file (overview)
├── principles.md              # Core mobile design principles
├── navigation.md              # Navigation patterns
├── components.md              # Component adaptations
├── pages/                     # Page-specific layouts
│   ├── home.md
│   ├── cases.md
│   ├── tasks.md
│   ├── documents.md
│   ├── communications.md
│   └── calendar.md
├── interactions.md            # Touch & gesture patterns
└── implementation.md          # Implementation checklist
```

## Quick Reference

| Topic         | File                           | Key Decisions              |
| ------------- | ------------------------------ | -------------------------- |
| Touch targets | [principles.md](principles.md) | 44x44px minimum            |
| Bottom nav    | [navigation.md](navigation.md) | 5 tabs, floating action    |
| Cards         | [components.md](components.md) | Full-width, swipe actions  |
| Home page     | [pages/home.md](pages/home.md) | Briefing + quick actions   |
| Forms         | [components.md](components.md) | Wizard pattern, 16px fonts |

## Design Tokens (Mobile Overrides)

See [../patterns/tokens.md](../patterns/tokens.md) for full token reference. Mobile-specific:

| Token            | Desktop | Mobile                        | Reason                        |
| ---------------- | ------- | ----------------------------- | ----------------------------- |
| Font size (base) | 13px    | 16px                          | Legibility, prevents iOS zoom |
| Touch target     | N/A     | 44px                          | Apple HIG minimum             |
| Button height    | 36-40px | 48-52px                       | Touch-friendly                |
| Spacing (card)   | 16-20px | 16px                          | Consistent, efficient         |
| Safe area top    | N/A     | `env(safe-area-inset-top)`    | Notch/Dynamic Island          |
| Safe area bottom | N/A     | `env(safe-area-inset-bottom)` | Home indicator                |

## Prior Art

### Existing Desktop Patterns

All desktop patterns are documented in `../patterns/`:

- [tokens.md](../patterns/tokens.md) - Design tokens (shared)
- [badges.md](../patterns/badges.md) - Status dots, priority pills
- [cards.md](../patterns/cards.md) - Widget cards, task items
- [forms.md](../patterns/forms.md) - Inputs, buttons
- [modals.md](../patterns/modals.md) - Dialogs, slide-overs, toasts
- [navigation.md](../patterns/navigation.md) - Sidebar, tabs
- [states.md](../patterns/states.md) - Empty, loading, error

### Existing Mobile Mockup

Reference: `../mockups/cases-new-mobile.html`

This mockup establishes the wizard pattern for complex forms on mobile.

### Mobile Audit

Reference: `../audit/mobile.md`

Previous audit identified:

- `/cases/new` - Needs dedicated mobile component (wizard pattern)
- `/time-tracking` - Needs responsive fixes (low effort)

## Implementation Priority

Based on usage patterns and complexity:

| Priority | Page           | Approach                        | Effort |
| -------- | -------------- | ------------------------------- | ------ |
| P0       | Home           | Mobile-specific layout          | Medium |
| P0       | Cases list     | Responsive with mobile cards    | Low    |
| P0       | Case detail    | Tab-based mobile layout         | Medium |
| P1       | Tasks          | Mobile task list + quick add    | Medium |
| P1       | Documents      | Grid/list toggle, swipe actions | Medium |
| P2       | Calendar       | Week view, simplified           | Medium |
| P2       | Communications | 2-panel → single panel          | High   |
| P3       | /cases/new     | Wizard pattern (mockup exists)  | High   |
| P3       | /time-tracking | Responsive fixes                | Low    |

## Getting Started

1. Read [principles.md](principles.md) for core mobile decisions
2. Review [navigation.md](navigation.md) for app structure
3. Check relevant page in [pages/](pages/) for specific layouts
4. Reference [components.md](components.md) for component specs
5. Use [implementation.md](implementation.md) as checklist
