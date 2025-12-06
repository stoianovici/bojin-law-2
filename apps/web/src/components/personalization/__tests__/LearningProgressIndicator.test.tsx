/**
 * LearningProgressIndicator Component Tests
 * Story 5.6: AI Learning and Personalization - Task 43
 */

import { render, screen } from '@testing-library/react';
import {
  LearningProgressIndicator,
  LearningProgressBadge,
  LearningProgressMini,
} from '../LearningProgressIndicator';
import { useWritingStyleProfile } from '@/hooks/useWritingStyle';
import { useSnippets } from '@/hooks/usePersonalSnippets';
import { useTaskPatterns } from '@/hooks/useTaskPatterns';
import { useDocumentPreferences } from '@/hooks/useDocumentPreferences';
import { useResponsePatterns } from '@/hooks/useResponsePatterns';

// Mock all the hooks
jest.mock('@/hooks/useWritingStyle');
jest.mock('@/hooks/usePersonalSnippets');
jest.mock('@/hooks/useTaskPatterns');
jest.mock('@/hooks/useDocumentPreferences');
jest.mock('@/hooks/useResponsePatterns');

const mockWritingProfile = {
  id: 'profile-1',
  sampleCount: 30,
  formalityScore: 0.7,
  sentenceLengthAvg: 15,
  vocabularyLevel: 'professional',
  preferredPhrases: ['conform', 'în conformitate cu'],
  confidence: 0.8,
};

describe('LearningProgressIndicator', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock values - moderate progress
    (useWritingStyleProfile as jest.Mock).mockReturnValue({
      profile: mockWritingProfile,
      learningProgress: 60,
    });
    (useSnippets as jest.Mock).mockReturnValue({
      count: 5,
    });
    (useTaskPatterns as jest.Mock).mockReturnValue({
      count: 4,
      activeCount: 3,
    });
    (useDocumentPreferences as jest.Mock).mockReturnValue({
      count: 2,
    });
    (useResponsePatterns as jest.Mock).mockReturnValue({
      hasPatterns: true,
      patterns: Array(5).fill({ taskType: 'Research', averageResponseHours: 24 }),
    });
  });

  describe('rendering', () => {
    it('renders the main progress indicator', () => {
      render(<LearningProgressIndicator />);

      expect(screen.getByText('Progres AI')).toBeInTheDocument();
    });

    it('displays circular gauge with overall percentage', () => {
      render(<LearningProgressIndicator />);

      // Check for the gauge percentage
      const percentage = screen.getByRole('progressbar');
      expect(percentage).toBeInTheDocument();
    });

    it('shows category breakdown when showDetails is true', () => {
      render(<LearningProgressIndicator showDetails />);

      expect(screen.getByText('Detalii pe categorii')).toBeInTheDocument();
      expect(screen.getByText('Stil de scriere')).toBeInTheDocument();
      expect(screen.getByText('Snippet-uri personale')).toBeInTheDocument();
      expect(screen.getByText('Pattern-uri task')).toBeInTheDocument();
      expect(screen.getByText('Preferințe documente')).toBeInTheDocument();
      expect(screen.getByText('Pattern-uri răspuns')).toBeInTheDocument();
    });

    it('hides category breakdown when showDetails is false', () => {
      render(<LearningProgressIndicator showDetails={false} />);

      expect(screen.queryByText('Detalii pe categorii')).not.toBeInTheDocument();
    });

    it('shows encouraging message based on progress', () => {
      render(<LearningProgressIndicator />);

      // With moderate progress, should show an encouraging message
      // The message is displayed below the circular gauge
      expect(
        screen.getByText(/continuă să folosești|progres bun/i)
      ).toBeInTheDocument();
    });
  });

  describe('progress calculation', () => {
    it('shows high progress when all categories are complete', () => {
      (useWritingStyleProfile as jest.Mock).mockReturnValue({
        profile: { ...mockWritingProfile, sampleCount: 50 },
        learningProgress: 100,
      });
      (useSnippets as jest.Mock).mockReturnValue({ count: 10 });
      (useTaskPatterns as jest.Mock).mockReturnValue({ count: 5, activeCount: 5 });
      (useDocumentPreferences as jest.Mock).mockReturnValue({ count: 3 });
      (useResponsePatterns as jest.Mock).mockReturnValue({
        hasPatterns: true,
        patterns: Array(10).fill({ taskType: 'Research' }),
      });

      render(<LearningProgressIndicator />);

      // Should show expert count message (5 din 5 categorii expert)
      expect(screen.getByText(/din.*categorii/i)).toBeInTheDocument();
    });

    it('shows low progress when categories have minimal data', () => {
      (useWritingStyleProfile as jest.Mock).mockReturnValue({
        profile: null,
        learningProgress: 0,
      });
      (useSnippets as jest.Mock).mockReturnValue({ count: 0 });
      (useTaskPatterns as jest.Mock).mockReturnValue({ count: 0, activeCount: 0 });
      (useDocumentPreferences as jest.Mock).mockReturnValue({ count: 0 });
      (useResponsePatterns as jest.Mock).mockReturnValue({
        hasPatterns: false,
        patterns: [],
      });

      render(<LearningProgressIndicator />);

      // Should show beginner message
      expect(screen.getByText(/începe|abia/i)).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has accessible progress bar with aria attributes', () => {
      render(<LearningProgressIndicator />);

      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuenow');
      expect(progressbar).toHaveAttribute('aria-valuemin', '0');
      expect(progressbar).toHaveAttribute('aria-valuemax', '100');
    });

    it('provides screen reader summary', () => {
      render(<LearningProgressIndicator showDetails />);

      // Check for SR-only summary
      const srContent = document.querySelector('.sr-only');
      expect(srContent).toBeInTheDocument();
      expect(srContent).toHaveTextContent('Sumar progres');
    });
  });
});

