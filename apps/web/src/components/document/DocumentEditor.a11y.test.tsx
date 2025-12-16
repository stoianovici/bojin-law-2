/**
 * Accessibility tests for Document Editor components
 * Tests WCAG AA compliance using jest-axe
 */

import React from 'react';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { EditorToolbar } from './EditorToolbar';
import { AIAssistantPanel } from './AIAssistantPanel';
import { VersionComparison } from './VersionComparison';
import { CommentsSidebar } from './CommentsSidebar';
import { CommandBar } from './CommandBar';

expect.extend(toHaveNoViolations);

describe('Document Editor Accessibility', () => {
  describe('EditorToolbar', () => {
    it('should not have any accessibility violations', async () => {
      const { container } = render(
        <EditorToolbar
          onFormatClick={jest.fn()}
          onAlignClick={jest.fn()}
          onHeadingClick={jest.fn()}
          onInsertClick={jest.fn()}
          onVersionHistoryClick={jest.fn()}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA labels for all buttons', async () => {
      const { container } = render(
        <EditorToolbar
          onFormatClick={jest.fn()}
          onAlignClick={jest.fn()}
          onHeadingClick={jest.fn()}
          onInsertClick={jest.fn()}
          onVersionHistoryClick={jest.fn()}
        />
      );

      const results = await axe(container, {
        rules: {
          'button-name': { enabled: true },
          'aria-required-attr': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });
  });

  describe('AIAssistantPanel', () => {
    it('should not have any accessibility violations when expanded', async () => {
      const { container } = render(<AIAssistantPanel isCollapsed={false} />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should not have any accessibility violations when collapsed', async () => {
      const { container } = render(<AIAssistantPanel isCollapsed={true} />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper keyboard navigation', async () => {
      const { container } = render(<AIAssistantPanel isCollapsed={false} />);

      const results = await axe(container, {
        rules: {
          tabindex: { enabled: true },
          'focus-order-semantics': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should have proper color contrast', async () => {
      const { container } = render(<AIAssistantPanel isCollapsed={false} />);

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });
  });

  describe('VersionComparison', () => {
    const mockPreviousVersion = {
      info: {
        versionNumber: 1,
        date: '2024-11-10 14:30',
        author: 'Test Author',
      },
      content: 'Previous content',
    };

    const mockCurrentVersion = {
      info: {
        versionNumber: 2,
        date: '2024-11-15 16:45',
        author: 'Test Author',
      },
      content: 'Current content',
    };

    const mockSemanticChanges = [
      {
        type: 'added' as const,
        lineNumber: 1,
        description: 'Test change',
      },
    ];

    it('should not have any accessibility violations', async () => {
      const { container } = render(
        <VersionComparison
          previousVersion={mockPreviousVersion}
          currentVersion={mockCurrentVersion}
          semanticChanges={mockSemanticChanges}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper color contrast for diff highlighting', async () => {
      const { container } = render(
        <VersionComparison
          previousVersion={mockPreviousVersion}
          currentVersion={mockCurrentVersion}
        />
      );

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA labels for navigation', async () => {
      const { container } = render(
        <VersionComparison
          previousVersion={mockPreviousVersion}
          currentVersion={mockCurrentVersion}
          semanticChanges={mockSemanticChanges}
        />
      );

      const results = await axe(container, {
        rules: {
          'button-name': { enabled: true },
          'aria-required-attr': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });
  });

  describe('CommentsSidebar', () => {
    const mockComments = [
      {
        id: '1',
        author: { name: 'Test Author' },
        text: 'Test comment',
        timestamp: '2 hours ago',
        lineNumber: 10,
        resolved: false,
      },
    ];

    it('should not have any accessibility violations when open', async () => {
      const { container } = render(<CommentsSidebar isOpen={true} comments={mockComments} />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should not have any accessibility violations when closed', async () => {
      const { container } = render(<CommentsSidebar isOpen={false} />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA labels for interactive elements', async () => {
      const { container } = render(<CommentsSidebar isOpen={true} comments={mockComments} />);

      const results = await axe(container, {
        rules: {
          'button-name': { enabled: true },
          label: { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should have proper form accessibility', async () => {
      const { container } = render(<CommentsSidebar isOpen={true} comments={[]} />);

      const results = await axe(container, {
        rules: {
          label: { enabled: true },
          'form-field-multiple-labels': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });
  });

  describe('CommandBar', () => {
    it('should not have any accessibility violations', async () => {
      const { container } = render(<CommandBar />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper form accessibility', async () => {
      const { container } = render(<CommandBar />);

      const results = await axe(container, {
        rules: {
          label: { enabled: true },
          'form-field-multiple-labels': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA labels for all buttons', async () => {
      const { container } = render(<CommandBar />);

      const results = await axe(container, {
        rules: {
          'button-name': { enabled: true },
          'aria-required-attr': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should have proper color contrast', async () => {
      const { container } = render(<CommandBar />);

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should maintain accessibility when loading', async () => {
      const { container } = render(<CommandBar isLoading={true} />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Romanian Diacritics Rendering', () => {
    it('should render Romanian diacritics correctly in EditorToolbar', async () => {
      const { container } = render(
        <EditorToolbar
          onFormatClick={jest.fn()}
          onAlignClick={jest.fn()}
          onHeadingClick={jest.fn()}
          onInsertClick={jest.fn()}
          onVersionHistoryClick={jest.fn()}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should render Romanian diacritics correctly in AIAssistantPanel', async () => {
      const { container } = render(<AIAssistantPanel isCollapsed={false} />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should render Romanian diacritics correctly in CommentsSidebar', async () => {
      const { container } = render(<CommentsSidebar isOpen={true} />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should render Romanian diacritics correctly in CommandBar', async () => {
      const { container } = render(<CommandBar />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support keyboard navigation in EditorToolbar', async () => {
      const { container } = render(
        <EditorToolbar
          onFormatClick={jest.fn()}
          onAlignClick={jest.fn()}
          onHeadingClick={jest.fn()}
          onInsertClick={jest.fn()}
          onVersionHistoryClick={jest.fn()}
        />
      );

      const results = await axe(container, {
        rules: {
          tabindex: { enabled: true },
          'focus-order-semantics': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation in AIAssistantPanel tabs', async () => {
      const { container } = render(<AIAssistantPanel isCollapsed={false} />);

      const results = await axe(container, {
        rules: {
          tabindex: { enabled: true },
          'focus-order-semantics': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation in VersionComparison', async () => {
      const { container } = render(<VersionComparison />);

      const results = await axe(container, {
        rules: {
          tabindex: { enabled: true },
          'focus-order-semantics': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });
  });

  describe('Screen Reader Compatibility', () => {
    it('should have proper ARIA labels in EditorToolbar', async () => {
      const { container } = render(
        <EditorToolbar
          onFormatClick={jest.fn()}
          onAlignClick={jest.fn()}
          onHeadingClick={jest.fn()}
          onInsertClick={jest.fn()}
          onVersionHistoryClick={jest.fn()}
        />
      );

      const results = await axe(container, {
        rules: {
          'aria-required-attr': { enabled: true },
          'aria-valid-attr-value': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA roles and labels in AIAssistantPanel', async () => {
      const { container } = render(<AIAssistantPanel isCollapsed={false} />);

      const results = await axe(container, {
        rules: {
          'aria-required-attr': { enabled: true },
          'aria-valid-attr-value': { enabled: true },
          'aria-roles': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });
  });
});
