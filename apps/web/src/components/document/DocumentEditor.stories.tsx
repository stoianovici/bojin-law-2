import type { Meta, StoryObj } from '@storybook/react';
import { DocumentEditor } from './DocumentEditor';
import { action } from '@storybook/addon-actions';

/**
 * DocumentEditor is a mock document editor with line numbers and Romanian legal content.
 * Supports formatting, alignment, and heading styles. Displays default contract template.
 */
const meta: Meta<typeof DocumentEditor> = {
  title: 'Document/DocumentEditor',
  component: DocumentEditor,
  tags: ['autodocs'],
  parameters: {
    layout: 'fullwidth',
  },
};

export default meta;
type Story = StoryObj<typeof DocumentEditor>;

/**
 * Default state with Romanian legal contract template
 */
export const Default: Story = {
  args: {
    onContentChange: action('content-changed'),
  },
};

/**
 * Editor with custom short content
 */
export const ShortContent: Story = {
  args: {
    content: 'CONTRACT DE PRESTĂRI SERVICII\n\nAcest document demonstrează editorul cu conținut scurt.\n\nPărțile contractante convin asupra următoarelor clauze...',
    onContentChange: action('content-changed'),
  },
};

/**
 * Editor with bold formatting applied
 */
export const BoldFormatting: Story = {
  args: {
    formatting: {
      bold: true,
    },
    onContentChange: action('content-changed'),
  },
};

/**
 * Editor with italic formatting applied
 */
export const ItalicFormatting: Story = {
  args: {
    formatting: {
      italic: true,
    },
    onContentChange: action('content-changed'),
  },
};

/**
 * Editor with underline formatting applied
 */
export const UnderlineFormatting: Story = {
  args: {
    formatting: {
      underline: true,
    },
    onContentChange: action('content-changed'),
  },
};

/**
 * Editor with strikethrough formatting applied
 */
export const StrikethroughFormatting: Story = {
  args: {
    formatting: {
      strikethrough: true,
    },
    onContentChange: action('content-changed'),
  },
};

/**
 * Editor with multiple formatting styles combined
 */
export const CombinedFormatting: Story = {
  args: {
    formatting: {
      bold: true,
      italic: true,
      underline: true,
    },
    onContentChange: action('content-changed'),
  },
};

/**
 * Editor with left alignment (default)
 */
export const LeftAlignment: Story = {
  args: {
    alignment: 'left',
    onContentChange: action('content-changed'),
  },
};

/**
 * Editor with center alignment
 */
export const CenterAlignment: Story = {
  args: {
    alignment: 'center',
    onContentChange: action('content-changed'),
  },
};

/**
 * Editor with right alignment
 */
export const RightAlignment: Story = {
  args: {
    alignment: 'right',
    onContentChange: action('content-changed'),
  },
};

/**
 * Editor with justify alignment
 */
export const JustifyAlignment: Story = {
  args: {
    alignment: 'justify',
    onContentChange: action('content-changed'),
  },
};

/**
 * Editor with H1 heading style
 */
export const H1Heading: Story = {
  args: {
    heading: 'h1',
    content: 'CONTRACT DE PRESTĂRI SERVICII JURIDICE',
    onContentChange: action('content-changed'),
  },
};

/**
 * Editor with H2 heading style
 */
export const H2Heading: Story = {
  args: {
    heading: 'h2',
    content: 'ARTICOLUL 1 - OBIECTUL CONTRACTULUI',
    onContentChange: action('content-changed'),
  },
};

/**
 * Editor with H3 heading style
 */
export const H3Heading: Story = {
  args: {
    heading: 'h3',
    content: 'Clauze generale',
    onContentChange: action('content-changed'),
  },
};

/**
 * Editor with normal text style
 */
export const NormalText: Story = {
  args: {
    heading: 'normal',
    onContentChange: action('content-changed'),
  },
};

/**
 * Empty editor state
 */
export const EmptyState: Story = {
  args: {
    content: '',
    onContentChange: action('content-changed'),
  },
};

/**
 * Romanian diacritics rendering test
 * Verifies correct display of: ă, â, î, ș, ț in document content
 */
export const RomanianDiacritics: Story = {
  args: {
    content: `Test Caractere Speciale Românești

Caractere cu diacritice:
- ă (a cu breve): împăcare, română, înțelegere
- â (a cu circumflex): mâine, pâine, România
- î (i cu circumflex): încredere, învățare, înțeles
- ș (s cu virgulă): știre, șef, măsură
- ț (t cu virgulă): țară, înțelegere, negociați

Exemple de text juridic:
Cabinet de Avocat "Bojin & Asociații" S.R.L.
Beneficiarul datorează penalități de întârziere.
Contractul se prelungește automat.
Obligația de confidențialitate rămâne în vigoare.`,
    onContentChange: action('content-changed'),
  },
  parameters: {
    docs: {
      description: {
        story: 'Verify all Romanian diacritics render correctly in the editor content',
      },
    },
  },
};

/**
 * Mobile view with responsive layout
 */
export const MobileView: Story = {
  args: {
    onContentChange: action('content-changed'),
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
  },
};

/**
 * Tablet view with responsive layout
 */
export const TabletView: Story = {
  args: {
    onContentChange: action('content-changed'),
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
};
