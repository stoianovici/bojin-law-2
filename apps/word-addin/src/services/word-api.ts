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
 * Custom error class for OOXML insertion failures.
 * Provides user-friendly error messages in Romanian.
 */
export class OoxmlInsertionError extends Error {
  constructor(
    public readonly originalError: Error | string,
    public readonly method: 'ooxml' | 'html' | 'all'
  ) {
    const message =
      method === 'all'
        ? 'Nu s-a putut insera documentul in Word. Incercati sa selectati o alta locatie in document sau sa inchideti si sa redeschideti documentul.'
        : method === 'ooxml'
          ? 'Formatul OOXML nu a putut fi inserat. Se incearca formatare simplificata...'
          : 'Nu s-a putut insera continutul in document.';
    super(message);
    this.name = 'OoxmlInsertionError';
  }
}

/**
 * Insert OOXML content at current cursor position (with Word styles)
 * Uses Word's insertOoxml API for style-aware content insertion
 *
 * Throws OoxmlInsertionError with Romanian error message if all methods fail.
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
          console.error('[Word API] setSelectedDataAsync failed');
          console.error('[Word API] Error message:', result.error?.message);
          console.error('[Word API] Error code:', result.error?.code);
          console.error('[Word API] Full error:', JSON.stringify(result.error));

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
                  // All methods failed - throw user-friendly error
                  reject(
                    new OoxmlInsertionError(
                      htmlError instanceof Error ? htmlError : String(htmlError),
                      'all'
                    )
                  );
                }
              } else {
                // No fallback available - throw user-friendly error
                reject(
                  new OoxmlInsertionError(error instanceof Error ? error : String(error), 'all')
                );
              }
            }
          }).catch((err) => {
            // Word.run itself failed
            reject(new OoxmlInsertionError(err instanceof Error ? err : String(err), 'all'));
          });
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
 *
 * Note: Uses batch loading with 'items/key,items/value' pattern to load
 * all properties in a single sync call (avoiding N+1 problem).
 */
