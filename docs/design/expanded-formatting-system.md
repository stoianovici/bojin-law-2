# Expanded Document Formatting System

Design specification for professional editorial formatting in Word add-in drafts.

## Overview

Extends the current 18-element system to 32 elements, adding callout boxes, tables, dividers, and advanced typography commonly used by book/article editors.

---

## Part 1: New Markdown Syntax Extensions

### Callout Boxes (6 new types)

Visual boxes with background colors and optional borders for highlighting information.

```markdown
:::note
Procedural information or helpful tips.
:::

:::warning
Deadlines, risks, or cautions.
:::

:::important
Critical information requiring immediate attention.
:::

:::example
Practical examples or case illustrations.
:::

:::definition
Formal term definitions.
:::

:::summary
Key takeaways or executive summaries.
:::
```

### Pull Quotes

Large, emphasized excerpts that draw attention.

```markdown
:::pullquote
"Dreptul la apărare este garantat."
— Constituția României, Art. 24
:::
```

### Tables

Simple table syntax with optional styling.

```markdown
:::table
| Parte | Calitate | Reprezentant |
|-------|----------|--------------|
| SC Example SRL | Reclamant | Av. Popescu |
| Ion Ionescu | Pârât | Av. Georgescu |
:::

:::table striped
| ... |
:::

:::table bordered
| ... |
:::
```

### Dividers

Visual section separators.

```markdown
--- → Simple line (existing)
\*\*\* → Decorative divider (three dots or ornament)
=== → Heavy section break
```

### Advanced Indentation (expand existing)

```markdown
> > > > text → Indent level 3 (2160 twips / 1.5 inch)
> > > >
> > > > > text → Indent level 4 (2880 twips / 2 inch)
```

### Typography Enhancements

```markdown
^^SMALL CAPS^^ → Small capitals
~~strikethrough~~ → Strikethrough text
++inserted/added++ → Underline (alternative to \_)
==highlighted== → Yellow highlight
```

### Page Layout

```markdown
:::pagebreak
:::

:::columns 2
Content in two columns...
:::

:::centered
Centered content block
:::
```

### Nested Lists (enhance existing)

```markdown
1. First level
   a. Second level (letter)
   b. Another
   i. Third level (roman)
   ii. Another
```

---

## Part 2: OOXML Implementation

### Callout Box Styles

Each callout type maps to specific shading and border combinations:

```typescript
const CALLOUT_STYLES = {
  note: {
    shading: 'E8F4FD', // Light blue
    borderColor: '2196F3', // Blue
    borderLeft: 4, // 4pt left border only
    icon: 'ℹ️',
  },
  warning: {
    shading: 'FFF8E1', // Light amber
    borderColor: 'FF9800', // Orange
    borderLeft: 4,
    icon: '⚠️',
  },
  important: {
    shading: 'FFEBEE', // Light red
    borderColor: 'F44336', // Red
    border: 'box', // All sides
    icon: '❗',
  },
  example: {
    shading: 'F5F5F5', // Light gray
    borderColor: '9E9E9E', // Gray
    borderLeft: 4,
    icon: '📋',
  },
  definition: {
    shading: 'F3E5F5', // Light purple
    borderColor: '9C27B0', // Purple
    border: 'box',
    icon: '📖',
  },
  summary: {
    shading: 'E8F5E9', // Light green
    borderColor: '4CAF50', // Green
    border: 'box',
    icon: '✓',
  },
};
```

### OOXML Templates

#### Callout Box Paragraph

```xml
<w:p>
  <w:pPr>
    <w:pStyle w:val="NoteBox"/>
    <w:pBdr>
      <w:left w:val="single" w:sz="24" w:space="4" w:color="2196F3"/>
    </w:pBdr>
    <w:shd w:val="clear" w:color="auto" w:fill="E8F4FD"/>
    <w:ind w:left="284" w:right="284"/>
    <w:spacing w:before="120" w:after="120"/>
  </w:pPr>
  <w:r>
    <w:t>Content here</w:t>
  </w:r>
</w:p>
```

