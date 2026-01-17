/**
 * OOXML Fragment Service
 * Generates OOXML fragments from extended markdown for Word insertion.
 *
 * Pagination Control:
 * - Headings use keepNext to stay with following content (no orphan headings)
 * - Callout boxes, signatures, conclusions use keepLines + keepNext to stay together
 * - Table rows use cantSplit to prevent row splitting across pages
 * - Table headers repeat on each page via tblHeader
 *
 * Supports 35 element types:
 * - Structure (6): Title, Subtitle, Heading1-3, Normal
 * - Inline (7): Bold, Italic, Underline, Bold+Italic, Small Caps, Strikethrough, Highlight
 * - Lists (4): Bullet, Numbered, Nested L2 (letter), Nested L3 (roman)
 * - Block (4): Quote, Indent L1-L4
 * - Callouts (7): Note, Warning, Important, Example, Definition, Summary, PullQuote
 * - Dividers (3): Simple (---), Decorative (***), Section Break (===)
 * - Layout (3): PageBreak, Centered, Columns
 * - Legal (7): DateLocation, PartyDefinition, PartyLabel, ArticleNumber,
 *   SignatureBlock, Citation, Conclusion
 *
 * Extended Markdown Syntax:
 * - # Title                    -> Title style
 * - ## Subtitle                -> Subtitle style
 * - ### Heading                -> Heading1 style
 * - #### Heading               -> Heading2 style
 * - ##### Heading              -> Heading3 style
 * - Plain text                 -> Normal style
 * - > text                     -> Quote style
 * - - item / 1. item           -> ListParagraph style
 * - text[^1]                   -> FootnoteReference
 * - >> text                    -> Normal + indent L1 (720 twips)
 * - >>> text                   -> Normal + indent L2 (1440 twips)
 * - >>>> text                  -> Normal + indent L3 (2160 twips)
 * - >>>>> text                 -> Normal + indent L4 (2880 twips)
 * - ---                        -> Simple horizontal rule
 * - ***                        -> Decorative divider (• • •)
 * - ===                        -> Heavy section break
 *
 * Inline Formatting:
 * - **text**                   -> Bold
 * - *text*                     -> Italic
 * - _text_                     -> Underline
 * - ***text***                 -> Bold + Italic
 * - ^^TEXT^^                   -> Small Caps
 * - ~~text~~                   -> Strikethrough
 * - ==text==                   -> Highlight (yellow)
 *
 * Custom Blocks (:::type ... :::):
 * - :::date-location           -> DateLocation style
 * - :::party                   -> PartyDefinition style
 * - :::article N               -> ArticleNumber style
 * - :::signature               -> SignatureBlock style
 * - :::citation                -> Citation style
 * - :::conclusion              -> Conclusion style
 * - :::columns                 -> Two-column layout
 * - :::note                    -> Blue info callout box
 * - :::warning                 -> Orange warning callout box
 * - :::important               -> Red critical callout box
 * - :::example                 -> Gray example callout box
 * - :::definition              -> Purple definition callout box
 * - :::summary                 -> Green summary callout box
 * - :::pullquote               -> Large centered quote with borders
 * - :::table                   -> Simple table
 * - :::pagebreak               -> Page break
 * - :::centered                -> Centered text block
 */

import { BOJIN_HEADER_PNG_BASE64, BOJIN_FOOTER_PNG_BASE64 } from '../assets/bojin-images';

// ============================================================================
// Types
// ============================================================================

interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  smallCaps?: boolean;
  strikethrough?: boolean;
  highlight?: string; // Highlight color (e.g., 'yellow')
  style?: string; // For custom run styles like PartyLabel
  footnoteId?: number; // For actual Word footnote references
}

interface Paragraph {
  style: string;
  runs: TextRun[];
  indent?: number; // in twips (1/20th of a point), 720 = 0.5 inch
  numbering?: {
    id: number;
    level: number;
  };
  // Callout box formatting
  shading?: string; // Background color hex (e.g., 'E8F4FD')
  borderLeft?: { size: number; color: string }; // Left border only
  borderBox?: { size: number; color: string }; // All sides border
  borderTopBottom?: { size: number; color: string }; // Top and bottom borders
  // Layout
  alignment?: 'left' | 'center' | 'right' | 'both';
  spacing?: { before?: number; after?: number }; // in twips
  // Pagination control
  keepNext?: boolean; // Keep with next paragraph (prevents orphan headings)
  keepLines?: boolean; // Keep all lines together (prevents mid-paragraph breaks)
  pageBreakBefore?: boolean; // Force page break before this paragraph
  // Special paragraph types
  paragraphType?: 'divider' | 'pageBreak' | 'table';
  tableData?: TableData;
}

interface TableData {
  headers: string[];
  rows: string[][];
  style?: 'plain' | 'striped' | 'bordered';
}

interface FootnoteDefinition {
  id: number;
  content: string;
}

interface ParseState {
  inBlock: boolean;
  blockType: string | null;
  blockArgs: string | null;
  blockContent: string[];
  // Raw markdown table accumulation
  inTable: boolean;
  tableLines: string[];
}

// ============================================================================
// OOXML Templates
// ============================================================================

// Abstract numbering definitions (templates for bullet and numbered lists)
// These define the format; actual numIds are generated dynamically to allow restart
// Note: Use Arial font with Unicode bullets for consistent cross-platform rendering
// Symbol/Wingdings fonts can cause rendering issues (square bullets) in some Word versions
const ABSTRACT_NUMBERING_XML = `<w:abstractNum w:abstractNumId="1">
<w:multiLevelType w:val="hybridMultilevel"/>
<w:lvl w:ilvl="0">
<w:start w:val="1"/>
<w:numFmt w:val="bullet"/>
<w:lvlText w:val="&#x2022;"/>
<w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:hint="default"/></w:rPr>
</w:lvl>
<w:lvl w:ilvl="1">
<w:start w:val="1"/>
<w:numFmt w:val="bullet"/>
<w:lvlText w:val="&#x25CB;"/>
<w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="1440" w:hanging="360"/></w:pPr>
<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:hint="default"/></w:rPr>
</w:lvl>
<w:lvl w:ilvl="2">
<w:start w:val="1"/>
<w:numFmt w:val="bullet"/>
<w:lvlText w:val="&#x25AA;"/>
<w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="2160" w:hanging="360"/></w:pPr>
<w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial" w:hint="default"/></w:rPr>
</w:lvl>
</w:abstractNum>
<w:abstractNum w:abstractNumId="2">
<w:multiLevelType w:val="hybridMultilevel"/>
<w:lvl w:ilvl="0">
<w:start w:val="1"/>
<w:numFmt w:val="decimal"/>
<w:lvlText w:val="%1."/>
<w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
</w:lvl>
<w:lvl w:ilvl="1">
<w:start w:val="1"/>
<w:numFmt w:val="lowerLetter"/>
<w:lvlText w:val="%2)"/>
<w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="1440" w:hanging="360"/></w:pPr>
</w:lvl>
<w:lvl w:ilvl="2">
<w:start w:val="1"/>
<w:numFmt w:val="lowerRoman"/>
<w:lvlText w:val="%3."/>
<w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="2160" w:hanging="360"/></w:pPr>
</w:lvl>
</w:abstractNum>
<w:abstractNum w:abstractNumId="3">
<w:multiLevelType w:val="multilevel"/>
<w:lvl w:ilvl="0">
<w:start w:val="1"/>
<w:numFmt w:val="decimal"/>
<w:lvlText w:val="%1."/>
<w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="720" w:hanging="360"/></w:pPr>
</w:lvl>
<w:lvl w:ilvl="1">
<w:start w:val="1"/>
<w:numFmt w:val="decimal"/>
<w:lvlText w:val="%1.%2."/>
<w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="1440" w:hanging="720"/></w:pPr>
</w:lvl>
<w:lvl w:ilvl="2">
<w:start w:val="1"/>
<w:numFmt w:val="lowerLetter"/>
<w:lvlText w:val="(%3)"/>
<w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="2160" w:hanging="360"/></w:pPr>
</w:lvl>
<w:lvl w:ilvl="3">
<w:start w:val="1"/>
<w:numFmt w:val="lowerRoman"/>
<w:lvlText w:val="(%4)"/>
<w:lvlJc w:val="left"/>
<w:pPr><w:ind w:left="2880" w:hanging="360"/></w:pPr>
</w:lvl>
</w:abstractNum>`;