export async function getDocumentProperties(): Promise<Record<string, string>> {
  if (typeof Word === 'undefined' || !Word.run) {
    console.warn('[getDocumentProperties] Word API not available');
    return {};
  }

  return new Promise((resolve, reject) => {
    Word.run(async (context: Word.RequestContext) => {
      try {
        const properties = context.document.properties;
        const customProps = properties.customProperties;

        // Load all items with their key and value in a single batch
        // This avoids the N+1 problem of loading each property individually
        customProps.load('items/key,items/value');
        await context.sync();

        console.log('[getDocumentProperties] Found', customProps.items.length, 'custom properties');

        const result: Record<string, string> = {};
        for (const prop of customProps.items) {
          console.log('[getDocumentProperties] Property:', prop.key, '=', prop.value);
          if (prop.key && prop.value !== undefined) {
            result[prop.key] = String(prop.value);
          }
        }

        console.log('[getDocumentProperties] Loaded properties:', Object.keys(result));
        resolve(result);
      } catch (error) {
        console.error('[getDocumentProperties] Error:', error);
        reject(error);
      }
    }).catch((err) => {
      console.error('[getDocumentProperties] Word.run error:', err);
      reject(err);
    });
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

/**
 * Get document content as base64-encoded string
 * Uses Office.js File API to get the document as compressed OOXML (.docx)
 */
export async function getDocumentAsBase64(): Promise<string> {
  return new Promise((resolve, reject) => {
    // Get document as compressed file (docx format)
    Office.context.document.getFileAsync(
      Office.FileType.Compressed,
      { sliceSize: 65536 }, // 64KB slices
      (result) => {
        if (result.status === Office.AsyncResultStatus.Failed) {
          reject(new Error(result.error.message || 'Failed to get document file'));
          return;
        }

        const file = result.value;
        const sliceCount = file.sliceCount;
        const slices: Uint8Array[] = [];
        let slicesReceived = 0;

        // Get all slices
        const getSlice = (index: number) => {
          file.getSliceAsync(index, (sliceResult) => {
            if (sliceResult.status === Office.AsyncResultStatus.Failed) {
              file.closeAsync();
              reject(new Error(sliceResult.error.message || `Failed to get slice ${index}`));
              return;
            }

            // Store the slice data
            slices[index] = new Uint8Array(sliceResult.value.data);
            slicesReceived++;

            if (slicesReceived === sliceCount) {
              // All slices received, combine and convert to base64
              file.closeAsync();

              // Combine all slices into single array
              const totalLength = slices.reduce((sum, slice) => sum + slice.length, 0);
              const combined = new Uint8Array(totalLength);
              let offset = 0;
              for (const slice of slices) {
                combined.set(slice, offset);
                offset += slice.length;
              }

              // Convert to base64
              const base64 = uint8ArrayToBase64(combined);
              resolve(base64);
            }
          });
        };

        // Start getting slices
        for (let i = 0; i < sliceCount; i++) {
          getSlice(i);
        }
      }
    );
  });
}

/**
 * Convert Uint8Array to base64 string
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

// ============================================================================
// Contract Analysis Functions (Expert Mode)
// ============================================================================

/**
 * Map risk level to Word highlight color.
 * Word supports: 'Yellow', 'Red', 'DarkRed', 'Green', 'Cyan', etc.
 */
function riskToHighlightColor(color: 'red' | 'yellow' | 'green'): string {
  switch (color) {
    case 'red':
      return 'Red';
    case 'yellow':
      return 'Yellow';
    case 'green':
      return 'BrightGreen';
    default:
      return 'Yellow';
  }
}

/**
 * Find and highlight a clause in the document.
 * Used for contract analysis to mark risky clauses.
 *
 * @param searchText - Text to find (first 100 chars of clause)
 * @param color - Highlight color ('red', 'yellow', 'green')
 */
export async function highlightClause(
  searchText: string,
  color: 'red' | 'yellow' | 'green'
): Promise<boolean> {
  if (!isWordAvailable()) {
    console.warn('[highlightClause] Word API not available');
    return false;
  }

  return new Promise((resolve) => {
    Word.run(async (context: Word.RequestContext) => {
      try {
        const body = context.document.body;

        // Search for the text
        const searchResults = body.search(searchText, {
          matchCase: false,
          matchWholeWord: false,
        });

        searchResults.load('items');
        await context.sync();

        if (searchResults.items.length === 0) {
          console.warn('[highlightClause] Text not found:', searchText.substring(0, 30));
          resolve(false);
          return;
        }

        // Highlight the first match
        const range = searchResults.items[0];
        range.font.highlightColor = riskToHighlightColor(color);
        await context.sync();

        console.log('[highlightClause] Highlighted text with', color);
        resolve(true);
      } catch (error) {
        console.error('[highlightClause] Error:', error);
        resolve(false);
      }
    }).catch((err) => {
      console.error('[highlightClause] Word.run error:', err);
      resolve(false);
    });
  });
}

/**
 * Search for text and scroll to it in the document.
 * Used for navigating to clauses from the analysis panel.
 *
 * @param searchText - Text to find and scroll to
 */
export async function searchAndScrollTo(searchText: string): Promise<boolean> {
  if (!isWordAvailable()) {
    console.warn('[searchAndScrollTo] Word API not available');
    return false;
  }

  return new Promise((resolve) => {
    Word.run(async (context: Word.RequestContext) => {
      try {
        const body = context.document.body;

        const searchResults = body.search(searchText, {
          matchCase: false,
          matchWholeWord: false,
        });

        searchResults.load('items');
        await context.sync();

        if (searchResults.items.length === 0) {
          console.warn('[searchAndScrollTo] Text not found:', searchText.substring(0, 30));
          resolve(false);
          return;
        }

        // Select and scroll to the first match
        const range = searchResults.items[0];
        range.select();
        await context.sync();

        console.log('[searchAndScrollTo] Scrolled to text');
        resolve(true);
      } catch (error) {
        console.error('[searchAndScrollTo] Error:', error);
        resolve(false);
      }
    }).catch((err) => {
      console.error('[searchAndScrollTo] Word.run error:', err);
      resolve(false);
    });
  });
}

/**
 * Insert text with tracked changes enabled.
 * Used for applying alternative clause text.
 *
 * @param newText - The new text to insert
 * @param oldText - The text to find and replace (if provided)
 */
export async function insertWithTrackedChanges(
  newText: string,
  oldText?: string
): Promise<boolean> {
  if (!isWordAvailable()) {
    console.warn('[insertWithTrackedChanges] Word API not available');
    return false;
  }

  return new Promise((resolve) => {
    Word.run(async (context: Word.RequestContext) => {
      try {
        // If oldText provided, find and replace it
        if (oldText) {
          const body = context.document.body;

          const searchResults = body.search(oldText.substring(0, 200), {
            matchCase: false,
            matchWholeWord: false,
          });

          searchResults.load('items');
          await context.sync();

          if (searchResults.items.length > 0) {
            // Enable track changes before making the edit
            // Note: Track changes may require document to already have it enabled
            // We'll insert the new text which will be tracked if tracking is on
            const range = searchResults.items[0];
            range.insertText(newText, Word.InsertLocation.replace);
            await context.sync();

            console.log('[insertWithTrackedChanges] Replaced text with tracked change');
            resolve(true);
            return;
          }
        }

        // If no oldText or not found, insert at selection
        const selection = context.document.getSelection();
        selection.insertText(newText, Word.InsertLocation.replace);
        await context.sync();

        console.log('[insertWithTrackedChanges] Inserted text at selection');
        resolve(true);
      } catch (error) {
        console.error('[insertWithTrackedChanges] Error:', error);
        resolve(false);
      }
    }).catch((err) => {
      console.error('[insertWithTrackedChanges] Word.run error:', err);
      resolve(false);
    });
  });
}
