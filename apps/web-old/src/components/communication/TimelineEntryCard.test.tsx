/**
 * TimelineEntryCard Component Tests
 * Story 5.5: Multi-Channel Communication Hub - Task 39 (AC: 1, 4)
 *
 * Tests for timeline entry display and interactions
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { TimelineEntryCard } from './TimelineEntryCard';
import type { TimelineEntry } from '@/hooks/useCaseTimeline';

// Mock the hooks
jest.mock('@/hooks/useCaseTimeline', () => ({
  useChannelMetadata: () => ({
    getChannelColor: () => 'text-linear-accent',
    getChannelLabel: (channel: string) => channel,
    isChannelDisabled: () => false,
  }),
  usePrivacyMetadata: () => ({
    getPrivacyColor: () => 'text-linear-text-secondary',
    getPrivacyLabel: (level: string) => level,
  }),
}));

// Mock date-fns
jest.mock('date-fns', () => ({
  formatDistanceToNow: () => '5 minutes ago',
  format: () => 'January 15, 2025 10:00 AM',
}));

describe('TimelineEntryCard', () => {
  const mockEntry: TimelineEntry = {
    id: 'entry-1',
    caseId: 'case-1',
    channelType: 'Email',
    direction: 'Inbound',
    subject: 'Test Subject',
    body: 'This is a test email body content that is reasonably short.',
    bodyPreview: 'This is a test email...',
    senderName: 'John Doe',
    senderEmail: 'john@example.com',
    recipients: [{ name: 'Jane Smith', email: 'jane@example.com', type: 'to' }],
    hasAttachments: false,
    attachments: [],
    privacyLevel: 'Normal',
    sentAt: '2025-01-15T10:00:00Z',
    childCount: 0,
  };

  it('should render entry with sender name', () => {
    render(<TimelineEntryCard entry={mockEntry} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
  });

  it('should render entry with sender email', () => {
    render(<TimelineEntryCard entry={mockEntry} />);

    expect(screen.getByText('<john@example.com>')).toBeInTheDocument();
  });

  it('should render subject', () => {
    render(<TimelineEntryCard entry={mockEntry} />);

    expect(screen.getByText('Test Subject')).toBeInTheDocument();
  });

  it('should render relative time', () => {
    render(<TimelineEntryCard entry={mockEntry} />);

    expect(screen.getByText('5 minutes ago')).toBeInTheDocument();
  });

  it('should render recipients', () => {
    render(<TimelineEntryCard entry={mockEntry} />);

    expect(screen.getByText(/To: Jane Smith/)).toBeInTheDocument();
  });

  it('should render body preview', () => {
    render(<TimelineEntryCard entry={mockEntry} />);

    expect(screen.getByText(/This is a test email/)).toBeInTheDocument();
  });

  it('should call onClick when card is clicked', () => {
    const onClick = jest.fn();
    render(<TimelineEntryCard entry={mockEntry} onClick={onClick} />);

    const article = screen.getByRole('article');
    fireEvent.click(article);

    expect(onClick).toHaveBeenCalled();
  });

  it('should display privacy badge for non-Normal privacy level', () => {
    const confidentialEntry: TimelineEntry = {
      ...mockEntry,
      privacyLevel: 'Confidential',
    };

    render(<TimelineEntryCard entry={confidentialEntry} />);

    expect(screen.getByText('Confidential')).toBeInTheDocument();
  });

  it('should not display privacy badge for Normal privacy level', () => {
    render(<TimelineEntryCard entry={mockEntry} />);

    expect(screen.queryByText('Normal')).not.toBeInTheDocument();
  });

  it('should display attachment count when has attachments', () => {
    const entryWithAttachments: TimelineEntry = {
      ...mockEntry,
      hasAttachments: true,
      attachments: [
        {
          id: 'att-1',
          fileName: 'doc.pdf',
          fileSize: 1024,
          mimeType: 'application/pdf',
          downloadUrl: '/doc.pdf',
        },
        {
          id: 'att-2',
          fileName: 'image.png',
          fileSize: 2048,
          mimeType: 'image/png',
          downloadUrl: '/image.png',
        },
      ],
    };

    render(<TimelineEntryCard entry={entryWithAttachments} />);

    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('should show "Coming Soon" badge when disabled', () => {
    render(<TimelineEntryCard entry={mockEntry} isDisabled={true} />);

    expect(screen.getByText('În curând')).toBeInTheDocument();
  });

  it('should have reduced opacity when disabled', () => {
    render(<TimelineEntryCard entry={mockEntry} isDisabled={true} />);

    const article = screen.getByRole('article');
    expect(article).toHaveClass('opacity-60');
  });

  it('should expand/collapse long body content', () => {
    const longBodyEntry: TimelineEntry = {
      ...mockEntry,
      body: 'A'.repeat(300), // Longer than 200 chars
    };

    render(<TimelineEntryCard entry={longBodyEntry} />);

    // Should show "Arată mai mult" button
    const expandButton = screen.getByRole('button', { name: /arată mai mult/i });
    expect(expandButton).toBeInTheDocument();

    // Click to expand
    fireEvent.click(expandButton);

    // Should now show "Arată mai puțin"
    expect(screen.getByRole('button', { name: /arată mai puțin/i })).toBeInTheDocument();
  });

  it('should display thread reply count', () => {
    const entryWithReplies: TimelineEntry = {
      ...mockEntry,
      childCount: 3,
    };

    render(<TimelineEntryCard entry={entryWithReplies} />);

    expect(screen.getByText('3 răspunsuri în conversație')).toBeInTheDocument();
  });

  it('should display singular "reply" for single reply', () => {
    const entryWithReply: TimelineEntry = {
      ...mockEntry,
      childCount: 1,
    };

    render(<TimelineEntryCard entry={entryWithReply} />);

    expect(screen.getByText('1 răspuns în conversație')).toBeInTheDocument();
  });

  it('should set aria attributes', () => {
    render(<TimelineEntryCard entry={mockEntry} aria-setsize={10} aria-posinset={3} />);

    const article = screen.getByRole('article');
    expect(article).toHaveAttribute('aria-setsize', '10');
    expect(article).toHaveAttribute('aria-posinset', '3');
  });

  it('should display different direction icons', () => {
    const outboundEntry: TimelineEntry = {
      ...mockEntry,
      direction: 'Outbound',
    };

    const { container } = render(<TimelineEntryCard entry={outboundEntry} />);

    // Check that the direction is displayed
    expect(container.querySelector('[title="Outbound"]')).toBeInTheDocument();
  });

  it('should show reply and forward buttons for email entries', () => {
    render(<TimelineEntryCard entry={mockEntry} />);

    // Hover to show actions
    const article = screen.getByRole('article');
    fireEvent.mouseEnter(article);

    expect(screen.getByTitle('Reply')).toBeInTheDocument();
    expect(screen.getByTitle('Forward')).toBeInTheDocument();
  });

  it('should show more actions button', () => {
    render(<TimelineEntryCard entry={mockEntry} />);

    // Hover to show actions
    const article = screen.getByRole('article');
    fireEvent.mouseEnter(article);

    expect(screen.getByTitle('More actions')).toBeInTheDocument();
  });

  it('should render internal note correctly', () => {
    const internalNote: TimelineEntry = {
      ...mockEntry,
      channelType: 'InternalNote',
      direction: 'Internal',
      subject: undefined,
    };

    render(<TimelineEntryCard entry={internalNote} />);

    // Should not show subject when undefined
    expect(screen.queryByRole('heading', { level: 3 })).not.toBeInTheDocument();
  });

  it('should truncate many recipients', () => {
    const manyRecipients: TimelineEntry = {
      ...mockEntry,
      recipients: [
        { name: 'User 1', email: 'user1@example.com', type: 'to' },
        { name: 'User 2', email: 'user2@example.com', type: 'to' },
        { name: 'User 3', email: 'user3@example.com', type: 'cc' },
        { name: 'User 4', email: 'user4@example.com', type: 'cc' },
        { name: 'User 5', email: 'user5@example.com', type: 'bcc' },
      ],
    };

    render(<TimelineEntryCard entry={manyRecipients} />);

    expect(screen.getByText(/\+2 more/)).toBeInTheDocument();
  });
});
