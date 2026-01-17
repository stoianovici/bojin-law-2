# Story: Give Claude Full Styling Freedom in Prompts

## Status: Ready for Implementation (after docx migration)

## Depends On

- `docs/docx-library-migration.md` - The docx converter must be in place first

---

## Summary

Update all prompts to give Claude creative freedom over document styling, rather than prescribing specific colors/fonts. Claude naturally produces beautiful HTML - we should let it.

---

## Current State

Today we changed prompts to request "semantic HTML" without styles:

```
// word-ai-prompts.ts (current - WRONG DIRECTION)
Output your response as SEMANTIC HTML. Do NOT include inline styles...
```

This was an attempt to simplify, but it removes Claude's strength: **aesthetic judgment**.

---

## The Problem with Prescriptive Prompts

Previously, prompts were overly prescriptive:

```
<h1 style="font-family: Inter, Arial; font-size: 24pt; color: #333333;">
<h2 style="font-family: Inter, Arial; font-size: 18pt; color: #9B2335;">
```

This causes problems:

1. **Claude follows rules instead of designing** - Output feels mechanical
2. **Brand colors may not suit the content** - A warning box shouldn't use brand red
3. **No creative variation** - Every document looks identical
4. **Prompt bloat** - Long style specifications clutter the prompt

---

## The New Approach: Design Freedom with Guardrails

Tell Claude:

1. You have full styling freedom
2. Here's what's technically supported
3. Here's what makes legal documents look professional
4. Footnotes are mandatory (the one strict rule)

---

## Prompt Changes

### 1. Revert Semantic HTML Changes

**Files to revert:**

- `services/gateway/src/services/word-ai-prompts.ts`
- `services/gateway/src/services/word-ai.service.ts`
- `services/gateway/src/services/research-phases.ts`

These were changed today to remove styling. Revert them and replace with the new approach below.

### 2. New HTML_FORMATTING_GUIDELINES

```typescript
export const HTML_FORMATTING_GUIDELINES = `
## OUTPUT FORMAT: Styled HTML

Create a beautifully formatted HTML document. You have full creative control over typography, colors, and layout.

### Technical Structure

Wrap your document in <article>:

<article>
  <!-- Your styled content -->
</article>

### What You Can Style

Use inline styles freely:

**Typography:**
- font-family: Georgia, "Times New Roman", serif (body)
- font-family: "Helvetica Neue", Arial, sans-serif (headings)
- font-size: 11pt, 12pt, 14pt, 18pt, 24pt, etc.
- font-weight: normal, bold
- font-style: italic
- line-height: 1.4, 1.6, 1.8
- letter-spacing: 0.5px

**Colors:**
- color: #333333 (dark gray for body - easier to read than black)
- color: any color that suits the document's purpose
- background-color: for highlighting, callouts, table headers

**Spacing & Layout:**
- text-align: left, center, right, justify
- text-indent: 0.5in (for paragraph first lines)
- margin-top, margin-bottom: for vertical rhythm
- padding: for callout boxes

**Borders:**
- border-left: for blockquotes and callout boxes
- border: for tables and warning boxes

### Document Design Principles

**For Legal/Academic Documents:**
- Use a serif font for body text (more readable for long documents)
- Use a sans-serif font for headings (clear hierarchy)
- Generous line-height (1.5-1.6) for readability
- Subtle colors - avoid bright/saturated colors in body text
- Consistent spacing between sections
- First-line indent OR space between paragraphs (not both)

**Visual Hierarchy:**
- Title: largest, can be centered
- Section headings: clearly distinct from body
- Body text: comfortable reading size (11-12pt)
- Footnotes: smaller (9-10pt)
- Use bold sparingly for emphasis
- Use italic for citations, foreign terms, titles of works

