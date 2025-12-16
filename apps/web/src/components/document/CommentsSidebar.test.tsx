/**
 * Tests for CommentsSidebar component
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { CommentsSidebar, Comment } from './CommentsSidebar';

const mockComments: Comment[] = [
  {
    id: '1',
    author: {
      name: 'Elena Popescu',
    },
    text: 'Onorariul ar trebui să fie negociat.',
    timestamp: '2 ore',
    lineNumber: 21,
    resolved: false,
  },
  {
    id: '2',
    author: {
      name: 'Mihai Bojin',
    },
    text: 'Am adăugat clauza de prelungire automată.',
    timestamp: 'Ieri',
    lineNumber: 17,
    resolved: false,
  },
  {
    id: '3',
    author: {
      name: 'Ana Ionescu',
    },
    text: 'Perfectă adăugarea serviciilor GDPR.',
    timestamp: '2 zile',
    lineNumber: 10,
    resolved: true,
  },
];

describe('CommentsSidebar', () => {
  describe('Closed State', () => {
    it('renders closed view when isOpen is false', () => {
      render(<CommentsSidebar isOpen={false} />);

      const button = screen.getByLabelText('Deschide comentarii');
      expect(button).toBeInTheDocument();
    });

    it('displays comment count badge when there are active comments', () => {
      render(<CommentsSidebar isOpen={false} comments={mockComments} />);

      // 2 active comments (not resolved)
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('does not display badge when all comments are resolved', () => {
      const resolvedComments = mockComments.map((c) => ({ ...c, resolved: true }));
      render(<CommentsSidebar isOpen={false} comments={resolvedComments} />);

      // No active comments badge
      expect(screen.queryByText('2')).not.toBeInTheDocument();
    });

    it('calls onToggle when open button is clicked', () => {
      const handleToggle = jest.fn();
      render(<CommentsSidebar isOpen={false} onToggle={handleToggle} />);

      const button = screen.getByLabelText('Deschide comentarii');
      fireEvent.click(button);

      expect(handleToggle).toHaveBeenCalledTimes(1);
    });

    it('has proper ARIA label and title', () => {
      render(<CommentsSidebar isOpen={false} />);

      const button = screen.getByLabelText('Deschide comentarii');
      expect(button).toHaveAttribute('title', 'Deschide comentarii');
    });
  });

  describe('Open State', () => {
    it('renders open view when isOpen is true', () => {
      render(<CommentsSidebar isOpen={true} />);

      expect(screen.getByText('Comentarii')).toBeInTheDocument();
      expect(screen.getByLabelText('Închide comentarii')).toBeInTheDocument();
    });

    it('displays active comment count in header badge', () => {
      render(<CommentsSidebar isOpen={true} comments={mockComments} />);

      // Should show badge with count of 2 (active comments)
      const badges = screen.getAllByText('2');
      expect(badges.length).toBeGreaterThan(0);
    });

    it('calls onToggle when close button is clicked', () => {
      const handleToggle = jest.fn();
      render(<CommentsSidebar isOpen={true} onToggle={handleToggle} />);

      const button = screen.getByLabelText('Închide comentarii');
      fireEvent.click(button);

      expect(handleToggle).toHaveBeenCalledTimes(1);
    });

    it('renders add comment button by default', () => {
      render(<CommentsSidebar isOpen={true} />);

      expect(screen.getByText('+ Adaugă comentariu')).toBeInTheDocument();
    });
  });

  describe('Add Comment Functionality', () => {
    it('shows comment form when add button is clicked', () => {
      render(<CommentsSidebar isOpen={true} />);

      const addButton = screen.getByText('+ Adaugă comentariu');
      fireEvent.click(addButton);

      expect(screen.getByPlaceholderText('Scrie un comentariu...')).toBeInTheDocument();
      expect(screen.getByText('Adaugă')).toBeInTheDocument();
      expect(screen.getByText('Anulează')).toBeInTheDocument();
    });

    it('allows typing in comment textarea', () => {
      render(<CommentsSidebar isOpen={true} />);

      fireEvent.click(screen.getByText('+ Adaugă comentariu'));

      const textarea = screen.getByPlaceholderText('Scrie un comentariu...');
      fireEvent.change(textarea, { target: { value: 'Test comment' } });

      expect(textarea).toHaveValue('Test comment');
    });

    it('calls onAddComment when comment is submitted', () => {
      const handleAddComment = jest.fn();
      render(<CommentsSidebar isOpen={true} onAddComment={handleAddComment} />);

      fireEvent.click(screen.getByText('+ Adaugă comentariu'));

      const textarea = screen.getByPlaceholderText('Scrie un comentariu...');
      fireEvent.change(textarea, { target: { value: 'New comment' } });

      const submitButton = screen.getByText('Adaugă');
      fireEvent.click(submitButton);

      expect(handleAddComment).toHaveBeenCalledWith('New comment');
    });

    it('clears textarea after successful submission', () => {
      const handleAddComment = jest.fn();
      render(<CommentsSidebar isOpen={true} onAddComment={handleAddComment} />);

      fireEvent.click(screen.getByText('+ Adaugă comentariu'));

      const textarea = screen.getByPlaceholderText('Scrie un comentariu...');
      fireEvent.change(textarea, { target: { value: 'New comment' } });
      fireEvent.click(screen.getByText('Adaugă'));

      // Form should be hidden after submission
      expect(screen.queryByPlaceholderText('Scrie un comentariu...')).not.toBeInTheDocument();
    });

    it('does not submit empty comments', () => {
      const handleAddComment = jest.fn();
      render(<CommentsSidebar isOpen={true} onAddComment={handleAddComment} />);

      fireEvent.click(screen.getByText('+ Adaugă comentariu'));

      const submitButton = screen.getByText('Adaugă');
      fireEvent.click(submitButton);

      expect(handleAddComment).not.toHaveBeenCalled();
    });

    it('does not submit whitespace-only comments', () => {
      const handleAddComment = jest.fn();
      render(<CommentsSidebar isOpen={true} onAddComment={handleAddComment} />);

      fireEvent.click(screen.getByText('+ Adaugă comentariu'));

      const textarea = screen.getByPlaceholderText('Scrie un comentariu...');
      fireEvent.change(textarea, { target: { value: '   ' } });

      const submitButton = screen.getByText('Adaugă');
      fireEvent.click(submitButton);

      expect(handleAddComment).not.toHaveBeenCalled();
    });

    it('cancels comment addition and clears form', () => {
      render(<CommentsSidebar isOpen={true} />);

      fireEvent.click(screen.getByText('+ Adaugă comentariu'));

      const textarea = screen.getByPlaceholderText('Scrie un comentariu...');
      fireEvent.change(textarea, { target: { value: 'Draft comment' } });

      const cancelButton = screen.getByText('Anulează');
      fireEvent.click(cancelButton);

      // Form should be hidden
      expect(screen.queryByPlaceholderText('Scrie un comentariu...')).not.toBeInTheDocument();
      expect(screen.getByText('+ Adaugă comentariu')).toBeInTheDocument();
    });

    it('works without onAddComment handler', () => {
      render(<CommentsSidebar isOpen={true} />);

      fireEvent.click(screen.getByText('+ Adaugă comentariu'));

      const textarea = screen.getByPlaceholderText('Scrie un comentariu...');
      fireEvent.change(textarea, { target: { value: 'Test' } });

      const submitButton = screen.getByText('Adaugă');

      expect(() => fireEvent.click(submitButton)).not.toThrow();
    });
  });

  describe('Comments List', () => {
    it('renders active comments', () => {
      render(<CommentsSidebar isOpen={true} comments={mockComments} />);

      expect(screen.getByText('Elena Popescu')).toBeInTheDocument();
      expect(screen.getByText('Mihai Bojin')).toBeInTheDocument();
      expect(screen.getByText('Onorariul ar trebui să fie negociat.')).toBeInTheDocument();
    });

    it('renders resolved comments in separate section', () => {
      render(<CommentsSidebar isOpen={true} comments={mockComments} />);

      expect(screen.getByText('Rezolvate (1)')).toBeInTheDocument();
      expect(screen.getByText('Ana Ionescu')).toBeInTheDocument();
      expect(screen.getByText('Perfectă adăugarea serviciilor GDPR.')).toBeInTheDocument();
    });

    it('displays comment timestamps', () => {
      render(<CommentsSidebar isOpen={true} comments={mockComments} />);

      expect(screen.getByText('2 ore')).toBeInTheDocument();
      expect(screen.getByText('Ieri')).toBeInTheDocument();
      expect(screen.getByText('2 zile')).toBeInTheDocument();
    });

    it('displays line numbers for comments', () => {
      render(<CommentsSidebar isOpen={true} comments={mockComments} />);

      expect(screen.getByText('Linia 21')).toBeInTheDocument();
      expect(screen.getByText('Linia 17')).toBeInTheDocument();
      expect(screen.getByText('Linia 10')).toBeInTheDocument();
    });

    it('generates correct initials for author avatars', () => {
      render(<CommentsSidebar isOpen={true} comments={mockComments} />);

      expect(screen.getByText('EP')).toBeInTheDocument(); // Elena Popescu
      expect(screen.getByText('MB')).toBeInTheDocument(); // Mihai Bojin
      expect(screen.getByText('AI')).toBeInTheDocument(); // Ana Ionescu
    });

    it('shows Rezolvat and Răspunde buttons for active comments', () => {
      render(<CommentsSidebar isOpen={true} comments={mockComments} />);

      const resolveButtons = screen.getAllByText('Rezolvat');
      const replyButtons = screen.getAllByText('Răspunde');

      // Should have buttons for 2 active comments
      expect(resolveButtons.length).toBe(2);
      expect(replyButtons.length).toBe(2);
    });

    it('does not show action buttons for resolved comments', () => {
      const resolvedComment = mockComments[2]; // Ana Ionescu's resolved comment
      render(<CommentsSidebar isOpen={true} comments={[resolvedComment]} />);

      // Should not have Rezolvat/Răspunde buttons
      expect(screen.queryByText('Rezolvat')).not.toBeInTheDocument();
      expect(screen.queryByText('Răspunde')).not.toBeInTheDocument();
    });
  });

  describe('Comment Actions', () => {
    it('calls onResolveComment when resolve button is clicked', () => {
      const handleResolve = jest.fn();
      render(
        <CommentsSidebar isOpen={true} comments={mockComments} onResolveComment={handleResolve} />
      );

      const resolveButtons = screen.getAllByText('Rezolvat');
      fireEvent.click(resolveButtons[0]);

      expect(handleResolve).toHaveBeenCalledWith('1');
    });

    it('calls onReplyComment when reply button is clicked', () => {
      const handleReply = jest.fn();
      render(
        <CommentsSidebar isOpen={true} comments={mockComments} onReplyComment={handleReply} />
      );

      const replyButtons = screen.getAllByText('Răspunde');
      fireEvent.click(replyButtons[0]);

      expect(handleReply).toHaveBeenCalledWith('1', '');
    });

    it('works without onResolveComment handler', () => {
      render(<CommentsSidebar isOpen={true} comments={mockComments} />);

      const resolveButtons = screen.getAllByText('Rezolvat');

      expect(() => fireEvent.click(resolveButtons[0])).not.toThrow();
    });

    it('works without onReplyComment handler', () => {
      render(<CommentsSidebar isOpen={true} comments={mockComments} />);

      const replyButtons = screen.getAllByText('Răspunde');

      expect(() => fireEvent.click(replyButtons[0])).not.toThrow();
    });
  });

  describe('Empty State', () => {
    it('shows empty state when no comments exist', () => {
      render(<CommentsSidebar isOpen={true} comments={[]} />);

      expect(screen.getByText('Niciun comentariu încă')).toBeInTheDocument();
      expect(
        screen.getByText('Adaugă primul comentariu pentru acest document')
      ).toBeInTheDocument();
    });

    it('does not show empty state when comments exist', () => {
      render(<CommentsSidebar isOpen={true} comments={mockComments} />);

      expect(screen.queryByText('Niciun comentariu încă')).not.toBeInTheDocument();
    });

    it('does not show resolved section when no resolved comments', () => {
      const activeOnly = mockComments.filter((c) => !c.resolved);
      render(<CommentsSidebar isOpen={true} comments={activeOnly} />);

      expect(screen.queryByText(/Rezolvate/)).not.toBeInTheDocument();
    });
  });

  describe('Romanian Diacritics', () => {
    it('renders Romanian diacritics in header', () => {
      render(<CommentsSidebar isOpen={true} />);

      expect(screen.getByText('Comentarii')).toBeInTheDocument();
    });

    it('renders Romanian diacritics in buttons', () => {
      render(<CommentsSidebar isOpen={true} />);

      expect(screen.getByText('+ Adaugă comentariu')).toBeInTheDocument();
      expect(screen.getByLabelText('Închide comentarii')).toBeInTheDocument();
    });

    it('renders Romanian diacritics in form', () => {
      render(<CommentsSidebar isOpen={true} />);

      fireEvent.click(screen.getByText('+ Adaugă comentariu'));

      expect(screen.getByPlaceholderText('Scrie un comentariu...')).toBeInTheDocument();
      expect(screen.getByText('Adaugă')).toBeInTheDocument();
      expect(screen.getByText('Anulează')).toBeInTheDocument();
    });

    it('renders Romanian diacritics in action buttons', () => {
      render(<CommentsSidebar isOpen={true} comments={mockComments} />);

      expect(screen.getAllByText('Rezolvat').length).toBeGreaterThan(0);
      expect(screen.getAllByText('Răspunde').length).toBeGreaterThan(0);
    });

    it('renders Romanian diacritics in comment content', () => {
      render(<CommentsSidebar isOpen={true} comments={mockComments} />);

      expect(screen.getByText(/clauză/)).toBeInTheDocument();
      expect(screen.getByText(/adăugarea/)).toBeInTheDocument();
    });

    it('renders Romanian diacritics in empty state', () => {
      render(<CommentsSidebar isOpen={true} comments={[]} />);

      expect(screen.getByText('Niciun comentariu încă')).toBeInTheDocument();
      expect(
        screen.getByText('Adaugă primul comentariu pentru acest document')
      ).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('has proper ARIA labels for toggle buttons', () => {
      const { rerender } = render(<CommentsSidebar isOpen={false} />);

      expect(screen.getByLabelText('Deschide comentarii')).toBeInTheDocument();

      rerender(<CommentsSidebar isOpen={true} />);

      expect(screen.getByLabelText('Închide comentarii')).toBeInTheDocument();
    });

    it('has proper title attributes on toggle buttons', () => {
      const { rerender } = render(<CommentsSidebar isOpen={false} />);

      const openButton = screen.getByLabelText('Deschide comentarii');
      expect(openButton).toHaveAttribute('title', 'Deschide comentarii');

      rerender(<CommentsSidebar isOpen={true} />);

      const closeButton = screen.getByLabelText('Închide comentarii');
      expect(closeButton).toHaveAttribute('title', 'Închide comentarii');
    });

    it('textarea has proper placeholder', () => {
      render(<CommentsSidebar isOpen={true} />);

      fireEvent.click(screen.getByText('+ Adaugă comentariu'));

      const textarea = screen.getByPlaceholderText('Scrie un comentariu...');
      expect(textarea).toHaveAttribute('placeholder', 'Scrie un comentariu...');
    });

    it('textarea is autofocused when form opens', () => {
      render(<CommentsSidebar isOpen={true} />);

      fireEvent.click(screen.getByText('+ Adaugă comentariu'));

      const textarea = screen.getByPlaceholderText('Scrie un comentariu...');
      expect(textarea).toHaveAttribute('autoFocus');
    });
  });

  describe('Props', () => {
    it('uses default isOpen value of false', () => {
      render(<CommentsSidebar />);

      expect(screen.getByLabelText('Deschide comentarii')).toBeInTheDocument();
    });

    it('uses mock comments by default', () => {
      render(<CommentsSidebar isOpen={true} />);

      // Should render default mock comments
      expect(screen.getByText('Elena Popescu')).toBeInTheDocument();
    });

    it('works without onToggle handler', () => {
      render(<CommentsSidebar isOpen={false} />);

      const button = screen.getByLabelText('Deschide comentarii');

      expect(() => fireEvent.click(button)).not.toThrow();
    });

    it('accepts custom comments', () => {
      const customComments: Comment[] = [
        {
          id: 'custom-1',
          author: { name: 'Custom Author' },
          text: 'Custom text',
          timestamp: 'now',
          resolved: false,
        },
      ];

      render(<CommentsSidebar isOpen={true} comments={customComments} />);

      expect(screen.getByText('Custom Author')).toBeInTheDocument();
      expect(screen.getByText('Custom text')).toBeInTheDocument();
    });
  });

  describe('Comment Filtering', () => {
    it('separates active and resolved comments correctly', () => {
      render(<CommentsSidebar isOpen={true} comments={mockComments} />);

      // Should show 2 active comments with action buttons
      const resolveButtons = screen.getAllByText('Rezolvat');
      expect(resolveButtons.length).toBe(2);

      // Should show 1 resolved comment in separate section
      expect(screen.getByText('Rezolvate (1)')).toBeInTheDocument();
    });

    it('shows correct count in badge', () => {
      render(<CommentsSidebar isOpen={true} comments={mockComments} />);

      // Badge should show count of active comments only
      const badges = screen.getAllByText('2');
      expect(badges.length).toBeGreaterThan(0);
    });
  });
});
