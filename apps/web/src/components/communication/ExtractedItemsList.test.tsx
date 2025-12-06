/**
 * ExtractedItemsList Component Tests
 * Story 5.2: Communication Intelligence Engine - Task 27
 *
 * Tests for displaying and interacting with extracted intelligence items
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExtractedItemsList } from './ExtractedItemsList';

// Mock the hooks
jest.mock('../../hooks/useExtractedItems', () => ({
  useExtractedItems: jest.fn(),
  useConvertToTask: jest.fn(),
  useDismissExtraction: jest.fn(),
}));

import {
  useExtractedItems,
  useConvertToTask,
  useDismissExtraction,
} from '../../hooks/useExtractedItems';

const mockDeadlines = [
  {
    id: 'deadline-1',
    description: 'File motion by deadline',
    dueDate: '2024-12-20',
    confidence: 0.95,
    status: 'Pending',
    emailId: 'email-1',
    caseId: 'case-1',
  },
  {
    id: 'deadline-2',
    description: 'Submit response',
    dueDate: '2024-12-25',
    confidence: 0.85,
    status: 'Pending',
    emailId: 'email-2',
    caseId: 'case-1',
  },
];

const mockCommitments = [
  {
    id: 'commitment-1',
    party: 'Opposing Counsel',
    commitmentText: 'Will provide discovery documents',
    dueDate: '2024-12-22',
    confidence: 0.88,
    status: 'Pending',
    emailId: 'email-1',
    caseId: 'case-1',
  },
];

const mockActionItems = [
  {
    id: 'action-1',
    description: 'Review contract draft',
    suggestedAssignee: 'Legal Team',
    priority: 'High',
    confidence: 0.92,
    status: 'Pending',
    emailId: 'email-1',
    caseId: 'case-1',
  },
];

const mockQuestions = [
  {
    id: 'question-1',
    questionText: 'Can you confirm the meeting time?',
    confidence: 0.9,
    status: 'Pending',
    emailId: 'email-1',
    caseId: 'case-1',
  },
];

describe('ExtractedItemsList', () => {
  const mockConvert = jest.fn();
  const mockDismiss = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();

    (useExtractedItems as jest.Mock).mockReturnValue({
      deadlines: mockDeadlines,
      commitments: mockCommitments,
      actionItems: mockActionItems,
      questions: mockQuestions,
      loading: false,
      error: null,
      refetch: jest.fn(),
    });

    (useConvertToTask as jest.Mock).mockReturnValue({
      convert: mockConvert,
      loading: false,
    });

    (useDismissExtraction as jest.Mock).mockReturnValue({
      dismiss: mockDismiss,
      loading: false,
    });
  });

  describe('rendering', () => {
    it('should render all extraction categories', () => {
      render(<ExtractedItemsList caseId="case-1" />);

      expect(screen.getByText('Deadlines')).toBeInTheDocument();
      expect(screen.getByText('Commitments')).toBeInTheDocument();
      expect(screen.getByText('Action Items')).toBeInTheDocument();
      expect(screen.getByText('Questions')).toBeInTheDocument();
    });

    it('should display deadline items with due dates', () => {
      render(<ExtractedItemsList caseId="case-1" />);

      expect(screen.getByText('File motion by deadline')).toBeInTheDocument();
      expect(screen.getByText('Submit response')).toBeInTheDocument();
    });

    it('should display commitment items with party information', () => {
      render(<ExtractedItemsList caseId="case-1" />);

      expect(screen.getByText('Will provide discovery documents')).toBeInTheDocument();
      expect(screen.getByText(/Opposing Counsel/)).toBeInTheDocument();
    });

    it('should display action items with priority', () => {
      render(<ExtractedItemsList caseId="case-1" />);

      expect(screen.getByText('Review contract draft')).toBeInTheDocument();
      expect(screen.getByText(/High/)).toBeInTheDocument();
    });

    it('should display question items', () => {
      render(<ExtractedItemsList caseId="case-1" />);

      expect(screen.getByText('Can you confirm the meeting time?')).toBeInTheDocument();
    });
  });

  describe('loading state', () => {
    it('should show loading indicator when fetching', () => {
      (useExtractedItems as jest.Mock).mockReturnValue({
        deadlines: [],
        commitments: [],
        actionItems: [],
        questions: [],
        loading: true,
        error: null,
        refetch: jest.fn(),
      });

      render(<ExtractedItemsList caseId="case-1" />);

      expect(screen.getByRole('status')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('should show empty message when no extractions', () => {
      (useExtractedItems as jest.Mock).mockReturnValue({
        deadlines: [],
        commitments: [],
        actionItems: [],
        questions: [],
        loading: false,
        error: null,
        refetch: jest.fn(),
      });

      render(<ExtractedItemsList caseId="case-1" />);

      expect(screen.getByText(/no extracted items/i)).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('should show error message on fetch failure', () => {
      (useExtractedItems as jest.Mock).mockReturnValue({
        deadlines: [],
        commitments: [],
        actionItems: [],
        questions: [],
        loading: false,
        error: new Error('Failed to fetch'),
        refetch: jest.fn(),
      });

      render(<ExtractedItemsList caseId="case-1" />);

      expect(screen.getByText(/error/i)).toBeInTheDocument();
    });
  });

  describe('confidence display', () => {
    it('should display high confidence badge for items >= 0.8', () => {
      render(<ExtractedItemsList caseId="case-1" />);

      // Items with confidence >= 0.8 should show high confidence indicator
      const highConfidenceItems = screen.getAllByText(/95%|92%|90%/);
      expect(highConfidenceItems.length).toBeGreaterThan(0);
    });
  });

  describe('convert to task', () => {
    it('should call convert function when button clicked', () => {
      render(<ExtractedItemsList caseId="case-1" />);

      const convertButtons = screen.getAllByRole('button', { name: /convert|create task/i });
      fireEvent.click(convertButtons[0]);

      expect(mockConvert).toHaveBeenCalled();
    });
  });

  describe('dismiss extraction', () => {
    it('should call dismiss function when button clicked', () => {
      render(<ExtractedItemsList caseId="case-1" />);

      const dismissButtons = screen.getAllByRole('button', { name: /dismiss/i });
      fireEvent.click(dismissButtons[0]);

      expect(mockDismiss).toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('should have appropriate ARIA labels', () => {
      render(<ExtractedItemsList caseId="case-1" />);

      expect(screen.getByRole('region', { name: /extracted items/i })).toBeInTheDocument();
    });

    it('should support keyboard navigation', () => {
      render(<ExtractedItemsList caseId="case-1" />);

      const buttons = screen.getAllByRole('button');
      buttons.forEach((button) => {
        expect(button).not.toHaveAttribute('tabindex', '-1');
      });
    });
  });
});
