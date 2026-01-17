/**
 * Typography Mockup Generator (proper DOCX format)
 * Generates a sample legal document with improved typography settings.
 *
 * Run: npx ts-node src/scripts/typography-mockup-docx.ts
 */

import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  convertInchesToTwip,
  BorderStyle,
  LineRuleType,
} from 'docx';
import * as fs from 'fs';

// ============================================================================
// Proposed Typography Values (in twips: 1 point = 20 twips)
// ============================================================================

const TYPOGRAPHY = {
  // Space after paragraph in points (converted to twips internally)
  spaceAfter: {
    title: 12, // 12pt - generous after title
    subtitle: 8, // 8pt
    heading1: 6, // 6pt
    heading2: 5, // 5pt
    heading3: 4, // 4pt
    body: 8, // 8pt - KEY CHANGE
    list: 3, // 3pt - tighter for lists
  },
  spaceBefore: {
    heading1: 12, // 12pt - visual section break
    heading2: 10, // 10pt
    heading3: 8, // 8pt
  },
  // Line spacing multiplier (1.0 = single, 1.5 = one-and-half)
  lineSpacing: {
    heading: 1.0,
    body: 1.5,
    list: 1.4,
  },
};

// Convert points to twips
const pt = (points: number) => points * 20;

// ============================================================================
// Document Generation
// ============================================================================

async function generateMockup() {
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(1),
              right: convertInchesToTwip(1),
              bottom: convertInchesToTwip(1),
              left: convertInchesToTwip(1),
            },
          },
        },
        children: [
          // Title
          new Paragraph({
            children: [
              new TextRun({
                text: 'CONTRACT DE CESIUNE DE PĂRȚI SOCIALE',
                font: 'Georgia',
                size: 48, // 24pt (half-points)
                color: '333333',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: {
              after: pt(TYPOGRAPHY.spaceAfter.title),
              line: 240, // single
              lineRule: LineRuleType.AUTO,
            },
          }),

          // Subtitle
          new Paragraph({
            children: [
              new TextRun({
                text: '(Contract de schimb de participații)',
                font: 'Georgia',
                size: 28, // 14pt
                color: '666666',
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: {
              after: pt(TYPOGRAPHY.spaceAfter.subtitle),
              line: 240,
              lineRule: LineRuleType.AUTO,
            },
          }),

          // Date/Number
          new Paragraph({
            children: [new TextRun({ text: 'Nr. __/__', font: 'Georgia', size: 24 })],
            spacing: {
              after: pt(TYPOGRAPHY.spaceAfter.body),
              line: 360, // 1.5x
              lineRule: LineRuleType.AUTO,
            },
          }),

          new Paragraph({
            children: [new TextRun({ text: 'București, [DATA]', font: 'Georgia', size: 24 })],
            spacing: {
              after: pt(TYPOGRAPHY.spaceAfter.body),
              line: 360,
              lineRule: LineRuleType.AUTO,
            },
          }),

          // Divider
          divider(),

          // PREAMBUL heading
          heading1('PREAMBUL'),

          // Body paragraphs - demonstrating the spacing
          bodyParagraph(
            'Prezentul contract reprezintă un contract de schimb de participații (părți sociale), prin care fiecare Parte cedează celeilalte părțile sociale deținute la o societate, în schimbul primirii părților sociale deținute de cealaltă Parte la o altă societate, fără plata vreunei sulte.'
          ),

          bodyParagraph(
            'Acest paragraf demonstrează spațierea dintre paragrafe. Observați că există un spațiu de 8pt între acest paragraf și cel anterior. Aceasta creează o separare vizuală clară, fără a fi necesară o linie goală.'
          ),

          bodyParagraph(
            'Spațierea dintre rânduri este de 1.5x, ceea ce oferă suficient spațiu pentru lizibilitate fără a face documentul prea "aerisit". Aceasta este practica standard pentru documente juridice profesionale.'
          ),

          // Divider
          divider(),

          // Article 1
          heading1('Articolul 1. DEFINIȚII ȘI INTERPRETARE'),

          heading2('1.1. Definiții'),

          bodyParagraph(
            'Părți Sociale Cedate A - reprezintă un număr de [__] părți sociale deținute de Copermutantul A la Societatea A, având o valoare nominală totală de [_] lei, reprezentând [__]% din capitalul social al Societății A.'
          ),

          bodyParagraph(
            'Părți Sociale Cedate B - reprezintă un număr de [__] părți sociale deținute de Copermutantul B la Societatea B, având o valoare nominală totală de [_] lei, reprezentând [__]% din capitalul social al Societății B.'
          ),

          heading2('1.2. Interpretare'),

          bodyParagraph(
            'În prezentul contract, cu excepția cazului în care contextul impune altfel:'
          ),

          listItem('referirile la articole sunt referiri la articolele prezentului contract;'),
          listItem(
            'titlurile articolelor sunt incluse doar pentru ușurința consultării și nu afectează interpretarea;'
          ),
          listItem('referirile la legi includ orice modificări sau republicări ulterioare.'),

          // Divider
          divider(),

          // Article 2
          heading1('Articolul 2. OBIECTUL CONTRACTULUI'),

          heading2('2.1. Schimbul de părți sociale'),

          bodyParagraph(
            'Prin prezentul contract, Părțile convin să realizeze un schimb reciproc de părți sociale, după cum urmează:'
          ),

          numberedItem(
            'a)',
            'Copermutantul A cedează și transferă Copermutantului B, care acceptă, Părțile Sociale Cedate A, reprezentând [___] părți sociale la Societatea A;'
          ),
          numberedItem(
            'b)',
            'Copermutantul B cedează și transferă Copermutantului A, care acceptă, Părțile Sociale Cedate B, reprezentând [___] părți sociale la Societatea B.'
          ),

          heading2('2.2. Natura juridică'),

          bodyParagraph(
            'Prezentul contract are natura juridică a unui contract de schimb, reglementat de art. 1763-1765 din Codul Civil, combinat cu dispozițiile speciale privind cesiunea părților sociale din Legea nr. 31/1990. Conform art. 1764 Cod Civil, dispozițiile de la vânzare se aplică în mod corespunzător contractului de schimb.'
          ),

          // Comparison note
          divider(),

          new Paragraph({
            children: [
              new TextRun({
                text: 'COMPARAȚIE CU STILUL ACTUAL:',
                font: 'Georgia',
                size: 24,
                bold: true,
                color: '9B2335',
              }),
            ],
            spacing: {
              before: pt(12),
              after: pt(6),
            },
          }),

          bodyParagraph(
            'Stilul curent nu are spațiu între paragrafe (space after = 0). Documentul de mai sus folosește 8pt space after pentru fiecare paragraf de body text, creând o separare vizuală clară.'
          ),

          bodyParagraph(
            'Alte modificări propuse: 6pt space after pentru Heading1, 12pt space before pentru Heading1 (crează secțiuni vizuale clare), și 1.4x line spacing pentru liste (în loc de 1.3x).'
          ),
        ],
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  const outputPath = process.env.HOME + '/Downloads/typography-mockup-improved.docx';
  fs.writeFileSync(outputPath, buffer);
  console.log(`\n✅ Mockup generated: ${outputPath}`);
  console.log('\nKey changes demonstrated:');
  console.log('  • 8pt space after body paragraphs (was 0pt)');
  console.log('  • 6pt space after Heading1');
  console.log('  • 12pt space before Heading1');
  console.log('  • 1.5x line spacing for body text');
}

// ============================================================================
// Helper Functions
// ============================================================================

function heading1(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        font: 'Georgia',
        size: 32, // 16pt
        color: '9B2335', // Bojin red
      }),
    ],
    spacing: {
      before: pt(TYPOGRAPHY.spaceBefore.heading1),
      after: pt(TYPOGRAPHY.spaceAfter.heading1),
      line: 240,
      lineRule: LineRuleType.AUTO,
    },
  });
}