describe('LearningProgressBadge', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useWritingStyleProfile as jest.Mock).mockReturnValue({
      learningProgress: 60,
    });
    (useSnippets as jest.Mock).mockReturnValue({ count: 5 });
    (useTaskPatterns as jest.Mock).mockReturnValue({ activeCount: 3 });
  });

  it('renders compact badge with percentage', () => {
    render(<LearningProgressBadge />);

    // Should show percentage
    expect(screen.getByText(/%/)).toBeInTheDocument();
  });

  it('has appropriate title attribute', () => {
    render(<LearningProgressBadge />);

    const badge = screen.getByTitle(/ai learning/i);
    expect(badge).toBeInTheDocument();
  });

  describe('color coding', () => {
    it('shows green color for high progress', () => {
      (useWritingStyleProfile as jest.Mock).mockReturnValue({ learningProgress: 100 });
      (useSnippets as jest.Mock).mockReturnValue({ count: 10 });
      (useTaskPatterns as jest.Mock).mockReturnValue({ activeCount: 5 });

      render(<LearningProgressBadge />);

      const badge = document.querySelector('.bg-green-100');
      expect(badge).toBeInTheDocument();
    });

    it('shows yellow color for medium progress', () => {
      (useWritingStyleProfile as jest.Mock).mockReturnValue({ learningProgress: 50 });
      (useSnippets as jest.Mock).mockReturnValue({ count: 5 });
      (useTaskPatterns as jest.Mock).mockReturnValue({ activeCount: 2 });

      render(<LearningProgressBadge />);

      const badge = document.querySelector('.bg-yellow-100');
      expect(badge).toBeInTheDocument();
    });

    it('shows gray color for low progress', () => {
      (useWritingStyleProfile as jest.Mock).mockReturnValue({ learningProgress: 10 });
      (useSnippets as jest.Mock).mockReturnValue({ count: 1 });
      (useTaskPatterns as jest.Mock).mockReturnValue({ activeCount: 0 });

      render(<LearningProgressBadge />);

      const badge = document.querySelector('.bg-gray-100');
      expect(badge).toBeInTheDocument();
    });
  });
});

describe('LearningProgressMini', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useWritingStyleProfile as jest.Mock).mockReturnValue({ learningProgress: 60 });
    (useSnippets as jest.Mock).mockReturnValue({ count: 5 });
    (useTaskPatterns as jest.Mock).mockReturnValue({ activeCount: 3 });
    (useDocumentPreferences as jest.Mock).mockReturnValue({ count: 2 });
  });

  it('renders mini widget with title', () => {
    render(<LearningProgressMini />);

    expect(screen.getByText('AI Learning')).toBeInTheDocument();
  });

  it('shows milestone badges for completed categories', () => {
    (useWritingStyleProfile as jest.Mock).mockReturnValue({ learningProgress: 60 });
    (useSnippets as jest.Mock).mockReturnValue({ count: 6 });
    (useTaskPatterns as jest.Mock).mockReturnValue({ activeCount: 4 });
    (useDocumentPreferences as jest.Mock).mockReturnValue({ count: 3 });

    render(<LearningProgressMini />);

    // Should show badges for milestones met
    expect(screen.getByText('Stil scriere')).toBeInTheDocument();
    expect(screen.getByText('Snippet-uri')).toBeInTheDocument();
    expect(screen.getByText('Pattern-uri')).toBeInTheDocument();
    expect(screen.getByText('Documente')).toBeInTheDocument();
  });

  it('shows getting started message when no milestones', () => {
    (useWritingStyleProfile as jest.Mock).mockReturnValue({ learningProgress: 10 });
    (useSnippets as jest.Mock).mockReturnValue({ count: 0 });
    (useTaskPatterns as jest.Mock).mockReturnValue({ activeCount: 0 });
    (useDocumentPreferences as jest.Mock).mockReturnValue({ count: 0 });

    render(<LearningProgressMini />);

    expect(
      screen.getByText(/începe să folosești/i)
    ).toBeInTheDocument();
  });
});
