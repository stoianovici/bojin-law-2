/**
 * DOCX Custom Properties Utility
 *
 * Injects custom properties into .docx files so that Word Add-ins
 * can read the context (documentId, caseId, etc.) when the file is opened.
 *
 * A .docx file is a ZIP archive. Custom properties are stored in docProps/custom.xml
 */

import JSZip from 'jszip';
import logger from './logger';

export interface DocxCustomProperties {
  _platformDocumentId: string;
  _platformCaseId: string;
  _platformCaseNumber: string;
  _platformFileName: string;
}

/**
 * Inject custom properties into a .docx file buffer
 * Returns a new buffer with the properties embedded
 */
export async function injectDocxCustomProperties(
  docxBuffer: Buffer,
  properties: DocxCustomProperties
): Promise<Buffer> {
  try {
    const zip = await JSZip.loadAsync(docxBuffer);

    // Create or update custom.xml
    const customXml = generateCustomPropertiesXml(properties);
    zip.file('docProps/custom.xml', customXml);

    // Ensure custom.xml is registered in [Content_Types].xml
    const contentTypesXml = await zip.file('[Content_Types].xml')?.async('string');
    if (contentTypesXml) {
      const updatedContentTypes = ensureCustomPropertiesContentType(contentTypesXml);
      zip.file('[Content_Types].xml', updatedContentTypes);
    }

    // Ensure relationship exists in _rels/.rels
    const relsXml = await zip.file('_rels/.rels')?.async('string');
    if (relsXml) {
      const updatedRels = ensureCustomPropertiesRelationship(relsXml);
      zip.file('_rels/.rels', updatedRels);
    }

    // Generate new buffer
    const newBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    logger.info('Injected custom properties into docx', {
      documentId: properties._platformDocumentId,
      caseId: properties._platformCaseId,
    });

    // Ensure we return the correct Buffer type
    return Buffer.from(newBuffer);
  } catch (error) {
    logger.error('Failed to inject custom properties into docx', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    // Return original buffer if injection fails
    return docxBuffer;
  }
}

/**
 * Generate the custom.xml content for Word custom properties
 */
function generateCustomPropertiesXml(properties: DocxCustomProperties): string {
  const entries = Object.entries(properties)
    .map(([key, value], index) => {
      // Property IDs must start at 2 (1 is reserved)
      const pid = index + 2;
      return `    <property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="${pid}" name="${escapeXml(key)}">
      <vt:lpwstr>${escapeXml(value)}</vt:lpwstr>
    </property>`;
    })
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
${entries}
</Properties>`;
}

/**
 * Ensure [Content_Types].xml includes the custom properties content type
 */
function ensureCustomPropertiesContentType(contentTypesXml: string): string {
  const customPropsType =
    '<Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/>';

  // Check if already present
  if (contentTypesXml.includes('docProps/custom.xml')) {
    return contentTypesXml;
  }

  // Insert before closing </Types> tag
  return contentTypesXml.replace('</Types>', `  ${customPropsType}\n</Types>`);
}

/**
 * Ensure _rels/.rels includes the relationship to custom.xml
 */
function ensureCustomPropertiesRelationship(relsXml: string): string {
  const customPropsRel =
    '<Relationship Id="rIdCustomProps" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties" Target="docProps/custom.xml"/>';

  // Check if already present
  if (relsXml.includes('custom-properties') || relsXml.includes('docProps/custom.xml')) {
    return relsXml;
  }

  // Insert before closing </Relationships> tag
  return relsXml.replace('</Relationships>', `  ${customPropsRel}\n</Relationships>`);
}

/**
 * Escape special XML characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