#### Full Border Box (Important/Definition)

```xml
<w:p>
  <w:pPr>
    <w:pBdr>
      <w:top w:val="single" w:sz="4" w:space="4" w:color="F44336"/>
      <w:left w:val="single" w:sz="4" w:space="4" w:color="F44336"/>
      <w:bottom w:val="single" w:sz="4" w:space="4" w:color="F44336"/>
      <w:right w:val="single" w:sz="4" w:space="4" w:color="F44336"/>
    </w:pBdr>
    <w:shd w:val="clear" w:color="auto" w:fill="FFEBEE"/>
    <w:ind w:left="284" w:right="284"/>
  </w:pPr>
  <!-- content -->
</w:p>
```

#### Pull Quote

```xml
<w:p>
  <w:pPr>
    <w:pStyle w:val="IntenseQuote"/>
    <w:pBdr>
      <w:top w:val="single" w:sz="4" w:space="4" w:color="9B2335"/>
      <w:bottom w:val="single" w:sz="4" w:space="4" w:color="9B2335"/>
    </w:pBdr>
    <w:ind w:left="720" w:right="720"/>
    <w:jc w:val="center"/>
  </w:pPr>
  <w:r>
    <w:rPr>
      <w:sz w:val="28"/>
      <w:i/>
      <w:color w:val="333333"/>
    </w:rPr>
    <w:t>"Quote text here"</w:t>
  </w:r>
</w:p>
```

#### Simple Table

```xml
<w:tbl>
  <w:tblPr>
    <w:tblStyle w:val="TableGrid"/>
    <w:tblW w:w="0" w:type="auto"/>
    <w:tblBorders>
      <w:top w:val="single" w:sz="4" w:color="auto"/>
      <w:left w:val="single" w:sz="4" w:color="auto"/>
      <w:bottom w:val="single" w:sz="4" w:color="auto"/>
      <w:right w:val="single" w:sz="4" w:color="auto"/>
      <w:insideH w:val="single" w:sz="4" w:color="auto"/>
      <w:insideV w:val="single" w:sz="4" w:color="auto"/>
    </w:tblBorders>
  </w:tblPr>
  <w:tr>
    <w:tc>
      <w:tcPr>
        <w:shd w:val="clear" w:fill="F5F5F5"/>
      </w:tcPr>
      <w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Header</w:t></w:r></w:p>
    </w:tc>
  </w:tr>
  <w:tr>
    <w:tc>
      <w:p><w:r><w:t>Cell content</w:t></w:r></w:p>
    </w:tc>
  </w:tr>
</w:tbl>
```

#### Decorative Divider

```xml
<w:p>
  <w:pPr>
    <w:jc w:val="center"/>
    <w:spacing w:before="240" w:after="240"/>
  </w:pPr>
  <w:r>
    <w:rPr>
      <w:color w:val="9B2335"/>
      <w:sz w:val="24"/>
    </w:rPr>
    <w:t>• • •</w:t>
  </w:r>
</w:p>
```

#### Heavy Section Break

```xml
<w:p>
  <w:pPr>
    <w:pBdr>
      <w:bottom w:val="single" w:sz="12" w:space="1" w:color="333333"/>
    </w:pBdr>
    <w:spacing w:before="360" w:after="360"/>
  </w:pPr>
</w:p>
```

#### Small Caps

```xml
<w:r>
  <w:rPr>
    <w:smallCaps/>
  </w:rPr>
  <w:t>SMALL CAPS TEXT</w:t>
</w:r>
```

#### Highlighted Text

```xml
<w:r>
  <w:rPr>
    <w:highlight w:val="yellow"/>
  </w:rPr>
  <w:t>Highlighted text</w:t>
</w:r>
```

#### Strikethrough

```xml
<w:r>
  <w:rPr>
    <w:strike/>
  </w:rPr>
  <w:t>Deleted text</w:t>
</w:r>
```

#### Page Break

```xml
<w:p>
  <w:r>
    <w:br w:type="page"/>
  </w:r>
</w:p>
```

#### Two Columns

