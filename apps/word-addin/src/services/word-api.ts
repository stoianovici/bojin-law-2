/**
 * Word API Service
 * Story 3.4: Word Integration with Live AI Assistance
 *
 * Wrapper functions for Word JavaScript API operations.
 */

/**
 * Check if Word API is available
 */
function isWordAvailable(): boolean {
  return typeof Word !== 'undefined' && Word.run !== undefined;
}

/**
 * Get currently selected text and surrounding context
 */
export async function getSelectedText(): Promise<{ selectedText: string; context: string }> {
  if (!isWordAvailable()) {
    return { selectedText: '', context: '' };
  }

  return new Promise((resolve, reject) => {
    Word.run(async (context: Word.RequestContext) => {
      try {
        const selection = context.document.getSelection();
        selection.load('text');

        // Get surrounding paragraph for context
        const paragraph = selection.paragraphs.getFirst();
        paragraph.load('text');

        await context.sync();

        resolve({
          selectedText: selection.text || '',
          context: paragraph.text || '',
        });
      } catch (error) {
        reject(error);
      }
    }).catch(reject);
  });
}

/**
 * Insert text at current cursor position
 */
export async function insertText(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    Word.run(async (context: Word.RequestContext) => {
      try {
        const selection = context.document.getSelection();
        selection.insertText(text, Word.InsertLocation.end);
        await context.sync();
        resolve();
      } catch (error) {
        reject(error);
      }
    }).catch(reject);
  });
}

/**
 * Convert markdown to simple HTML for Word
 */