/**
 * Generate numbering.xml with dynamic numIds for list restart support
 * Each distinct list sequence gets its own numId to restart numbering
 * @param bulletNumIds - Array of numIds used for bullet lists
 * @param decimalNumIds - Array of numIds used for numbered lists
 */
function generateNumberingXml(bulletNumIds: number[], decimalNumIds: number[]): string {
  // Generate numId entries for each list sequence
  // Bullets reference abstractNumId 1, decimals reference abstractNumId 3 (European contract style)
  let numEntries = '';

  for (const numId of bulletNumIds) {
    numEntries += `<w:num w:numId="${numId}"><w:abstractNumId w:val="1"/></w:num>\n`;
  }

  for (const numId of decimalNumIds) {
    // Use abstractNumId 3 for European-style contract numbering: 1., 1.1., (a), (i)
    numEntries += `<w:num w:numId="${numId}"><w:abstractNumId w:val="3"/></w:num>\n`;
  }

  // Default numIds if no lists exist (prevents Word errors)
  if (bulletNumIds.length === 0 && decimalNumIds.length === 0) {
    numEntries = `<w:num w:numId="1"><w:abstractNumId w:val="1"/></w:num>
<w:num w:numId="2"><w:abstractNumId w:val="3"/></w:num>`;
  }

  return `<pkg:part pkg:name="/word/numbering.xml" pkg:contentType="application/vnd.openxmlformats-officedocument.wordprocessingml.numbering+xml">
<pkg:xmlData>
<w:numbering xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
${ABSTRACT_NUMBERING_XML}
${numEntries}
</w:numbering>
</pkg:xmlData>
</pkg:part>`;
}

// Document relationships including numbering.xml, footnotes.xml, header, and footer
const DOCUMENT_RELS_XML = `<pkg:part pkg:name="/word/_rels/document.xml.rels" pkg:contentType="application/vnd.openxmlformats-package.relationships+xml">
<pkg:xmlData>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/numbering" Target="numbering.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footnotes" Target="footnotes.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/header" Target="header1.xml"/>
<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/footer" Target="footer1.xml"/>
</Relationships>
</pkg:xmlData>
</pkg:part>`;

/**
 * Generate footnotes.xml part for Word footnotes
 * Footnotes appear at the bottom of the page where referenced
 */
function generateFootnotesXml(footnotes: FootnoteDefinition[]): string {
  // Word requires separator and continuation separator footnotes (ids -1 and 0)
  let footnotesContent = `<w:footnote w:type="separator" w:id="-1">
<w:p><w:r><w:separator/></w:r></w:p>
</w:footnote>
<w:footnote w:type="continuationSeparator" w:id="0">
<w:p><w:r><w:continuationSeparator/></w:r></w:p>
</w:footnote>`;

  // Add user-defined footnotes
  for (const fn of footnotes) {
    const escapedContent = fn.content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    // Footnote styling: 10pt (20 half-points), 1.2 line spacing (288 twips)
    footnotesContent += `
<w:footnote w:id="${fn.id}">
<w:p>
<w:pPr>
<w:pStyle w:val="FootnoteText"/>
<w:spacing w:line="288" w:lineRule="auto"/>
</w:pPr>
<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/><w:vertAlign w:val="superscript"/><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:footnoteRef/></w:r>
<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/><w:rFonts w:ascii="${FONT_BODY}" w:hAnsi="${FONT_BODY}" w:cs="${FONT_BODY_FALLBACK}"/></w:rPr><w:t xml:space="preserve"> ${escapedContent}</w:t></w:r>
</w:p>
</w:footnote>`;
  }

  return `<pkg:part pkg:name="/word/footnotes.xml" pkg:contentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footnotes+xml">
<pkg:xmlData>
<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
${footnotesContent}
</w:footnotes>
</pkg:xmlData>
</pkg:part>`;
}

/**
 * Generate header1.xml part with Bojin logo image
 * Position values from Bojin-Master-Template.docx
 */
function generateHeaderXml(): string {
  return `<pkg:part pkg:name="/word/header1.xml" pkg:contentType="application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml">
<pkg:xmlData>
<w:hdr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:p>
<w:pPr><w:pStyle w:val="Header"/></w:pPr>
<w:r>
<w:rPr><w:noProof/></w:rPr>
<w:drawing>
<wp:anchor distT="0" distB="0" distL="114300" distR="114300" simplePos="0" relativeHeight="251658240" behindDoc="1" locked="0" layoutInCell="1" allowOverlap="1">
<wp:simplePos x="0" y="0"/>
<wp:positionH relativeFrom="margin"><wp:posOffset>-966650</wp:posOffset></wp:positionH>
<wp:positionV relativeFrom="margin"><wp:posOffset>-940527</wp:posOffset></wp:positionV>
<wp:extent cx="7699556" cy="893135"/>
<wp:effectExtent l="0" t="0" r="0" b="0"/>
<wp:wrapNone/>
<wp:docPr id="1" name="Header Image"/>
<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>
<a:graphic>
<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:pic>
<pic:nvPicPr><pic:cNvPr id="1" name="Header Image"/><pic:cNvPicPr/></pic:nvPicPr>
<pic:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="7699556" cy="893135"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
</pic:pic>
</a:graphicData>
</a:graphic>
</wp:anchor>
</w:drawing>
</w:r>
</w:p>
</w:hdr>
</pkg:xmlData>
</pkg:part>`;
}

/**
 * Generate footer1.xml part with Bojin contact info image and page numbering
 * Position values from Bojin-Master-Template.docx
 * Page numbering: "Pagina X din Y" format in Romanian
 */
function generateFooterXml(): string {
  return `<pkg:part pkg:name="/word/footer1.xml" pkg:contentType="application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml">
<pkg:xmlData>
<w:ftr xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
       xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
       xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture">
<w:p>
<w:pPr><w:pStyle w:val="Footer"/><w:jc w:val="right"/></w:pPr>
<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/><w:rFonts w:ascii="${FONT_BODY}" w:hAnsi="${FONT_BODY}" w:cs="${FONT_BODY_FALLBACK}"/></w:rPr><w:t xml:space="preserve">Pagina </w:t></w:r>
<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r>
<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:instrText>PAGE</w:instrText></w:r>
<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r>
<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>1</w:t></w:r>
<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>
<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/><w:rFonts w:ascii="${FONT_BODY}" w:hAnsi="${FONT_BODY}" w:cs="${FONT_BODY_FALLBACK}"/></w:rPr><w:t xml:space="preserve"> din </w:t></w:r>
<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:fldChar w:fldCharType="begin"/></w:r>
<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:instrText>NUMPAGES</w:instrText></w:r>
<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:fldChar w:fldCharType="separate"/></w:r>
<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:t>1</w:t></w:r>
<w:r><w:rPr><w:sz w:val="20"/><w:szCs w:val="20"/></w:rPr><w:fldChar w:fldCharType="end"/></w:r>
</w:p>
<w:p>
<w:pPr><w:pStyle w:val="Footer"/></w:pPr>
<w:r>
<w:rPr><w:noProof/></w:rPr>
<w:drawing>
<wp:anchor distT="0" distB="0" distL="114300" distR="114300" simplePos="0" relativeHeight="251659264" behindDoc="0" locked="0" layoutInCell="1" allowOverlap="1">
<wp:simplePos x="0" y="0"/>
<wp:positionH relativeFrom="margin"><wp:posOffset>-966443</wp:posOffset></wp:positionH>
<wp:positionV relativeFrom="margin"><wp:posOffset>9032875</wp:posOffset></wp:positionV>
<wp:extent cx="7756525" cy="899160"/>
<wp:effectExtent l="0" t="0" r="0" b="0"/>
<wp:wrapSquare wrapText="bothSides"/>
<wp:docPr id="2" name="Footer Image"/>
<wp:cNvGraphicFramePr><a:graphicFrameLocks noChangeAspect="1"/></wp:cNvGraphicFramePr>
<a:graphic>
<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture">
<pic:pic>
<pic:nvPicPr><pic:cNvPr id="2" name="Footer Image"/><pic:cNvPicPr/></pic:nvPicPr>
<pic:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill>
<pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="7756525" cy="899160"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr>
</pic:pic>
</a:graphicData>
</a:graphic>
</wp:anchor>
</w:drawing>
</w:r>
</w:p>
</w:ftr>
</pkg:xmlData>
</pkg:part>`;
}

