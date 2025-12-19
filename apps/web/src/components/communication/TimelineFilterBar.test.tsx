/**
 * TimelineFilterBar Component Tests
 * Story 5.5: Multi-Channel Communication Hub - Task 39 (AC: 1)
 *
 * Tests for timeline filtering functionality
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { TimelineFilterBar } from './TimelineFilterBar';
import type { TimelineFilter, CommunicationChannel } from '@/hooks/useCaseTimeline';

// Mock the hooks
jest.mock('@/hooks/useCaseTimeline', () => ({
  useChannelMetadata: () => ({
    getChannelLabel: (channel: string) => {
      const labels: Record<string, string> = {
        Email: 'Email',
        InternalNote: 'Internal Note',
        Phone: 'Phone Call',
        Meeting: 'Meeting',
        WhatsApp: 'WhatsApp',
        SMS: 'SMS',
      };
      return labels[channel] || channel;
    },
    isChannelDisabled: (channel: string) => {
      // Mock: WhatsApp and SMS are disabled (future channels)
      return channel === 'WhatsApp' || channel === 'SMS';
    },
  }),
}));

describe('TimelineFilterBar', () => {
  const defaultFilter: Omit<TimelineFilter, 'caseId'> = {};
  const mockOnChange = jest.fn();
  const mockOnClear = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render filter button', () => {
    render(
      <TimelineFilterBar
        filter={defaultFilter}
        onChange={mockOnChange}
        onClear={mockOnClear}
        activeCount={0}
      />
    );

    expect(screen.getByRole('button', { name: /filtre/i })).toBeInTheDocument();
  });

  it('should render search input', () => {
    render(
      <TimelineFilterBar
        filter={defaultFilter}
        onChange={mockOnChange}
        onClear={mockOnClear}
        activeCount={0}
      />
    );

    expect(screen.getByPlaceholderText('Caută comunicări...')).toBeInTheDocument();
  });

  it('should display active filter count', () => {
    render(
      <TimelineFilterBar
        filter={defaultFilter}
        onChange={mockOnChange}
        onClear={mockOnClear}
        activeCount={3}
      />
    );

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('should show clear button when filters are active', () => {
    render(
      <TimelineFilterBar
        filter={defaultFilter}
        onChange={mockOnChange}
        onClear={mockOnClear}
        activeCount={2}
      />
    );

    expect(screen.getByRole('button', { name: /șterge/i })).toBeInTheDocument();
  });

  it('should not show clear button when no filters are active', () => {
    render(
      <TimelineFilterBar
        filter={defaultFilter}
        onChange={mockOnChange}
        onClear={mockOnClear}
        activeCount={0}
      />
    );

    expect(screen.queryByRole('button', { name: /șterge/i })).not.toBeInTheDocument();
  });

  it('should call onClear when clear button is clicked', () => {
    render(
      <TimelineFilterBar
        filter={defaultFilter}
        onChange={mockOnChange}
        onClear={mockOnClear}
        activeCount={2}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /șterge/i }));
    expect(mockOnClear).toHaveBeenCalled();
  });

  it('should call onChange when search input changes', () => {
    render(
      <TimelineFilterBar
        filter={defaultFilter}
        onChange={mockOnChange}
        onClear={mockOnClear}
        activeCount={0}
      />
    );

    const searchInput = screen.getByPlaceholderText('Caută comunicări...');
    fireEvent.change(searchInput, { target: { value: 'test query' } });

    expect(mockOnChange).toHaveBeenCalledWith({ searchTerm: 'test query' });
  });

  it('should clear searchTerm when input is emptied', () => {
    render(
      <TimelineFilterBar
        filter={{ searchTerm: 'existing' }}
        onChange={mockOnChange}
        onClear={mockOnClear}
        activeCount={1}
      />
    );

    const searchInput = screen.getByPlaceholderText('Caută comunicări...');
    fireEvent.change(searchInput, { target: { value: '' } });

    expect(mockOnChange).toHaveBeenCalledWith({ searchTerm: undefined });
  });

  it('should expand filter panel when filter button is clicked', () => {
    render(
      <TimelineFilterBar
        filter={defaultFilter}
        onChange={mockOnChange}
        onClear={mockOnClear}
        activeCount={0}
      />
    );

    const filterButton = screen.getByRole('button', { name: /filtre/i });
    fireEvent.click(filterButton);

    expect(screen.getByRole('region', { name: /filter options/i })).toBeInTheDocument();
  });

  it('should show channel checkboxes in expanded panel', () => {
    render(
      <TimelineFilterBar
        filter={defaultFilter}
        onChange={mockOnChange}
        onClear={mockOnClear}
        activeCount={0}
      />
    );

    // Expand the filter panel
    fireEvent.click(screen.getByRole('button', { name: /filtre/i }));

    // Check for channel fieldset and checkboxes
    expect(screen.getByRole('group', { name: /canale/i })).toBeInTheDocument();
    expect(screen.getAllByText('Email').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Internal Note').length).toBeGreaterThan(0);
  });

  it('should toggle channel filter when clicked', () => {
    render(
      <TimelineFilterBar
        filter={{ channelTypes: [] }}
        onChange={mockOnChange}
        onClear={mockOnClear}
        activeCount={0}
      />
    );

    // Expand the filter panel
    fireEvent.click(screen.getByRole('button', { name: /filtre/i }));

    // Find all Email elements and get the one in the expanded panel (within fieldset)
    const channelsFieldset = screen.getByRole('group', { name: /canale/i });
    const emailCheckbox = channelsFieldset.querySelector('input[type="checkbox"]');
    if (emailCheckbox) {
      const emailLabel = emailCheckbox.closest('label');
      if (emailLabel) {
        fireEvent.click(emailLabel);
      }
    }

    expect(mockOnChange).toHaveBeenCalledWith({
      channelTypes: ['Email'],
    });
  });

  it('should remove channel from filter when already selected', () => {
    render(
      <TimelineFilterBar
        filter={{ channelTypes: ['Email', 'InternalNote'] as CommunicationChannel[] }}
        onChange={mockOnChange}
        onClear={mockOnClear}
        activeCount={2}
      />
    );

    // Expand the filter panel
    fireEvent.click(screen.getByRole('button', { name: /filtre/i }));

    // Find the Email checkbox in the channels fieldset and click to deselect
    const channelsFieldset = screen.getByRole('group', { name: /canale/i });
    const emailCheckbox = channelsFieldset.querySelector('input[type="checkbox"]:checked');
    if (emailCheckbox) {
      const emailLabel = emailCheckbox.closest('label');
      if (emailLabel) {
        fireEvent.click(emailLabel);
      }
    }

    expect(mockOnChange).toHaveBeenCalledWith({
      channelTypes: ['InternalNote'],
    });
  });

  it('should disable future channel options', () => {
    render(
      <TimelineFilterBar
        filter={defaultFilter}
        onChange={mockOnChange}
        onClear={mockOnClear}
        activeCount={0}
      />
    );

    // Expand the filter panel
    fireEvent.click(screen.getByRole('button', { name: /filtre/i }));

    // WhatsApp should be disabled
    const whatsappCheckbox = screen.getAllByRole('checkbox').find((cb) => {
      const label = cb.closest('label');
      return label?.textContent?.includes('WhatsApp');
    });

    expect(whatsappCheckbox).toBeDisabled();
  });

  it('should show direction radio buttons', () => {
    render(
      <TimelineFilterBar
        filter={defaultFilter}
        onChange={mockOnChange}
        onClear={mockOnClear}
        activeCount={0}
      />
    );

    // Expand the filter panel
    fireEvent.click(screen.getByRole('button', { name: /filtre/i }));

    expect(screen.getByText('Toate')).toBeInTheDocument();
    expect(screen.getByText('Primite')).toBeInTheDocument();
    expect(screen.getByText('Trimise')).toBeInTheDocument();
    expect(screen.getByText('Interne')).toBeInTheDocument();
  });

  it('should call onChange when direction is changed', () => {
    render(
      <TimelineFilterBar
        filter={defaultFilter}
        onChange={mockOnChange}
        onClear={mockOnClear}
        activeCount={0}
      />
    );

    // Expand the filter panel
    fireEvent.click(screen.getByRole('button', { name: /filtre/i }));

    // Click Inbound direction
    const inboundLabel = screen.getByText('Primite').closest('label');
    if (inboundLabel) {
      fireEvent.click(inboundLabel);
    }

    expect(mockOnChange).toHaveBeenCalledWith({ direction: 'Inbound' });
  });

  it('should show date range inputs', () => {
    render(
      <TimelineFilterBar
        filter={defaultFilter}
        onChange={mockOnChange}
        onClear={mockOnClear}
        activeCount={0}
      />
    );

    // Expand the filter panel
    fireEvent.click(screen.getByRole('button', { name: /filtre/i }));

    expect(screen.getByLabelText('De la data')).toBeInTheDocument();
    expect(screen.getByLabelText('Până la data')).toBeInTheDocument();
  });

  it('should call onChange when date range is set', () => {
    render(
      <TimelineFilterBar
        filter={defaultFilter}
        onChange={mockOnChange}
        onClear={mockOnClear}
        activeCount={0}
      />
    );

    // Expand the filter panel
    fireEvent.click(screen.getByRole('button', { name: /filtre/i }));

    const fromDate = screen.getByLabelText('De la data');
    fireEvent.change(fromDate, { target: { value: '2025-01-01' } });

    expect(mockOnChange).toHaveBeenCalledWith({
      dateFrom: expect.any(Date),
    });
  });

  it('should show privacy toggle', () => {
    render(
      <TimelineFilterBar
        filter={defaultFilter}
        onChange={mockOnChange}
        onClear={mockOnClear}
        activeCount={0}
      />
    );

    // Expand the filter panel
    fireEvent.click(screen.getByRole('button', { name: /filtre/i }));

    expect(screen.getByText('Afișează comunicările private')).toBeInTheDocument();
  });

  it('should call onChange when privacy toggle is clicked', () => {
    render(
      <TimelineFilterBar
        filter={{ includePrivate: false }}
        onChange={mockOnChange}
        onClear={mockOnClear}
        activeCount={0}
      />
    );

    // Expand the filter panel
    fireEvent.click(screen.getByRole('button', { name: /filtre/i }));

    const privacyCheckbox = screen.getByRole('checkbox', {
      name: /afișează comunicările private/i,
    });
    fireEvent.click(privacyCheckbox);

    expect(mockOnChange).toHaveBeenCalledWith({ includePrivate: true });
  });

  it('should have proper aria-expanded state', () => {
    render(
      <TimelineFilterBar
        filter={defaultFilter}
        onChange={mockOnChange}
        onClear={mockOnClear}
        activeCount={0}
      />
    );

    const filterButton = screen.getByRole('button', { name: /filtre/i });

    // Initially collapsed
    expect(filterButton).toHaveAttribute('aria-expanded', 'false');

    // Click to expand
    fireEvent.click(filterButton);
    expect(filterButton).toHaveAttribute('aria-expanded', 'true');

    // Click to collapse
    fireEvent.click(filterButton);
    expect(filterButton).toHaveAttribute('aria-expanded', 'false');
  });

  it('should announce filter state to screen readers', () => {
    render(
      <TimelineFilterBar
        filter={defaultFilter}
        onChange={mockOnChange}
        onClear={mockOnClear}
        activeCount={3}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('3 filtre active');
  });

  it('should announce when no filters are active', () => {
    render(
      <TimelineFilterBar
        filter={defaultFilter}
        onChange={mockOnChange}
        onClear={mockOnClear}
        activeCount={0}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Niciun filtru activ');
  });

  it('should display search term in input', () => {
    render(
      <TimelineFilterBar
        filter={{ searchTerm: 'existing search' }}
        onChange={mockOnChange}
        onClear={mockOnClear}
        activeCount={1}
      />
    );

    const searchInput = screen.getByPlaceholderText('Caută comunicări...');
    expect(searchInput).toHaveValue('existing search');
  });

  it('should apply custom className', () => {
    const { container } = render(
      <TimelineFilterBar
        filter={defaultFilter}
        onChange={mockOnChange}
        onClear={mockOnClear}
        activeCount={0}
        className="custom-class"
      />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });
});
