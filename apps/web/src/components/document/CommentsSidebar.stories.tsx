import type { Meta, StoryObj } from '@storybook/react';
import { CommentsSidebar } from './CommentsSidebar';
import { action } from '@storybook/addon-actions';
import React from 'react';

/**
 * CommentsSidebar is a collapsible sidebar for document comments and collaboration.
 * Displays comments with author info, timestamps, line numbers, and resolve/reply actions.
 * Shows active and resolved comments separately with visual distinction.
 */
const meta: Meta<typeof CommentsSidebar> = {
  title: 'Document/CommentsSidebar',
  component: CommentsSidebar,
  tags: ['autodocs'],
  parameters: {
    layout: 'padded',
  },
};

export default meta;
type Story = StoryObj<typeof CommentsSidebar>;

/**
 * Default state with sidebar open and mock comments
 */
export const Default: Story = {
  args: {
    isOpen: true,
    onToggle: action('toggle'),
    onAddComment: action('add-comment'),
    onResolveComment: action('resolve-comment'),
    onReplyComment: action('reply-comment'),
  },
};

/**
 * Collapsed sidebar showing icon and active comment count
 */
export const Collapsed: Story = {
  args: {
    isOpen: false,
    onToggle: action('toggle'),
    onAddComment: action('add-comment'),
    onResolveComment: action('resolve-comment'),
    onReplyComment: action('reply-comment'),
  },
};

/**
 * Sidebar with add comment form open
 */
export const AddingComment: Story = {
  args: {
    isOpen: true,
    onToggle: action('toggle'),
    onAddComment: (text: string) => {
      action('add-comment')(text);
      console.log('New comment:', text);
    },
    onResolveComment: action('resolve-comment'),
    onReplyComment: action('reply-comment'),
  },
  render: (args: any) => {
    const [isOpen, setIsOpen] = React.useState(true);
    return (
      <div className="h-[700px]">
        <CommentsSidebar {...args} isOpen={isOpen} onToggle={() => setIsOpen(!isOpen)} />
      </div>
    );
  },
};

/**
 * Empty state with no comments
 */
export const EmptyState: Story = {
  args: {
    isOpen: true,
    comments: [],
    onToggle: action('toggle'),
    onAddComment: action('add-comment'),
    onResolveComment: action('resolve-comment'),
    onReplyComment: action('reply-comment'),
  },
};

/**
 * Sidebar with only active comments (no resolved)
 */
export const ActiveCommentsOnly: Story = {
  args: {
    isOpen: true,
    comments: [
      {
        id: '1',
        author: { name: 'Elena Popescu' },
        text: 'Onorariul ar trebui să fie negociat. Propun să rămână la 4.500 EUR până la evaluarea trimestrială.',
        timestamp: '2 ore',
        lineNumber: 21,
        resolved: false,
      },
      {
        id: '2',
        author: { name: 'Mihai Bojin' },
        text: 'Am adăugat clauza de prelungire automată pentru continuitate. Vă rog să confirmați dacă este acceptabilă.',
        timestamp: 'Ieri',
        lineNumber: 17,
        resolved: false,
      },
    ],
    onToggle: action('toggle'),
    onAddComment: action('add-comment'),
    onResolveComment: action('resolve-comment'),
    onReplyComment: action('reply-comment'),
  },
};

/**
 * Sidebar with only resolved comments
 */
export const ResolvedCommentsOnly: Story = {
  args: {
    isOpen: true,
    comments: [
      {
        id: '1',
        author: { name: 'Ana Ionescu' },
        text: 'Perfectă adăugarea serviciilor GDPR. Aceasta era o cerință esențială pentru noi.',
        timestamp: '2 zile',
        lineNumber: 10,
        resolved: true,
      },
      {
        id: '2',
        author: { name: 'Andrei Vlad' },
        text: 'Toate modificările au fost implementate corect.',
        timestamp: '3 zile',
        lineNumber: 24,
        resolved: true,
      },
    ],
    onToggle: action('toggle'),
    onAddComment: action('add-comment'),
    onResolveComment: action('resolve-comment'),
    onReplyComment: action('reply-comment'),
  },
};

/**
 * Sidebar with mixed active and resolved comments
 */
export const MixedComments: Story = {
  args: {
    isOpen: true,
    onToggle: action('toggle'),
    onAddComment: action('add-comment'),
    onResolveComment: action('resolve-comment'),
    onReplyComment: action('reply-comment'),
  },
};

/**
 * Sidebar with many comments (scrollable)
 */
export const ManyComments: Story = {
  args: {
    isOpen: true,
    comments: Array.from({ length: 15 }, (_, i) => ({
      id: `comment-${i}`,
      author: { name: i % 2 === 0 ? 'Elena Popescu' : 'Mihai Bojin' },
      text: `Comentariu ${i + 1}: Acesta este un comentariu de test pentru a demonstra scrolling-ul în sidebar.`,
      timestamp: i < 5 ? `${i + 1} ore` : `${i - 4} zile`,
      lineNumber: 10 + i,
      resolved: i >= 10,
    })),
    onToggle: action('toggle'),
    onAddComment: action('add-comment'),
    onResolveComment: action('resolve-comment'),
    onReplyComment: action('reply-comment'),
  },
};

