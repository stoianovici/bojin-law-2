# /iterate - Visual Inspection

**Purpose**: Visually inspect implemented features using Playwright screenshots and generate iteration feedback.
**Mode**: Semi-autonomous (Claude captures, analyzes, proposes fixes)
**Input**: `implement-{slug}.md` OR explicit pages/components
**Output**: `.claude/work/tasks/iterate-{slug}.md`

## Invocation

```bash
# From implementation doc
/iterate implement-{slug}

# Explicit pages
/iterate --pages /,/cases,/tasks

# Explicit components
/iterate --components Button,Card,Input

# Mix of both
/iterate --pages /dashboard --components Button,Badge

# All pages and all components
/iterate --all
```

## Prerequisites

Playwright must be installed (already in devDependencies):

```bash
npm install
npx playwright install chromium  # If not already installed
```

## Auto-load Context

```
Read: .claude/work/tasks/implement-{slug}.md → Understand what was changed
Read: .claude/docs/architecture.md → Design system reference
```

---

## Execution Steps

### 1. Determine Targets

**If given `implement-{slug}`**:

- Read `.claude/work/tasks/implement-{slug}.md` (or `done/implement-{slug}.md`)
- Extract changed files from "Files Changed" table
- Map files to pages/components:
  - `src/app/(dashboard)/page.tsx` → page `/`
  - `src/app/(dashboard)/cases/page.tsx` → page `/cases`
  - `src/components/ui/Button.tsx` → component `Button`

**If given explicit targets**:

- Use the provided `--pages` and `--components` lists

**If `--all`**:

- Pages: `/`, `/login`, `/cases`, `/tasks`, `/documents`, `/email`, `/time`
- Components: `Button`, `Card`, `Input`, `Badge`, `Avatar`, `Dialog`, `DropdownMenu`, `Tooltip`, `Select`, `ScrollArea`, `Tabs`, `Separator`, `Popover`, `Toast`

### 2. Ensure Dev Server Running

Check if dev server is running:

```bash
curl -s http://localhost:3001 > /dev/null 2>&1
```

If not running, start it in background:

```bash
npm run dev &
# Wait for server to be ready
sleep 5
```

### 3. Capture Screenshots

Run the visual capture script:

```bash
npx ts-node scripts/visual-capture.ts \
  --slug {slug} \
  --pages /,/cases,/tasks \
  --components Button,Card
```

This creates:

- `.claude/work/screenshots/iterate-{slug}/page-*.png` (page screenshots)
- `.claude/work/screenshots/iterate-{slug}/component-*.png` (component screenshots)
- `.claude/work/screenshots/iterate-{slug}/manifest.json` (capture metadata)

### 4. Analyze Screenshots

For each screenshot in the manifest:

1. Read the image file using the Read tool (Claude supports images)
2. Analyze against design system expectations:

**Layout Checks**:

- Proper spacing and padding (4px grid system)
- Correct alignment of elements
- No content overflow or truncation
- Responsive behavior

**Typography Checks**:

- Correct font sizes (text-xs through text-3xl)
- Proper font weights
- Color contrast (text-linear-text-primary vs secondary vs muted)

**Design System Compliance**:

- Dark theme correct (bg-linear-bg-primary #0A0A0B)
- Accent color usage (linear-accent #5E6AD2)
- Border colors (linear-border-subtle, linear-border-default)
- Elevation via backgrounds (primary < elevated < tertiary)

**Component Rendering**:

- All variants render correctly
- States visible (hover, focus, disabled)
- Icons and text aligned properly

**Accessibility (Visual)**:

- Sufficient color contrast
- Focus indicators visible
- Text readable at size

### 5. Generate Feedback

Create structured feedback with:

- Summary of what was inspected
- Issues found with screenshot references
- Actionable fix tasks for `/implement`

---

## Output: Task Document

**Write to**: `.claude/work/tasks/iterate-{slug}.md`

```markdown
# Iteration: [Feature/Slug Name]

**Status**: Review Complete
**Date**: [YYYY-MM-DD]
**Input**: `implement-{slug}.md` (or explicit targets)
**Screenshots**: `.claude/work/screenshots/iterate-{slug}/`
**Next step**: Fix issues or proceed to `/commit`

---

## Inspection Summary

### Pages Inspected

| Route  | Screenshot     | Issues |
| ------ | -------------- | ------ |
| /      | page-home.png  | 0      |
| /cases | page-cases.png | 2      |
| /tasks | page-tasks.png | 1      |

### Components Inspected

| Component | Screenshot           | Issues |
| --------- | -------------------- | ------ |
| Button    | component-Button.png | 0      |
| Card      | component-Card.png   | 1      |

---

## Issues Found

### Issue 1: [Descriptive Title]

- **Location**: [Page route or Component name]
- **Screenshot**: `[filename].png`
- **What I See**: [Description of the visual problem]
- **Expected**: [What it should look like based on design system]
- **Suggested Fix**:
  - File: `src/path/to/file.tsx`
  - Line: ~XX
  - Change: [Specific code change needed]

### Issue 2: ...

---

## Iteration Tasks

> These tasks can be passed to `/implement iterate-{slug}` for automated fixes

### Task 1: [Fix Title]

- **File**: src/path/to/file.tsx (MODIFY)
- **Do**: [Specific change instructions]
- **Done when**: [Visual acceptance criteria]

### Task 2: ...

---

## Verdict

- [ ] **Issues found** - Run `/implement iterate-{slug}` to fix, or make manual changes
- [x] **No issues** - Implementation looks good! Proceed to `/commit`
```

---

## Component Preview Routes

Components can be previewed in isolation at:

```
/dev/preview/[ComponentName]
```

Available components:

- `/dev/preview/Button`
- `/dev/preview/Card`
- `/dev/preview/Input`
- `/dev/preview/Badge`
- `/dev/preview/Avatar`
- `/dev/preview/Dialog`
- `/dev/preview/DropdownMenu`
- `/dev/preview/Tooltip`
- `/dev/preview/Select`
- `/dev/preview/ScrollArea`
- `/dev/preview/Tabs`
- `/dev/preview/Separator`
- `/dev/preview/Popover`
- `/dev/preview/Toast`

---

## Analysis Guidelines

When analyzing screenshots, provide specific, actionable feedback:

**Good feedback**:

> The gap between stat cards is 16px but should be 12px per Linear guidelines.
> File: `src/app/(dashboard)/page.tsx`, Line ~44
> Change: `gap-4` to `gap-3`

**Bad feedback**:

> The spacing looks off.

---

## Rules

- ALWAYS ensure dev server is running before capture
- CAPTURE full-page screenshots for pages
- ANALYZE each screenshot individually using vision
- PROVIDE specific, actionable fixes with file paths and line numbers
- REFERENCE screenshots by filename in issues
- FORMAT output for `/implement` consumption
- DO NOT make changes during iteration - only observe and document

---

## Transition

When analysis is complete:

1. Write iterate doc to `.claude/work/tasks/iterate-{slug}.md`

2. **If issues found**:

   > "Found X issue(s). Run `/implement iterate-{slug}` to fix automatically, or make manual changes."

3. **If no issues**:
   > "Implementation looks good! Proceed to `/commit`."

---

## Example Session

```
User: /iterate implement-story-40-pages

Claude:
1. Reads implement-story-40-pages.md
2. Extracts: pages /, /cases, /tasks modified
3. Checks dev server (running on :3001)
4. Runs: npx ts-node scripts/visual-capture.ts --slug story-40-pages --pages /,/cases,/tasks
5. Reads page-home.png, page-cases.png, page-tasks.png
6. Analyzes each screenshot against design system
7. Documents 2 issues found on /cases page
8. Writes iterate-story-40-pages.md with fixes
9. Reports: "Found 2 issues. Run `/implement iterate-story-40-pages` to fix."
```