```xml
<w:p>
  <w:pPr>
    <w:sectPr>
      <w:cols w:num="2" w:space="720"/>
    </w:sectPr>
  </w:pPr>
</w:p>
<!-- Column content here -->
<w:p>
  <w:pPr>
    <w:sectPr>
      <w:cols w:num="1"/>
    </w:sectPr>
  </w:pPr>
</w:p>
```

---

## Part 3: Updated Prompt Instructions

### New Formatting Section for System Prompt

```
FORMATARE AVANSATĂ (folosește pentru documente profesionale):

CASETE DE EVIDENȚIERE:
:::note
Text informativ sau procedural
:::
→ Casetă albastră cu informații utile

:::warning
Atenție la termen/risc
:::
→ Casetă portocalie pentru avertismente

:::important
Clauză critică sau obligație esențială
:::
→ Casetă roșie pentru informații critice

:::example
Exemplu practic sau ilustrație
:::
→ Casetă gri pentru exemple

:::definition
_Termen definit_ - explicația formală a termenului
:::
→ Casetă violet pentru definiții

:::summary
Punctele cheie de reținut
:::
→ Casetă verde pentru rezumate

CITAT EVIDENȚIAT (pull quote):
:::pullquote
"Citatul important"
— Sursa
:::
→ Text mare, centrat, cu linii decorative

TABELE:
:::table
| Coloană 1 | Coloană 2 |
|-----------|-----------|
| Valoare   | Valoare   |
:::

SEPARATOARE:
---  → Linie simplă
***  → Separator decorativ (• • •)
===  → Separator greu de secțiune

TIPOGRAFIE:
^^TEXT^^ → SMALL CAPS (pentru titluri de acte)
==text== → Text evidențiat (galben)
~~text~~ → Text tăiat (pentru modificări)

LAYOUT:
:::pagebreak
:::
→ Pagină nouă

:::centered
Text centrat
:::

CÂND SĂ FOLOSEȘTI:

1. :::note - pentru explicații procedurale, termene orientative
2. :::warning - pentru termene imperative, riscuri, sancțiuni
3. :::important - pentru clauze esențiale, obligații principale
4. :::example - pentru jurisprudență, cazuri similare
5. :::definition - când introduci termeni tehnici sau definiți
6. :::summary - la începutul sau sfârșitul secțiunilor majore
7. :::pullquote - pentru citate din legi sau decizii importante
8. Tabele - pentru comparații, liste de părți, termene structurate
9. Separatoare - între secțiuni majore ale documentului
```

---

## Part 4: Complete Element Reference

### All 32 Elements

| #   | Element            | Syntax          | Category      |
| --- | ------------------ | --------------- | ------------- |
| 1   | Title              | `# text`        | Structure     |
| 2   | Subtitle           | `## text`       | Structure     |
| 3   | Heading 1          | `### text`      | Structure     |
| 4   | Heading 2          | `#### text`     | Structure     |
| 5   | Heading 3          | `##### text`    | Structure     |
| 6   | Normal             | plain text      | Structure     |
| 7   | Bold               | `**text**`      | Inline        |
| 8   | Italic             | `*text*`        | Inline        |
| 9   | Underline          | `_text_`        | Inline        |
| 10  | Bold+Italic        | `***text***`    | Inline        |
| 11  | Small Caps         | `^^TEXT^^`      | Inline (NEW)  |
| 12  | Strikethrough      | `~~text~~`      | Inline (NEW)  |
| 13  | Highlight          | `==text==`      | Inline (NEW)  |
| 14  | Footnote           | `[^1]`          | Inline        |
| 15  | Bullet List        | `- item`        | List          |
| 16  | Numbered List      | `1. item`       | List          |
| 17  | Nested List L2     | `   a. item`    | List (NEW)    |
| 18  | Nested List L3     | `      i. item` | List (NEW)    |
| 19  | Quote              | `> text`        | Block         |
| 20  | Indent L1          | `>> text`       | Block         |
| 21  | Indent L2          | `>>> text`      | Block         |
| 22  | Indent L3          | `>>>> text`     | Block (NEW)   |
| 23  | Note Box           | `:::note`       | Callout (NEW) |
| 24  | Warning Box        | `:::warning`    | Callout (NEW) |
| 25  | Important Box      | `:::important`  | Callout (NEW) |
| 26  | Example Box        | `:::example`    | Callout (NEW) |
| 27  | Definition Box     | `:::definition` | Callout (NEW) |
| 28  | Summary Box        | `:::summary`    | Callout (NEW) |
| 29  | Pull Quote         | `:::pullquote`  | Callout (NEW) |
| 30  | Table              | `:::table`      | Block (NEW)   |
| 31  | Decorative Divider | `***`           | Divider (NEW) |
| 32  | Section Break      | `===`           | Divider (NEW) |
| 33  | Page Break         | `:::pagebreak`  | Layout (NEW)  |
| 34  | Centered Block     | `:::centered`   | Layout (NEW)  |
| 35  | Two Columns        | `:::columns 2`  | Layout (NEW)  |

