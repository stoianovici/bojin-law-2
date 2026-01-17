# Research Paper Quality Improvements - Session Checkpoint

**Date:** 2025-01-16
**Status:** In progress - architectural exploration phase

---

## Problem Statement

The Word add-in's AI research paper drafting produces content that is **informationally correct but lacks scholarly weight**. Documents read like "well-researched explainers" rather than academic papers.

### Symptoms observed in test output:

1. AI reasoning leaked into document ("Am adunat suficiente informații...")
2. Sparse citations - sources exist but not tied to claims with footnotes
3. Information presented sequentially, not argumentatively
4. No scholarly conversation (who agrees/disagrees with whom)
5. Flat structure - no thesis being built
6. Sources quoted but not analyzed

---

## What We Built (Completed)

### 1. Research Methodology Guidelines

**File:** `services/gateway/src/services/research-methodology-guidelines.ts`

Covers HOW to research:

- Systematic approach (understand question → plan search → calibrate depth)
- Source hierarchy (legislation → jurisprudence → doctrine)
- Source evaluation criteria (authority, recency, relevance)
- Content organization (Claim → Evidence → Analysis model)
- Multi-source synthesis techniques
- Quality checklist

### 2. Academic Writing Style Guidelines

**File:** `services/gateway/src/services/academic-writing-style-guidelines.ts`

Covers HOW to write with scholarly weight:

- Voice and register (formal, objective, calibrated certainty)
- Citation density (minimum 1-2 footnotes per substantive paragraph)
- Source integration techniques (not just quote, but analyze)
- Argumentative structure (each section advances the thesis)
- Scholarly conversation (show debates, acknowledge counterarguments)
- Visual apparatus (when to use boxes, tables, quotes strategically)
- Common mistakes to avoid

### 3. Updated draftWithResearch Prompt

**File:** `services/gateway/src/services/word-ai-prompts.ts`

Changes:

- Added critical rule: NO meta-commentary, start directly with title
- Restructured into 4 parts: Methodology → Academic Style → Process → Formatting
- Added concrete example of academic citation integration
- Included both checklists (research quality + academic writing)
- Emphasized citation density requirements

---

## Architectural Concern Identified

The prompt is now **~9,000+ words**. Concerns:

- Attention dilution on key instructions
- Potential conflicting signals
- Cost/latency increase
- Diminishing returns

---

## Two-Phase Architecture (IMPLEMENTED)

Separates Research and Writing into distinct phases:

### Proposed Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        PHASE 1: RESEARCH                     │
│                                                              │
│  Prompt: Research methodology only (~3k words)              │
│  Tools: web_search                                          │
│  Output: Structured research notes (not prose)              │
│                                                              │
│  Output format:                                              │
│  {                                                           │
│    "central_question": "...",                               │
│    "sources": [                                             │
│      {                                                       │
│        "type": "legislation|jurisprudence|doctrine",        │
│        "citation": "Art. 535 Cod Civil",                    │
│        "content": "exact quote or summary",                 │
│        "url": "https://...",                                │
│        "authority_level": "primary|secondary|tertiary",     │
│        "relevance": "why this matters for the question"     │
│      }                                                       │
│    ],                                                        │
│    "positions": [                                           │
│      {                                                       │
│        "position": "majority view on X",                    │
│        "supporters": ["Stoica", "Chelaru"],                 │
│        "sources": [ref to sources above]                    │
│      },                                                       │
│      {                                                       │
│        "position": "minority view on X",                    │
│        "supporters": ["Bîrsan"],                            │
│        "sources": [ref to sources above]                    │
│      }                                                       │
│    ],                                                        │
│    "gaps": ["no ÎCCJ jurisprudence found on Y"],            │
│    "recommended_structure": ["intro", "section1", ...]      │
│  }                                                           │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        PHASE 2: WRITE                        │
│                                                              │
│  Prompt: Academic writing style + formatting (~4k words)    │
│  Input: Structured research notes from Phase 1              │
│  Tools: None (pure writing)                                 │
│  Output: Final polished academic document                   │
│                                                              │
│  The writing agent:                                          │
│  - Receives pre-organized research                          │
│  - Focuses purely on composition and argumentation          │
│  - Knows the positions and debates to present               │
│  - Has all sources pre-evaluated for authority              │
└─────────────────────────────────────────────────────────────┘
```

### Benefits of Two-Phase

1. **Focused prompts** - Each ~3-4k words instead of 9k+
2. **Separation of concerns** - Research and writing are different cognitive tasks
3. **Debuggability** - Can inspect research notes before writing
4. **Reusability** - Research notes could feed multiple output formats
5. **Quality control** - Can validate research completeness before writing

### Implementation Details

**New file:** `services/gateway/src/services/research-phases.ts`

- `ResearchNotes` interface - structured output from Phase 1
- `PHASE1_RESEARCH_PROMPT` - focused research agent prompt
- `PHASE2_WRITING_PROMPT` - focused writing agent prompt
- `COMPACT_MARKDOWN_REFERENCE` - minimal formatting reference

**Modified:** `services/gateway/src/services/word-ai.service.ts`

- Added `draftWithResearchTwoPhase()` method
- Wired up `useTwoPhaseResearch` flag in `draft()` and `draftStream()`
- Fallback to single-phase if JSON parsing fails

**Modified:** `packages/shared/types/src/word-integration.ts`

- Added `useTwoPhaseResearch?: boolean` to `WordDraftRequest`

### How to Enable Two-Phase

```typescript
// In Word add-in or API call:
const request: WordDraftRequest = {
  documentName: 'Research Paper',
  prompt: 'Analizează răspunderea civilă pentru sisteme AI',
  enableWebSearch: true,
  useTwoPhaseResearch: true, // <-- Enable two-phase
};
```

---

## Files Changed This Session

```
services/gateway/src/services/
├── research-methodology-guidelines.ts    # NEW - research how-to
├── academic-writing-style-guidelines.ts  # NEW - writing how-to
├── research-phases.ts                    # NEW - two-phase architecture
├── word-ai-prompts.ts                    # MODIFIED - integrated new guidelines
├── word-ai.service.ts                    # MODIFIED - two-phase orchestration
└── document-formatting-guidelines.ts     # UNCHANGED - already good