/**
 * Generate header1.xml.rels - relationship to header image
 */
function generateHeaderRelsXml(): string {
  return `<pkg:part pkg:name="/word/_rels/header1.xml.rels" pkg:contentType="application/vnd.openxmlformats-package.relationships+xml">
<pkg:xmlData>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image1.png"/>
</Relationships>
</pkg:xmlData>
</pkg:part>`;
}

/**
 * Generate footer1.xml.rels - relationship to footer image
 */
function generateFooterRelsXml(): string {
  return `<pkg:part pkg:name="/word/_rels/footer1.xml.rels" pkg:contentType="application/vnd.openxmlformats-package.relationships+xml">
<pkg:xmlData>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/image2.png"/>
</Relationships>
</pkg:xmlData>
</pkg:part>`;
}

/**
 * Generate media parts for header and footer images (base64 encoded PNGs)
 */
function generateMediaParts(): string {
  return `<pkg:part pkg:name="/word/media/image1.png" pkg:contentType="image/png" pkg:compression="store">
<pkg:binaryData>${BOJIN_HEADER_PNG_BASE64}</pkg:binaryData>
</pkg:part>
<pkg:part pkg:name="/word/media/image2.png" pkg:contentType="image/png" pkg:compression="store">
<pkg:binaryData>${BOJIN_FOOTER_PNG_BASE64}</pkg:binaryData>
</pkg:part>`;
}

/**
 * Generate section properties with page setup and header/footer references
 * A4 page size with 2.5cm margins
 */
function generateSectionProperties(): string {
  return `<w:sectPr>
<w:headerReference w:type="default" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId3"/>
<w:footerReference w:type="default" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" r:id="rId4"/>
<w:pgSz w:w="11906" w:h="16838"/>
<w:pgMar w:top="1417" w:right="1417" w:bottom="1417" w:left="1417" w:header="709" w:footer="709"/>
</w:sectPr>`;
}

/**
 * Build OOXML package wrapper with optional footnotes and dynamic numbering
 * @param bodyXml - The document body XML
 * @param footnotes - Footnote definitions
 * @param bulletNumIds - Array of numIds used for bullet lists
 * @param decimalNumIds - Array of numIds used for numbered lists
 */
