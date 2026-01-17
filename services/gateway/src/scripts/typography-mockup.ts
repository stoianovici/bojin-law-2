/**
 * Typography Mockup Generator
 * Generates a sample legal document with improved typography settings.
 *
 * Run: npx ts-node src/scripts/typography-mockup.ts
 * Output: /tmp/typography-mockup.xml (open in Word)
 */

import * as fs from 'fs';

// ============================================================================
// Proposed Typography Values
// ============================================================================

/**
 * Paragraph spacing values in twips (1 point = 20 twips)
 * Research-based values for professional legal documents
 */
const TYPOGRAPHY = {
  // Line spacing (w:line values with lineRule="auto")
  lineSpacing: {
    single: 240, // 1.0x - for headings
    tight: 312, // 1.3x - for lists (current)
    comfortable: 336, // 1.4x - for lists (proposed)
    body: 360, // 1.5x - for body text
  },

  // Space after paragraph (w:after values)
  spaceAfter: {
    title: 240, // 12pt - generous after title
    subtitle: 160, // 8pt
    heading1: 120, // 6pt - enough separation
    heading2: 100, // 5pt
    heading3: 80, // 4pt
    body: 160, // 8pt - KEY CHANGE: adds paragraph separation
    list: 60, // 3pt - tighter for list items
    quote: 160, // 8pt - same as body
  },

  // Space before paragraph (w:before values)
  spaceBefore: {
    heading1: 240, // 12pt - visual section break
    heading2: 200, // 10pt
    heading3: 160, // 8pt
  },
};

// ============================================================================
// OOXML Generation (simplified version with proposed changes)
// ============================================================================

