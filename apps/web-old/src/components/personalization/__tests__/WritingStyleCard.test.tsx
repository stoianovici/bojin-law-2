/**
 * WritingStyleCard Component Tests
 * Story 5.6: AI Learning and Personalization - Task 43
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { WritingStyleCard, WritingStyleCardCompact } from '../WritingStyleCard';
import { useWritingStyle } from '@/hooks/useWritingStyle';

// Mock the hook
jest.mock('@/hooks/useWritingStyle');

const mockProfile = {
  id: 'profile-1',
  firmId: 'firm-1',
  userId: 'user-1',
  formalityLevel: 0.75,
  averageSentenceLength: 18,
  vocabularyComplexity: 0.6,
  preferredTone: 'Professional',
  commonPhrases: [
    { phrase: 'Cu stimă', frequency: 10, context: 'closing' },
    { phrase: 'Vă rugăm', frequency: 8, context: 'body' },
    { phrase: 'În conformitate cu', frequency: 5, context: 'legal_term' },
    { phrase: 'Potrivit articolului', frequency: 4, context: 'legal_term' },
    { phrase: 'Cu deosebită considerație', frequency: 3, context: 'closing' },
    { phrase: 'Extra phrase', frequency: 2, context: 'body' },
  ],
  punctuationStyle: {
    useOxfordComma: true,
    preferSemicolons: false,
    useDashes: 'em-dash',
    colonBeforeLists: true,
  },
  languagePatterns: {
    primaryLanguage: 'romanian',
    formalityByLanguage: { romanian: 0.8 },
    preferredGreetingsByLanguage: { romanian: ['Stimate'] },
    legalTermsPreference: 'romanian',
  },
  sampleCount: 25,
  lastAnalyzedAt: new Date('2024-01-15T10:30:00'),
  createdAt: new Date(),
  updatedAt: new Date(),
};

const defaultMockHook = {
  profile: mockProfile,
  loading: false,
  error: null,
  hasProfile: true,
  learningProgress: 75,
  isLearning: true,
  analyzeWritingStyle: jest.fn().mockResolvedValue(undefined),
  resetWritingStyle: jest.fn().mockResolvedValue(undefined),
  analyzing: false,
  resetting: false,
  formalityLabel: 'Formal',
  complexityLabel: 'Mediu',
};

describe('WritingStyleCard', () => {
  const user = userEvent.setup();

  beforeEach(() => {
    jest.clearAllMocks();
    (useWritingStyle as jest.Mock).mockReturnValue(defaultMockHook);
  });

  describe('rendering', () => {
    it('renders the card with title', () => {
      render(<WritingStyleCard />);
      expect(screen.getByText('Stil de Scriere')).toBeInTheDocument();
    });

    it('renders the description', () => {
      render(<WritingStyleCard />);
      expect(
        screen.getByText('Stilul tău de scriere învățat din editările la draft-uri')
      ).toBeInTheDocument();
    });

    it('shows learning badge when still learning', () => {
      render(<WritingStyleCard />);
      expect(screen.getByText('Învățare 75%')).toBeInTheDocument();
    });

    it('shows complete badge when learning is complete', () => {
      (useWritingStyle as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        isLearning: false,
      });
      render(<WritingStyleCard />);
      expect(screen.getByText('Profil Complet')).toBeInTheDocument();
    });

    it('displays formality progress bar', () => {
      render(<WritingStyleCard />);
      expect(screen.getByText('Nivel de Formalitate')).toBeInTheDocument();
      expect(screen.getByText('75%')).toBeInTheDocument();
    });

    it('displays vocabulary complexity progress bar', () => {
      render(<WritingStyleCard />);
      expect(screen.getByText('Complexitate Vocabular')).toBeInTheDocument();
      expect(screen.getByText('60%')).toBeInTheDocument();
    });

    it('displays preferred tone', () => {
      render(<WritingStyleCard />);
      expect(screen.getByText('Ton Preferat')).toBeInTheDocument();
      expect(screen.getByText('Professional')).toBeInTheDocument();
    });

    it('displays sample count', () => {
      render(<WritingStyleCard />);
      expect(screen.getByText('Mostre Analizate')).toBeInTheDocument();
      expect(screen.getByText('25')).toBeInTheDocument();
    });

    it('displays top 5 common phrases', () => {
      render(<WritingStyleCard />);
      expect(screen.getByText('Expresii Frecvente')).toBeInTheDocument();
      // Should show only top 5 sorted by frequency
      expect(screen.getByText('Cu stimă')).toBeInTheDocument();
      expect(screen.getByText('Vă rugăm')).toBeInTheDocument();
      expect(screen.getByText('În conformitate cu')).toBeInTheDocument();
      expect(screen.getByText('Potrivit articolului')).toBeInTheDocument();
      expect(screen.getByText('Cu deosebită considerație')).toBeInTheDocument();
      // 6th phrase should NOT be shown
      expect(screen.queryByText('Extra phrase')).not.toBeInTheDocument();
    });

    it('displays last analyzed date', () => {
      render(<WritingStyleCard />);
      expect(screen.getByText(/Ultima analiză:/)).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('shows loading skeleton when loading', () => {
      (useWritingStyle as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        loading: true,
      });
      render(<WritingStyleCard />);
      // Skeleton elements are present (animated)
      const skeletonContainer = document.querySelector('.animate-pulse');
      expect(skeletonContainer).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty state when no profile exists', () => {
      (useWritingStyle as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        profile: null,
        hasProfile: false,
      });
      render(<WritingStyleCard />);
      expect(screen.getByText('Nicio preferință învățată')).toBeInTheDocument();
      expect(screen.getByText(/Editează draft-uri generate de AI/)).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message when error occurs', () => {
      (useWritingStyle as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        error: new Error('Failed to load'),
      });
      render(<WritingStyleCard />);
      expect(screen.getByText('Eroare la încărcarea profilului de scriere.')).toBeInTheDocument();
    });
  });

  describe('actions', () => {
    it('renders analyze button', () => {
      render(<WritingStyleCard />);
      expect(screen.getByText('Actualizează')).toBeInTheDocument();
    });

    it('calls analyzeWritingStyle when analyze button is clicked', async () => {
      const mockAnalyze = jest.fn().mockResolvedValue(undefined);
      (useWritingStyle as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        analyzeWritingStyle: mockAnalyze,
      });

      render(<WritingStyleCard />);
      await user.click(screen.getByText('Actualizează'));
      expect(mockAnalyze).toHaveBeenCalled();
    });

    it('shows analyzing state while analyzing', () => {
      (useWritingStyle as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        analyzing: true,
      });
      render(<WritingStyleCard />);
      expect(screen.getByText('Analizez...')).toBeInTheDocument();
    });

    it('renders reset button when showResetButton is true', () => {
      render(<WritingStyleCard showResetButton={true} />);
      expect(screen.getByText('Resetează')).toBeInTheDocument();
    });

    it('hides reset button when showResetButton is false', () => {
      render(<WritingStyleCard showResetButton={false} />);
      expect(screen.queryByText('Resetează')).not.toBeInTheDocument();
    });

    it('opens reset confirmation dialog when reset is clicked', async () => {
      render(<WritingStyleCard />);
      await user.click(screen.getByText('Resetează'));
      expect(screen.getByText('Resetează Stilul de Scriere')).toBeInTheDocument();
      expect(
        screen.getByText(/Ești sigur că vrei să resetezi profilul de scriere/)
      ).toBeInTheDocument();
    });

    it('closes dialog when cancel is clicked', async () => {
      render(<WritingStyleCard />);
      await user.click(screen.getByText('Resetează'));
      await user.click(screen.getByText('Anulează'));
      expect(screen.queryByText('Resetează Stilul de Scriere')).not.toBeInTheDocument();
    });

    it('calls resetWritingStyle when reset is confirmed', async () => {
      const mockReset = jest.fn().mockResolvedValue(undefined);
      (useWritingStyle as jest.Mock).mockReturnValue({
        ...defaultMockHook,
        resetWritingStyle: mockReset,
      });

      render(<WritingStyleCard />);
      await user.click(screen.getByText('Resetează'));

      // Click the reset button in the dialog
      const dialogResetButton = screen.getAllByText('Resetează')[1];
      await user.click(dialogResetButton);

      expect(mockReset).toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has accessible progress bars with aria labels', () => {
      render(<WritingStyleCard />);
      const progressBars = screen.getAllByRole('progressbar');
      expect(progressBars.length).toBeGreaterThan(0);
      // Check that at least one has a proper label
      const formalityBar = progressBars.find((bar) =>
        bar.getAttribute('aria-label')?.includes('formalitate')
      );
      expect(formalityBar).toBeDefined();
    });
  });
});

describe('WritingStyleCardCompact', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useWritingStyle as jest.Mock).mockReturnValue(defaultMockHook);
  });

  it('renders compact version with style info', () => {
    render(<WritingStyleCardCompact />);
    expect(screen.getByText('Stil de Scriere')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('shows preferred tone', () => {
    render(<WritingStyleCardCompact />);
    expect(screen.getByText(/Ton:/)).toBeInTheDocument();
    expect(screen.getByText('Professional')).toBeInTheDocument();
  });

  it('shows formality label', () => {
    render(<WritingStyleCardCompact />);
    expect(screen.getByText(/Formalitate:/)).toBeInTheDocument();
    expect(screen.getByText('Formal')).toBeInTheDocument();
  });

  it('shows loading state', () => {
    (useWritingStyle as jest.Mock).mockReturnValue({
      ...defaultMockHook,
      loading: true,
    });
    render(<WritingStyleCardCompact />);
    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('shows empty state when no profile', () => {
    (useWritingStyle as jest.Mock).mockReturnValue({
      ...defaultMockHook,
      hasProfile: false,
      profile: null,
    });
    render(<WritingStyleCardCompact />);
    expect(screen.getByText('Stilul de scriere încă nu a fost învățat')).toBeInTheDocument();
  });

  it('has article role for accessibility', () => {
    render(<WritingStyleCardCompact />);
    expect(screen.getByRole('article')).toBeInTheDocument();
  });
});