/**
 * Interactive toggle between open/closed states
 */
export const InteractiveToggle: Story = {
  args: {
    isOpen: true,
    onToggle: action('toggle'),
    onAddComment: action('add-comment'),
    onResolveComment: action('resolve-comment'),
    onReplyComment: action('reply-comment'),
  },
  render: (args: any) => {
    const [isOpen, setIsOpen] = React.useState(true);
    return (
      <div className="h-[700px] flex">
        <div className="flex-1 bg-gray-100 flex items-center justify-center">
          <p className="text-gray-600">Editor area (toggle comments sidebar)</p>
        </div>
        <CommentsSidebar
          {...args}
          isOpen={isOpen}
          onToggle={() => {
            setIsOpen(!isOpen);
            args.onToggle?.();
          }}
        />
      </div>
    );
  },
};

/**
 * Interactive resolve comment functionality
 */
export const InteractiveResolve: Story = {
  args: {
    isOpen: true,
    onToggle: action('toggle'),
    onAddComment: action('add-comment'),
    onResolveComment: (commentId: string) => {
      action('resolve-comment')(commentId);
      console.log('Resolved comment:', commentId);
      alert(`Comentariul ${commentId} a fost marcat ca rezolvat!`);
    },
    onReplyComment: action('reply-comment'),
  },
};

/**
 * Interactive reply to comment functionality
 */
export const InteractiveReply: Story = {
  args: {
    isOpen: true,
    onToggle: action('toggle'),
    onAddComment: action('add-comment'),
    onResolveComment: action('resolve-comment'),
    onReplyComment: (commentId: string, text: string) => {
      action('reply-comment')(commentId, text);
      console.log('Reply to comment:', commentId, text);
      alert(`Răspuns la comentariul ${commentId}`);
    },
  },
};

/**
 * Comments with line number references
 */
export const WithLineNumbers: Story = {
  args: {
    isOpen: true,
    comments: [
      {
        id: '1',
        author: { name: 'Elena Popescu' },
        text: 'Această clauză necesită revizuire.',
        timestamp: '1 oră',
        lineNumber: 15,
        resolved: false,
      },
      {
        id: '2',
        author: { name: 'Mihai Bojin' },
        text: 'Termenul de plată trebuie modificat.',
        timestamp: '2 ore',
        lineNumber: 42,
        resolved: false,
      },
      {
        id: '3',
        author: { name: 'Ana Ionescu' },
        text: 'Perfect! Această secțiune este clară.',
        timestamp: '3 ore',
        lineNumber: 67,
        resolved: true,
      },
    ],
    onToggle: action('toggle'),
    onAddComment: action('add-comment'),
    onResolveComment: action('resolve-comment'),
    onReplyComment: action('reply-comment'),
  },
};

/**
 * Romanian diacritics in comment content
 * Verifies: ă, â, î, ș, ț characters display correctly
 */
export const RomanianDiacritics: Story = {
  args: {
    isOpen: true,
    comments: [
      {
        id: '1',
        author: { name: 'Ștefan Țîrlea' },
        text: 'Clauza de confidențialitate trebuie să includă și protecția datelor cu caracter personal conform GDPR.',
        timestamp: '2 ore',
        lineNumber: 28,
        resolved: false,
      },
      {
        id: '2',
        author: { name: 'Andreea Stănescu' },
        text: 'Părțile contractante ar trebui să convină asupra unor termene mai clare pentru îndeplinirea obligațiilor.',
        timestamp: 'Ieri',
        lineNumber: 35,
        resolved: false,
      },
      {
        id: '3',
        author: { name: 'Ionuț Mărginean' },
        text: 'Această modificare îmbunătățește semnificativ întreaga structură a contractului.',
        timestamp: '2 zile',
        lineNumber: 45,
        resolved: true,
      },
    ],
    onToggle: action('toggle'),
    onAddComment: action('add-comment'),
    onResolveComment: action('resolve-comment'),
    onReplyComment: action('reply-comment'),
  },
  parameters: {
    docs: {
      description: {
        story:
          'Verify Romanian diacritics render correctly in author names and comment text: Ștefan, Țîrlea, Stănescu, Ionuț, Mărginean, confidențialitate, îndeplinirea, îmbunătățește',
      },
    },
  },
};

/**
 * Mobile responsive view
 */
export const MobileView: Story = {
  args: {
    isOpen: true,
    onToggle: action('toggle'),
    onAddComment: action('add-comment'),
    onResolveComment: action('resolve-comment'),
    onReplyComment: action('reply-comment'),
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
    isOpen: true,
    onToggle: action('toggle'),
    onAddComment: action('add-comment'),
    onResolveComment: action('resolve-comment'),
    onReplyComment: action('reply-comment'),
  },
  parameters: {
    viewport: {
      defaultViewport: 'tablet',
    },
  },
};

/**
 * Full height sidebar
 */
export const FullHeight: Story = {
  args: {
    isOpen: true,
    onToggle: action('toggle'),
    onAddComment: action('add-comment'),
    onResolveComment: action('resolve-comment'),
    onReplyComment: action('reply-comment'),
  },
  render: (args: any) => (
    <div className="h-[900px]">
      <CommentsSidebar {...args} />
    </div>
  ),
};