packages/shared/types/src/
└── word-integration.ts                   # MODIFIED - added useTwoPhaseResearch flag
```

---

## Key Design Decisions

1. **Methodology vs Style separation** - Research methodology (how to find/evaluate sources) is distinct from academic style (how to write). Kept in separate files.

2. **Romanian language** - All guidelines in Romanian to match the output language and legal terminology.

3. **Concrete examples** - Guidelines include ❌/✅ examples throughout for clarity.

4. **Checklists** - Both methodology and style have verification checklists the model can reference.

5. **Citation density rule** - Explicit requirement: "minimum 1-2 footnotes per substantive paragraph"

---

## Latest Changes (Session 2)

### Footnote Enforcement in Phase 2 Prompt

**Problem identified:** Test outputs showed ZERO inline footnote citations despite mentioning sources. The model wrote things like "Andreas Matthias în lucrarea sa seminală din 2004" without any `[^1]` markers.

**Solution implemented:** Significantly strengthened Phase 2 writing prompt with:

1. **New section "REGULI OBLIGATORII PENTRU CITĂRI (CRITICE!)"** containing:
   - Explicit rule: "DE FIECARE DATĂ când menționezi un autor, o decizie, un articol de lege, sau orice sursă, TREBUIE să adaugi IMEDIAT [^N]"
   - Table showing exactly when to use footnotes (7 categories)
   - Three concrete WRONG vs RIGHT examples (including the exact Andreas Matthias case)
   - Format guide for footnote definitions at document end
   - Verification checklist for footnotes

2. **New critical rules added:**
   - "OBLIGATORIU: Fiecare autor/lege/decizie menționat(ă) TREBUIE să aibă [^N] imediat după"
   - "OBLIGATORIU: Documentul TREBUIE să conțină secțiunea '## Note' cu toate definițiile [^N]:"
   - "OBLIGATORIU: Verifică că ai MINIMUM 10-20 note [^N] pentru un document de cercetare standard"

---

## To Continue This Work

### Option A: Test current footnote fixes

1. Enable `useTwoPhaseResearch: true` in the Word add-in
2. Verify that output now contains inline `[^N]` markers throughout
3. Check that "## Note" section exists with all definitions

### Option B: Implement HTML → OOXML Pipeline (RECOMMENDED)

**See:** `docs/html-to-ooxml-implementation-plan.md`

The fundamental issue is that Markdown is a lossy intermediate format. Opus produces beautiful HTML naturally - we should leverage that instead of teaching it custom markdown syntax.

**New pipeline:**

```
AI → HTML (styled) → html-to-ooxml converter → OOXML → Word
```

This addresses:

- Font sizes, spacing, colors (all expressible in HTML inline styles)
- Visual hierarchy (headings that actually stand out)
- Callout boxes, tables, footnotes
- The overall "polished" vs "drafted" feel

Implementation plan includes:

- Files to create/modify
- Style mappings (preserving Bojin brand)
- Example of what good HTML from Opus looks like
- Phased implementation approach
