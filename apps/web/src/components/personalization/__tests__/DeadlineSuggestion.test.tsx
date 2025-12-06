/**
 * DeadlineSuggestion Component Tests
 * Story 5.6: AI Learning and Personalization - Task 43
 */

import { render, screen, fireEvent } from '@testing-library/react';
import {
  DeadlineSuggestion,
  DeadlineSuggestionInline,
  DeadlineSuggestionSkeleton,
} from '../DeadlineSuggestion';
import { useSuggestDeadline } from '@/hooks/useResponsePatterns';

// Mock the hooks - only mock the hook, not the helper functions
jest.mock('@/hooks/useResponsePatterns', () => ({
  ...jest.requireActual('@/hooks/useResponsePatterns'),
  useSuggestDeadline: jest.fn(),
}));

const mockSuggestion = {
  suggestedDate: '2024-12-20T00:00:00.000Z',
  confidence: 0.85,
  basedOnSamples: 25,
  reasoning: 'Based on your average completion time of 3 days for similar Research tasks',
};

describe('DeadlineSuggestion', () => {
  const mockOnAccept = jest.fn();
  const mockOnDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useSuggestDeadline as jest.Mock).mockReturnValue({
      suggestion: mockSuggestion,
      loading: false,
      hasSuggestion: true,
    });
  });

  describe('rendering', () => {
    it('renders suggestion when data is available', () => {
      render(
        <DeadlineSuggestion
          taskType="Research"
          onAccept={mockOnAccept}
        />
      );

      expect(screen.getByText('Sugestie AI pentru termen')).toBeInTheDocument();
      expect(screen.getByText('Înaltă')).toBeInTheDocument(); // High confidence label
      expect(screen.getByText(mockSuggestion.reasoning)).toBeInTheDocument();
    });

    it('does not render when loading', () => {
      (useSuggestDeadline as jest.Mock).mockReturnValue({
        suggestion: null,
        loading: true,
        hasSuggestion: false,
      });

      const { container } = render(
        <DeadlineSuggestion
          taskType="Research"
          onAccept={mockOnAccept}
        />
      );

      expect(container).toBeEmptyDOMElement();
    });

    it('does not render when no suggestion', () => {
      (useSuggestDeadline as jest.Mock).mockReturnValue({
        suggestion: null,
        loading: false,
        hasSuggestion: false,
      });

      const { container } = render(
        <DeadlineSuggestion
          taskType="Research"
          onAccept={mockOnAccept}
        />
      );

      expect(container).toBeEmptyDOMElement();
    });

    it('does not render when current due date matches suggestion', () => {
      const { container } = render(
        <DeadlineSuggestion
          taskType="Research"
          currentDueDate="2024-12-20"
          onAccept={mockOnAccept}
        />
      );

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('interactions', () => {
    it('calls onAccept with ISO date when Accept button is clicked', () => {
      render(
        <DeadlineSuggestion
          taskType="Research"
          onAccept={mockOnAccept}
        />
      );

      const acceptButton = screen.getByRole('button', { name: /acceptă/i });
      fireEvent.click(acceptButton);

      expect(mockOnAccept).toHaveBeenCalledWith('2024-12-20');
    });

    it('calls onDismiss and hides suggestion when Ignore button is clicked', () => {
      render(
        <DeadlineSuggestion
          taskType="Research"
          onAccept={mockOnAccept}
          onDismiss={mockOnDismiss}
        />
      );

      // Button has aria-label "Respinge sugestia"
      const ignoreButton = screen.getByRole('button', { name: /respinge sugestia/i });
      fireEvent.click(ignoreButton);

      expect(mockOnDismiss).toHaveBeenCalled();
      // After dismissal, the component should not be visible
      expect(screen.queryByText('Sugestie AI pentru termen')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper aria labels', () => {
      render(
        <DeadlineSuggestion
          taskType="Research"
          onAccept={mockOnAccept}
        />
      );

      expect(screen.getByRole('region')).toHaveAttribute(
        'aria-label',
        'Sugestie termen limită AI'
      );
    });

    it('accept button has descriptive aria-label', () => {
      render(
        <DeadlineSuggestion
          taskType="Research"
          onAccept={mockOnAccept}
        />
      );

      const acceptButton = screen.getByRole('button', { name: /acceptă termenul sugerat/i });
      expect(acceptButton).toBeInTheDocument();
    });
  });

  describe('confidence levels', () => {
    it('displays confidence label based on confidence score', () => {
      // Default mock has confidence 0.85 which should show "Înaltă"
      render(
        <DeadlineSuggestion
          taskType="Research"
          onAccept={mockOnAccept}
        />
      );

      // 0.85 confidence should render "Înaltă" (High)
      expect(screen.getByText('Înaltă')).toBeInTheDocument();
    });
  });
});

describe('DeadlineSuggestionInline', () => {
  const mockOnAccept = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useSuggestDeadline as jest.Mock).mockReturnValue({
      suggestion: mockSuggestion,
      loading: false,
      hasSuggestion: true,
    });
  });

  it('renders compact inline suggestion', () => {
    render(
      <DeadlineSuggestionInline
        taskType="Research"
        onAccept={mockOnAccept}
      />
    );

    // Should show short date format
    expect(screen.getByText(/sugerare/i)).toBeInTheDocument();
  });

  it('calls onAccept when clicked', () => {
    render(
      <DeadlineSuggestionInline
        taskType="Research"
        onAccept={mockOnAccept}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);

    expect(mockOnAccept).toHaveBeenCalledWith('2024-12-20');
  });

  it('does not render when current due date matches suggestion', () => {
    const { container } = render(
      <DeadlineSuggestionInline
        taskType="Research"
        currentDueDate="2024-12-20"
        onAccept={mockOnAccept}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });
});

describe('DeadlineSuggestionSkeleton', () => {
  it('renders loading skeleton', () => {
    render(<DeadlineSuggestionSkeleton />);

    // Check for skeleton animation class
    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });
});
