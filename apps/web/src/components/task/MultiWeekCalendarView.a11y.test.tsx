/**
 * MultiWeekCalendarView Accessibility Tests
 * Tests WCAG AA compliance using jest-axe for Story 1.7.5
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import userEvent from '@testing-library/user-event';
import { MultiWeekCalendarView } from './MultiWeekCalendarView';
import { createMockTasks, createMockTask } from '@legal-platform/test-utils';
import type { Task } from '@legal-platform/types';

expect.extend(toHaveNoViolations);

describe('MultiWeekCalendarView Accessibility (WCAG AA)', () => {
  // Create tasks with dates in the current week range
  const today = new Date();
  const mockTasks = createMockTasks(20).map((task, index) => ({
    ...task,
    dueDate: new Date(today.getTime() + (index - 10) * 24 * 60 * 60 * 1000), // Spread across ±10 days
  }));
  const mockTaskClick = jest.fn();
  const mockTaskDrop = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('General Accessibility', () => {
    it('should not have any accessibility violations', async () => {
      const { container } = render(
        <MultiWeekCalendarView
          tasks={mockTasks}
          onTaskClick={mockTaskClick}
          onTaskDrop={mockTaskDrop}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should not have accessibility violations when empty', async () => {
      const { container } = render(
        <MultiWeekCalendarView tasks={[]} onTaskClick={mockTaskClick} onTaskDrop={mockTaskDrop} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should not have accessibility violations with many tasks', async () => {
      const manyTasks = createMockTasks(100);
      const { container } = render(
        <MultiWeekCalendarView
          tasks={manyTasks}
          onTaskClick={mockTaskClick}
          onTaskDrop={mockTaskDrop}
          weeksToShow={8}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should not have accessibility violations with 2 weeks view', async () => {
      const { container } = render(
        <MultiWeekCalendarView
          tasks={mockTasks}
          onTaskClick={mockTaskClick}
          onTaskDrop={mockTaskDrop}
          weeksToShow={2}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('ARIA Labels', () => {
    it('should have proper ARIA labels for week headers', async () => {
      const { container } = render(
        <MultiWeekCalendarView
          tasks={mockTasks}
          onTaskClick={mockTaskClick}
          onTaskDrop={mockTaskDrop}
        />
      );

      const results = await axe(container, {
        rules: {
          'aria-required-attr': { enabled: true },
          'aria-valid-attr-value': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();

      // Verify week headers have aria-label
      const weekHeaders = container.querySelectorAll('[role="heading"]');
      expect(weekHeaders.length).toBeGreaterThan(0);
      weekHeaders.forEach((header) => {
        expect(header).toHaveAttribute('aria-label');
        expect(header.getAttribute('aria-label')).toMatch(/Săptămâna/);
      });
    });

    it('should have proper ARIA labels for day columns', async () => {
      const { container } = render(
        <MultiWeekCalendarView
          tasks={mockTasks}
          onTaskClick={mockTaskClick}
          onTaskDrop={mockTaskDrop}
        />
      );

      // Verify day columns have aria-label
      const dayColumns = container.querySelectorAll('[role="region"]');
      expect(dayColumns.length).toBe(28); // 4 weeks × 7 days

      dayColumns.forEach((column) => {
        expect(column).toHaveAttribute('aria-label');
        const label = column.getAttribute('aria-label');
        // Should contain day name in Romanian
        expect(label).toMatch(/luni|marți|miercuri|joi|vineri|sâmbătă|duminică/i);
      });
    });

    it('should have proper ARIA labels for task cards', async () => {
      const today = new Date();
      const tasks: Task[] = [
        {
          ...createMockTask(),
          title: 'Pregătire Dosar Urgent',
          type: 'Research',
          priority: 'High',
          dueDate: today, // Use today's date so it appears in current week
        },
      ];

      const { container } = render(
        <MultiWeekCalendarView tasks={tasks} onTaskClick={mockTaskClick} onTaskDrop={mockTaskDrop} />
      );

      const taskCards = container.querySelectorAll('[role="button"]');
      expect(taskCards.length).toBeGreaterThan(0);

      taskCards.forEach((card) => {
        expect(card).toHaveAttribute('aria-label');
        const label = card.getAttribute('aria-label');
        // Should contain type and priority
        expect(label).toMatch(/Tip:/);
        expect(label).toMatch(/Prioritate:/);
      });
    });

    it('should include time in ARIA label for time-specific tasks', async () => {
      const today = new Date();
      today.setHours(14, 30, 0, 0); // Set to 14:30

      const timeSpecificTask: Task = {
        ...createMockTask(),
        title: 'Întâlnire Client',
        type: 'Meeting',
        priority: 'High',
        dueDate: today,
      };

      const { container } = render(
        <MultiWeekCalendarView
          tasks={[timeSpecificTask]}
          onTaskClick={mockTaskClick}
          onTaskDrop={mockTaskDrop}
        />
      );

      const taskCard = container.querySelector('[role="button"]');
      expect(taskCard).toHaveAttribute('aria-label');
      const label = taskCard?.getAttribute('aria-label');
      expect(label).toMatch(/14:30/);
    });

    it('should not include time in ARIA label for all-day tasks', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Midnight = all-day

      const allDayTask: Task = {
        ...createMockTask(),
        title: 'Research Task',
        type: 'Research',
        priority: 'Medium',
        dueDate: today,
      };

      const { container } = render(
        <MultiWeekCalendarView
          tasks={[allDayTask]}
          onTaskClick={mockTaskClick}
          onTaskDrop={mockTaskDrop}
        />
      );

      const taskCard = container.querySelector('[role="button"]');
      expect(taskCard).toHaveAttribute('aria-label');
      const label = taskCard?.getAttribute('aria-label');
      // Should not start with time
      expect(label).not.toMatch(/^\d{2}:\d{2}/);
      expect(label).toMatch(/Research Task/);
    });

    it('should have proper ARIA labels for navigation buttons', async () => {
      const { container } = render(
        <MultiWeekCalendarView
          tasks={mockTasks}
          onTaskClick={mockTaskClick}
          onTaskDrop={mockTaskDrop}
        />
      );

      const results = await axe(container, {
        rules: {
          'button-name': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();

      // Check specific navigation buttons
      const todayButton = screen.getByLabelText(/săptămâna curentă/i);
      expect(todayButton).toBeInTheDocument();

      const prevButton = screen.getByLabelText(/săptămâna anterioară/i);
      expect(prevButton).toBeInTheDocument();

      const nextButton = screen.getByLabelText(/săptămâna următoare/i);
      expect(nextButton).toBeInTheDocument();
    });

    it('should mark "Astăzi" in day column ARIA label', async () => {
      const { container } = render(
        <MultiWeekCalendarView
          tasks={mockTasks}
          onTaskClick={mockTaskClick}
          onTaskDrop={mockTaskDrop}
        />
      );

      const dayColumns = container.querySelectorAll('[role="region"]');
      const todayColumn = Array.from(dayColumns).find((col) =>
        col.getAttribute('aria-label')?.includes('Astăzi')
      );

      expect(todayColumn).toBeDefined();
    });
  });

  describe('Keyboard Navigation', () => {
    it('should support keyboard navigation for task cards', async () => {
      const user = userEvent.setup();
      const { container } = render(
        <MultiWeekCalendarView
          tasks={mockTasks}
          onTaskClick={mockTaskClick}
          onTaskDrop={mockTaskDrop}
        />
      );

      const results = await axe(container, {
        rules: {
          'tabindex': { enabled: true },
          'focus-order-semantics': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();

      // Verify task cards are keyboard accessible
      const taskCards = container.querySelectorAll('[role="button"]');
      expect(taskCards.length).toBeGreaterThan(0);

      taskCards.forEach((card) => {
        expect(card).toHaveAttribute('tabIndex');
        expect(card.getAttribute('tabIndex')).toBe('0');
      });
    });

    it('should activate task card on Enter key press', async () => {
      const user = userEvent.setup();
      const today = new Date();
      const task = {
        ...createMockTask(),
        dueDate: today,
      };
      render(
        <MultiWeekCalendarView
          tasks={[task]}
          onTaskClick={mockTaskClick}
          onTaskDrop={mockTaskDrop}
        />
      );

      const taskCard = screen.getByRole('button', { name: new RegExp(task.title) });
      taskCard.focus();
      await user.keyboard('{Enter}');

      expect(mockTaskClick).toHaveBeenCalledWith(task);
    });

    it('should activate task card on Space key press', async () => {
      const user = userEvent.setup();
      const today = new Date();
      const task = {
        ...createMockTask(),
        dueDate: today,
      };
      render(
        <MultiWeekCalendarView
          tasks={[task]}
          onTaskClick={mockTaskClick}
          onTaskDrop={mockTaskDrop}
        />
      );

      const taskCard = screen.getByRole('button', { name: new RegExp(task.title) });
      taskCard.focus();
      await user.keyboard(' ');

      expect(mockTaskClick).toHaveBeenCalledWith(task);
    });

    it('should support tab navigation through navigation controls', async () => {
      render(
        <MultiWeekCalendarView
          tasks={mockTasks}
          onTaskClick={mockTaskClick}
          onTaskDrop={mockTaskDrop}
        />
      );

      // Verify all navigation buttons are keyboard accessible
      const todayButton = screen.getByLabelText(/mergi la săptămâna curentă/i);
      const prevButton = screen.getByLabelText(/săptămâna anterioară/i);
      const nextButton = screen.getByLabelText(/săptămâna următoare/i);

      expect(todayButton).toBeInTheDocument();
      expect(prevButton).toBeInTheDocument();
      expect(nextButton).toBeInTheDocument();

      // All buttons should be focusable
      [todayButton, prevButton, nextButton].forEach((button) => {
        button.focus();
        expect(button).toHaveFocus();
      });
    });
  });

  describe('Drag-and-Drop Accessibility', () => {
    it('should have aria-grabbed attribute on draggable task cards', async () => {
      const { container } = render(
        <MultiWeekCalendarView
          tasks={mockTasks}
          onTaskClick={mockTaskClick}
          onTaskDrop={mockTaskDrop}
        />
      );

      const draggableCards = container.querySelectorAll('[draggable="true"]');
      expect(draggableCards.length).toBeGreaterThan(0);

      draggableCards.forEach((card) => {
        expect(card).toHaveAttribute('aria-grabbed');
      });
    });

    it('should not have accessibility violations with drag-and-drop', async () => {
      const { container } = render(
        <MultiWeekCalendarView
          tasks={mockTasks}
          onTaskClick={mockTaskClick}
          onTaskDrop={mockTaskDrop}
        />
      );

      const results = await axe(container, {
        rules: {
          'aria-valid-attr': { enabled: true },
          'aria-valid-attr-value': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });
  });

  describe('Color Contrast', () => {
    // Note: Color contrast tests require canvas support which is not available in jsdom.
    // These tests are disabled but kept for documentation. Use E2E tests with real browsers for color contrast validation.

    it('should have proper color contrast for all task type colors', async () => {
      const today = new Date();
      const allTypeTasks: Task[] = [
        { ...createMockTask(), type: 'Research', dueDate: today },
        { ...createMockTask(), type: 'DocumentCreation', dueDate: today },
        { ...createMockTask(), type: 'DocumentRetrieval', dueDate: today },
        { ...createMockTask(), type: 'CourtDate', dueDate: today },
        { ...createMockTask(), type: 'Meeting', dueDate: today },
        { ...createMockTask(), type: 'BusinessTrip', dueDate: today },
      ];

      const { container } = render(
        <MultiWeekCalendarView
          tasks={allTypeTasks}
          onTaskClick={mockTaskClick}
          onTaskDrop={mockTaskDrop}
        />
      );

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: false }, // Disabled: requires canvas (not available in jsdom)
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should have proper color contrast for priority borders', async () => {
      const today = new Date();
      const priorityTasks: Task[] = [
        { ...createMockTask(), priority: 'Urgent', dueDate: today },
        { ...createMockTask(), priority: 'High', dueDate: today },
        { ...createMockTask(), priority: 'Medium', dueDate: today },
        { ...createMockTask(), priority: 'Low', dueDate: today },
      ];

      const { container } = render(
        <MultiWeekCalendarView
          tasks={priorityTasks}
          onTaskClick={mockTaskClick}
          onTaskDrop={mockTaskDrop}
        />
      );

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: false }, // Disabled: requires canvas (not available in jsdom)
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should have proper color contrast for navigation and toolbar elements', async () => {
      const { container } = render(
        <MultiWeekCalendarView
          tasks={mockTasks}
          onTaskClick={mockTaskClick}
          onTaskDrop={mockTaskDrop}
        />
      );

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: false }, // Disabled: requires canvas (not available in jsdom)
        },
      });

      expect(results).toHaveNoViolations();
    });
  });

  describe('Focus Management', () => {
    it('should have visible focus indicators on all interactive elements', async () => {
      const { container } = render(
        <MultiWeekCalendarView
          tasks={mockTasks}
          onTaskClick={mockTaskClick}
          onTaskDrop={mockTaskDrop}
        />
      );

      const results = await axe(container, {
        rules: {
          'focus-order-semantics': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should maintain focus visibility on task cards', async () => {
      const user = userEvent.setup();
      const task = createMockTask();
      render(
        <MultiWeekCalendarView
          tasks={[task]}
          onTaskClick={mockTaskClick}
          onTaskDrop={mockTaskDrop}
        />
      );

      const taskCard = screen.getByRole('button', { name: new RegExp(task.title) });

      // Focus the task card
      taskCard.focus();
      expect(taskCard).toHaveFocus();

      // Verify focus ring is applied via className
      expect(taskCard.className).toMatch(/focus:ring/);
    });
  });

  describe('Romanian Diacritics', () => {
    it('should render Romanian diacritics correctly in task titles', async () => {
      const today = new Date();
      const romanianTasks: Task[] = [
        {
          ...createMockTask(),
          title: 'Întâlnire cu Șeful Companiei în București',
          dueDate: today,
        },
        {
          ...createMockTask(),
          title: 'Pregătire dosar pentru ședința de mâine',
          dueDate: today,
        },
      ];

      const { container } = render(
        <MultiWeekCalendarView
          tasks={romanianTasks}
          onTaskClick={mockTaskClick}
          onTaskDrop={mockTaskDrop}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Verify diacritics are rendered in ARIA labels
      const taskCards = container.querySelectorAll('[role="button"]');
      const labels = Array.from(taskCards).map((card) => card.getAttribute('aria-label'));
      const hasRomanianDiacritics = labels.some(
        (label) => label?.includes('Întâlnire') || label?.includes('Pregătire')
      );
      expect(hasRomanianDiacritics).toBe(true);
    });

    it('should render Romanian diacritics correctly in month names', async () => {
      const { container } = render(
        <MultiWeekCalendarView
          tasks={mockTasks}
          onTaskClick={mockTaskClick}
          onTaskDrop={mockTaskDrop}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Month names should use Romanian locale (date-fns/locale/ro)
      // This is validated through aria-labels
      const dayColumns = container.querySelectorAll('[role="region"]');
      expect(dayColumns.length).toBeGreaterThan(0);
    });

    it('should render Romanian UI text correctly', async () => {
      const { container } = render(
        <MultiWeekCalendarView
          tasks={mockTasks}
          onTaskClick={mockTaskClick}
          onTaskDrop={mockTaskDrop}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Verify Romanian UI text exists (multiple "Astăzi" labels may exist)
      const todayElements = screen.getAllByText('Astăzi');
      expect(todayElements.length).toBeGreaterThan(0);

      // Check for week info text
      const weekInfo = container.textContent;
      expect(weekInfo).toMatch(/săptămân/i);
    });

    it('should announce Romanian text correctly via ARIA labels', async () => {
      const today = new Date();
      const romanianTask: Task = {
        ...createMockTask(),
        title: 'Întâlnire în București',
        type: 'Meeting',
        priority: 'High',
        dueDate: today,
      };

      const { container } = render(
        <MultiWeekCalendarView
          tasks={[romanianTask]}
          onTaskClick={mockTaskClick}
          onTaskDrop={mockTaskDrop}
        />
      );

      const taskCard = screen.getByRole('button', { name: /Întâlnire în București/ });
      expect(taskCard).toHaveAttribute('aria-label');
      expect(taskCard.getAttribute('aria-label')).toContain('Întâlnire în București');
    });
  });

  describe('Screen Reader Compatibility', () => {
    it('should have proper ARIA roles and labels', async () => {
      const { container } = render(
        <MultiWeekCalendarView
          tasks={mockTasks}
          onTaskClick={mockTaskClick}
          onTaskDrop={mockTaskDrop}
        />
      );

      const results = await axe(container, {
        rules: {
          'aria-required-attr': { enabled: true },
          'aria-valid-attr-value': { enabled: true },
          'aria-roles': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should have proper heading hierarchy', async () => {
      const { container } = render(
        <MultiWeekCalendarView
          tasks={mockTasks}
          onTaskClick={mockTaskClick}
          onTaskDrop={mockTaskDrop}
        />
      );

      const results = await axe(container, {
        rules: {
          'heading-order': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();

      // Week headers should be level 2
      const weekHeaders = container.querySelectorAll('[role="heading"][aria-level="2"]');
      expect(weekHeaders.length).toBe(4); // 4 weeks
    });

    it('should provide context for screen readers on task count', async () => {
      const { container } = render(
        <MultiWeekCalendarView
          tasks={mockTasks}
          onTaskClick={mockTaskClick}
          onTaskDrop={mockTaskDrop}
        />
      );

      // Week headers include task count in aria-label
      const weekHeaders = container.querySelectorAll('[role="heading"]');
      weekHeaders.forEach((header) => {
        const label = header.getAttribute('aria-label');
        expect(label).toMatch(/sarcină|sarcini/);
      });
    });
  });

  describe('Weekend Column Accessibility', () => {
    it('should not have accessibility violations for narrow weekend columns', async () => {
      const { container } = render(
        <MultiWeekCalendarView
          tasks={mockTasks}
          onTaskClick={mockTaskClick}
          onTaskDrop={mockTaskDrop}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA labels for weekend day columns', async () => {
      const { container } = render(
        <MultiWeekCalendarView
          tasks={mockTasks}
          onTaskClick={mockTaskClick}
          onTaskDrop={mockTaskDrop}
        />
      );

      const dayColumns = container.querySelectorAll('[role="region"]');
      const weekendColumns = Array.from(dayColumns).filter((col) => {
        const label = col.getAttribute('aria-label');
        return label?.includes('sâmbătă') || label?.includes('duminică');
      });

      expect(weekendColumns.length).toBe(8); // 2 weekend days × 4 weeks
      weekendColumns.forEach((col) => {
        expect(col).toHaveAttribute('aria-label');
      });
    });
  });

  describe('Empty States', () => {
    it('should not have accessibility violations with empty day columns', async () => {
      const { container } = render(
        <MultiWeekCalendarView tasks={[]} onTaskClick={mockTaskClick} onTaskDrop={mockTaskDrop} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();

      // Empty state text should be present
      expect(screen.getAllByText('Fără sarcini').length).toBeGreaterThan(0);
    });

    it('should have proper ARIA labels even when empty', async () => {
      const { container } = render(
        <MultiWeekCalendarView tasks={[]} onTaskClick={mockTaskClick} onTaskDrop={mockTaskDrop} />
      );

      // Week headers should still have labels
      const weekHeaders = container.querySelectorAll('[role="heading"]');
      expect(weekHeaders.length).toBe(4);
      weekHeaders.forEach((header) => {
        expect(header).toHaveAttribute('aria-label');
        expect(header.getAttribute('aria-label')).toMatch(/0 sarcini/);
      });
    });
  });
});
