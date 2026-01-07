# Claude Code Project Configuration

## Project Overview

**bojin-law-ui** - AI-powered legal case management UI with desktop and mobile experiences.

## Key Documentation

| Document                       | Purpose                         | When to Read               |
| ------------------------------ | ------------------------------- | -------------------------- |
| `.claude/docs/architecture.md` | Tech stack, project structure   | Starting any work          |
| `.claude/docs/mobile-ux.md`    | Mobile design system & patterns | **Any mobile UI work**     |
| `.claude/docs/decisions.md`    | Design decisions log            | Understanding past choices |

## Mobile UX Rules

> **IMPORTANT**: When working on any mobile UI (`src/app/m/**`), you MUST:
>
> 1. Read `.claude/docs/mobile-ux.md` first
> 2. Reference the HTML mockups in `mockups/` folder
> 3. Match the mockups exactly - they are the source of truth
> 4. Verify changes with `npx ts-node scripts/capture-mobile.ts`

### Quick Design Tokens

```
Backgrounds: #0a0a0a (primary) → #141414 (elevated) → #1a1a1a (card)
Text: #fafafa (primary) → #a1a1a1 (secondary) → #6b6b6b (tertiary)
Accent: #3b82f6 (blue), #f59e0b (warning), #22c55e (success)
Spacing: Always px-6 (24px) for content padding
```

## Development Commands

```bash
npm run dev          # Start dev server (port 3001)
npm run type-check   # TypeScript validation
npm run lint         # ESLint
```

## Workflow Commands

```
/context    - Load project state
/brainstorm - Collaborative ideation
/research   - Parallel investigation
/plan       - Task breakdown
/implement  - Execute plan
/iterate    - Visual inspection with screenshots
/commit     - Create verified commit
```

## File Conventions

- Mobile pages: `src/app/m/**/*.tsx`
- Mobile components: `src/components/layout/Mobile*.tsx`
- Mockups (source of truth): `mockups/*.html`
- Screenshots: `.claude/work/screenshots/`
