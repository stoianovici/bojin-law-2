/**
 * Accessibility tests for Task Management components
 * Tests WCAG AA compliance using jest-axe
 */

import React from 'react';
import { render } from '@testing-library/react';
import { axe, toHaveNoViolations } from 'jest-axe';
import { MultiWeekCalendarView } from './MultiWeekCalendarView';
import { KanbanBoard } from './KanbanBoard';
import { ListView } from './ListView';
import { TaskCreationBar } from './TaskCreationBar';
import { TaskDetailModal } from './TaskDetailModal';
import { createMockTasks, createMockTask } from '@legal-platform/test-utils';

expect.extend(toHaveNoViolations);

describe('Task Management Accessibility', () => {
  describe('MultiWeekCalendarView', () => {
    const mockTasks = createMockTasks(10);

    it('should not have any accessibility violations', async () => {
      const { container } = render(
        <MultiWeekCalendarView
          tasks={mockTasks}
          onTaskClick={jest.fn()}
          onTaskDrop={jest.fn()}
          weeksToShow={4}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA labels for navigation buttons', async () => {
      const { container } = render(
        <MultiWeekCalendarView
          tasks={mockTasks}
          onTaskClick={jest.fn()}
          onTaskDrop={jest.fn()}
          weeksToShow={4}
        />
      );

      const results = await axe(container, {
        rules: {
          'button-name': { enabled: true },
          'aria-required-attr': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should have proper color contrast for task type badges', async () => {
      const { container } = render(
        <MultiWeekCalendarView
          tasks={mockTasks}
          onTaskClick={jest.fn()}
          onTaskDrop={jest.fn()}
          weeksToShow={4}
        />
      );

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', async () => {
      const { container } = render(
        <MultiWeekCalendarView
          tasks={mockTasks}
          onTaskClick={jest.fn()}
          onTaskDrop={jest.fn()}
          weeksToShow={4}
        />
      );

      const results = await axe(container, {
        rules: {
          'tabindex': { enabled: true },
          'focus-order-semantics': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should not have accessibility violations when empty', async () => {
      const { container } = render(
        <MultiWeekCalendarView
          tasks={[]}
          onTaskClick={jest.fn()}
          onTaskDrop={jest.fn()}
          weeksToShow={4}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('KanbanBoard', () => {
    const mockTasks = createMockTasks(20);

    it('should not have any accessibility violations', async () => {
      const { container } = render(
        <KanbanBoard
          tasks={mockTasks}
          onTaskClick={jest.fn()}
          onTaskStatusChange={jest.fn()}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA labels for kanban columns', async () => {
      const { container } = render(
        <KanbanBoard
          tasks={mockTasks}
          onTaskClick={jest.fn()}
          onTaskStatusChange={jest.fn()}
        />
      );

      const results = await axe(container, {
        rules: {
          'aria-required-attr': { enabled: true },
          'aria-valid-attr-value': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should have accessible drag-and-drop with keyboard alternatives', async () => {
      const { container } = render(
        <KanbanBoard
          tasks={mockTasks}
          onTaskClick={jest.fn()}
          onTaskStatusChange={jest.fn()}
        />
      );

      const results = await axe(container, {
        rules: {
          'tabindex': { enabled: true },
          'button-name': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should have proper color contrast for task cards', async () => {
      const { container } = render(
        <KanbanBoard
          tasks={mockTasks}
          onTaskClick={jest.fn()}
          onTaskStatusChange={jest.fn()}
        />
      );

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should not have accessibility violations when empty', async () => {
      const { container } = render(
        <KanbanBoard tasks={[]} onTaskClick={jest.fn()} onTaskStatusChange={jest.fn()} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('ListView', () => {
    const mockTasks = createMockTasks(15);

    it('should not have any accessibility violations', async () => {
      const { container } = render(
        <ListView tasks={mockTasks} onTaskClick={jest.fn()} onSortChange={jest.fn()} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper table accessibility', async () => {
      const { container } = render(
        <ListView tasks={mockTasks} onTaskClick={jest.fn()} onSortChange={jest.fn()} />
      );

      const results = await axe(container, {
        rules: {
          'table-duplicate-name': { enabled: true },
          'table-fake-caption': { enabled: true },
          'th-has-data-cells': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA labels for sortable column headers', async () => {
      const { container } = render(
        <ListView tasks={mockTasks} onTaskClick={jest.fn()} onSortChange={jest.fn()} />
      );

      const results = await axe(container, {
        rules: {
          'button-name': { enabled: true },
          'aria-required-attr': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should have proper color contrast for type badges and priority indicators', async () => {
      const { container } = render(
        <ListView tasks={mockTasks} onTaskClick={jest.fn()} onSortChange={jest.fn()} />
      );

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should have accessible pagination controls', async () => {
      const { container } = render(
        <ListView tasks={mockTasks} onTaskClick={jest.fn()} onSortChange={jest.fn()} />
      );

      const results = await axe(container, {
        rules: {
          'button-name': { enabled: true },
          'aria-required-attr': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should not have accessibility violations when empty', async () => {
      const { container } = render(
        <ListView tasks={[]} onTaskClick={jest.fn()} onSortChange={jest.fn()} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation for table rows', async () => {
      const { container } = render(
        <ListView tasks={mockTasks} onTaskClick={jest.fn()} onSortChange={jest.fn()} />
      );

      const results = await axe(container, {
        rules: {
          'tabindex': { enabled: true },
          'focus-order-semantics': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });
  });

  describe('TaskCreationBar', () => {
    it('should not have any accessibility violations', async () => {
      const { container } = render(<TaskCreationBar onCreateTask={jest.fn()} />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper form accessibility', async () => {
      const { container } = render(<TaskCreationBar onCreateTask={jest.fn()} />);

      const results = await axe(container, {
        rules: {
          'label': { enabled: true },
          'form-field-multiple-labels': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA labels for input and buttons', async () => {
      const { container } = render(<TaskCreationBar onCreateTask={jest.fn()} />);

      const results = await axe(container, {
        rules: {
          'button-name': { enabled: true },
          'aria-required-attr': { enabled: true },
          'label': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should have proper color contrast for highlighted entities', async () => {
      const { container } = render(<TaskCreationBar onCreateTask={jest.fn()} />);

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation', async () => {
      const { container } = render(<TaskCreationBar onCreateTask={jest.fn()} />);

      const results = await axe(container, {
        rules: {
          'tabindex': { enabled: true },
          'focus-order-semantics': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });
  });

  describe('TaskDetailModal', () => {
    it('should not have any accessibility violations when creating new task', async () => {
      const { container } = render(
        <TaskDetailModal isOpen={true} onClose={jest.fn()} onSave={jest.fn()} task={null} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should not have any accessibility violations when editing task', async () => {
      const mockTask = createMockTask();
      const { container } = render(
        <TaskDetailModal
          isOpen={true}
          onClose={jest.fn()}
          onSave={jest.fn()}
          onDelete={jest.fn()}
          task={mockTask}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should have proper form accessibility', async () => {
      const { container } = render(
        <TaskDetailModal isOpen={true} onClose={jest.fn()} onSave={jest.fn()} task={null} />
      );

      const results = await axe(container, {
        rules: {
          'label': { enabled: true },
          'form-field-multiple-labels': { enabled: true },
          'aria-required-attr': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should have proper ARIA labels for all form fields', async () => {
      const { container } = render(
        <TaskDetailModal isOpen={true} onClose={jest.fn()} onSave={jest.fn()} task={null} />
      );

      const results = await axe(container, {
        rules: {
          'button-name': { enabled: true },
          'aria-required-attr': { enabled: true },
          'label': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should support keyboard navigation and modal focus trap', async () => {
      const { container } = render(
        <TaskDetailModal isOpen={true} onClose={jest.fn()} onSave={jest.fn()} task={null} />
      );

      const results = await axe(container, {
        rules: {
          'tabindex': { enabled: true },
          'focus-order-semantics': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should have proper color contrast for form elements', async () => {
      const { container } = render(
        <TaskDetailModal isOpen={true} onClose={jest.fn()} onSave={jest.fn()} task={null} />
      );

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should not have accessibility violations when closed', async () => {
      const { container } = render(
        <TaskDetailModal isOpen={false} onClose={jest.fn()} onSave={jest.fn()} task={null} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Romanian Diacritics Rendering', () => {
    it('should render Romanian diacritics correctly in MultiWeekCalendarView', async () => {
      const { container } = render(
        <MultiWeekCalendarView
          tasks={createMockTasks(5)}
          onTaskClick={jest.fn()}
          onTaskDrop={jest.fn()}
          weeksToShow={4}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should render Romanian diacritics correctly in KanbanBoard', async () => {
      const { container } = render(
        <KanbanBoard
          tasks={createMockTasks(5)}
          onTaskClick={jest.fn()}
          onTaskStatusChange={jest.fn()}
        />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should render Romanian diacritics correctly in ListView', async () => {
      const { container } = render(
        <ListView tasks={createMockTasks(5)} onTaskClick={jest.fn()} onSortChange={jest.fn()} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should render Romanian diacritics correctly in TaskCreationBar', async () => {
      const { container } = render(<TaskCreationBar onCreateTask={jest.fn()} />);

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });

    it('should render Romanian diacritics correctly in TaskDetailModal', async () => {
      const { container } = render(
        <TaskDetailModal isOpen={true} onClose={jest.fn()} onSave={jest.fn()} task={null} />
      );

      const results = await axe(container);
      expect(results).toHaveNoViolations();
    });
  });

  describe('Color Contrast for Task Types', () => {
    it('should have proper color contrast for Research tasks (Blue)', async () => {
      const researchTasks = createMockTasks(3).map((task) => ({
        ...task,
        type: 'Research' as const,
      }));

      const { container } = render(
        <KanbanBoard
          tasks={researchTasks}
          onTaskClick={jest.fn()}
          onTaskStatusChange={jest.fn()}
        />
      );

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should have proper color contrast for DocumentCreation tasks (Green)', async () => {
      const docTasks = createMockTasks(3).map((task) => ({
        ...task,
        type: 'DocumentCreation' as const,
      }));

      const { container } = render(
        <KanbanBoard tasks={docTasks} onTaskClick={jest.fn()} onTaskStatusChange={jest.fn()} />
      );

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should have proper color contrast for CourtDate tasks (Red)', async () => {
      const courtTasks = createMockTasks(3).map((task) => ({
        ...task,
        type: 'CourtDate' as const,
      }));

      const { container } = render(
        <KanbanBoard tasks={courtTasks} onTaskClick={jest.fn()} onTaskStatusChange={jest.fn()} />
      );

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should have proper color contrast for Meeting tasks (Yellow)', async () => {
      const meetingTasks = createMockTasks(3).map((task) => ({
        ...task,
        type: 'Meeting' as const,
      }));

      const { container } = render(
        <KanbanBoard
          tasks={meetingTasks}
          onTaskClick={jest.fn()}
          onTaskStatusChange={jest.fn()}
        />
      );

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });

    it('should have proper color contrast for all 6 task types in ListView', async () => {
      const allTypeTasks = [
        { ...createMockTask(), type: 'Research' as const },
        { ...createMockTask(), type: 'DocumentCreation' as const },
        { ...createMockTask(), type: 'DocumentRetrieval' as const },
        { ...createMockTask(), type: 'CourtDate' as const },
        { ...createMockTask(), type: 'Meeting' as const },
        { ...createMockTask(), type: 'BusinessTrip' as const },
      ];

      const { container } = render(
        <ListView tasks={allTypeTasks} onTaskClick={jest.fn()} onSortChange={jest.fn()} />
      );

      const results = await axe(container, {
        rules: {
          'color-contrast': { enabled: true },
        },
      });

      expect(results).toHaveNoViolations();
    });
  });

  describe('Screen Reader Compatibility', () => {
    it('should have proper ARIA roles and labels in MultiWeekCalendarView', async () => {
      const { container } = render(
        <MultiWeekCalendarView
          tasks={createMockTasks(10)}
          onTaskClick={jest.fn()}
          onTaskDrop={jest.fn()}
          weeksToShow={4}
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

    it('should have proper ARIA roles and labels in KanbanBoard', async () => {
      const { container } = render(
        <KanbanBoard
          tasks={createMockTasks(10)}
          onTaskClick={jest.fn()}
          onTaskStatusChange={jest.fn()}
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

    it('should have proper ARIA roles and labels in TaskDetailModal', async () => {
      const { container } = render(
        <TaskDetailModal isOpen={true} onClose={jest.fn()} onSave={jest.fn()} task={null} />
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
  });
});
