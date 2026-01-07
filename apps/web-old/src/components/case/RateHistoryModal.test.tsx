/**
 * RateHistoryModal Component Tests
 * Story 2.8.1: Billing & Rate Management - Task 23
 */

import { render, screen, fireEvent, within } from '@testing-library/react';
import { RateHistoryModal } from './RateHistoryModal';
import type { RateHistoryEntry } from '@/hooks/useRateHistory';

// Mock rate history hook
const mockHistoryData: RateHistoryEntry[] = [
  {
    id: '1',
    changedAt: new Date('2024-01-15T10:30:00'),
    changedBy: {
      id: 'user1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
    },
    rateType: 'partner',
    oldRate: 50000, // $500.00
    newRate: 55000, // $550.00
  },
  {
    id: '2',
    changedAt: new Date('2024-01-10T14:20:00'),
    changedBy: {
      id: 'user2',
      firstName: 'Jane',
      lastName: 'Smith',
      email: 'jane.smith@example.com',
    },
    rateType: 'associate',
    oldRate: 30000, // $300.00
    newRate: 28000, // $280.00
  },
  {
    id: '3',
    changedAt: new Date('2024-01-05T09:15:00'),
    changedBy: {
      id: 'user1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
    },
    rateType: 'fixed',
    oldRate: 100000, // $1000.00
    newRate: 120000, // $1200.00
  },
];

jest.mock('@/hooks/useRateHistory', () => ({
  useRateHistory: jest.fn(() => ({
    history: mockHistoryData,
    loading: false,
    error: null,
  })),
}));

const mockCaseId = 'test-case-123';
const mockOnClose = jest.fn();

const defaultProps = {
  caseId: mockCaseId,
  isOpen: true,
  onClose: mockOnClose,
};