### Preserved Legal Blocks (7)

| Element       | Syntax             | Use                     |
| ------------- | ------------------ | ----------------------- |
| Date/Location | `:::date-location` | Document header         |
| Party         | `:::party`         | Contract parties        |
| Article       | `:::article N`     | Legal article reference |
| Citation      | `:::citation`      | Legal citations         |
| Conclusion    | `:::conclusion`    | Dispositif              |
| Signature     | `:::signature`     | Signature block         |
| Columns       | `:::columns`       | Multi-column layout     |

---

## Part 5: Implementation Priority

### Phase 1: High Impact (implement first)

1. Callout boxes (note, warning, important) - most useful for legal docs
2. Tables - essential for structured legal data
3. Decorative dividers - visual polish

### Phase 2: Typography

4. Small caps - common in legal document titles
5. Highlight - useful for draft review
6. Strikethrough - useful for showing changes

### Phase 3: Layout

7. Page breaks
8. Centered blocks
9. Columns (already partially implemented)

### Phase 4: Advanced

10. Pull quotes
11. Nested lists
12. Additional indent levels

---

## Part 6: Example Output

A legal document using the expanded system:

```markdown
# Contract de Prestări Servicii

:::date-location
București, 15 ianuarie 2025
:::

:::party
**PRESTATOR:** SC Legal Services SRL, J40/1234/2020, CUI RO12345678
**BENEFICIAR:** Ion Popescu, CNP 1234567890123
:::

---

### Articolul 1. Obiectul Contractului

:::definition
_Serviciile_ reprezintă activitățile de consultanță juridică descrise în Anexa 1.
:::

Prestatorul se obligă să furnizeze Beneficiarului serviciile de consultanță juridică în domeniul dreptului comercial.

:::important
Termenul de executare este de **30 de zile** de la semnarea contractului. Nerespectarea termenului atrage penalități de 0,1% pe zi de întârziere.
:::

### Articolul 2. Prețul și Modalitatea de Plată

:::table
| Serviciu | Tarif | Termen plată |
|----------|-------|--------------|
| Consultanță inițială | 500 EUR | La semnare |
| Redactare acte | 200 EUR/act | La livrare |
| Reprezentare | 150 EUR/oră | Lunar |
:::

:::warning
Plata se efectuează în termen de 15 zile de la emiterea facturii. După acest termen se percep dobânzi legale.
:::

### Articolul 3. Confidențialitate

:::note
Obligația de confidențialitate se extinde și după încetarea contractului, conform art. 1170 Cod Civil.
:::

Părțile se obligă să păstreze confidențialitatea informațiilor obținute în executarea contractului.

:::pullquote
"Secretul profesional al avocatului este de ordine publică."
— Art. 11, Legea 51/1995
:::

===

### Articolul 4. Dispoziții Finale

:::summary

- Durata: 1 an cu prelungire automată
- Reziliere: preaviz 30 zile
- Litigii: instanțele din București
  :::

:::signature
Prestator,

---

SC Legal Services SRL

Beneficiar,

---

Ion Popescu
:::
```