function generateMockupDocument(): string {
  const bodyContent = `
    ${paragraph('Title', 'CONTRACT DE CESIUNE DE PĂRȚI SOCIALE', {
      fontSize: 48,
      bold: false,
      color: '333333',
      lineSpacing: TYPOGRAPHY.lineSpacing.single,
      spaceAfter: TYPOGRAPHY.spaceAfter.title,
      alignment: 'center',
    })}

    ${paragraph('Subtitle', '(Contract de schimb de participații)', {
      fontSize: 28,
      color: '666666',
      lineSpacing: TYPOGRAPHY.lineSpacing.single,
      spaceAfter: TYPOGRAPHY.spaceAfter.subtitle,
      alignment: 'center',
    })}

    ${paragraph('Normal', 'Nr. __/__', {
      fontSize: 24,
      lineSpacing: TYPOGRAPHY.lineSpacing.body,
      spaceAfter: TYPOGRAPHY.spaceAfter.body,
    })}

    ${paragraph('Normal', 'București, [DATA]', {
      fontSize: 24,
      lineSpacing: TYPOGRAPHY.lineSpacing.body,
      spaceAfter: TYPOGRAPHY.spaceAfter.body,
    })}

    ${divider()}

    ${paragraph('Heading1', 'PREAMBUL', {
      fontSize: 32,
      color: '9B2335',
      lineSpacing: TYPOGRAPHY.lineSpacing.single,
      spaceBefore: TYPOGRAPHY.spaceBefore.heading1,
      spaceAfter: TYPOGRAPHY.spaceAfter.heading1,
    })}

    ${paragraph(
      'Normal',
      'Prezentul contract reprezintă un contract de schimb de participații (părți sociale), prin care fiecare Parte cedează celeilalte părțile sociale deținute la o societate, în schimbul primirii părților sociale deținute de cealaltă Parte la o altă societate, fără plata vreunei sulte.',
      {
        fontSize: 24,
        lineSpacing: TYPOGRAPHY.lineSpacing.body,
        spaceAfter: TYPOGRAPHY.spaceAfter.body,
      }
    )}

    ${paragraph(
      'Normal',
      'Acest paragraf demonstrează spațierea dintre paragrafe. Observați că există un spațiu de 8pt (160 twips) între acest paragraf și cel anterior. Aceasta creează o separare vizuală clară, fără a fi necesară o linie goală.',
      {
        fontSize: 24,
        lineSpacing: TYPOGRAPHY.lineSpacing.body,
        spaceAfter: TYPOGRAPHY.spaceAfter.body,
      }
    )}

    ${paragraph(
      'Normal',
      'Spațierea dintre rânduri este de 1.5x (360 twips), ceea ce oferă suficient spațiu pentru lizibilitate fără a face documentul prea "aerisit". Aceasta este practica standard pentru documente juridice profesionale.',
      {
        fontSize: 24,
        lineSpacing: TYPOGRAPHY.lineSpacing.body,
        spaceAfter: TYPOGRAPHY.spaceAfter.body,
      }
    )}

    ${divider()}

    ${paragraph('Heading1', 'Articolul 1. DEFINIȚII ȘI INTERPRETARE', {
      fontSize: 32,
      color: '9B2335',
      lineSpacing: TYPOGRAPHY.lineSpacing.single,
      spaceBefore: TYPOGRAPHY.spaceBefore.heading1,
      spaceAfter: TYPOGRAPHY.spaceAfter.heading1,
    })}

    ${paragraph('Heading2', '1.1. Definiții', {
      fontSize: 28,
      color: '333333',
      lineSpacing: TYPOGRAPHY.lineSpacing.single,
      spaceBefore: TYPOGRAPHY.spaceBefore.heading2,
      spaceAfter: TYPOGRAPHY.spaceAfter.heading2,
    })}

    ${paragraph(
      'Normal',
      'Părți Sociale Cedate A - reprezintă un număr de [__] părți sociale deținute de Copermutantul A la Societatea A, având o valoare nominală totală de [_] lei, reprezentând [__]% din capitalul social al Societății A.',
      {
        fontSize: 24,
        lineSpacing: TYPOGRAPHY.lineSpacing.body,
        spaceAfter: TYPOGRAPHY.spaceAfter.body,
      }
    )}

    ${paragraph(
      'Normal',
      'Părți Sociale Cedate B - reprezintă un număr de [__] părți sociale deținute de Copermutantul B la Societatea B, având o valoare nominală totală de [_] lei, reprezentând [__]% din capitalul social al Societății B.',
      {
        fontSize: 24,
        lineSpacing: TYPOGRAPHY.lineSpacing.body,
        spaceAfter: TYPOGRAPHY.spaceAfter.body,
      }
    )}

    ${paragraph('Heading2', '1.2. Interpretare', {
      fontSize: 28,
      color: '333333',
      lineSpacing: TYPOGRAPHY.lineSpacing.single,
      spaceBefore: TYPOGRAPHY.spaceBefore.heading2,
      spaceAfter: TYPOGRAPHY.spaceAfter.heading2,
    })}

    ${paragraph(
      'Normal',
      'În prezentul contract, cu excepția cazului în care contextul impune altfel:',
      {
        fontSize: 24,
        lineSpacing: TYPOGRAPHY.lineSpacing.body,
        spaceAfter: TYPOGRAPHY.spaceAfter.list,
      }
    )}

    ${listItem('referirile la articole sunt referiri la articolele prezentului contract;')}
    ${listItem('titlurile articolelor sunt incluse doar pentru ușurința consultării și nu afectează interpretarea;')}
    ${listItem('referirile la legi includ orice modificări sau republicări ulterioare.')}

    ${divider()}

    ${paragraph('Heading1', 'Articolul 2. OBIECTUL CONTRACTULUI', {
      fontSize: 32,
      color: '9B2335',
      lineSpacing: TYPOGRAPHY.lineSpacing.single,
      spaceBefore: TYPOGRAPHY.spaceBefore.heading1,
      spaceAfter: TYPOGRAPHY.spaceAfter.heading1,
    })}

    ${paragraph('Heading2', '2.1. Schimbul de părți sociale', {
      fontSize: 28,
      color: '333333',
      lineSpacing: TYPOGRAPHY.lineSpacing.single,
      spaceBefore: TYPOGRAPHY.spaceBefore.heading2,
      spaceAfter: TYPOGRAPHY.spaceAfter.heading2,
    })}

    ${paragraph(
      'Normal',
      'Prin prezentul contract, Părțile convin să realizeze un schimb reciproc de părți sociale, după cum urmează:',
      {
        fontSize: 24,
        lineSpacing: TYPOGRAPHY.lineSpacing.body,
        spaceAfter: TYPOGRAPHY.spaceAfter.list,
      }
    )}

    ${numberedItem('a)', 'Copermutantul A cedează și transferă Copermutantului B, care acceptă, Părțile Sociale Cedate A, reprezentând [___] părți sociale la Societatea A;')}
    ${numberedItem('b)', 'Copermutantul B cedează și transferă Copermutantului A, care acceptă, Părțile Sociale Cedate B, reprezentând [___] părți sociale la Societatea B.')}

    ${paragraph('Heading2', '2.2. Natura juridică', {
      fontSize: 28,
      color: '333333',
      lineSpacing: TYPOGRAPHY.lineSpacing.single,
      spaceBefore: TYPOGRAPHY.spaceBefore.heading2,
      spaceAfter: TYPOGRAPHY.spaceAfter.heading2,
    })}

    ${paragraph(
      'Normal',
      'Prezentul contract are natura juridică a unui contract de schimb, reglementat de art. 1763-1765 din Codul Civil, combinat cu dispozițiile speciale privind cesiunea părților sociale din Legea nr. 31/1990. Conform art. 1764 Cod Civil, dispozițiile de la vânzare se aplică în mod corespunzător contractului de schimb.',
      {
        fontSize: 24,
        lineSpacing: TYPOGRAPHY.lineSpacing.body,
        spaceAfter: TYPOGRAPHY.spaceAfter.body,
      }
    )}
  `;

  return wrapDocument(bodyContent);
}

// ============================================================================
// Helper Functions
// ============================================================================

interface ParagraphOptions {
  fontSize?: number;
  bold?: boolean;
  italic?: boolean;
  color?: string;
  lineSpacing?: number;
  spaceAfter?: number;
  spaceBefore?: number;
  alignment?: 'left' | 'center' | 'right' | 'both';
  indent?: number;
}