describe('RateHistoryModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders nothing when isOpen is false', () => {
      const { container } = render(<RateHistoryModal {...defaultProps} isOpen={false} />);
      expect(container.firstChild).toBeNull();
    });

    it('renders modal when isOpen is true', () => {
      render(<RateHistoryModal {...defaultProps} />);
      expect(screen.getByText('Rate Change History')).toBeInTheDocument();
    });

    it('displays search input', () => {
      render(<RateHistoryModal {...defaultProps} />);
      expect(screen.getByPlaceholderText(/search by user name or email/i)).toBeInTheDocument();
    });

    it('displays rate type filter dropdown', () => {
      render(<RateHistoryModal {...defaultProps} />);
      expect(screen.getByLabelText(/filter by type/i)).toBeInTheDocument();
    });
  });

  describe('History Timeline Display', () => {
    it('displays all history entries', () => {
      render(<RateHistoryModal {...defaultProps} />);
      expect(screen.getByText('Partner Rate Updated')).toBeInTheDocument();
      expect(screen.getByText('Associate Rate Updated')).toBeInTheDocument();
      expect(screen.getByText('Fixed Amount Updated')).toBeInTheDocument();
    });

    it('shows user who made the change', () => {
      render(<RateHistoryModal {...defaultProps} />);
      expect(screen.getByText(/john doe/i)).toBeInTheDocument();
      expect(screen.getByText(/jane smith/i)).toBeInTheDocument();
    });

    it('displays old and new rates', () => {
      render(<RateHistoryModal {...defaultProps} />);
      expect(screen.getByText('$500.00')).toBeInTheDocument();
      expect(screen.getByText('$550.00')).toBeInTheDocument();
    });

    it('shows increase indicator for rate increases', () => {
      render(<RateHistoryModal {...defaultProps} />);
      expect(screen.getByText('Increased')).toBeInTheDocument();
    });

    it('shows decrease indicator for rate decreases', () => {
      render(<RateHistoryModal {...defaultProps} />);
      expect(screen.getByText('Decreased')).toBeInTheDocument();
    });

    it('displays result count', () => {
      render(<RateHistoryModal {...defaultProps} />);
      expect(screen.getByText('3 changes')).toBeInTheDocument();
    });

    it('formats dates correctly', () => {
      render(<RateHistoryModal {...defaultProps} />);
      expect(screen.getByText(/Jan 15, 2024/i)).toBeInTheDocument();
    });
  });

  describe('Filtering by Rate Type', () => {
    it('shows all rate types in dropdown', () => {
      render(<RateHistoryModal {...defaultProps} />);
      const select = screen.getByLabelText(/filter by type/i);

      expect(within(select).getByText('All Changes')).toBeInTheDocument();
      expect(within(select).getByText('Partner Rate')).toBeInTheDocument();
      expect(within(select).getByText('Associate Rate')).toBeInTheDocument();
      expect(within(select).getByText('Paralegal Rate')).toBeInTheDocument();
      expect(within(select).getByText('Fixed Amount')).toBeInTheDocument();
    });

    it('filters entries by selected rate type', () => {
      render(<RateHistoryModal {...defaultProps} />);

      const select = screen.getByLabelText(/filter by type/i);
      fireEvent.change(select, { target: { value: 'partner' } });

      expect(screen.getByText('Partner Rate Updated')).toBeInTheDocument();
      expect(screen.queryByText('Associate Rate Updated')).not.toBeInTheDocument();
      expect(screen.queryByText('Fixed Amount Updated')).not.toBeInTheDocument();
      expect(screen.getByText('1 change')).toBeInTheDocument();
    });

    it('shows all entries when "All Changes" selected', () => {
      render(<RateHistoryModal {...defaultProps} />);

      const select = screen.getByLabelText(/filter by type/i);
      fireEvent.change(select, { target: { value: 'partner' } });
      fireEvent.change(select, { target: { value: 'all' } });

      expect(screen.getByText('3 changes')).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('filters entries by user first name', () => {
      render(<RateHistoryModal {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search by user name or email/i);
      fireEvent.change(searchInput, { target: { value: 'John' } });

      expect(screen.getByText('Partner Rate Updated')).toBeInTheDocument();
      expect(screen.getByText('Fixed Amount Updated')).toBeInTheDocument();
      expect(screen.queryByText('Associate Rate Updated')).not.toBeInTheDocument();
      expect(screen.getByText('2 changes')).toBeInTheDocument();
    });

    it('filters entries by user last name', () => {
      render(<RateHistoryModal {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search by user name or email/i);
      fireEvent.change(searchInput, { target: { value: 'Smith' } });

      expect(screen.queryByText('Partner Rate Updated')).not.toBeInTheDocument();
      expect(screen.getByText('Associate Rate Updated')).toBeInTheDocument();
      expect(screen.getByText('1 change')).toBeInTheDocument();
    });

    it('filters entries by email', () => {
      render(<RateHistoryModal {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search by user name or email/i);
      fireEvent.change(searchInput, { target: { value: 'jane.smith@example.com' } });

      expect(screen.getByText('Associate Rate Updated')).toBeInTheDocument();
      expect(screen.getByText('1 change')).toBeInTheDocument();
    });

    it('is case-insensitive', () => {
      render(<RateHistoryModal {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search by user name or email/i);
      fireEvent.change(searchInput, { target: { value: 'JOHN' } });

      expect(screen.getByText('2 changes')).toBeInTheDocument();
    });

    it('shows no results message when search has no matches', () => {
      render(<RateHistoryModal {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search by user name or email/i);
      fireEvent.change(searchInput, { target: { value: 'NonexistentUser' } });

      expect(screen.getByText(/no changes match your filters/i)).toBeInTheDocument();
    });
  });

  describe('Combined Filtering and Search', () => {
    it('applies both filters simultaneously', () => {
      render(<RateHistoryModal {...defaultProps} />);

      const select = screen.getByLabelText(/filter by type/i);
      const searchInput = screen.getByPlaceholderText(/search by user name or email/i);

      fireEvent.change(select, { target: { value: 'partner' } });
      fireEvent.change(searchInput, { target: { value: 'John' } });

      expect(screen.getByText('Partner Rate Updated')).toBeInTheDocument();
      expect(screen.getByText('1 change')).toBeInTheDocument();
    });

    it('shows clear filters button when no results', () => {
      render(<RateHistoryModal {...defaultProps} />);

      const searchInput = screen.getByPlaceholderText(/search by user name or email/i);
      fireEvent.change(searchInput, { target: { value: 'NonexistentUser' } });

      expect(screen.getByText('Clear filters')).toBeInTheDocument();
    });

    it('clears filters when clear button clicked', () => {
      render(<RateHistoryModal {...defaultProps} />);

      const select = screen.getByLabelText(/filter by type/i);
      const searchInput = screen.getByPlaceholderText(/search by user name or email/i);

      fireEvent.change(select, { target: { value: 'partner' } });
      fireEvent.change(searchInput, { target: { value: 'Test' } });

      const clearButton = screen.getByText('Clear filters');
      fireEvent.click(clearButton);

      expect((select as HTMLSelectElement).value).toBe('all');
      expect((searchInput as HTMLInputElement).value).toBe('');
    });
  });

  describe('Empty States', () => {
    it('shows empty state when no history exists', () => {
      const useRateHistory = require('@/hooks/useRateHistory').useRateHistory;
      useRateHistory.mockReturnValue({
        history: [],
        loading: false,
        error: null,
      });

      render(<RateHistoryModal {...defaultProps} />);
      expect(screen.getByText('No rate changes')).toBeInTheDocument();
      expect(screen.getByText(/this case has no rate change history yet/i)).toBeInTheDocument();
    });
  });

  describe('Loading State', () => {
    it('shows loading spinner when loading', () => {
      const useRateHistory = require('@/hooks/useRateHistory').useRateHistory;
      useRateHistory.mockReturnValue({
        history: [],
        loading: true,
        error: null,
      });

      render(<RateHistoryModal {...defaultProps} />);
      const spinner = document.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('shows error message when fetch fails', () => {
      const useRateHistory = require('@/hooks/useRateHistory').useRateHistory;
      useRateHistory.mockReturnValue({
        history: [],
        loading: false,
        error: { message: 'Failed to fetch history' },
      });

      render(<RateHistoryModal {...defaultProps} />);
      expect(screen.getByText('Failed to load rate history')).toBeInTheDocument();
      expect(screen.getByText('Failed to fetch history')).toBeInTheDocument();
    });
  });

  describe('Modal Actions', () => {
    it('closes modal when Close button clicked', () => {
      render(<RateHistoryModal {...defaultProps} />);
      const closeButton = screen.getByText('Close');
      fireEvent.click(closeButton);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('closes modal when X button clicked', () => {
      render(<RateHistoryModal {...defaultProps} />);
      const xButton = screen.getByLabelText('Close');
      fireEvent.click(xButton);
      expect(mockOnClose).toHaveBeenCalled();
    });

    it('closes modal when clicking backdrop', () => {
      render(<RateHistoryModal {...defaultProps} />);
      const backdrop = screen.getByText('Rate Change History').closest('.fixed');
      if (backdrop) {
        fireEvent.click(backdrop);
        expect(mockOnClose).toHaveBeenCalled();
      }
    });

    it('does not close modal when clicking modal content', () => {
      render(<RateHistoryModal {...defaultProps} />);
      const modalContent = screen.getByText('Rate Change History').closest('.bg-white');
      if (modalContent) {
        fireEvent.click(modalContent);
        expect(mockOnClose).not.toHaveBeenCalled();
      }
    });
  });

  describe('Timeline Formatting', () => {
    it('displays timeline connector lines between entries', () => {
      render(<RateHistoryModal {...defaultProps} />);
      const connectors = document.querySelectorAll('.bg-gray-200');
      expect(connectors.length).toBeGreaterThan(0);
    });

    it('shows variance amount for rate changes', () => {
      render(<RateHistoryModal {...defaultProps} />);
      // Partner rate: $550 - $500 = $50 increase
      expect(screen.getByText(/\+\$50\.00/)).toBeInTheDocument();
    });
  });
});
