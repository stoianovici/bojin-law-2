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
  let html = markdown
    // Escape HTML entities first
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    // Headers
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold and italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<b><i>$1</i></b>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(.+?)\*/g, '<i>$1</i>')
    // Lists
    .replace(/^\s*[-*]\s+(.+)$/gm, '<li>$1</li>')
    .replace(/^\s*\d+\.\s+(.+)$/gm, '<li>$1</li>')
    // Paragraphs (double newlines)
    .replace(/\n\n/g, '</p><p>')
    // Single newlines to <br>
    .replace(/\n/g, '<br>');

  // Wrap list items in <ul>
  html = html.replace(/(<li>.*?<\/li>)+/gs, '<ul>$&</ul>');

  // Wrap in paragraph tags
  html = '<p>' + html + '</p>';

  // Clean up empty paragraphs
  html = html.replace(/<p><\/p>/g, '');

  return html;
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