function heading2(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        font: 'Georgia',
        size: 28, // 14pt
        color: '333333',
      }),
    ],
    spacing: {
      before: pt(TYPOGRAPHY.spaceBefore.heading2),
      after: pt(TYPOGRAPHY.spaceAfter.heading2),
      line: 240,
      lineRule: LineRuleType.AUTO,
    },
  });
}

function bodyParagraph(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        font: 'Georgia',
        size: 24, // 12pt
      }),
    ],
    spacing: {
      after: pt(TYPOGRAPHY.spaceAfter.body),
      line: 360, // 1.5x
      lineRule: LineRuleType.AUTO,
    },
  });
}

function listItem(text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: `• ${text}`,
        font: 'Georgia',
        size: 24,
      }),
    ],
    indent: {
      left: convertInchesToTwip(0.5),
    },
    spacing: {
      after: pt(TYPOGRAPHY.spaceAfter.list),
      line: 336, // 1.4x
      lineRule: LineRuleType.AUTO,
    },
  });
}

function numberedItem(prefix: string, text: string): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: `${prefix} ${text}`,
        font: 'Georgia',
        size: 24,
      }),
    ],
    indent: {
      left: convertInchesToTwip(0.5),
    },
    spacing: {
      after: pt(TYPOGRAPHY.spaceAfter.list),
      line: 336, // 1.4x
      lineRule: LineRuleType.AUTO,
    },
  });
}

function divider(): Paragraph {
  return new Paragraph({
    children: [
      new TextRun({
        text: '• • •',
        font: 'Georgia',
        size: 24,
        color: '999999',
      }),
    ],
    alignment: AlignmentType.CENTER,
    spacing: {
      before: pt(12),
      after: pt(12),
    },
  });
}

// Run
generateMockup().catch(console.error);