function markdownToHtml(markdown: string): string {
  // Process line by line for better control
  const lines = markdown.split('\n');
  const htmlParts: string[] = [];
  let inList = false;
  let listType: 'ul' | 'ol' | null = null;

  for (const line of lines) {
    let processed = line;

    // Escape HTML entities in content (but preserve our markers)
    processed = processed.replace(/&/g, '&amp;').replace(/</g, '&lt;');

    // Headers (process before other formatting)
    if (/^##### (.+)$/.test(processed)) {
      if (inList) {
        htmlParts.push(listType === 'ol' ? '</ol>' : '</ul>');
        inList = false;
      }
      htmlParts.push(processed.replace(/^##### (.+)$/, '<h5>$1</h5>'));
      continue;
    }
    if (/^#### (.+)$/.test(processed)) {
      if (inList) {
        htmlParts.push(listType === 'ol' ? '</ol>' : '</ul>');
        inList = false;
      }
      htmlParts.push(processed.replace(/^#### (.+)$/, '<h4>$1</h4>'));
      continue;
    }
    if (/^### (.+)$/.test(processed)) {
      if (inList) {
        htmlParts.push(listType === 'ol' ? '</ol>' : '</ul>');
        inList = false;
      }
      htmlParts.push(processed.replace(/^### (.+)$/, '<h3>$1</h3>'));
      continue;
    }
    if (/^## (.+)$/.test(processed)) {
      if (inList) {
        htmlParts.push(listType === 'ol' ? '</ol>' : '</ul>');
        inList = false;
      }
      htmlParts.push(processed.replace(/^## (.+)$/, '<h2>$1</h2>'));
      continue;
    }
    if (/^# (.+)$/.test(processed)) {
      if (inList) {
        htmlParts.push(listType === 'ol' ? '</ol>' : '</ul>');
        inList = false;
      }
      htmlParts.push(processed.replace(/^# (.+)$/, '<h1>$1</h1>'));
      continue;
    }

    // Blockquote with double >> (indented)
    if (/^>> (.+)$/.test(processed)) {
      if (inList) {
        htmlParts.push(listType === 'ol' ? '</ol>' : '</ul>');
        inList = false;
      }
      const content = processed.replace(/^>> (.+)$/, '$1');
      htmlParts.push(`<p style="margin-left: 40px;">${applyInlineFormatting(content)}</p>`);
      continue;
    }

    // Blockquote with single >
    if (/^> (.+)$/.test(processed)) {
      if (inList) {
        htmlParts.push(listType === 'ol' ? '</ol>' : '</ul>');
        inList = false;
      }
      const content = processed.replace(/^> (.+)$/, '$1');
      htmlParts.push(
        `<blockquote style="border-left: 3px solid #ccc; margin-left: 10px; padding-left: 10px; color: #555;">${applyInlineFormatting(content)}</blockquote>`
      );
      continue;
    }

    // Unordered list
    if (/^[-*] (.+)$/.test(processed)) {
      if (!inList || listType !== 'ul') {
        if (inList) htmlParts.push(listType === 'ol' ? '</ol>' : '</ul>');
        htmlParts.push('<ul>');
        inList = true;
        listType = 'ul';
      }
      const content = processed.replace(/^[-*] (.+)$/, '$1');
      htmlParts.push(`<li>${applyInlineFormatting(content)}</li>`);
      continue;
    }

    // Ordered list
    if (/^\d+\. (.+)$/.test(processed)) {
      if (!inList || listType !== 'ol') {
        if (inList) htmlParts.push(listType === 'ol' ? '</ol>' : '</ul>');
        htmlParts.push('<ol>');
        inList = true;
        listType = 'ol';
      }
      const content = processed.replace(/^\d+\. (.+)$/, '$1');
      htmlParts.push(`<li>${applyInlineFormatting(content)}</li>`);
      continue;
    }

    // Close list if we're no longer in list items
    if (inList) {
      htmlParts.push(listType === 'ol' ? '</ol>' : '</ul>');
      inList = false;
      listType = null;
    }

    // Empty line - add paragraph break
    if (processed.trim() === '') {
      continue;
    }

    // Regular paragraph
    htmlParts.push(`<p>${applyInlineFormatting(processed)}</p>`);
  }

  // Close any open list
  if (inList) {
    htmlParts.push(listType === 'ol' ? '</ol>' : '</ul>');
  }

  return htmlParts.join('\n');
}

/**
 * Apply inline formatting (bold, italic, underline)
 */
function applyInlineFormatting(text: string): string {
  return (
    text
      // Bold+italic ***text***
      .replace(/\*\*\*(.+?)\*\*\*/g, '<b><i>$1</i></b>')
      // Bold **text**
      .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
      // Italic *text*
      .replace(/\*(.+?)\*/g, '<i>$1</i>')
      // Underline _text_
      .replace(/_([^_]+)_/g, '<u>$1</u>')
  );
}

/**
 * Insert HTML content at current cursor position (with formatting)
 */
export async function insertHtml(html: string): Promise<void> {
  return new Promise((resolve, reject) => {
    Word.run(async (context: Word.RequestContext) => {
      try {
        const selection = context.document.getSelection();
        selection.insertHtml(html, Word.InsertLocation.end);
        await context.sync();
        resolve();
      } catch (error) {
        reject(error);
      }
    }).catch(reject);
  });
}

/**
 * Insert markdown content as formatted HTML
 */
export async function insertMarkdown(markdown: string): Promise<void> {
  const html = markdownToHtml(markdown);
  return insertHtml(html);
}

/**
 * Replace currently selected text
 */
export async function replaceSelection(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    Word.run(async (context: Word.RequestContext) => {
      try {
        const selection = context.document.getSelection();
        selection.insertText(text, Word.InsertLocation.replace);
        await context.sync();
        resolve();
      } catch (error) {
        reject(error);
      }
    }).catch(reject);
  });
}

/**
 * Replace currently selected text with formatted HTML (from markdown)
 */
export async function replaceSelectionFormatted(markdown: string): Promise<void> {
  const html = markdownToHtml(markdown);
  return new Promise((resolve, reject) => {
    Word.run(async (context: Word.RequestContext) => {
      try {
        const selection = context.document.getSelection();
        selection.insertHtml(html, Word.InsertLocation.replace);
        await context.sync();
        resolve();
      } catch (error) {
        reject(error);
      }
    }).catch(reject);
  });
}

// ============================================================================
// OOXML Insertion Functions
// ============================================================================

/**
 * Insert OOXML content at current cursor position (with Word styles)
 * Uses Word's insertOoxml API for style-aware content insertion
 */
export async function insertOoxml(ooxml: string, markdownFallback?: string): Promise<void> {
  console.log(
    '[Word API] insertOoxml called, length:',
    ooxml.length,
    'fallback length:',
    markdownFallback?.length
  );
  console.log('[Word API] OOXML preview:', ooxml.substring(0, 200));

  // Try setSelectedDataAsync first (more reliable for Word Online)
  // Then fall back to Word.js insertOoxml, then HTML
  return new Promise((resolve, reject) => {
    // Method 1: setSelectedDataAsync with OOXML coercion (most reliable)
    Office.context.document.setSelectedDataAsync(
      ooxml,
      { coercionType: Office.CoercionType.Ooxml },
      (result) => {
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          console.log('[Word API] setSelectedDataAsync OOXML success');
          resolve();
        } else {
          console.warn(
            '[Word API] setSelectedDataAsync failed:',
            result.error?.message,
            result.error?.code
          );

          // Method 2: Try Word.js insertOoxml
          Word.run(async (context: Word.RequestContext) => {
            try {
              const selection = context.document.getSelection();
              selection.insertOoxml(ooxml, Word.InsertLocation.end);
              await context.sync();
              console.log('[Word API] Word.js insertOoxml success');
              resolve();
            } catch (error) {
              console.warn('[Word API] Word.js insertOoxml failed:', (error as Error).message);

              // Method 3: Fall back to HTML
              if (markdownFallback) {
                try {
                  // Check if content is already HTML
                  // Claude often adds "thinking" text before HTML, so check for common tags anywhere
                  const hasHtmlTags =
                    /<(article|div|p|h[1-6]|section|table|ul|ol|header|footer|nav)\b/i.test(
                      markdownFallback
                    );
                  const html = hasHtmlTags ? markdownFallback : markdownToHtml(markdownFallback);
                  const selection = context.document.getSelection();
                  selection.insertHtml(html, Word.InsertLocation.end);
                  await context.sync();
                  console.log('[Word API] HTML fallback success, wasHtml:', hasHtmlTags);
                  resolve();
                } catch (htmlError) {
                  console.error('[Word API] HTML fallback also failed:', htmlError);
                  reject(htmlError);
                }
              } else {
                reject(error);
              }
            }
          }).catch(reject);
        }
      }
    );
  });
}

/**
 * Replace currently selected text with OOXML content (with Word styles)
 */
export async function replaceSelectionOoxml(ooxml: string): Promise<void> {
  return new Promise((resolve, reject) => {
    Word.run(async (context: Word.RequestContext) => {
      try {
        const selection = context.document.getSelection();
        // Word.InsertLocation.replace replaces the selection
        selection.insertOoxml(ooxml, Word.InsertLocation.replace);
        await context.sync();
        resolve();
      } catch (error) {
        reject(error);
      }
    }).catch(reject);
  });
}

/**
 * Get document content for context
 */
export async function getDocumentContent(maxLength: number = 10000): Promise<string> {
  return new Promise((resolve, reject) => {
    Word.run(async (context: Word.RequestContext) => {
      try {
        const body = context.document.body;
        body.load('text');
        await context.sync();

        const text = body.text || '';
        resolve(text.substring(0, maxLength));
      } catch (error) {
        reject(error);
      }
    }).catch(reject);
  });
}

/**
 * Get document custom properties
 */
export async function getDocumentProperties(): Promise<Record<string, string>> {
  return new Promise((resolve, reject) => {
    Word.run(async (context: Word.RequestContext) => {
      try {
        const properties = context.document.properties;
        properties.load('customProperties');
        await context.sync();

        const result: Record<string, string> = {};
        properties.customProperties.items.forEach((prop: Word.CustomProperty) => {
          result[prop.key] = prop.value;
        });

        resolve(result);
      } catch (error) {
        reject(error);
      }
    }).catch(reject);
  });
}

/**
 * Set document custom property
 */
export async function setDocumentProperty(key: string, value: string): Promise<void> {
  return new Promise((resolve, reject) => {
    Word.run(async (context: Word.RequestContext) => {
      try {
        const properties = context.document.properties;
        properties.customProperties.add(key, value);
        await context.sync();
        resolve();
      } catch (error) {
        reject(error);
      }
    }).catch(reject);
  });
}

/**
 * Get cursor position context (text before cursor)
 */
export async function getCursorContext(length: number = 500): Promise<string> {
  return new Promise((resolve, _reject) => {
    Word.run(async (context: Word.RequestContext) => {
      try {
        const selection = context.document.getSelection();
        const range = selection.getRange('Start');

        // Get preceding content
        const paragraph = range.paragraphs.getFirst();
        paragraph.load('text');

        await context.sync();

        const text = paragraph.text || '';
        resolve(text.substring(Math.max(0, text.length - length)));
      } catch {
        // If we can't get context, return empty string
        resolve('');
      }
    }).catch(() => resolve(''));
  });
}

/**
 * Insert comment on selection
 */
export async function insertComment(text: string): Promise<void> {
  return new Promise((resolve, reject) => {
    Word.run(async (context: Word.RequestContext) => {
      try {
        const selection = context.document.getSelection();
        // Note: Comments API may require additional permissions
        (selection as unknown as { insertComment: (text: string) => void }).insertComment(text);
        await context.sync();
        resolve();
      } catch (error) {
        reject(error);
      }
    }).catch(reject);
  });
}

interface WordComment {
  id: string;
  content: string;
  authorName: string;
}

/**
 * Get all comments in document
 */
export async function getComments(): Promise<Array<{ id: string; text: string; author: string }>> {
  return new Promise((resolve, _reject) => {
    Word.run(async (context: Word.RequestContext) => {
      try {
        // Note: Comments API availability depends on Word version
        const comments = (
          context.document as unknown as {
            comments: { load: (props: string) => void; items: WordComment[] };
          }
        ).comments;
        comments.load('items');
        await context.sync();

        const result = comments.items.map((c: WordComment) => ({
          id: c.id,
          text: c.content,
          author: c.authorName,
        }));

        resolve(result);
      } catch {
        // Comments API not available
        resolve([]);
      }
    }).catch(() => resolve([]));
  });
}

/**
 * Highlight text range
 */
export async function highlightSelection(color: string = 'yellow'): Promise<void> {
  return new Promise((resolve, reject) => {
    Word.run(async (context: Word.RequestContext) => {
      try {
        const selection = context.document.getSelection();
        selection.font.highlightColor = color;
        await context.sync();
        resolve();
      } catch (error) {
        reject(error);
      }
    }).catch(reject);
  });
}

/**
 * Save document
 */
export async function saveDocument(): Promise<void> {
  return new Promise((resolve, reject) => {
    Word.run(async (context: Word.RequestContext) => {
      try {
        // Note: save() may not work in all scenarios
        (context.document as unknown as { save: () => void }).save();
        await context.sync();
        resolve();
      } catch (error) {
        reject(error);
      }
    }).catch(reject);
  });
}

/**
 * Get document name/title
 */
export async function getDocumentName(): Promise<string> {
  if (!isWordAvailable()) {
    return 'Document nou';
  }

  return new Promise((resolve) => {
    Word.run(async (context: Word.RequestContext) => {
      try {
        const properties = context.document.properties;
        properties.load('title');
        await context.sync();

        // Use title if available, otherwise return default
        const title = properties.title?.trim();
        resolve(title || 'Document nou');
      } catch {
        resolve('Document nou');
      }
    }).catch(() => resolve('Document nou'));
  });
}

/**
 * Get document URL (for SharePoint/OneDrive documents)
 * Returns the URL of the document if available, or null if local/unsaved
 */
export async function getDocumentUrl(): Promise<string | null> {
  if (!isWordAvailable()) {
    return null;
  }

  return new Promise((resolve) => {
    // Try to get URL from Office context
    // Office.context.document.url gives the full URL for online documents
    try {
      const url = (Office.context as { document?: { url?: string } }).document?.url;
      if (url && typeof url === 'string' && url.startsWith('http')) {
        resolve(url);
        return;
      }
    } catch {
      // Continue to fallback
    }

    // Fallback: try to get from document properties
    Word.run(async (context: Word.RequestContext) => {
      try {
        // Try to access the document URL via the Word API if available
        // Note: This might not be available in all Word versions
        const doc = context.document as unknown as { url?: string; load: (props: string) => void };
        if (doc.url !== undefined) {
          doc.load('url');
          await context.sync();
          if (doc.url && typeof doc.url === 'string') {
            resolve(doc.url);
            return;
          }
        }
        resolve(null);
      } catch {
        resolve(null);
      }
    }).catch(() => resolve(null));
  });
}

/**
 * Get document file name from properties or URL
 */
export async function getDocumentFileName(): Promise<string | null> {
  if (!isWordAvailable()) {
    return null;
  }

  // First try to get from document URL
  const url = await getDocumentUrl();
  if (url) {
    try {
      const urlPath = new URL(url).pathname;
      const fileName = urlPath.split('/').pop();
      if (fileName) {
        return decodeURIComponent(fileName);
      }
    } catch {
      // URL parsing failed, continue
    }
  }

  // Try to get from Office context filename
  try {
    // @ts-expect-error - Office context may have fileName in some environments
    const fileName = Office.context?.document?.fileName;
    if (fileName && typeof fileName === 'string') {
      return fileName;
    }
  } catch {
    // Continue
  }

  return null;
}
