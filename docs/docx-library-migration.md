# Story: Migrate HTML-to-OOXML Converter to `docx` Library

## Status: ❌ NOT FEASIBLE - Closed

## Analysis Summary (2026-01-16)

**Key Finding**: The `docx` npm library **cannot** be used to replace `html-to-ooxml.service.ts`.

### Why This Migration Is Not Possible

1. **Output Format Incompatibility**: The `docx` library generates `.docx` files (ZIP archives), not flat OPC XML. Word's `insertOoxml()` API requires flat OPC XML format with `pkg:package` wrapper.

2. **No Conversion Path**: There's no way to convert the docx library's output to flat OPC XML without essentially reimplementing what we already have.

3. **Existing Implementation Is Complete**: The current `html-to-ooxml.service.ts` already has:
   - Full footnote support with `<w:footnoteReference>` elements
   - Footnote definitions in `/word/footnotes.xml`
   - All HTML elements (headings, paragraphs, tables, lists, callouts)
   - Inline styles (bold, italic, underline, colors, fonts)
   - Bojin brand header/footer with images
   - Page numbers

### Where `docx` Library IS Used

The `docx` library is already used in `docx-generator.service.ts` for generating complete `.docx` files for SharePoint upload - which is its intended use case.

### Recommendation

Keep the current architecture:

- `html-to-ooxml.service.ts` → Flat OPC XML for Word add-in `insertOoxml()`
- `docx-generator.service.ts` → Complete .docx files for SharePoint

---

## Original Summary (Archived)

Replace the hand-rolled OOXML XML string generation in `html-to-ooxml.service.ts` with the `docx` npm library. This will provide type-safe document generation, proper footnote support, and better maintainability.

---

## Background & Motivation

### The Problem

The Word add-in uses Claude to generate documents. Claude naturally produces beautiful HTML with good typography, colors, and structure. However, the current conversion pipeline loses this quality:

1. Claude outputs HTML
2. `html-to-ooxml.service.ts` (1400 lines) parses HTML and generates raw OOXML XML strings
3. Word inserts the OOXML

The raw XML approach is:

- **Fragile**: One typo breaks the whole document
- **Hard to maintain**: 1400 lines of string templates
- **Limited**: Footnotes are particularly painful in raw OOXML

### The Solution

Use the `docx` npm library which:

- Provides TypeScript types for all Word features
- Handles OOXML serialization correctly
- Has built-in footnote support
- Is well-maintained (600k+ weekly downloads)

### What Stays the Same

