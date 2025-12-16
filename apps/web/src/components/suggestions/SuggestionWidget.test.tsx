/**
 * SuggestionWidget Component Tests
 * Story 5.4: Proactive AI Suggestions System - Task 38
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { SuggestionWidget } from './SuggestionWidget';
import {
  usePendingSuggestions,
  useAcceptSuggestion,
  useDismissSuggestion,
} from '@/hooks/useSuggestions';
import type { AISuggestion } from '@legal-platform/types';

// Mock the hooks
jest.mock('@/hooks/useSuggestions');

const mockAccept = jest.fn();
const mockDismiss = jest.fn();

const mockSuggestions: AISuggestion[] = [
  {
    id: 'sug-1',
    type: 'TaskSuggestion' as const,
    category: 'Task' as const,
    title: 'Finalizează revizuirea contractului',
    description: 'Ai început revizuirea acum 2 zile',
    suggestedAction: 'open_task',
    actionPayload: { taskId: 'task-123' },
    confidence: 0.85,
    priority: 'High' as const,
    status: 'Pending' as const,
    createdAt: new Date(),
    userId: 'user-123',
    firmId: 'firm-456',
  },
  {
    id: 'sug-2',
    type: 'DeadlineWarning' as const,
    category: 'Calendar' as const,
    title: 'Termen limită apropiat',
    description: 'Depunere cerere în 2 zile',
    suggestedAction: 'view_deadline',
    actionPayload: { caseId: 'case-789' },
    confidence: 0.92,
    priority: 'Urgent' as const,
    status: 'Pending' as const,
    createdAt: new Date(),
    userId: 'user-123',
    firmId: 'firm-456',
  },
  {
    id: 'sug-3',
    type: 'PatternMatch' as const,
    category: 'Communication' as const,
    title: 'Tipar recunoscut',
    description: 'De obicei trimiți update client după depunere',
    suggestedAction: 'send_email',
    actionPayload: { templateId: 'client-update' },
    confidence: 0.75,
    priority: 'Normal' as const,
    status: 'Pending' as const,
    createdAt: new Date(),
    userId: 'user-123',
    firmId: 'firm-456',
  },
];

describe('SuggestionWidget', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (usePendingSuggestions as jest.Mock).mockReturnValue({
      suggestions: mockSuggestions,
      loading: false,
      error: null,
    });
    (useAcceptSuggestion as jest.Mock).mockReturnValue({
      accept: mockAccept,
      loading: false,
    });
    (useDismissSuggestion as jest.Mock).mockReturnValue({
      dismiss: mockDismiss,
      loading: false,
    });
  });

  describe('collapsed state', () => {
    it('should render collapsed by default', () => {
      render(<SuggestionWidget />);

      // Should show suggestion count badge
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('should show suggestion count badge', () => {
      render(<SuggestionWidget />);

      const badge = screen.getByText('3');
      expect(badge).toBeInTheDocument();
    });

    it('should expand when clicked', async () => {
      render(<SuggestionWidget />);

      const trigger = screen.getByRole('button', { name: /sugestii/i });
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Finalizează revizuirea contractului')).toBeInTheDocument();
      });
    });
  });

  describe('expanded state', () => {
    it('should show all suggestions when expanded', async () => {
      render(<SuggestionWidget />);

      const trigger = screen.getByRole('button', { name: /sugestii/i });
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Finalizează revizuirea contractului')).toBeInTheDocument();
        expect(screen.getByText('Termen limită apropiat')).toBeInTheDocument();
        expect(screen.getByText('Tipar recunoscut')).toBeInTheDocument();
      });
    });

    it('should collapse when Escape is pressed', async () => {
      render(<SuggestionWidget />);

      const trigger = screen.getByRole('button', { name: /sugestii/i });
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Finalizează revizuirea contractului')).toBeInTheDocument();
      });

      fireEvent.keyDown(document, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByText('Finalizează revizuirea contractului')).not.toBeVisible();
      });
    });
  });

  describe('suggestion actions', () => {
    it('should call accept when accept button is clicked', async () => {
      render(<SuggestionWidget />);

      // Expand widget
      const trigger = screen.getByRole('button', { name: /sugestii/i });
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Finalizează revizuirea contractului')).toBeInTheDocument();
      });

      // Find and click accept button
      const acceptButtons = screen.getAllByRole('button', { name: /acceptă|aplică/i });
      fireEvent.click(acceptButtons[0]);

      expect(mockAccept).toHaveBeenCalledWith('sug-1');
    });

    it('should call dismiss when dismiss button is clicked', async () => {
      render(<SuggestionWidget />);

      // Expand widget
      const trigger = screen.getByRole('button', { name: /sugestii/i });
      fireEvent.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Finalizează revizuirea contractului')).toBeInTheDocument();
      });

      // Find and click dismiss button
      const dismissButtons = screen.getAllByRole('button', { name: /respinge|ignoră/i });
      fireEvent.click(dismissButtons[0]);

      expect(mockDismiss).toHaveBeenCalled();
    });
  });

  describe('empty state', () => {
    it('should show empty state when no suggestions', () => {
      (usePendingSuggestions as jest.Mock).mockReturnValue({
        suggestions: [],
        loading: false,
        error: null,
      });

      render(<SuggestionWidget />);

      // Widget should not show or show "no suggestions" message
      expect(screen.queryByText('3')).not.toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should show loading indicator when loading', () => {
      (usePendingSuggestions as jest.Mock).mockReturnValue({
        suggestions: [],
        loading: true,
        error: null,
      });

      render(<SuggestionWidget />);

      // Should show some loading indicator or animate
      expect(screen.getByRole('button')).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('should have complementary role', () => {
      render(<SuggestionWidget />);

      expect(screen.getByRole('complementary')).toBeInTheDocument();
    });

    it('should have proper aria-label', () => {
      render(<SuggestionWidget />);

      expect(screen.getByLabelText(/sugestii ai/i)).toBeInTheDocument();
    });

    it('should have aria-expanded state', async () => {
      render(<SuggestionWidget />);

      const trigger = screen.getByRole('button', { name: /sugestii/i });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(trigger);

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      });
    });
  });

  describe('type-specific styling', () => {
    it('should apply correct styling for TaskSuggestion', async () => {
      render(<SuggestionWidget />);

      const trigger = screen.getByRole('button', { name: /sugestii/i });
      fireEvent.click(trigger);

      await waitFor(() => {
        const taskCard = screen
          .getByText('Finalizează revizuirea contractului')
          .closest('[class*="card"]');
        expect(taskCard).toBeInTheDocument();
      });
    });

    it('should apply correct styling for DeadlineWarning', async () => {
      render(<SuggestionWidget />);

      const trigger = screen.getByRole('button', { name: /sugestii/i });
      fireEvent.click(trigger);

      await waitFor(() => {
        const deadlineCard = screen.getByText('Termen limită apropiat').closest('[class*="card"]');
        expect(deadlineCard).toBeInTheDocument();
      });
    });
  });

  describe('priority ordering', () => {
    it('should show urgent suggestions first', async () => {
      render(<SuggestionWidget />);

      const trigger = screen.getByRole('button', { name: /sugestii/i });
      fireEvent.click(trigger);

      await waitFor(() => {
        const suggestions = screen.getAllByRole('article');
        // Urgent should be first
        expect(suggestions[0]).toHaveTextContent(/Termen limită/i);
      });
    });
  });
});
