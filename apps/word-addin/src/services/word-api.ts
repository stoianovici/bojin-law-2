/**
 * Word API Service
 * Story 3.4: Word Integration with Live AI Assistance
 *
 * Wrapper functions for Word JavaScript API operations.
 */

/**
 * Get currently selected text and surrounding context
 */
export async function getSelectedText(): Promise<{ selectedText: string; context: string }> {
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
      } catch (error) {
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
        // @ts-ignore - Comments API
        selection.insertComment(text);
        await context.sync();
        resolve();
      } catch (error) {
        reject(error);
      }
    }).catch(reject);
  });
}

/**
 * Get all comments in document
 */
export async function getComments(): Promise<Array<{ id: string; text: string; author: string }>> {
  return new Promise((resolve, _reject) => {
    Word.run(async (context: Word.RequestContext) => {
      try {
        // Note: Comments API availability depends on Word version
        // @ts-ignore - Comments API
        const comments = context.document.comments;
        comments.load('items');
        await context.sync();

        const result = comments.items.map((c: any) => ({
          id: c.id,
          text: c.content,
          author: c.authorName,
        }));

        resolve(result);
      } catch (_error) {
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
        // @ts-ignore
        context.document.save();
        await context.sync();
        resolve();
      } catch (error) {
        reject(error);
      }
    }).catch(reject);
  });
}