function paragraph(style: string, text: string, opts: ParagraphOptions = {}): string {
  const pPrParts: string[] = [];
  const rPrParts: string[] = [];

  // Paragraph style
  pPrParts.push(`<w:pStyle w:val="${style}"/>`);

  // Alignment
  if (opts.alignment) {
    pPrParts.push(`<w:jc w:val="${opts.alignment}"/>`);
  }

  // Spacing
  const spacingParts: string[] = [];
  if (opts.spaceBefore !== undefined) {
    spacingParts.push(`w:before="${opts.spaceBefore}"`);
  }
  if (opts.spaceAfter !== undefined) {
    spacingParts.push(`w:after="${opts.spaceAfter}"`);
  }
  if (opts.lineSpacing !== undefined) {
    spacingParts.push(`w:line="${opts.lineSpacing}" w:lineRule="auto"`);
  }
  if (spacingParts.length > 0) {
    pPrParts.push(`<w:spacing ${spacingParts.join(' ')}/>`);
  }

  // Indentation
  if (opts.indent) {
    pPrParts.push(`<w:ind w:left="${opts.indent}"/>`);
  }

  // Run properties (font)
  rPrParts.push(
    '<w:rFonts w:ascii="Georgia" w:hAnsi="Georgia" w:eastAsia="Georgia" w:cs="Times New Roman"/>'
  );

  if (opts.bold) {
    rPrParts.push('<w:b/>');
  }
  if (opts.italic) {
    rPrParts.push('<w:i/>');
  }
  if (opts.fontSize) {
    rPrParts.push(`<w:sz w:val="${opts.fontSize}"/>`);
    rPrParts.push(`<w:szCs w:val="${opts.fontSize}"/>`);
  }
  if (opts.color) {
    rPrParts.push(`<w:color w:val="${opts.color}"/>`);
  }

  const pPr = pPrParts.length > 0 ? `<w:pPr>${pPrParts.join('')}</w:pPr>` : '';
  const rPr = rPrParts.length > 0 ? `<w:rPr>${rPrParts.join('')}</w:rPr>` : '';

  const escapedText = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  return `<w:p>${pPr}<w:r>${rPr}<w:t xml:space="preserve">${escapedText}</w:t></w:r></w:p>`;
}

function listItem(text: string): string {
  return paragraph('ListParagraph', `• ${text}`, {
    fontSize: 24,
    lineSpacing: TYPOGRAPHY.lineSpacing.comfortable,
    spaceAfter: TYPOGRAPHY.spaceAfter.list,
    indent: 720,
  });
}

function numberedItem(prefix: string, text: string): string {
  return paragraph('ListParagraph', `${prefix} ${text}`, {
    fontSize: 24,
    lineSpacing: TYPOGRAPHY.lineSpacing.comfortable,
    spaceAfter: TYPOGRAPHY.spaceAfter.list,
    indent: 720,
  });
}

function divider(): string {
  return `<w:p>
    <w:pPr>
      <w:jc w:val="center"/>
      <w:spacing w:before="240" w:after="240"/>
    </w:pPr>
    <w:r>
      <w:rPr>
        <w:rFonts w:ascii="Georgia" w:hAnsi="Georgia"/>
        <w:sz w:val="24"/>
        <w:color w:val="999999"/>
      </w:rPr>
      <w:t>• • •</w:t>
    </w:r>
  </w:p>`;
}

function wrapDocument(bodyXml: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<?mso-application progid="Word.Document"?>
<pkg:package xmlns:pkg="http://schemas.microsoft.com/office/2006/xmlPackage">
<pkg:part pkg:name="/_rels/.rels" pkg:contentType="application/vnd.openxmlformats-package.relationships+xml">
<pkg:xmlData>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>
</pkg:xmlData>
</pkg:part>
<pkg:part pkg:name="/word/document.xml" pkg:contentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml">
<pkg:xmlData>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${bodyXml}
<w:sectPr>
<w:pgSz w:w="11906" w:h="16838"/>
<w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="709" w:footer="709"/>
</w:sectPr>
</w:body>
</w:document>
</pkg:xmlData>
</pkg:part>
</pkg:package>`;
}

// ============================================================================
// Main
// ============================================================================

const outputPath = '/tmp/typography-mockup.xml';
const content = generateMockupDocument();
fs.writeFileSync(outputPath, content, 'utf-8');
console.log(`\n✅ Mockup generated: ${outputPath}`);
console.log('\nTo view:');
console.log('  1. Open Microsoft Word');
console.log('  2. File → Open → Select the .xml file');
console.log('  3. Or rename to .docx and double-click');
console.log('\nKey changes demonstrated:');
console.log('  • 8pt (160 twips) space after body paragraphs');
console.log('  • 6pt (120 twips) space after Heading1');
console.log('  • 1.4x line spacing for lists (was 1.3x)');
console.log('  • Space before headings for visual separation');
