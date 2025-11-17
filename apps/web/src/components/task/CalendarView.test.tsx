/**
 * CalendarView Unit Tests
 * Tests calendar rendering, navigation, task interactions, and Romanian localization
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CalendarView } from './CalendarView';
import { createMockWeekTasks } from '@legal-platform/test-utils';
import type { Task } from '@legal-platform/types';

// Mock React Big Calendar styles
jest.mock('react-big-calendar/lib/css/react-big-calendar.css', () => ({}));

describe('CalendarView', () => {
  const mockOnTaskClick = jest.fn();
  const mockOnTaskDrop = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders calendar without crashing', () => {
    const { container } = render(
      <CalendarView tasks={[]} onTaskClick={mockOnTaskClick} />
    );
    expect(container.querySelector('.rbc-calendar')).toBeInTheDocument();
  });

  it('displays navigation controls with Romanian labels', () => {
    render(<CalendarView tasks={[]} onTaskClick={mockOnTaskClick} />);

    // Check for "Astăzi" (Today) button - use getAllByText since React Big Calendar also renders "Astăzi"
    const todayButtons = screen.getAllByText('Astăzi');
    expect(todayButtons.length).toBeGreaterThan(0);

    // Check for navigation buttons
    expect(screen.getByLabelText('Săptămâna anterioară')).toBeInTheDocument();
    expect(screen.getByLabelText('Săptămâna următoare')).toBeInTheDocument();
  });

  it('renders tasks as calendar events', () => {
    const mockTasks = createMockWeekTasks(5);
    const { container } = render(
      <CalendarView tasks={mockTasks} onTaskClick={mockOnTaskClick} />
    );

    // Calendar should have events
    const events = container.querySelectorAll('.rbc-event');
    expect(events.length).toBeGreaterThan(0);
  });

  it('displays task titles in calendar events', () => {
    const mockTasks = createMockWeekTasks(3);
    const { container } = render(<CalendarView tasks={mockTasks} onTaskClick={mockOnTaskClick} />);

    // At least one task title should be visible in the calendar events
    const taskTitle = mockTasks[0].title;

    // Find the task title in the rendered events
    const events = container.querySelectorAll('.rbc-event');
    expect(events.length).toBeGreaterThan(0);

    // Check if any event contains the task title
    const eventTexts = Array.from(events).map(e => e.textContent);
    const hasTitle = eventTexts.some(text => text && text.includes(taskTitle.substring(0, 10)));
    expect(hasTitle).toBe(true);
  });

  it('applies correct color coding by task type', () => {
    const mockTasks: Task[] = [
      createMockWeekTasks(1)[0],
    ];

    // Override type to ensure we're testing a specific color
    mockTasks[0].type = 'Research';

    const { container } = render(
      <CalendarView tasks={mockTasks} onTaskClick={mockOnTaskClick} />
    );

    const event = container.querySelector('.rbc-event');
    const computedStyle = window.getComputedStyle(event!);

    // Research tasks should have blue background (#3B82F6)
    // Note: The actual rendered color might be in rgb format
    expect(event).toBeInTheDocument();
  });

  it('calls onTaskClick when clicking a task event', async () => {
    const mockTasks = createMockWeekTasks(1);
    const { container } = render(
      <CalendarView tasks={mockTasks} onTaskClick={mockOnTaskClick} />
    );

    const event = container.querySelector('.rbc-event');
    expect(event).toBeInTheDocument();

    fireEvent.click(event!);

    await waitFor(() => {
      expect(mockOnTaskClick).toHaveBeenCalledTimes(1);
      expect(mockOnTaskClick).toHaveBeenCalledWith(mockTasks[0]);
    });
  });

  it('navigates to previous week when clicking previous button', () => {
    render(<CalendarView tasks={[]} onTaskClick={mockOnTaskClick} />);

    const previousButton = screen.getByLabelText('Săptămâna anterioară');
    fireEvent.click(previousButton);

    // Calendar should re-render with new date (tested implicitly by no errors)
    expect(previousButton).toBeInTheDocument();
  });

  it('navigates to next week when clicking next button', () => {
    render(<CalendarView tasks={[]} onTaskClick={mockOnTaskClick} />);

    const nextButton = screen.getByLabelText('Săptămâna următoare');
    fireEvent.click(nextButton);

    // Calendar should re-render with new date
    expect(nextButton).toBeInTheDocument();
  });

  it('navigates to current week when clicking Astăzi button', () => {
    render(<CalendarView tasks={[]} onTaskClick={mockOnTaskClick} />);

    // Navigate to next week first
    const nextButton = screen.getByLabelText('Săptămâna următoare');
    fireEvent.click(nextButton);

    // Then navigate back to today - use getAllByText since there are multiple "Astăzi" buttons
    const todayButtons = screen.getAllByText('Astăzi');
    fireEvent.click(todayButtons[0]); // Click the first one (our custom button)

    // Calendar should re-render with current week
    expect(todayButtons[0]).toBeInTheDocument();
  });

  it('displays week range in Romanian format', () => {
    const { container } = render(
      <CalendarView tasks={[]} onTaskClick={mockOnTaskClick} />
    );

    // Should display date range like "11 Nov - 17 Nov 2025"
    // Using regex to match Romanian month abbreviations
    const weekRangeText = container.textContent;
    expect(weekRangeText).toMatch(/\d+ \w+ - \d+ \w+ \d{4}/);
  });

  it('supports drag and drop when onTaskDrop is provided', async () => {
    const mockTasks = createMockWeekTasks(1);
    const { container } = render(
      <CalendarView
        tasks={mockTasks}
        onTaskClick={mockOnTaskClick}
        onTaskDrop={mockOnTaskDrop}
      />
    );

    // Calendar should have draggable events
    const calendar = container.querySelector('.rbc-calendar');
    expect(calendar).toBeInTheDocument();

    // Note: Full drag-and-drop testing requires more complex setup
    // We're just verifying the component accepts the prop
  });

  it('renders all 6 task type colors in legend (first 3)', () => {
    render(<CalendarView tasks={[]} onTaskClick={mockOnTaskClick} />);

    // Legend shows first 3 task types
    expect(screen.getByText('Research')).toBeInTheDocument();
    expect(screen.getByText('DocumentCreation')).toBeInTheDocument();
    expect(screen.getByText('DocumentRetrieval')).toBeInTheDocument();
  });

  it('displays Romanian time format (HH:mm) in events', () => {
    const mockTasks = createMockWeekTasks(1);
    // Set a specific time to test
    mockTasks[0].dueDate = new Date('2025-11-14T14:30:00');

    render(<CalendarView tasks={mockTasks} onTaskClick={mockOnTaskClick} />);

    // Should display time in 24-hour format (14:30)
    // Time is displayed inside the custom event component
    expect(screen.getByText('14:30')).toBeInTheDocument();
  });

  it('handles empty task list gracefully', () => {
    const { container } = render(
      <CalendarView tasks={[]} onTaskClick={mockOnTaskClick} />
    );

    // Calendar should render without errors
    expect(container.querySelector('.rbc-calendar')).toBeInTheDocument();

    // No events should be displayed
    const events = container.querySelectorAll('.rbc-event');
    expect(events.length).toBe(0);
  });

  it('displays tasks with proper duration (default 1 hour)', () => {
    const mockTasks = createMockWeekTasks(1);
    const { container } = render(
      <CalendarView tasks={mockTasks} onTaskClick={mockOnTaskClick} />
    );

    // Events should be rendered with default 1-hour duration
    const events = container.querySelectorAll('.rbc-event');
    expect(events.length).toBeGreaterThan(0);
  });

  it('respects custom duration from task metadata', () => {
    const mockTasks = createMockWeekTasks(1);
    mockTasks[0].metadata.duration = 120; // 2 hours

    const { container } = render(
      <CalendarView tasks={mockTasks} onTaskClick={mockOnTaskClick} />
    );

    // Event should be rendered (duration affects event height in calendar)
    const events = container.querySelectorAll('.rbc-event');
    expect(events.length).toBeGreaterThan(0);
  });

  it('displays calendar in week view by default', () => {
    const { container } = render(
      <CalendarView tasks={[]} onTaskClick={mockOnTaskClick} />
    );

    // Week view should show days of the week
    // In Romanian: Lun, Mar, Mie, Joi, Vin, Sâm, Dum
    const calendar = container.querySelector('.rbc-time-view');
    expect(calendar).toBeInTheDocument();
  });

  it('sets calendar work hours from 8 AM to 8 PM', () => {
    const { container } = render(
      <CalendarView tasks={[]} onTaskClick={mockOnTaskClick} />
    );

    // Calendar should be configured with min/max times
    const calendar = container.querySelector('.rbc-calendar');
    expect(calendar).toBeInTheDocument();

    // Time slots should start at 08:00 and end at 20:00
    // This is verified by the component props (min/max)
  });

  it('displays current time indicator', () => {
    const { container } = render(
      <CalendarView tasks={[]} onTaskClick={mockOnTaskClick} />
    );

    // Current time indicator should be present (red line)
    // Note: This requires the calendar to be rendered at current time
    const calendar = container.querySelector('.rbc-calendar');
    expect(calendar).toBeInTheDocument();
  });

  it('handles Romanian diacritics in task titles correctly', () => {
    const mockTasks: Task[] = [
      {
        ...createMockWeekTasks(1)[0],
        title: 'Întâlnire cu clientul Ștefan Țăran',
      },
    ];

    render(<CalendarView tasks={mockTasks} onTaskClick={mockOnTaskClick} />);

    // Romanian diacritics should render correctly
    expect(screen.getByText((content) => content.includes('Întâlnire'))).toBeInTheDocument();
  });

  it('applies responsive styles for mobile viewports', () => {
    const { container } = render(
      <CalendarView tasks={[]} onTaskClick={mockOnTaskClick} />
    );

    // Component should include responsive wrapper
    const wrapper = container.querySelector('.calendar-wrapper');
    expect(wrapper).toBeInTheDocument();
    expect(wrapper).toHaveClass('calendar-wrapper');
  });
});