- Claude still outputs HTML (Claude's strength)
- The API endpoints stay the same
- The Word add-in insertion code stays the same

### What Changes

- The converter backend: HTML → `docx` objects → OOXML (instead of HTML → XML strings)

---

## Current Architecture

### File Locations

```
services/gateway/src/services/
├── html-to-ooxml.service.ts    # Current converter (REPLACE)
├── word-ai.service.ts          # Calls the converter (NO CHANGE)
├── word-ai.routes.ts           # API endpoints (NO CHANGE)
└── word-ai-prompts.ts          # Claude prompts (MINOR UPDATE)

apps/word-addin/src/services/
└── word-api.ts                 # Word insertion (NO CHANGE)
```

### Current Flow

```
POST /api/ai/word/draft
       ↓
word-ai.service.ts → Claude generates HTML
       ↓
POST /api/ai/word/ooxml (or inline conversion)
       ↓
html-to-ooxml.service.ts.convertWithMetadata(html)
       ↓
Manual XML string building (parseHtml → buildOoxmlPackage)
       ↓
Returns OOXML string
       ↓
word-api.ts.insertOoxml(ooxml)
```

### Current Converter Structure (html-to-ooxml.service.ts)

Key methods:

- `convert(html)` / `convertWithMetadata(html)` - Entry points
- `parseHtml(html)` - Uses JSDOM to parse HTML into internal structure
- `parseHeading()`, `parseParagraph()`, `parseTable()`, etc. - Element parsers
- `parseInlineContent()` - Handles bold, italic, links, footnote refs
- `parseFooter()` - Extracts footnote definitions
- `buildOoxmlPackage()` - Generates the final XML string

Internal types:

```typescript
interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  fontSize?: number;
  color?: string;
  fontFamily?: string;
  footnoteId?: number;
}

interface Paragraph {
  runs: TextRun[];
  alignment?: 'left' | 'center' | 'right' | 'both';
  indent?: number;
  spacing?: { before?: number; after?: number; line?: number };
  shading?: string;
  // ... more
}
```

---

## Target Architecture

### New Flow

```
POST /api/ai/word/draft
       ↓
word-ai.service.ts → Claude generates HTML
       ↓
POST /api/ai/word/ooxml
       ↓
html-to-docx.service.ts.convert(html)  # NEW SERVICE
       ↓
Parse HTML with JSDOM (same as before)
       ↓
Build docx Document object (NEW)
       ↓
Packer.toBuffer(doc) → OOXML
       ↓
Returns OOXML string
       ↓
word-api.ts.insertOoxml(ooxml)
```

### New Service: html-to-docx.service.ts

```typescript
import {
  Document,
  Paragraph,
  TextRun,
  HeadingLevel,
  Table,
  TableRow,
  TableCell,
  FootnoteReferenceRun,
  AlignmentType,
  Packer,
  // ... etc
} from 'docx';
import { JSDOM } from 'jsdom';

export class HtmlToDocxService {
  async convert(html: string): Promise<Buffer> {
    const dom = new JSDOM(html);
    const article = dom.window.document.querySelector('article');

    // Extract footnotes first
    const footnotes = this.extractFootnotes(article);

    // Parse content
    const children = this.parseChildren(article, footnotes);

    // Build document
    const doc = new Document({
      footnotes,
      sections: [
        {
          children,
        },
      ],
    });

    return Packer.toBuffer(doc);
  }

  // ... parsing methods
}
```

---

## Implementation Plan

### Phase 1: Setup & Basic Structure

1. **Install docx library**

   ```bash
   pnpm --filter gateway add docx
   ```

2. **Create new service file**
   - `services/gateway/src/services/html-to-docx.service.ts`
   - Keep old service for fallback during development

3. **Basic structure**
   ```typescript
   export class HtmlToDocxService {
     async convert(html: string): Promise<string> {
       // Parse HTML
       // Build Document
       // Pack to buffer
       // Return base64 or appropriate format for insertOoxml
     }
   }
   ```

### Phase 2: Element Parsing

Implement parsers for each HTML element:

#### Headings (h1-h6)

```typescript
private parseHeading(element: Element, level: number): Paragraph {
  const style = this.parseInlineStyle(element);
  return new Paragraph({
    heading: this.getHeadingLevel(level), // HEADING_1, HEADING_2, etc.
    children: this.parseInlineContent(element),
    alignment: this.getAlignment(style),
  });
}
```

#### Paragraphs

```typescript
private parseParagraph(element: Element): Paragraph {
  const style = this.parseInlineStyle(element);
  return new Paragraph({
    children: this.parseInlineContent(element),
    alignment: this.getAlignment(style),
    indent: style.textIndent ? { firstLine: this.toTwips(style.textIndent) } : undefined,
    spacing: {
      before: this.toTwips(style.marginTop),
      after: this.toTwips(style.marginBottom),
      line: style.lineHeight ? this.toLineSpacing(style.lineHeight) : undefined,
    },
  });
}
```

#### Inline Content (TextRuns)

```typescript
private parseInlineContent(element: Element): (TextRun | FootnoteReferenceRun)[] {
  const runs: (TextRun | FootnoteReferenceRun)[] = [];

  for (const node of element.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      runs.push(new TextRun({
        text: node.textContent,
        // inherit styles from parent
      }));
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const el = node as Element;
      const tag = el.tagName.toLowerCase();

      if (tag === 'strong' || tag === 'b') {
        runs.push(...this.parseInlineContent(el).map(r =>
          r instanceof TextRun ? new TextRun({ ...r, bold: true }) : r
        ));
      } else if (tag === 'em' || tag === 'i') {
        runs.push(...this.parseInlineContent(el).map(r =>
          r instanceof TextRun ? new TextRun({ ...r, italics: true }) : r
        ));
      } else if (tag === 'sup' && el.querySelector('a[href^="#fn"]')) {
        // Footnote reference
        const href = el.querySelector('a')?.getAttribute('href');
        const fnId = parseInt(href?.replace('#fn', '') || '0');
        runs.push(new FootnoteReferenceRun(fnId));
      }
      // ... more inline elements
    }
  }

  return runs;
}
```

#### Footnotes

```typescript
private extractFootnotes(article: Element): Record<number, { children: Paragraph[] }> {
  const footer = article.querySelector('footer');
  const footnotes: Record<number, { children: Paragraph[] }> = {};

  if (footer) {
    for (const p of footer.querySelectorAll('p[id^="fn"]')) {
      const id = parseInt(p.id.replace('fn', ''));
      // Remove the leading <sup>N</sup> from footnote text
      const text = p.textContent?.replace(/^\d+\s*/, '') || '';
      footnotes[id] = {
        children: [new Paragraph({ children: [new TextRun(text)] })],
      };
    }
  }

  return footnotes;
}
```

#### Tables

```typescript
private parseTable(element: Element): Table {
  const rows: TableRow[] = [];

  for (const tr of element.querySelectorAll('tr')) {
    const cells: TableCell[] = [];
    for (const cell of tr.querySelectorAll('td, th')) {
      cells.push(new TableCell({
        children: [new Paragraph({
          children: this.parseInlineContent(cell),
        })],
        shading: cell.tagName === 'TH' ? { fill: 'F0F0F0' } : undefined,
      }));
    }
    rows.push(new TableRow({ children: cells }));
  }

  return new Table({ rows });
}
```

#### Lists

```typescript
private parseList(element: Element, isOrdered: boolean): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  for (const li of element.children) {
    if (li.tagName.toLowerCase() === 'li') {
      paragraphs.push(new Paragraph({
        children: this.parseInlineContent(li),
        numbering: {
          reference: isOrdered ? 'ordered-list' : 'bullet-list',
          level: 0,
        },
      }));

      // Handle nested lists
      const nestedList = li.querySelector('ul, ol');
      if (nestedList) {
        paragraphs.push(...this.parseList(nestedList, nestedList.tagName === 'OL'));
      }
    }
  }

  return paragraphs;
}
```

#### Callout Boxes (div.callout)

```typescript
private parseDiv(element: Element): Paragraph[] {
  const className = element.getAttribute('class') || '';
  const isCallout = className.includes('callout');
  const isWarning = className.includes('callout-warning');

  const paragraphs: Paragraph[] = [];

  for (const child of element.children) {
    const para = this.parseParagraph(child as Element);

    if (isCallout) {
      // Apply callout styling
      para.shading = { fill: isWarning ? 'FDF2F2' : 'F5F5F5' };
      para.border = {
        left: {
          style: BorderStyle.SINGLE,
          size: 24,
          color: isWarning ? '9B2335' : 'CCCCCC',
        },
      };
    }

    paragraphs.push(para);
  }

  return paragraphs;
}
```

### Phase 3: Style Parsing

```typescript
interface ParsedStyle {
  color?: string;
  fontSize?: string;
  fontFamily?: string;
  fontWeight?: string;
  fontStyle?: string;
  textDecoration?: string;
  textAlign?: string;
  textIndent?: string;
  lineHeight?: string;
  marginTop?: string;
  marginBottom?: string;
  backgroundColor?: string;
  borderLeft?: string;
}

private parseInlineStyle(element: Element): ParsedStyle {
  const style = element.getAttribute('style') || '';
  const parsed: ParsedStyle = {};

  for (const rule of style.split(';')) {
    const [prop, value] = rule.split(':').map(s => s.trim());
    if (prop && value) {
      // Convert kebab-case to camelCase
      const camelProp = prop.replace(/-([a-z])/g, g => g[1].toUpperCase());
      parsed[camelProp as keyof ParsedStyle] = value;
    }
  }

  return parsed;
}

// Utility: Convert CSS units to OOXML twips (1/20 of a point)
private toTwips(cssValue: string | undefined): number | undefined {
  if (!cssValue) return undefined;

  const match = cssValue.match(/^([\d.]+)(px|pt|in|cm)?$/);
  if (!match) return undefined;

  const value = parseFloat(match[1]);
  const unit = match[2] || 'px';

  switch (unit) {
    case 'pt': return value * 20;
    case 'px': return value * 15; // Approximate
    case 'in': return value * 1440;
    case 'cm': return value * 567;
    default: return value * 20;
  }
}
```

### Phase 4: Integration

1. **Update word-ai.routes.ts** to use new service

   ```typescript
   // In /api/ai/word/ooxml endpoint
   import { htmlToDocxService } from '../services/html-to-docx.service';

   const buffer = await htmlToDocxService.convert(html);
   // Convert to format expected by Word add-in
   ```

2. **Update exports**
   - Export new service from index
   - Keep old service available for fallback

3. **Feature flag** (optional)
   - Add config flag to switch between old and new converter
   - Allow gradual rollout

### Phase 5: Testing

1. **Unit tests** for each parser method
2. **Integration test**: HTML → OOXML → verify in Word
3. **Comparison test**: Same HTML through old vs new converter

---

## HTML Features Claude Can Use

### Fully Supported

| HTML                              | docx Equivalent                        |
| --------------------------------- | -------------------------------------- |
| `<h1>` - `<h6>`                   | `HeadingLevel.HEADING_1` - `HEADING_6` |
| `<p>`                             | `Paragraph`                            |
| `<strong>`, `<b>`                 | `TextRun({ bold: true })`              |
| `<em>`, `<i>`                     | `TextRun({ italics: true })`           |
| `<u>`                             | `TextRun({ underline: {} })`           |
| `<s>`, `<del>`                    | `TextRun({ strike: true })`            |
| `<sup>`                           | `TextRun({ superScript: true })`       |
| `<sub>`                           | `TextRun({ subScript: true })`         |
| `<sup><a href="#fn1">1</a></sup>` | `FootnoteReferenceRun(1)`              |
| `<ul>`, `<ol>`, `<li>`            | `Paragraph({ numbering: {...} })`      |
| `<table>`, `<tr>`, `<td>`, `<th>` | `Table`, `TableRow`, `TableCell`       |
| `<blockquote>`                    | `Paragraph` with indent/border         |
| `<a href="...">`                  | `ExternalHyperlink`                    |
| `<br>`                            | `TextRun({ break: 1 })`                |
| `<hr>`                            | `Paragraph` with bottom border         |

### Inline Styles Supported

| CSS Property        | docx Equivalent                                  |
| ------------------- | ------------------------------------------------ |
| `color`             | `TextRun({ color: "FF0000" })`                   |
| `font-size`         | `TextRun({ size: 24 })` (half-points)            |
| `font-family`       | `TextRun({ font: "Arial" })`                     |
| `text-align`        | `Paragraph({ alignment: AlignmentType.CENTER })` |
| `text-indent`       | `Paragraph({ indent: { firstLine: 720 } })`      |
| `line-height`       | `Paragraph({ spacing: { line: 360 } })`          |
| `margin-top/bottom` | `Paragraph({ spacing: { before/after: 200 } })`  |
| `background-color`  | `Paragraph({ shading: { fill: "FFFF00" } })`     |
| `border-left`       | `Paragraph({ border: { left: {...} } })`         |

### Not Supported (Claude should avoid)

- CSS classes / `<style>` blocks
- `display: flex/grid`
- `position`, `float`
- Gradients, shadows
- SVG, canvas
- Complex selectors

---

## Prompt Updates

Update `word-ai-prompts.ts` to tell Claude about the full styling freedom:

```typescript
export const HTML_FORMATTING_GUIDELINES = `
## OUTPUT FORMAT

Output your response as HTML. You have full styling freedom using inline styles.

### Document Structure

<article>
  <h1 style="color: #333; font-size: 28pt; text-align: center;">Title</h1>
  <p style="text-indent: 0.5in; line-height: 1.6;">Body text...</p>
</article>

### Styling Freedom

You can use any inline styles:
- Colors: style="color: #9B2335;"
- Font sizes: style="font-size: 14pt;"
- Font families: style="font-family: Georgia, serif;"
- Alignment: style="text-align: center;"
- Spacing: style="margin-top: 12pt; margin-bottom: 6pt;"
- Backgrounds: style="background-color: #f5f5f5;"
- Borders: style="border-left: 4px solid #ccc;"

### Tables

<table style="width: 100%; border-collapse: collapse;">
  <tr style="background: #f0f0f0;">
    <th style="padding: 8pt; border: 1px solid #ddd;">Header</th>
  </tr>
  <tr>
    <td style="padding: 8pt; border: 1px solid #ddd;">Cell</td>
  </tr>
</table>

### Footnotes (CRITICAL)

Every source MUST have a footnote:
<p>Text with citation<sup><a href="#fn1">1</a></sup>.</p>

<footer>
  <p id="fn1"><sup>1</sup> Full citation here.</p>
</footer>

### Callout Boxes

<div class="callout">
  <p><strong>Note</strong></p>
  <p>Information here...</p>
</div>

<div class="callout-warning">
  <p><strong>Warning</strong></p>
  <p>Critical information...</p>
</div>

### Rules

1. Wrap everything in <article>
2. Use inline styles for all visual customization
3. Every source needs a footnote
4. Use class="callout" or class="callout-warning" for callout boxes
`;
```

---

## Files to Create/Modify

### Create

- `services/gateway/src/services/html-to-docx.service.ts` - New converter

### Modify

- `services/gateway/package.json` - Add `docx` dependency
- `services/gateway/src/services/word-ai.routes.ts` - Use new converter
- `services/gateway/src/services/word-ai-prompts.ts` - Update HTML guidelines

### Keep (no changes)

- `apps/word-addin/src/services/word-api.ts`
- `apps/word-addin/src/components/DraftTab.tsx`
- `services/gateway/src/services/word-ai.service.ts`

### Deprecate (keep for fallback, remove later)

- `services/gateway/src/services/html-to-ooxml.service.ts`

---

## Success Criteria

1. **Footnotes work correctly** - Real Word footnotes, not just superscript text
2. **Claude's styling preserved** - Colors, fonts, sizes render as specified
3. **Tables render properly** - With headers, borders, cell shading
4. **Callout boxes work** - Background colors, borders
5. **Lists work** - Bullet and numbered, with nesting
6. **No regression** - Everything that worked before still works

---

## Rollback Plan

Keep old `html-to-ooxml.service.ts` available. If issues arise:

```typescript
// In word-ai.routes.ts
const USE_NEW_CONVERTER = process.env.USE_DOCX_CONVERTER === 'true';

if (USE_NEW_CONVERTER) {
  return htmlToDocxService.convert(html);
} else {
  return htmlToOoxmlService.convert(html);
}
```

---

## References

- docx library: https://github.com/dolanmiu/docx
- docx documentation: https://docx.js.org/
- Current converter: `services/gateway/src/services/html-to-ooxml.service.ts`
- Word add-in insertion: `apps/word-addin/src/services/word-api.ts`