**Callout Boxes:**
- Light background (#f5f5f5, #f0f7ff, #fff8e6)
- Left border or subtle full border
- Clear label (Notă, Important, Atenție, Definiție)

**Tables:**
- Header row with background shading
- Clear borders or alternating row colors
- Adequate cell padding
- Left-align text, right-align numbers

### Footnotes (MANDATORY)

Every source, citation, legal reference, or claim must have a footnote.

In text:
<p>Conform art. 1357 Cod Civil<sup><a href="#fn1">1</a></sup>, răspunderea...</p>

At document end:
<footer>
  <p id="fn1"><sup>1</sup> Art. 1357, Legea nr. 287/2009 privind Codul Civil.</p>
</footer>

A research document without footnotes is incomplete.

### What NOT to Do

- Don't use CSS classes or <style> blocks (only inline styles work)
- Don't use very light text colors (poor contrast)
- Don't use decorative fonts
- Don't use more than 2-3 colors in a document
- Don't make headings too large (keep proportional)
- Don't skip heading levels (h1 → h3)

### Romanian Typography

- Ghilimele: „text" (not "text")
- Diacritice: ă, â, î, ș, ț (always correct)
- Ghilimele în ghilimele: „text «citat» text"
`;
```

### 3. Simplified System Prompt for Research

```typescript
draftWithResearch: `Ești un cercetător juridic expert pentru o firmă de avocatură din România.

Creează documente de cercetare frumoase și profesionale în format HTML.

## DESIGN

Ai libertate deplină asupra stilului vizual. Folosește inline styles pentru:
- Fonturi și dimensiuni
- Culori (subtile, profesionale)
- Spațiere și aliniere
- Casete de evidențiere
- Tabele

Creează documente care arată ca publicații academice de calitate.

## STRUCTURĂ

- Învelește tot conținutul în <article>
- Folosește heading-uri ierarhice (h1-h6)
- Paragrafele în <p>
- Listele în <ul>/<ol>

## FOOTNOTES (OBLIGATORIU)

Fiecare sursă trebuie să aibă footnote:
- În text: <sup><a href="#fn1">1</a></sup>
- La final: <footer><p id="fn1">...</p></footer>

Un document fără footnotes este incomplet.

## CERCETARE

${RESEARCH_METHODOLOGY_GUIDELINES}

## CALITATE

${RESEARCH_QUALITY_CHECKLIST}
`;
```

### 4. User Prompt Update (word-ai.service.ts)

```typescript
let userPrompt = `Creează un document HTML frumos și profesional.

Ai libertate deplină asupra stilului - fonturi, culori, spațiere.
Folosește inline styles. NU folosi markdown.

OBLIGATORIU: Fiecare sursă necesită footnote cu <sup><a href="#fnN">N</a></sup>

---

## Document: ${request.documentName}

${contextInfo.contextSection}

## Instrucțiuni
${request.prompt}`;
```

---

## What Changes

| Aspect    | Before                           | After                |
| --------- | -------------------------------- | -------------------- |
| Colors    | Prescribed (#9B2335 for h2)      | Claude chooses       |
| Fonts     | Prescribed (Inter, Source Serif) | Claude chooses       |
| Spacing   | Prescribed values                | Claude chooses       |
| Layout    | Rigid template                   | Claude designs       |
| Footnotes | Required                         | Required (unchanged) |

---

## Expected Outcome

Claude will:

1. Choose fonts that suit the document's tone
2. Use colors purposefully (not because told to)
3. Create visual hierarchy naturally
4. Design callout boxes that fit the content
5. Produce documents that feel "designed" not "templated"

---

## Files to Modify

1. **word-ai-prompts.ts**
   - Replace `HTML_FORMATTING_GUIDELINES` with new version
   - Update `draftWithResearch` system prompt

2. **word-ai.service.ts**
   - Update inline user prompt (~line 511)

3. **research-phases.ts**
   - Update `PHASE2_WRITING_PROMPT`
   - Update `COMPACT_HTML_REFERENCE`

---

## Testing

1. Generate several research documents
2. Compare visual quality to previous output
3. Verify Claude uses varied, appropriate styling
4. Confirm footnotes still work correctly
5. Check that output converts properly through new docx converter

---

## Rollback

If Claude's design choices are poor:

1. Add more specific guidance in prompts
2. Or revert to prescriptive approach

But try freedom first - Claude is usually good at this.

---

## Notes

- This story should be implemented AFTER the docx migration
- The docx converter needs to be working first to properly render Claude's styles
- The semantic HTML changes from today should be reverted as part of this work