function buildOoxmlWrapper(
  bodyXml: string,
  footnotes: FootnoteDefinition[],
  bulletNumIds: number[],
  decimalNumIds: number[]
): string {
  const footnotesXml = footnotes.length > 0 ? generateFootnotesXml(footnotes) : '';
  const numberingXml = generateNumberingXml(bulletNumIds, decimalNumIds);
  const headerXml = generateHeaderXml();
  const footerXml = generateFooterXml();
  const headerRelsXml = generateHeaderRelsXml();
  const footerRelsXml = generateFooterRelsXml();
  const mediaParts = generateMediaParts();
  const sectPr = generateSectionProperties();

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
${DOCUMENT_RELS_XML}
${numberingXml}
${footnotesXml}
${headerXml}
${footerXml}
${headerRelsXml}
${footerRelsXml}
${mediaParts}
<pkg:part pkg:name="/word/document.xml" pkg:contentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml">
<pkg:xmlData>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>
${bodyXml}
${sectPr}
</w:body>
</w:document>
</pkg:xmlData>
</pkg:part>
</pkg:package>`;
}

// Style mappings from markdown elements to Word styles
const STYLE_MAP: Record<string, string> = {
  title: 'Title',
  subtitle: 'Subtitle',
  heading1: 'Heading1',
  heading2: 'Heading2',
  heading3: 'Heading3',
  normal: 'Normal',
  quote: 'Quote',
  listParagraph: 'ListParagraph',
  dateLocation: 'DateLocation',
  partyDefinition: 'PartyDefinition',
  partyLabel: 'PartyLabel',
  articleNumber: 'ArticleNumber',
  signatureBlock: 'SignatureBlock',
  citation: 'Citation',
  conclusion: 'Conclusion',
};

// Indent values in twips (1 inch = 1440 twips)
const INDENT_L1 = 720; // 0.5 inch
const INDENT_L2 = 1440; // 1 inch
const INDENT_L3 = 2160; // 1.5 inch
const INDENT_L4 = 2880; // 2 inch

// Font configuration
const FONT_BODY = 'Source Serif Pro';
const FONT_BODY_FALLBACK = 'Georgia';
const FONT_HEADING = 'Inter';
const FONT_HEADING_FALLBACK = 'Arial';

// Styles that use heading font
const HEADING_STYLES = ['Title', 'Subtitle', 'Heading1', 'Heading2', 'Heading3'];

/**
 * Convert ASCII quotes to Romanian typographic quotes
 * "text" → „text" (double low-9 opening, double high-6 closing)
 * 'text' → «text» (guillemets for nested/inner quotes)
 */
function convertToRomanianQuotes(text: string): string {
  return text
    .replace(/"([^"]+)"/g, '„$1"') // "text" → „text"
    .replace(/'([^']+)'/g, '«$1»'); // 'text' → «text»
}

// Callout box styles - simplified 2-color palette
// Neutral: informational content (note, example, definition, summary)
// Important: warnings and critical content (warning, important)
const CALLOUT_STYLES = {
  // Neutral style - gray background with gray left border
  note: {
    shading: 'F5F5F5', // Light gray
    borderColor: 'CCCCCC', // Gray
    borderType: 'left' as const,
  },
  example: {
    shading: 'F5F5F5', // Light gray
    borderColor: 'CCCCCC', // Gray
    borderType: 'left' as const,
  },
  definition: {
    shading: 'F5F5F5', // Light gray
    borderColor: 'CCCCCC', // Gray
    borderType: 'left' as const,
  },
  summary: {
    shading: 'F5F5F5', // Light gray
    borderColor: 'CCCCCC', // Gray
    borderType: 'left' as const,
  },
  // Important style - light red with Bojin red box border
  warning: {
    shading: 'FDF2F2', // Light red tint
    borderColor: '9B2335', // Bojin brand red
    borderType: 'box' as const,
  },
  important: {
    shading: 'FDF2F2', // Light red tint
    borderColor: '9B2335', // Bojin brand red
    borderType: 'box' as const,
  },
};

// ============================================================================
// Service
// ============================================================================

export class OoxmlFragmentService {
  /**
   * Convert extended markdown to OOXML fragment for Word's insertOoxml()
   * Supports real Word footnotes that appear at the bottom of each page
   * Handles list numbering restart - each distinct list sequence gets its own numId
   */
  markdownToOoxmlFragment(markdown: string): string {
    const { paragraphs, footnotes } = this.parseMarkdown(markdown);

    // Apply chapter 1/3 rule: keep 3 paragraphs with Heading1 to prevent orphaned chapters
    const withChapterRule = this.applyChapterRule(paragraphs);

    // Post-process paragraphs to assign unique numIds to each list sequence
    // A new sequence starts when a non-list paragraph appears between lists
    const { processedParagraphs, bulletNumIds, decimalNumIds } =
      this.assignListNumberingIds(withChapterRule);

    const bodyXml = processedParagraphs.map((p) => this.paragraphToOoxml(p)).join('');
    return buildOoxmlWrapper(bodyXml, footnotes, bulletNumIds, decimalNumIds);
  }

  /**
   * Apply chapter 1/3 page rule: after a Heading1, keep the next 3 paragraphs
   * together with the heading to ensure ~1/3 page of content stays with the chapter title.
   * Also applies keepNext to short lists (≤5 items).
   */
  private applyChapterRule(paragraphs: Paragraph[]): Paragraph[] {
    let keepNextCount = 0;

    return paragraphs.map((para, index) => {
      // After Heading1, keep next 3 block elements with heading
      if (para.style === 'Heading1') {
        keepNextCount = 3;
        return para; // Heading1 already has keepNext from parsing
      }

      // Apply keepNext to paragraphs following Heading1
      if (keepNextCount > 0 && !para.paragraphType) {
        keepNextCount--;
        return { ...para, keepNext: true };
      }

      // Short lists: apply keepNext to all but last item in lists ≤5 items
      if (para.numbering) {
        // Look ahead to count list items in this sequence
        let listLength = 1;
        let j = index + 1;
        while (
          j < paragraphs.length &&
          paragraphs[j].numbering &&
          paragraphs[j].numbering!.id === para.numbering.id
        ) {
          listLength++;
          j++;
        }

        // For short lists, keep items together (except last)
        if (listLength <= 5) {
          const isLast =
            index + 1 >= paragraphs.length ||
            !paragraphs[index + 1].numbering ||
            paragraphs[index + 1].numbering!.id !== para.numbering.id;

          if (!isLast) {
            return { ...para, keepNext: true };
          }
        }
      }

      return para;
    });
  }

  /**
   * Assign unique numbering IDs to list sequences for proper restart behavior
   * When a non-list paragraph separates two lists, each list gets its own numId
   * This causes Word to restart numbering for each distinct list sequence
   */
  private assignListNumberingIds(paragraphs: Paragraph[]): {
    processedParagraphs: Paragraph[];
    bulletNumIds: number[];
    decimalNumIds: number[];
  } {
    const bulletNumIds: Set<number> = new Set();
    const decimalNumIds: Set<number> = new Set();

    // Track current list type and whether we're in a list
    let currentBulletNumId = 1; // Start at 1 for bullets
    let currentDecimalNumId = 101; // Start at 101 for decimals (to avoid overlap)
    let wasInBulletList = false;
    let wasInDecimalList = false;

    const processed = paragraphs.map((para) => {
      if (!para.numbering) {
        // Non-list paragraph breaks the list sequence
        // Next list item should start a new sequence
        if (wasInBulletList) {
          currentBulletNumId++;
          wasInBulletList = false;
        }
        if (wasInDecimalList) {
          currentDecimalNumId++;
          wasInDecimalList = false;
        }
        return para;
      }

      // This is a list paragraph - determine if bullet (id=1) or decimal (id=2)
      const isBullet = para.numbering.id === 1;

      if (isBullet) {
        // Switching from decimal to bullet also breaks the sequence
        if (wasInDecimalList) {
          currentDecimalNumId++;
          wasInDecimalList = false;
        }

        bulletNumIds.add(currentBulletNumId);
        wasInBulletList = true;

        return {
          ...para,
          numbering: {
            ...para.numbering,
            id: currentBulletNumId,
          },
        };
      } else {
        // Switching from bullet to decimal also breaks the sequence
        if (wasInBulletList) {
          currentBulletNumId++;
          wasInBulletList = false;
        }

        decimalNumIds.add(currentDecimalNumId);
        wasInDecimalList = true;

        return {
          ...para,
          numbering: {
            ...para.numbering,
            id: currentDecimalNumId,
          },
        };
      }
    });

    return {
      processedParagraphs: processed,
      bulletNumIds: Array.from(bulletNumIds),
      decimalNumIds: Array.from(decimalNumIds),
    };
  }

  /**
   * Parse extended markdown into paragraphs with styles and footnotes
   */
  private parseMarkdown(markdown: string): {
    paragraphs: Paragraph[];
    footnotes: FootnoteDefinition[];
  } {
    const lines = markdown.split('\n');
    const paragraphs: Paragraph[] = [];
    const footnotes: FootnoteDefinition[] = [];
    const state: ParseState = {
      inBlock: false,
      blockType: null,
      blockArgs: null,
      blockContent: [],
      inTable: false,
      tableLines: [],
    };

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for block start (:::type)
      const blockStartMatch = line.match(/^:::(\w+[-\w]*)\s*(.*)$/);
      if (blockStartMatch && !state.inBlock) {
        state.inBlock = true;
        state.blockType = blockStartMatch[1].toLowerCase();
        state.blockArgs = blockStartMatch[2] || null;
        state.blockContent = [];
        continue;
      }

      // Check for block end (:::)
      if (line.trim() === ':::' && state.inBlock) {
        const blockParagraphs = this.processBlock(
          state.blockType!,
          state.blockArgs,
          state.blockContent
        );
        paragraphs.push(...blockParagraphs);
        state.inBlock = false;
        state.blockType = null;
        state.blockArgs = null;
        state.blockContent = [];
        continue;
      }

      // Accumulate block content
      if (state.inBlock) {
        state.blockContent.push(line);
        continue;
      }

      // Check for footnote definitions [^N]: content
      const footnoteDefMatch = line.match(/^\[\^(\d+)\]:\s*(.+)$/);
      if (footnoteDefMatch) {
        footnotes.push({
          id: parseInt(footnoteDefMatch[1], 10),
          content: footnoteDefMatch[2],
        });
        continue;
      }

      // Check for raw markdown table row (starts and ends with |)
      const trimmedLine = line.trim();
      const isTableRow = /^\|.+\|$/.test(trimmedLine);
      const isTableSeparator = /^\|[-:\s|]+\|$/.test(trimmedLine);

      if (isTableRow || isTableSeparator) {
        // Start or continue accumulating table lines
        if (!state.inTable) {
          state.inTable = true;
          state.tableLines = [];
        }
        state.tableLines.push(line);
        continue;
      }

      // If we were in a table but this line isn't a table row, finalize the table
      if (state.inTable && state.tableLines.length > 0) {
        const tableData = this.parseTableContent(state.tableLines, null);
        if (tableData) {
          paragraphs.push({
            style: STYLE_MAP.normal,
            runs: [],
            paragraphType: 'table',
            tableData,
          });
        }
        state.inTable = false;
        state.tableLines = [];
      }

      // Skip empty lines
      if (!line.trim()) {
        continue;
      }

      // Parse regular line
      const paragraph = this.parseLine(line);
      if (paragraph) {
        paragraphs.push(paragraph);
      }
    }

    // Handle unclosed block (shouldn't happen in well-formed input)
    if (state.inBlock && state.blockContent.length > 0) {
      const blockParagraphs = this.processBlock(
        state.blockType!,
        state.blockArgs,
        state.blockContent
      );
      paragraphs.push(...blockParagraphs);
    }

    // Handle table at end of document (no non-table line to trigger finalization)
    if (state.inTable && state.tableLines.length > 0) {
      const tableData = this.parseTableContent(state.tableLines, null);
      if (tableData) {
        paragraphs.push({
          style: STYLE_MAP.normal,
          runs: [],
          paragraphType: 'table',
          tableData,
        });
      }
    }

    return { paragraphs, footnotes };
  }

  /**
   * Parse a single line into a paragraph
   */
  private parseLine(line: string): Paragraph | null {
    // Title: # Title
    const titleMatch = line.match(/^#\s+(.+)$/);
    if (titleMatch) {
      return {
        style: STYLE_MAP.title,
        runs: this.parseInlineFormatting(titleMatch[1]),
        keepNext: true, // Keep title with following content
      };
    }

    // Subtitle: ## Subtitle
    const subtitleMatch = line.match(/^##\s+(.+)$/);
    if (subtitleMatch) {
      return {
        style: STYLE_MAP.subtitle,
        runs: this.parseInlineFormatting(subtitleMatch[1]),
        keepNext: true, // Keep subtitle with following content
      };
    }

    // Heading 1: ### Heading
    const h1Match = line.match(/^###\s+(.+)$/);
    if (h1Match) {
      return {
        style: STYLE_MAP.heading1,
        runs: this.parseInlineFormatting(h1Match[1]),
        keepNext: true, // Keep heading with following content
      };
    }

    // Heading 2: #### Heading
    const h2Match = line.match(/^####\s+(.+)$/);
    if (h2Match) {
      return {
        style: STYLE_MAP.heading2,
        runs: this.parseInlineFormatting(h2Match[1]),
        keepNext: true, // Keep heading with following content
      };
    }

    // Heading 3: ##### Heading
    const h3Match = line.match(/^#####\s+(.+)$/);
    if (h3Match) {
      return {
        style: STYLE_MAP.heading3,
        runs: this.parseInlineFormatting(h3Match[1]),
        keepNext: true, // Keep heading with following content
      };
    }

    // Heavy section break: ===
    if (line.trim() === '===') {
      return {
        style: STYLE_MAP.normal,
        runs: [],
        paragraphType: 'divider',
        borderTopBottom: { size: 12, color: '333333' },
        spacing: { before: 360, after: 360 },
      };
    }

    // Decorative divider: ***
    if (line.trim() === '***') {
      return {
        style: STYLE_MAP.normal,
        runs: [{ text: '• • •' }],
        paragraphType: 'divider',
        alignment: 'center',
        spacing: { before: 240, after: 240 },
      };
    }

    // Simple horizontal rule: ---
    if (line.trim() === '---') {
      return {
        style: STYLE_MAP.normal,
        runs: [],
        paragraphType: 'divider',
        borderTopBottom: { size: 4, color: 'CCCCCC' },
        spacing: { before: 120, after: 120 },
      };
    }

    // Indent L4: >>>>> text (5 >)
    const indentL4Match = line.match(/^>>>>>\s*(.+)$/);
    if (indentL4Match) {
      return {
        style: STYLE_MAP.normal,
        runs: this.parseInlineFormatting(indentL4Match[1]),
        indent: INDENT_L4,
      };
    }

    // Indent L3: >>>> text (4 >)
    const indentL3Match = line.match(/^>>>>\s*(.+)$/);
    if (indentL3Match) {
      return {
        style: STYLE_MAP.normal,
        runs: this.parseInlineFormatting(indentL3Match[1]),
        indent: INDENT_L3,
      };
    }

    // Indent L2: >>> text
    const indentL2Match = line.match(/^>>>\s*(.+)$/);
    if (indentL2Match) {
      return {
        style: STYLE_MAP.normal,
        runs: this.parseInlineFormatting(indentL2Match[1]),
        indent: INDENT_L2,
      };
    }

    // Indent L1: >> text
    const indentL1Match = line.match(/^>>\s*(.+)$/);
    if (indentL1Match) {
      return {
        style: STYLE_MAP.normal,
        runs: this.parseInlineFormatting(indentL1Match[1]),
        indent: INDENT_L1,
      };
    }

    // Quote: > text (single >) - block quote with left border
    const quoteMatch = line.match(/^>\s+(.+)$/);
    if (quoteMatch) {
      return {
        style: STYLE_MAP.quote,
        runs: this.parseInlineFormatting(quoteMatch[1]),
        indent: INDENT_L1, // 0.5" left indent
        borderLeft: { size: 16, color: 'CCCCCC' }, // 2pt gray left border
      };
    }

    // Contract list level 3 (roman in parens): spaces + (i), (ii) etc
    const contractL3Match = line.match(/^\s{9,}\(([ivxlcdm]+)\)\s+(.+)$/i);
    if (contractL3Match) {
      return {
        style: STYLE_MAP.listParagraph,
        runs: this.parseInlineFormatting(contractL3Match[2]),
        numbering: { id: 2, level: 3 },
      };
    }

    // Contract list level 2 (letters in parens): spaces + (a), (b) etc
    const contractL2Match = line.match(/^\s{6,8}\(([a-z])\)\s+(.+)$/i);
    if (contractL2Match) {
      return {
        style: STYLE_MAP.listParagraph,
        runs: this.parseInlineFormatting(contractL2Match[2]),
        numbering: { id: 2, level: 2 },
      };
    }

    // Contract list level 1 (subsection): spaces + 1.1., 1.2. etc
    const contractL1Match = line.match(/^\s{3,5}(\d+\.\d+\.)\s+(.+)$/);
    if (contractL1Match) {
      return {
        style: STYLE_MAP.listParagraph,
        runs: this.parseInlineFormatting(contractL1Match[2]),
        numbering: { id: 2, level: 1 },
      };
    }

    // Legacy nested list level 3 (roman numerals): spaces + i. or ii. etc
    const nestedL3Match = line.match(/^\s{6,}([ivxlcdm]+)\.\s+(.+)$/i);
    if (nestedL3Match) {
      return {
        style: STYLE_MAP.listParagraph,
        runs: this.parseInlineFormatting(nestedL3Match[2]),
        numbering: { id: 2, level: 3 },
      };
    }

    // Legacy nested list level 2 (letters): spaces + a. or b. etc
    const nestedL2Match = line.match(/^\s{3,5}([a-z])\.\s+(.+)$/i);
    if (nestedL2Match) {
      return {
        style: STYLE_MAP.listParagraph,
        runs: this.parseInlineFormatting(nestedL2Match[2]),
        numbering: { id: 2, level: 2 },
      };
    }

    // Unordered list: - item
    const ulMatch = line.match(/^-\s+(.+)$/);
    if (ulMatch) {
      return {
        style: STYLE_MAP.listParagraph,
        runs: this.parseInlineFormatting(ulMatch[1]),
        numbering: { id: 1, level: 0 },
      };
    }

    // Ordered list: 1. item (contract level 0)
    const olMatch = line.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      return {
        style: STYLE_MAP.listParagraph,
        runs: this.parseInlineFormatting(olMatch[1]),
        numbering: { id: 2, level: 0 },
      };
    }

    // Default: Normal paragraph
    return {
      style: STYLE_MAP.normal,
      runs: this.parseInlineFormatting(line),
    };
  }

  /**
   * Process a custom block (:::type ... :::)
   */
  private processBlock(
    blockType: string,
    blockArgs: string | null,
    content: string[]
  ): Paragraph[] {
    const paragraphs: Paragraph[] = [];

    switch (blockType) {
      case 'date-location': {
        // DateLocation block - each line is a paragraph with DateLocation style
        for (const line of content) {
          if (line.trim()) {
            paragraphs.push({
              style: STYLE_MAP.dateLocation,
              runs: this.parseInlineFormatting(line.trim()),
            });
          }
        }
        break;
      }

      case 'party': {
        // Party block - paragraphs with PartyDefinition style
        // Lines with **NAME:** pattern get PartyLabel run style
        // Keep entire party block together on same page
        const partyLines = content.filter((line) => line.trim());
        for (let i = 0; i < partyLines.length; i++) {
          const line = partyLines[i];
          const isLast = i === partyLines.length - 1;

          const partyLabelMatch = line.match(/^\*\*([^*]+):\*\*\s*(.*)$/);
          if (partyLabelMatch) {
            // Party label line: **NAME:** followed by description
            const runs: TextRun[] = [
              { text: partyLabelMatch[1] + ':', bold: true, style: STYLE_MAP.partyLabel },
            ];
            if (partyLabelMatch[2]) {
              runs.push({ text: ' ' + partyLabelMatch[2] });
            }
            paragraphs.push({
              style: STYLE_MAP.partyDefinition,
              runs,
              keepLines: true,
              keepNext: !isLast, // Keep all party lines together
            });
          } else {
            paragraphs.push({
              style: STYLE_MAP.partyDefinition,
              runs: this.parseInlineFormatting(line.trim()),
              keepLines: true,
              keepNext: !isLast,
            });
          }
        }
        break;
      }

      case 'article': {
        // Article block - first paragraph is ArticleNumber with the number
        const articleNumber = blockArgs?.trim() || '';
        if (articleNumber) {
          paragraphs.push({
            style: STYLE_MAP.articleNumber,
            runs: [{ text: `Art. ${articleNumber}`, bold: true }],
          });
        }
        // Content follows as normal paragraphs
        for (const line of content) {
          if (line.trim()) {
            paragraphs.push({
              style: STYLE_MAP.normal,
              runs: this.parseInlineFormatting(line.trim()),
            });
          }
        }
        break;
      }

      case 'signature': {
        // Signature block - each line as SignatureBlock style
        // Keep entire signature block together on same page
        const sigLines = content.filter((line) => line.trim());
        for (let i = 0; i < sigLines.length; i++) {
          const isLast = i === sigLines.length - 1;
          paragraphs.push({
            style: STYLE_MAP.signatureBlock,
            runs: this.parseInlineFormatting(sigLines[i].trim()),
            keepLines: true,
            keepNext: !isLast, // Keep all signature lines together
          });
        }
        break;
      }

      case 'citation': {
        // Citation block - each line as Citation style
        for (const line of content) {
          if (line.trim()) {
            paragraphs.push({
              style: STYLE_MAP.citation,
              runs: this.parseInlineFormatting(line.trim()),
            });
          }
        }
        break;
      }

      case 'conclusion': {
        // Conclusion block - each line as Conclusion style
        // Keep entire conclusion together on same page
        const conclusionLines = content.filter((line) => line.trim());
        for (let i = 0; i < conclusionLines.length; i++) {
          const isLast = i === conclusionLines.length - 1;
          paragraphs.push({
            style: STYLE_MAP.conclusion,
            runs: this.parseInlineFormatting(conclusionLines[i].trim()),
            keepLines: true,
            keepNext: !isLast, // Keep all conclusion lines together
          });
        }
        break;
      }

      case 'columns': {
        // Two-column layout - handled specially in OOXML generation
        // For now, treat as normal paragraphs
        // TODO: Implement proper column section break
        for (const line of content) {
          if (line.trim()) {
            paragraphs.push({
              style: STYLE_MAP.normal,
              runs: this.parseInlineFormatting(line.trim()),
            });
          }
        }
        break;
      }

      // Callout boxes
      case 'note':
      case 'warning':
      case 'important':
      case 'example':
      case 'definition':
      case 'summary': {
        const calloutStyle = CALLOUT_STYLES[blockType as keyof typeof CALLOUT_STYLES];
        const contentLines = content.filter((line) => line.trim());
        for (let i = 0; i < contentLines.length; i++) {
          const line = contentLines[i];
          const isLast = i === contentLines.length - 1;
          const para: Paragraph = {
            style: STYLE_MAP.normal,
            runs: this.parseInlineFormatting(line.trim()),
            shading: calloutStyle.shading,
            indent: 284, // Slight indent for callout content
            spacing: { before: 120, after: 120 },
            keepLines: true, // Keep each callout paragraph together
            keepNext: !isLast, // Keep all callout paragraphs together as a unit
          };
          if (calloutStyle.borderType === 'left') {
            para.borderLeft = { size: 24, color: calloutStyle.borderColor };
          } else {
            para.borderBox = { size: 4, color: calloutStyle.borderColor };
          }
          paragraphs.push(para);
        }
        break;
      }

      case 'pullquote': {
        // Pull quote - large centered text with top/bottom borders
        // Keep entire pull quote together on same page
        const quoteLines = content.filter((line) => line.trim());
        for (let i = 0; i < quoteLines.length; i++) {
          const isLast = i === quoteLines.length - 1;
          paragraphs.push({
            style: STYLE_MAP.normal,
            runs: this.parseInlineFormatting(quoteLines[i].trim()),
            alignment: 'center',
            indent: 720, // Indent from both sides
            borderTopBottom: { size: 4, color: '9B2335' }, // Bojin brand color
            spacing: { before: 240, after: 240 },
            keepLines: true,
            keepNext: !isLast, // Keep all pull quote lines together
          });
        }
        break;
      }

      case 'table': {
        // Parse table markdown into structured data
        const tableData = this.parseTableContent(content, blockArgs);
        if (tableData) {
          paragraphs.push({
            style: STYLE_MAP.normal,
            runs: [],
            paragraphType: 'table',
            tableData,
          });
        }
        break;
      }

      case 'pagebreak': {
        paragraphs.push({
          style: STYLE_MAP.normal,
          runs: [],
          paragraphType: 'pageBreak',
        });
        break;
      }

      case 'centered': {
        for (const line of content) {
          if (line.trim()) {
            paragraphs.push({
              style: STYLE_MAP.normal,
              runs: this.parseInlineFormatting(line.trim()),
              alignment: 'center',
            });
          }
        }
        break;
      }

      default: {
        // Unknown block type - treat as normal paragraphs
        for (const line of content) {
          if (line.trim()) {
            paragraphs.push({
              style: STYLE_MAP.normal,
              runs: this.parseInlineFormatting(line.trim()),
            });
          }
        }
      }
    }

    return paragraphs;
  }

  /**
   * Parse table content from markdown table syntax
   */
  private parseTableContent(content: string[], style: string | null): TableData | null {
    const rows: string[][] = [];
    let headers: string[] = [];
    let headerParsed = false;

    for (const line of content) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Skip separator lines (|---|---|)
      if (/^\|[-:\s|]+\|$/.test(trimmed)) {
        headerParsed = true;
        continue;
      }

      // Parse table row
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        const cells = trimmed
          .slice(1, -1)
          .split('|')
          .map((cell) => cell.trim());

        if (!headerParsed && headers.length === 0) {
          headers = cells;
        } else {
          rows.push(cells);
        }
      }
    }

    if (headers.length === 0 && rows.length === 0) {
      return null;
    }

    return {
      headers,
      rows,
      style: (style as TableData['style']) || 'plain',
    };
  }

  /**
   * Parse inline formatting (**bold**, *italic*, ^^small caps^^, ~~strikethrough~~, ==highlight==, [^N] footnotes)
   * Also converts ASCII quotes to Romanian typographic quotes
   */
  private parseInlineFormatting(text: string): TextRun[] {
    const runs: TextRun[] = [];
    // Convert ASCII quotes to Romanian quotes first
    let remaining = convertToRomanianQuotes(text);

    while (remaining.length > 0) {
      // Check for small caps ^^TEXT^^
      const smallCapsMatch = remaining.match(/^\^\^([^^]+)\^\^/);
      if (smallCapsMatch) {
        runs.push({ text: smallCapsMatch[1], smallCaps: true });
        remaining = remaining.slice(smallCapsMatch[0].length);
        continue;
      }

      // Check for highlight ==text==
      const highlightMatch = remaining.match(/^==([^=]+)==/);
      if (highlightMatch) {
        runs.push({ text: highlightMatch[1], highlight: 'yellow' });
        remaining = remaining.slice(highlightMatch[0].length);
        continue;
      }

      // Check for strikethrough ~~text~~
      const strikeMatch = remaining.match(/^~~([^~]+)~~/);
      if (strikeMatch) {
        runs.push({ text: strikeMatch[1], strikethrough: true });
        remaining = remaining.slice(strikeMatch[0].length);
        continue;
      }

      // Check for bold+italic ***text***
      const boldItalicMatch = remaining.match(/^\*\*\*([^*]+)\*\*\*/);
      if (boldItalicMatch) {
        runs.push({ text: boldItalicMatch[1], bold: true, italic: true });
        remaining = remaining.slice(boldItalicMatch[0].length);
        continue;
      }

      // Check for bold **text**
      const boldMatch = remaining.match(/^\*\*([^*]+)\*\*/);
      if (boldMatch) {
        runs.push({ text: boldMatch[1], bold: true });
        remaining = remaining.slice(boldMatch[0].length);
        continue;
      }

      // Check for italic *text*
      const italicMatch = remaining.match(/^\*([^*]+)\*/);
      if (italicMatch) {
        runs.push({ text: italicMatch[1], italic: true });
        remaining = remaining.slice(italicMatch[0].length);
        continue;
      }

      // Check for underline _text_
      const underlineMatch = remaining.match(/^_([^_]+)_/);
      if (underlineMatch) {
        runs.push({ text: underlineMatch[1], underline: true });
        remaining = remaining.slice(underlineMatch[0].length);
        continue;
      }

      // Check for footnote reference [^N]
      const footnoteMatch = remaining.match(/^\[\^(\d+)\]/);
      if (footnoteMatch) {
        // Generate actual Word footnote reference (number is auto-generated by Word)
        runs.push({
          text: '', // Word generates the footnote number automatically
          footnoteId: parseInt(footnoteMatch[1], 10),
        });
        remaining = remaining.slice(footnoteMatch[0].length);
        continue;
      }

      // Find the next special character or take all remaining
      const nextSpecialIndex = remaining.search(/\*|_|\[\^|\^{2}|~{2}|={2}/);
      if (nextSpecialIndex === -1) {
        // No more special characters
        runs.push({ text: remaining });
        break;
      } else if (nextSpecialIndex === 0) {
        // Special char at start but not matched - take one char and continue
        runs.push({ text: remaining[0] });
        remaining = remaining.slice(1);
      } else {
        // Take plain text up to the next special character
        runs.push({ text: remaining.slice(0, nextSpecialIndex) });
        remaining = remaining.slice(nextSpecialIndex);
      }
    }

    // Merge adjacent runs with same formatting
    return this.mergeAdjacentRuns(runs);
  }

  /**
   * Merge adjacent runs with identical formatting
   */
  private mergeAdjacentRuns(runs: TextRun[]): TextRun[] {
    if (runs.length === 0) return runs;

    const merged: TextRun[] = [runs[0]];

    for (let i = 1; i < runs.length; i++) {
      const current = runs[i];
      const last = merged[merged.length - 1];

      if (
        last.bold === current.bold &&
        last.italic === current.italic &&
        last.underline === current.underline &&
        last.smallCaps === current.smallCaps &&
        last.strikethrough === current.strikethrough &&
        last.highlight === current.highlight &&
        last.style === current.style
      ) {
        // Same formatting - merge
        last.text += current.text;
      } else {
        merged.push(current);
      }
    }

    return merged;
  }

  /**
   * Convert a paragraph to OOXML
   */
  private paragraphToOoxml(para: Paragraph): string {
    // Handle special paragraph types
    if (para.paragraphType === 'pageBreak') {
      return '<w:p><w:r><w:br w:type="page"/></w:r></w:p>';
    }

    if (para.paragraphType === 'table' && para.tableData) {
      return this.tableToOoxml(para.tableData);
    }

    const pPr = this.buildParagraphProperties(para);
    // Pass paragraph style to runs for direct formatting fallback
    const runs = para.runs.map((r) => this.runToOoxml(r, para.style)).join('');

    return `<w:p>${pPr}${runs}</w:p>`;
  }

  /**
   * Convert table data to OOXML
   */
  private tableToOoxml(table: TableData): string {
    const parts: string[] = [];

    // Table properties - minimal borders style (top/bottom only)
    parts.push('<w:tbl>');
    parts.push('<w:tblPr>');
    parts.push('<w:tblStyle w:val="TableGrid"/>');
    parts.push('<w:tblW w:w="0" w:type="auto"/>');
    // Minimal borders: top and bottom only, light gray color
    parts.push('<w:tblBorders>');
    parts.push('<w:top w:val="single" w:sz="8" w:color="DDDDDD"/>');
    parts.push('<w:left w:val="nil"/>');
    parts.push('<w:bottom w:val="single" w:sz="8" w:color="DDDDDD"/>');
    parts.push('<w:right w:val="nil"/>');
    parts.push('<w:insideH w:val="single" w:sz="4" w:color="EEEEEE"/>');
    parts.push('<w:insideV w:val="nil"/>');
    parts.push('</w:tblBorders>');
    // Cell padding: 6pt (120 twips) on all sides
    parts.push('<w:tblCellMar>');
    parts.push('<w:top w:w="120" w:type="dxa"/>');
    parts.push('<w:left w:w="120" w:type="dxa"/>');
    parts.push('<w:bottom w:w="120" w:type="dxa"/>');
    parts.push('<w:right w:w="120" w:type="dxa"/>');
    parts.push('</w:tblCellMar>');
    parts.push('</w:tblPr>');

    // Header row
    if (table.headers.length > 0) {
      parts.push('<w:tr>');
      // Row properties: repeat header on each page + don't split row
      parts.push('<w:trPr><w:tblHeader/><w:cantSplit/></w:trPr>');
      for (const header of table.headers) {
        parts.push('<w:tc>');
        // Header: bold text, light gray background
        parts.push('<w:tcPr>');
        parts.push('<w:shd w:val="clear" w:fill="F9F9F9"/>');
        parts.push(
          '<w:tcBorders><w:bottom w:val="single" w:sz="8" w:color="DDDDDD"/></w:tcBorders>'
        );
        parts.push('</w:tcPr>');
        parts.push(
          `<w:p><w:pPr><w:keepNext/></w:pPr><w:r><w:rPr><w:b/><w:rFonts w:ascii="${FONT_BODY}" w:hAnsi="${FONT_BODY}" w:cs="${FONT_BODY_FALLBACK}"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>${this.escapeXml(header)}</w:t></w:r></w:p>`
        );
        parts.push('</w:tc>');
      }
      parts.push('</w:tr>');
    }

    // Data rows
    const isLastRow = (idx: number) => idx === table.rows.length - 1;
    for (let rowIndex = 0; rowIndex < table.rows.length; rowIndex++) {
      const row = table.rows[rowIndex];
      parts.push('<w:tr>');
      // Prevent row from splitting across pages
      parts.push('<w:trPr><w:cantSplit/></w:trPr>');
      for (const cell of row) {
        parts.push('<w:tc>');
        // Cell properties
        const tcPrParts: string[] = [];
        // Striped style: alternate row shading
        if (table.style === 'striped' && rowIndex % 2 === 1) {
          tcPrParts.push('<w:shd w:val="clear" w:fill="F9F9F9"/>');
        }
        // Bottom border on last row
        if (isLastRow(rowIndex)) {
          tcPrParts.push(
            '<w:tcBorders><w:bottom w:val="single" w:sz="8" w:color="DDDDDD"/></w:tcBorders>'
          );
        }
        if (tcPrParts.length > 0) {
          parts.push(`<w:tcPr>${tcPrParts.join('')}</w:tcPr>`);
        }
        parts.push(
          `<w:p><w:r><w:rPr><w:rFonts w:ascii="${FONT_BODY}" w:hAnsi="${FONT_BODY}" w:cs="${FONT_BODY_FALLBACK}"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr><w:t>${this.escapeXml(cell)}</w:t></w:r></w:p>`
        );
        parts.push('</w:tc>');
      }
      parts.push('</w:tr>');
    }

    parts.push('</w:tbl>');
    return parts.join('');
  }

  /**
   * Build paragraph properties XML
   */
  private buildParagraphProperties(para: Paragraph): string {
    const parts: string[] = [];

    // Style reference
    parts.push(`<w:pStyle w:val="${this.escapeXml(para.style)}"/>`);

    // Pagination control - must come early in pPr
    // Widow/orphan control prevents single lines at top/bottom of pages
    parts.push('<w:widowControl/>');

    if (para.keepNext) {
      parts.push('<w:keepNext/>');
    }
    if (para.keepLines) {
      parts.push('<w:keepLines/>');
    }
    if (para.pageBreakBefore) {
      parts.push('<w:pageBreakBefore/>');
    }

    // Alignment
    if (para.alignment) {
      const alignMap = { left: 'left', center: 'center', right: 'right', both: 'both' };
      parts.push(`<w:jc w:val="${alignMap[para.alignment]}"/>`);
    }

    // Spacing (before/after and line spacing)
    // Line spacing: 336 = 1.4 (body/lists), 288 = 1.2 (footnotes), 240 = single (headings)
    const lineSpacing = this.getLineSpacingForStyle(
      para.style,
      para.numbering !== undefined,
      para.shading !== undefined
    );
    const styleSpacing = this.getStyleSpacing(para.style);
    const spacingParts: string[] = [];

    // Style-based spacing takes precedence, then explicit para.spacing
    const spaceBefore = para.spacing?.before ?? styleSpacing.before;
    const spaceAfter = para.spacing?.after ?? styleSpacing.after;

    if (spaceBefore !== undefined) {
      spacingParts.push(`w:before="${spaceBefore}"`);
    }
    if (spaceAfter !== undefined) {
      spacingParts.push(`w:after="${spaceAfter}"`);
    }
    if (lineSpacing) {
      spacingParts.push(`w:line="${lineSpacing}" w:lineRule="auto"`);
    }
    if (spacingParts.length > 0) {
      parts.push(`<w:spacing ${spacingParts.join(' ')}/>`);
    }

    // Borders
    if (para.borderLeft || para.borderBox || para.borderTopBottom) {
      const borderParts: string[] = [];
      if (para.borderBox) {
        borderParts.push(
          `<w:top w:val="single" w:sz="${para.borderBox.size}" w:space="4" w:color="${para.borderBox.color}"/>`
        );
        borderParts.push(
          `<w:left w:val="single" w:sz="${para.borderBox.size}" w:space="4" w:color="${para.borderBox.color}"/>`
        );
        borderParts.push(
          `<w:bottom w:val="single" w:sz="${para.borderBox.size}" w:space="4" w:color="${para.borderBox.color}"/>`
        );
        borderParts.push(
          `<w:right w:val="single" w:sz="${para.borderBox.size}" w:space="4" w:color="${para.borderBox.color}"/>`
        );
      } else if (para.borderLeft) {
        borderParts.push(
          `<w:left w:val="single" w:sz="${para.borderLeft.size}" w:space="4" w:color="${para.borderLeft.color}"/>`
        );
      } else if (para.borderTopBottom) {
        borderParts.push(
          `<w:top w:val="single" w:sz="${para.borderTopBottom.size}" w:space="1" w:color="${para.borderTopBottom.color}"/>`
        );
        borderParts.push(
          `<w:bottom w:val="single" w:sz="${para.borderTopBottom.size}" w:space="1" w:color="${para.borderTopBottom.color}"/>`
        );
      }
      if (borderParts.length > 0) {
        parts.push(`<w:pBdr>${borderParts.join('')}</w:pBdr>`);
      }
    }

    // Shading (background color)
    if (para.shading) {
      parts.push(`<w:shd w:val="clear" w:color="auto" w:fill="${para.shading}"/>`);
    }

    // Indentation
    if (para.indent) {
      // For callouts with right indent too, use both left and right
      if (para.shading) {
        parts.push(`<w:ind w:left="${para.indent}" w:right="${para.indent}"/>`);
      } else {
        parts.push(`<w:ind w:left="${para.indent}"/>`);
      }
    } else if (para.style === 'Normal' && !para.numbering && !para.shading && !para.paragraphType) {
      // First-line indent for body paragraphs (not lists, callouts, or special types)
      // 720 twips = 0.5 inch, standard paragraph indent
      parts.push('<w:ind w:firstLine="720"/>');
    }

    // Numbering for lists
    if (para.numbering) {
      parts.push(
        `<w:numPr><w:ilvl w:val="${para.numbering.level}"/><w:numId w:val="${para.numbering.id}"/></w:numPr>`
      );
    }

    if (parts.length === 0) return '';
    return `<w:pPr>${parts.join('')}</w:pPr>`;
  }

  /**
   * Convert a text run to OOXML
   * @param run - The text run to convert
   * @param paragraphStyle - Parent paragraph style for direct formatting fallback
   */
  private runToOoxml(run: TextRun, paragraphStyle?: string): string {
    // Handle footnote reference - generates actual Word footnote
    if (run.footnoteId !== undefined) {
      return `<w:r><w:rPr><w:rStyle w:val="FootnoteReference"/><w:vertAlign w:val="superscript"/></w:rPr><w:footnoteReference w:id="${run.footnoteId}"/></w:r>`;
    }

    const rPr = this.buildRunProperties(run, paragraphStyle);
    const escapedText = this.escapeXml(run.text);

    // Handle text with spaces at beginning/end
    const needsPreserve = run.text.startsWith(' ') || run.text.endsWith(' ');
    const xmlSpace = needsPreserve ? ' xml:space="preserve"' : '';

    return `<w:r>${rPr}<w:t${xmlSpace}>${escapedText}</w:t></w:r>`;
  }

  /**
   * Build run properties XML
   * Includes direct formatting fallback for headings/titles to ensure rendering
   * even when styles don't exist in the target document.
   * @param run - The text run
   * @param paragraphStyle - Parent paragraph style for direct formatting
   */
  private buildRunProperties(run: TextRun, paragraphStyle?: string): string {
    const parts: string[] = [];

    // Run style (e.g., FootnoteReference, PartyLabel)
    if (run.style) {
      parts.push(`<w:rStyle w:val="${this.escapeXml(run.style)}"/>`);
    }

    // Direct formatting fallback based on paragraph style
    // Font sizes in half-points (24 = 12pt, 28 = 14pt, 32 = 16pt, 56 = 28pt)
    const styleFormatting = this.getStyleFormatting(paragraphStyle);

    // Font family - different fonts for headings vs body text
    const isHeading = paragraphStyle && HEADING_STYLES.includes(paragraphStyle);
    if (isHeading) {
      parts.push(
        `<w:rFonts w:ascii="${FONT_HEADING}" w:hAnsi="${FONT_HEADING}" w:eastAsia="${FONT_HEADING}" w:cs="${FONT_HEADING_FALLBACK}"/>`
      );
    } else {
      parts.push(
        `<w:rFonts w:ascii="${FONT_BODY}" w:hAnsi="${FONT_BODY}" w:eastAsia="${FONT_BODY}" w:cs="${FONT_BODY_FALLBACK}"/>`
      );
    }

    // Bold - from run or from style
    if (run.bold || styleFormatting.bold) {
      parts.push('<w:b/>');
    }

    // Italic - from run or from style
    if (run.italic || styleFormatting.italic) {
      parts.push('<w:i/>');
    }

    // Underline
    if (run.underline) {
      parts.push('<w:u w:val="single"/>');
    }

    // Small caps
    if (run.smallCaps) {
      parts.push('<w:smallCaps/>');
    }

    // Strikethrough
    if (run.strikethrough) {
      parts.push('<w:strike/>');
    }

    // Highlight
    if (run.highlight) {
      parts.push(`<w:highlight w:val="${run.highlight}"/>`);
    }

    // Font size (half-points)
    if (styleFormatting.fontSize) {
      parts.push(`<w:sz w:val="${styleFormatting.fontSize}"/>`);
      parts.push(`<w:szCs w:val="${styleFormatting.fontSize}"/>`);
    }

    // Color
    if (styleFormatting.color) {
      parts.push(`<w:color w:val="${styleFormatting.color}"/>`);
    }

    if (parts.length === 0) return '';
    return `<w:rPr>${parts.join('')}</w:rPr>`;
  }

  /**
   * Get line spacing for a paragraph based on style
   * @param style - Paragraph style name
   * @param isList - Whether paragraph is a list item
   * @param isCallout - Whether paragraph has shading (callout box)
   * @returns Line spacing in OOXML units (240=single, 288=1.2, 336=1.4)
   */
  private getLineSpacingForStyle(
    style: string,
    isList: boolean,
    isCallout: boolean
  ): number | null {
    // Headings use single spacing (240)
    if (['Title', 'Subtitle', 'Heading1', 'Heading2', 'Heading3'].includes(style)) {
      return 240;
    }

    // Footnotes and citations use 1.2 spacing (288)
    if (['FootnoteText', 'Citation'].includes(style)) {
      return 288;
    }

    // Callouts use slightly tighter spacing
    if (isCallout) {
      return 312;
    }

    // Body text and lists use 1.4 spacing (336) for readability
    return 336;
  }

  /**
   * Get spacing before/after for a paragraph style
   * Follows the rule: space above ≥ 1.5× space below for headings
   * @returns Spacing in twips (20 twips = 1pt)
   */
  private getStyleSpacing(style: string): { before?: number; after?: number } {
    switch (style) {
      case 'Title':
        return { before: 480, after: 240 }; // 24pt before, 12pt after
      case 'Subtitle':
        return { before: 120, after: 240 }; // 6pt before, 12pt after
      case 'Heading1':
        return { before: 480, after: 240 }; // 24pt before, 12pt after
      case 'Heading2':
        return { before: 360, after: 180 }; // 18pt before, 9pt after
      case 'Heading3':
        return { before: 240, after: 120 }; // 12pt before, 6pt after
      case 'Normal':
        return { after: 160 }; // 8pt after for paragraph spacing
      default:
        return {};
    }
  }

  /**
   * Get direct formatting for a paragraph style
   * This provides fallback formatting when styles don't exist.
   * Values are synced with Bojin-Master-Template.docx styles.
   */
  private getStyleFormatting(style?: string): {
    bold?: boolean;
    italic?: boolean;
    fontSize?: number;
    color?: string;
  } {
    if (!style) return {};

    // Font sizes in half-points (24 = 12pt)
    // Research-based legal document typography
    switch (style) {
      // Built-in styles
      case 'Title':
        return { fontSize: 48, color: '333333' }; // 24pt
      case 'Subtitle':
        return { fontSize: 28, color: '666666' }; // 14pt
      case 'Heading1':
        return { fontSize: 36, color: '9B2335' }; // 18pt (updated from 16pt)
      case 'Heading2':
        return { fontSize: 28, color: '333333' }; // 14pt
      case 'Heading3':
        return { fontSize: 24, color: '666666' }; // 12pt
      case 'Normal':
        return { fontSize: 24 }; // 12pt body text (legal standard)
      case 'ListParagraph':
        return { fontSize: 24 }; // 12pt list text
      case 'Quote':
        return { fontSize: 24, color: '4A4A4A' }; // 12pt, no italic (uses border instead)
      case 'FootnoteText':
        return { fontSize: 20 }; // 10pt footnote text
      // Custom legal styles
      case 'DateLocation':
        return { fontSize: 24, color: '4A4A4A' }; // 12pt, right-aligned
      case 'PartyDefinition':
        return { fontSize: 24 }; // 12pt, justified
      case 'PartyLabel':
        return { bold: true, fontSize: 24, color: '9B2335' }; // 12pt bold, Bojin red
      case 'ArticleNumber':
        return { bold: true, fontSize: 24, color: '333333' }; // 12pt bold
      case 'Citation':
        return { italic: true, fontSize: 20, color: '4A4A4A' }; // 10pt italic (updated from 11pt)
      case 'SignatureBlock':
        return { bold: true, fontSize: 20, color: '333333' }; // 10pt bold, centered
      case 'Conclusion':
        return { fontSize: 24, color: '333333' }; // 12pt
      default:
        return { fontSize: 24 }; // Default: 12pt body text
    }
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

// Export singleton instance
export const ooxmlFragmentService = new OoxmlFragmentService();
