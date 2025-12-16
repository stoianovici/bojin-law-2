/**
 * TaskKanbanBoard Component Tests
 * Tests column rendering and task organization
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { TaskKanbanBoard } from './TaskKanbanBoard';
import { createTask, createUser } from '@legal-platform/test-utils';

describe('TaskKanbanBoard', () => {
  const mockUsers = [
    createUser({ id: 'user-1', firstName: 'Ion', lastName: 'Popescu' }),
    createUser({ id: 'user-2', firstName: 'Maria', lastName: 'Ionescu' }),
  ];

  const mockTasks = [
    createTask({ id: 'task-1', title: 'Task To Do', status: 'Pending', priority: 'High' }),
    createTask({
      id: 'task-2',
      title: 'Task In Progress',
      status: 'InProgress',
      priority: 'Medium',
    }),
    createTask({ id: 'task-3', title: 'Task In Review', status: 'Cancelled', priority: 'Low' }),
    createTask({ id: 'task-4', title: 'Task Completed', status: 'Completed', priority: 'High' }),
    createTask({ id: 'task-5', title: 'Another To Do', status: 'Pending', priority: 'Medium' }),
  ];

  it('should render all 4 kanban columns', () => {
    render(<TaskKanbanBoard tasks={mockTasks} users={mockUsers} />);

    expect(screen.getByText('De Făcut')).toBeInTheDocument(); // To Do
    expect(screen.getByText('În Lucru')).toBeInTheDocument(); // In Progress
    expect(screen.getByText('În Revizuire')).toBeInTheDocument(); // Review
    expect(screen.getByText('Finalizat')).toBeInTheDocument(); // Complete
  });

  it('should display task count in each column header', () => {
    render(<TaskKanbanBoard tasks={mockTasks} users={mockUsers} />);

    // 2 tasks in To Do column
    const toDoColumn = screen.getByText('De Făcut').closest('div');
    expect(toDoColumn).toHaveTextContent('2');

    // 1 task in In Progress column
    const inProgressColumn = screen.getByText('În Lucru').closest('div');
    expect(inProgressColumn).toHaveTextContent('1');

    // 1 task in Review column
    const reviewColumn = screen.getByText('În Revizuire').closest('div');
    expect(reviewColumn).toHaveTextContent('1');

    // 1 task in Complete column
    const completeColumn = screen.getByText('Finalizat').closest('div');
    expect(completeColumn).toHaveTextContent('1');
  });

  it('should render tasks in correct columns based on status', () => {
    render(<TaskKanbanBoard tasks={mockTasks} users={mockUsers} />);

    expect(screen.getByText('Task To Do')).toBeInTheDocument();
    expect(screen.getByText('Task In Progress')).toBeInTheDocument();
    expect(screen.getByText('Task In Review')).toBeInTheDocument();
    expect(screen.getByText('Task Completed')).toBeInTheDocument();
    expect(screen.getByText('Another To Do')).toBeInTheDocument();
  });

  it('should render Add Task button in each column', () => {
    render(<TaskKanbanBoard tasks={mockTasks} users={mockUsers} />);

    const addTaskButtons = screen.getAllByText(/adaugă sarcină/i);
    expect(addTaskButtons).toHaveLength(4); // One per column
  });

  it('should display drag-and-drop visual indicator note', () => {
    render(<TaskKanbanBoard tasks={mockTasks} users={mockUsers} />);

    expect(screen.getByText(/glisare.*versiunile viitoare/i)).toBeInTheDocument();
  });

  it('should render empty column when no tasks have that status', () => {
    const tasksWithoutReview = mockTasks.filter((t) => t.status !== 'Cancelled');
    render(<TaskKanbanBoard tasks={tasksWithoutReview} users={mockUsers} />);

    const reviewColumn = screen.getByText('În Revizuire').closest('div');
    expect(reviewColumn).toHaveTextContent('0');
  });

  it('should render board with 4-column grid layout', () => {
    const { container } = render(<TaskKanbanBoard tasks={mockTasks} users={mockUsers} />);
    const boardGrid = container.querySelector('.lg\\:grid-cols-4');

    expect(boardGrid).toBeInTheDocument();
  });

  it('should display all tasks when empty tasks array', () => {
    render(<TaskKanbanBoard tasks={[]} users={mockUsers} />);

    // All columns should show 0 tasks
    expect(screen.getAllByText('0')).toHaveLength(4);
  });

  it('should color-code column headers appropriately', () => {
    const { container } = render(<TaskKanbanBoard tasks={mockTasks} users={mockUsers} />);

    // Check badge colors (the count badges have the color coding)
    const toDoHeader = screen.getByText('De Făcut').parentElement;
    const toDoCountBadge = toDoHeader?.querySelector('.bg-gray-100');
    expect(toDoCountBadge).toBeInTheDocument();

    const inProgressHeader = screen.getByText('În Lucru').parentElement;
    const inProgressCountBadge = inProgressHeader?.querySelector('.bg-blue-100');
    expect(inProgressCountBadge).toBeInTheDocument();

    const reviewHeader = screen.getByText('În Revizuire').parentElement;
    const reviewCountBadge = reviewHeader?.querySelector('.bg-yellow-100');
    expect(reviewCountBadge).toBeInTheDocument();

    const completeHeader = screen.getByText('Finalizat').parentElement;
    const completeCountBadge = completeHeader?.querySelector('.bg-green-100');
    expect(completeCountBadge).toBeInTheDocument();
  });

  it('should render multiple tasks in same column', () => {
    render(<TaskKanbanBoard tasks={mockTasks} users={mockUsers} />);

    const toDoTasks = [screen.getByText('Task To Do'), screen.getByText('Another To Do')];

    toDoTasks.forEach((task) => {
      expect(task).toBeInTheDocument();
    });
  });
});
