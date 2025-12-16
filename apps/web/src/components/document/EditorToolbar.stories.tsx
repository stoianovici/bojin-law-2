import type { Meta, StoryObj } from '@storybook/react';
import { EditorToolbar } from './EditorToolbar';
import { action } from '@storybook/addon-actions';

/**
 * EditorToolbar provides formatting controls for the document editor.
 * Includes bold, italic, underline, strikethrough, alignment, heading levels,
 * insert menu, and version history button. All Romanian language support.
 */
const meta: Meta<typeof EditorToolbar> = {
  title: 'Document/EditorToolbar',
  component: EditorToolbar,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullwidth',
  },
};

export default meta;
type Story = StoryObj<typeof EditorToolbar>;

/**
 * Default state with all toolbar controls
 */
export const Default: Story = {
  args: {
    onFormatClick: action('format-clicked'),
    onAlignClick: action('align-clicked'),
    onHeadingChange: action('heading-changed'),
    onInsertClick: action('insert-clicked'),
    onVersionHistoryClick: action('version-history-clicked'),
  },
};

/**
 * Toolbar with format button interactions
 */
export const FormatButtonsInteractive: Story = {
  args: {
    onFormatClick: (format: string) => {
      action('format-clicked')(format);
      console.log(`Format applied: ${format}`);
    },
    onAlignClick: action('align-clicked'),
    onHeadingChange: action('heading-changed'),
    onInsertClick: action('insert-clicked'),
    onVersionHistoryClick: action('version-history-clicked'),
  },
};

/**
 * Toolbar with alignment button interactions
 */
export const AlignmentInteractive: Story = {
  args: {
    onFormatClick: action('format-clicked'),
    onAlignClick: (alignment: string) => {
      action('align-clicked')(alignment);
      console.log(`Alignment changed: ${alignment}`);
    },
    onHeadingChange: action('heading-changed'),
    onInsertClick: action('insert-clicked'),
    onVersionHistoryClick: action('version-history-clicked'),
  },
};

/**
 * Toolbar with heading dropdown interactions
 */
export const HeadingDropdownInteractive: Story = {
  args: {
    onFormatClick: action('format-clicked'),
    onAlignClick: action('align-clicked'),
    onHeadingChange: (heading: string) => {
      action('heading-changed')(heading);
      console.log(`Heading changed: ${heading}`);
    },
    onInsertClick: action('insert-clicked'),
    onVersionHistoryClick: action('version-history-clicked'),
  },
};

/**
 * Toolbar with insert menu interactions
 */
export const InsertMenuInteractive: Story = {
  args: {
    onFormatClick: action('format-clicked'),
    onAlignClick: action('align-clicked'),
    onHeadingChange: action('heading-changed'),
    onInsertClick: (type: string) => {
      action('insert-clicked')(type);
      console.log(`Insert: ${type}`);
    },
    onVersionHistoryClick: action('version-history-clicked'),
  },
};

/**
 * Toolbar with version history button interaction
 */
export const VersionHistoryInteractive: Story = {
  args: {
    onFormatClick: action('format-clicked'),
    onAlignClick: action('align-clicked'),
    onHeadingChange: action('heading-changed'),
    onInsertClick: action('insert-clicked'),
    onVersionHistoryClick: () => {
      action('version-history-clicked')();
      console.log('Version history opened');
    },
  },
};

/**
 * Romanian diacritics rendering test - all labels should display correctly
 * Check for: ă, â, î, ș, ț characters in toolbar labels
 */
export const RomanianDiacritics: Story = {
  args: {
    onFormatClick: action('format-clicked'),
    onAlignClick: action('align-clicked'),
    onHeadingChange: action('heading-changed'),
    onInsertClick: action('insert-clicked'),
    onVersionHistoryClick: action('version-history-clicked'),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Verify Romanian diacritics render correctly: Aldină, Cursiv, Subliniat, Tăiat, Aliniere stânga/dreapta, Inserează, Titlu, Bloc semnătură',
      },
    },
  },
};

/**
 * Mobile responsive view - toolbar should wrap on small screens
 */
export const MobileView: Story = {
  args: {
    onFormatClick: action('format-clicked'),
    onAlignClick: action('align-clicked'),
    onHeadingChange: action('heading-changed'),
    onInsertClick: action('insert-clicked'),
    onVersionHistoryClick: action('version-history-clicked'),
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

/**
 * Tablet responsive view
 */
export const TabletView: Story = {
  args: {
    onFormatClick: action('format-clicked'),
    onAlignClick: action('align-clicked'),
    onHeadingChange: action('heading-changed'),
    onInsertClick: action('insert-clicked'),
    onVersionHistoryClick: action('version-history-clicked'),
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
};
