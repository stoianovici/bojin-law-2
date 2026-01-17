# Implementation Plan: HTML → OOXML Pipeline

**Date:** 2025-01-16
**Status:** Ready for implementation
**Goal:** Replace Markdown → OOXML with HTML → OOXML for better visual formatting

---

## Problem Statement

The current pipeline produces documents that look "drafted" rather than "edited":

```
Current: AI → Markdown → ooxml-fragment.service.ts → OOXML → Word
```

**Issues with Markdown as intermediate format:**

1. **Lossy format** - Markdown can't express exact font sizes, spacing, colors
2. **We instruct the AI extensively** on markdown syntax (`::: blocks`, `[^N]`, etc.) instead of letting it do what it's good at
3. **Our converter makes assumptions** about styling that may not match what looks good
4. **Opus produces beautiful HTML naturally** when asked - we're fighting against its strengths

**User observation:** "Opus creates beautiful HTMLs when asked to create docs. In the addin we call Opus to do the work, i'm not sure we're doing the right thing here."

---

## Prompt Simplification Benefit

Current prompts are **~9000+ words** because we teach:

- Custom markdown syntax (:::note, :::summary, :::signature blocks)
- Footnote syntax ([^N] in text, [^N]: at end)
- Heading hierarchy (# vs ## vs ### mapping)
- Romanian quote conventions in markdown
- Table formatting in markdown
- List numbering conventions

**With HTML output, we can remove most of this.** Opus already knows:

- How to write `<h1>`, `<h2>`, `<h3>`
- How to create styled `<div>` boxes
- How to make `<table>` with proper structure
- How to use `<sup>` for footnotes
- How to apply inline CSS

**Simplified prompt structure:**

| Keep                                       | Remove                                   |
| ------------------------------------------ | ---------------------------------------- |
| Research methodology (HOW to find sources) | Markdown syntax documentation            |
| Academic writing style (HOW to argue)      | Custom block syntax (:::note etc.)       |
| Brief HTML style guide (~500 words)        | Extensive formatting rules (~3000 words) |
| Content quality checklists                 | Markdown-specific checklists             |

**Estimated prompt reduction:** From ~9000 words to ~4000 words (55% smaller)

This means:

- Less attention dilution on formatting vs content
- Fewer conflicting instructions
- Lower cost per request
- Faster responses
- Opus focuses on what it's good at

---

## Proposed Solution

```
New: AI → HTML (styled) → html-to-ooxml converter → OOXML → Word
```

Let Opus output HTML with inline styles, then convert that HTML to OOXML. This leverages:

- Opus's natural ability to produce well-formatted HTML
- HTML's richer formatting capabilities
- Simpler prompts (no custom markdown syntax to teach)

---

## Current Architecture

### Files involved in the current pipeline:

1. **`services/gateway/src/services/word-ai-prompts.ts`**
   - Contains prompts that instruct AI to output markdown
   - Includes extensive markdown syntax documentation
   - ~9000+ words of formatting instructions

2. **`services/gateway/src/services/document-formatting-guidelines.ts`**
   - Markdown formatting conventions (Romanian quotes, numbering, etc.)
   - Custom block syntax (:::note, :::summary, etc.)

3. **`services/gateway/src/services/ooxml-fragment.service.ts`** (1977 lines)
   - Converts extended markdown to OOXML
   - Handles: headings, lists, tables, callouts, footnotes, etc.
   - Contains all style definitions (fonts, sizes, colors, spacing)

4. **`services/gateway/src/routes/word-ai.routes.ts`**
   - Has `/api/ai/word/ooxml` endpoint that calls the converter

5. **`apps/word-addin/src/services/api-client.ts`**
   - `getOoxml(markdown)` - calls the conversion endpoint

6. **`apps/word-addin/src/components/DraftTab.tsx`**
   - Receives markdown from AI stream
   - Calls `getOoxml()` to convert
   - Inserts into Word via `insertOoxml()`

### Current flow in detail:

```typescript
// 1. AI generates markdown with custom syntax
const markdown = `
# Răspunderea Civilă pentru Sisteme AI

:::summary
**Rezumat**
Prezentul studiu analizează...
:::

### 1. Introducere

Conform art. 1357 Cod Civil[^1], răspunderea civilă...

[^1]: Art. 1357, Legea nr. 287/2009 privind Codul Civil.
`;

// 2. Markdown sent to backend for conversion
const { ooxmlContent } = await apiClient.getOoxml(markdown);

// 3. OOXML inserted into Word
await insertOoxml(ooxmlContent);
```

---

## New Architecture

### Approach: HTML with inline styles

Instead of teaching AI custom markdown syntax, let it output styled HTML:

```html
<article style="font-family: 'Source Serif Pro', Georgia, serif;">
  <h1 style="font-size: 24pt; color: #333; text-align: center; margin-bottom: 12pt;">
    Răspunderea Civilă pentru Sisteme AI
  </h1>

  <div style="background: #f5f5f5; border-left: 4px solid #ccc; padding: 12pt; margin: 12pt 0;">
    <strong>Rezumat</strong>
    <p>Prezentul studiu analizează...</p>
  </div>

  <h2 style="font-size: 18pt; color: #9B2335; margin-top: 24pt;">1. Introducere</h2>

  <p style="text-indent: 0.5in; line-height: 1.4;">
    Conform art. 1357 Cod Civil<sup><a href="#fn1">1</a></sup
    >, răspunderea civilă...
  </p>

  <footer style="font-size: 10pt; border-top: 1px solid #ccc; margin-top: 24pt;">
    <p id="fn1"><sup>1</sup> Art. 1357, Legea nr. 287/2009 privind Codul Civil.</p>
  </footer>
</article>
```

### Files to create/modify:

#### 1. NEW: `services/gateway/src/services/html-to-ooxml.service.ts`

Converts styled HTML to OOXML. Options:

**Option A: Use existing library**

- `mammoth` (reverse: DOCX→HTML, not what we need)
- `html-to-docx` npm package - converts HTML to DOCX buffer
- `pandoc` via child process - versatile but adds dependency

**Option B: Build custom converter** (recommended for control)

- Parse HTML with `cheerio` or `jsdom`
- Map HTML elements to OOXML equivalents
- Preserve inline styles as direct formatting

```typescript
// Pseudocode for custom converter
export class HtmlToOoxmlService {
  convert(html: string): string {
    const doc = parseHTML(html);
    const paragraphs = [];

    for (const element of doc.body.children) {
      if (element.tagName === 'H1') {
        paragraphs.push(this.convertHeading(element, 1));
      } else if (element.tagName === 'P') {
        paragraphs.push(this.convertParagraph(element));
      } else if (element.tagName === 'DIV') {
        // Check for callout box styling
        paragraphs.push(this.convertDiv(element));
      }
      // ... etc
    }

    return this.wrapInOoxmlPackage(paragraphs);
  }

  private convertParagraph(el: Element): OoxmlParagraph {
    const style = parseInlineStyle(el.style);
    return {
      fontSize: style.fontSize, // e.g., "12pt" → 24 half-points
      fontFamily: style.fontFamily,
      textIndent: style.textIndent,
      lineHeight: style.lineHeight,
      runs: this.parseInlineContent(el.innerHTML),
    };
  }
}
```

#### 2. MODIFY: `services/gateway/src/services/word-ai-prompts.ts`

Replace markdown instructions with HTML instructions:

```typescript
export const HTML_FORMATTING_GUIDELINES = `
## OUTPUT FORMAT

Output your response as styled HTML. Use inline styles for formatting.

### Document Structure

<article style="font-family: 'Source Serif Pro', Georgia, serif; font-size: 12pt; line-height: 1.4;">
  <!-- Your content here -->
</article>

### Typography

| Element | Style |
|---------|-------|
| Title | font-size: 24pt; color: #333; text-align: center |
| Heading 1 | font-size: 18pt; color: #9B2335; margin-top: 24pt |
| Heading 2 | font-size: 14pt; color: #333; margin-top: 18pt |
| Body | font-size: 12pt; text-indent: 0.5in; line-height: 1.4 |
| Footnote | font-size: 10pt |

### Callout Boxes

For notes/summaries, use a styled div:
<div style="background: #f5f5f5; border-left: 4px solid #ccc; padding: 12pt; margin: 12pt 0;">
  <strong>Note</strong>
  <p>Content...</p>
</div>

For warnings/important:
<div style="background: #fdf2f2; border: 1px solid #9B2335; padding: 12pt; margin: 12pt 0;">
  <strong>Important</strong>
  <p>Content...</p>
</div>

### Footnotes

Use superscript links in text:
<sup><a href="#fn1">1</a></sup>

Define at end in footer:
<footer>
  <p id="fn1"><sup>1</sup> Citation text...</p>
</footer>

### Tables

<table style="border-collapse: collapse; width: 100%;">
  <thead style="background: #f9f9f9; border-bottom: 2px solid #ddd;">
    <tr>
      <th style="padding: 8pt; text-align: left;">Header</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td style="padding: 8pt; border-bottom: 1px solid #eee;">Cell</td>
    </tr>
  </tbody>
</table>
`;
```

#### 3. MODIFY: `services/gateway/src/routes/word-ai.routes.ts`

Update the `/ooxml` endpoint to accept HTML:

```typescript
// Before
router.post('/ooxml', async (req, res) => {
  const { markdown } = req.body;
  const ooxml = ooxmlFragmentService.markdownToOoxmlFragment(markdown);
  res.json({ ooxmlContent: ooxml });
});

// After
router.post('/ooxml', async (req, res) => {
  const { html, markdown } = req.body;

  // Support both for backward compatibility during transition
  const ooxml = html
    ? htmlToOoxmlService.convert(html)
    : ooxmlFragmentService.markdownToOoxmlFragment(markdown);

  res.json({ ooxmlContent: ooxml });
});
```

#### 4. MODIFY: `apps/word-addin/src/services/api-client.ts`

Update to send HTML:

```typescript
async getOoxml(content: string, format: 'html' | 'markdown' = 'html'): Promise<{ ooxmlContent: string }> {
  const body = format === 'html' ? { html: content } : { markdown: content };
  return this.post<{ ooxmlContent: string }>(`${API_BASE_URL}/api/ai/word/ooxml`, body);
}
```

---

## Style Mappings

Preserve existing Bojin brand styles:

| Element   | Font             | Size | Color               | Spacing                                  |
| --------- | ---------------- | ---- | ------------------- | ---------------------------------------- |
| Title     | Inter            | 24pt | #333333             | 24pt before, 12pt after                  |
| Subtitle  | Inter            | 14pt | #666666             | 6pt before, 12pt after                   |
| Heading 1 | Inter            | 18pt | #9B2335 (brand red) | 24pt before, 12pt after                  |
| Heading 2 | Inter            | 14pt | #333333             | 18pt before, 9pt after                   |
| Heading 3 | Inter            | 12pt | #666666             | 12pt before, 6pt after                   |
| Body      | Source Serif Pro | 12pt | black               | 0.5in first-line indent, 1.4 line height |
| Footnote  | Source Serif Pro | 10pt | black               | 1.2 line height                          |
| Quote     | Source Serif Pro | 12pt | #4A4A4A             | Left border, 0.5in indent                |

---

## Implementation Steps

### Phase 1: Build the HTML → OOXML converter

1. Create `html-to-ooxml.service.ts`
2. Implement parsing for:
   - Headings (h1-h6) with style extraction
   - Paragraphs with text-indent, line-height
   - Bold, italic, underline (b, i, u, strong, em)
   - Superscript for footnotes
   - Divs with background/border (callout boxes)
   - Tables
   - Lists (ul, ol, nested)
3. Implement OOXML wrapper (reuse from current service)
4. Write unit tests with sample HTML

### Phase 2: Update prompts

1. Create `HTML_FORMATTING_GUIDELINES` in word-ai-prompts.ts
2. Update `draftWithResearch` prompt to output HTML
3. Update `PHASE2_WRITING_PROMPT` to output HTML
4. Keep research methodology and academic style guidelines (content quality)

### Phase 3: Update API and client

1. Modify `/ooxml` endpoint to accept both HTML and markdown
2. Update api-client to send HTML
3. Test with Word add-in

### Phase 4: Testing and refinement

1. Generate sample research documents
2. Compare HTML output quality with markdown output
3. Adjust style mappings as needed
4. Remove markdown formatting guidelines once stable

---

## Risks and Mitigations

| Risk                            | Mitigation                                     |
| ------------------------------- | ---------------------------------------------- |
| AI outputs inconsistent HTML    | Provide clear style guide with examples        |
| Complex nested structures       | Test with edge cases, add fallbacks            |
| Performance (parsing HTML)      | HTML parsing is fast; cache if needed          |
| Word Online compatibility       | Test insertOoxml on both desktop and online    |
| Breaking existing functionality | Keep markdown path available during transition |

---

## Success Criteria

1. Research documents have proper visual hierarchy (headings stand out)
2. Consistent spacing between sections
3. Callout boxes render with proper styling
4. Tables have clean borders and padding
5. Footnotes appear at page bottom (not inline)
6. Overall "polished" feel rather than "drafted" feel

---

## Reference: What good HTML from Opus looks like

When asked to create a styled HTML document, Opus naturally produces:

```html
<!DOCTYPE html>
<html lang="ro">
  <head>
    <meta charset="UTF-8" />
    <style>
      body {
        font-family: 'Source Serif Pro', Georgia, serif;
        font-size: 12pt;
        line-height: 1.6;
        max-width: 800px;
        margin: 0 auto;
        padding: 40px;
      }
      h1 {
        font-family: Inter, Arial, sans-serif;
        font-size: 24pt;
        color: #333;
        text-align: center;
        margin-bottom: 24pt;
      }
      h2 {
        font-family: Inter, Arial, sans-serif;
        font-size: 18pt;
        color: #9b2335;
        margin-top: 32pt;
        margin-bottom: 16pt;
      }
      p {
        text-indent: 0.5in;
        margin-bottom: 12pt;
      }
      .callout {
        background: #f5f5f5;
        border-left: 4px solid #ccc;
        padding: 16px;
        margin: 20px 0;
      }
      .callout-important {
        background: #fdf2f2;
        border: 1px solid #9b2335;
      }
      table {
        width: 100%;
        border-collapse: collapse;
        margin: 20px 0;
      }
      th,
      td {
        padding: 12px;
        text-align: left;
        border-bottom: 1px solid #eee;
      }
      th {
        background: #f9f9f9;
        font-weight: bold;
      }
      .footnote {
        font-size: 10pt;
        color: #666;
      }
      sup a {
        color: #9b2335;
        text-decoration: none;
      }
    </style>
  </head>
  <body>
    <article>
      <h1>Răspunderea Civilă pentru Sistemele de Inteligență Artificială</h1>
      <p style="text-align: center; font-style: italic; color: #666;">
        Civil Liability for Artificial Intelligence Systems
      </p>

      <div class="callout">
        <strong>Rezumat</strong>
        <p style="text-indent: 0;">
          Prezentul studiu analizează cadrul juridic al răspunderii civile...
        </p>
      </div>

      <h2>1. Introducere</h2>
      <p>
        Evoluția rapidă a sistemelor de inteligență artificială<sup><a href="#fn1">1</a></sup>
        ridică întrebări fundamentale privind răspunderea civilă...
      </p>

      <!-- More content... -->

      <footer class="footnotes">
        <hr />
        <p id="fn1" class="footnote">
          <sup>1</sup> A. Matthias, <em>The responsibility gap</em>, Ethics and Information
          Technology, 2004.
        </p>
      </footer>
    </article>
  </body>
</html>
```

This is the quality we want to preserve and convert to OOXML.

---

## Files Summary

| File                                | Action    | Description                             |
| ----------------------------------- | --------- | --------------------------------------- |
| `html-to-ooxml.service.ts`          | CREATE    | New HTML → OOXML converter              |
| `word-ai-prompts.ts`                | MODIFY    | Add HTML_FORMATTING_GUIDELINES          |
| `research-phases.ts`                | MODIFY    | Update Phase 2 to output HTML           |
| `word-ai.routes.ts`                 | MODIFY    | Accept HTML in /ooxml endpoint          |
| `api-client.ts`                     | MODIFY    | Send HTML to backend                    |
| `ooxml-fragment.service.ts`         | KEEP      | Fallback for markdown (deprecate later) |
| `document-formatting-guidelines.ts` | DEPRECATE | No longer needed for HTML               |

---

## Questions to Consider

1. **Should we use CSS classes or inline styles?**
   - Inline styles: Simpler to parse, self-contained
   - CSS classes: Cleaner HTML, but need to extract and merge styles
   - Recommendation: Inline styles for conversion simplicity

2. **Should we strip the HTML wrapper?**
   - Opus might output full `<!DOCTYPE html>...`
   - We only need the `<article>` or `<body>` content
   - Strip during conversion

3. **How to handle Opus not following the style guide exactly?**
   - Apply default styles if inline styles missing
   - Use style mappings as fallback

4. **What about the streaming response?**
   - Currently streams markdown chunks
   - HTML streams the same way (just different format)
   - No change needed to streaming logic
