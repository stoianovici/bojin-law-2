/**
 * TaskCard Component Tests
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskCard } from './TaskCard';
import { createTask, createUser } from '@legal-platform/test-utils';

// Mock date-fns
jest.mock('date-fns', () => ({
  format: jest.fn(() => '12 Nov'),
  differenceInDays: jest.fn(() => 5),
}));

jest.mock('date-fns/locale', () => ({
  ro: {},
}));

describe('TaskCard', () => {
  const mockTask = createTask({
    title: 'Test Task',
    description: 'Test description',
    priority: 'High',
    dueDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
  });

  const mockAssignee = createUser({
    firstName: 'Ion',
    lastName: 'Popescu',
  });

  it('should render task title', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByText('Test Task')).toBeInTheDocument();
  });

  it('should render task description', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('should render priority badge', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByText('Înaltă')).toBeInTheDocument();
  });

  it('should render assignee avatar when provided', () => {
    render(<TaskCard task={mockTask} assignee={mockAssignee} />);
    expect(screen.getByText('IP')).toBeInTheDocument(); // Initials
  });

  it('should not render assignee when not provided', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.queryByText('IP')).not.toBeInTheDocument();
  });

  it('should call onTaskClick when card is clicked', () => {
    const handleClick = jest.fn();
    render(<TaskCard task={mockTask} onTaskClick={handleClick} />);

    fireEvent.click(screen.getByText('Test Task'));
    expect(handleClick).toHaveBeenCalledWith(mockTask);
  });

  it('should call onMenuClick when menu button is clicked', () => {
    const handleMenuClick = jest.fn();
    render(<TaskCard task={mockTask} onMenuClick={handleMenuClick} />);

    const menuButton = screen.getByLabelText('Opțiuni sarcină');
    fireEvent.click(menuButton);
    expect(handleMenuClick).toHaveBeenCalledWith(mockTask);
  });

  it('should not call onTaskClick when menu button is clicked', () => {
    const handleTaskClick = jest.fn();
    const handleMenuClick = jest.fn();
    render(
      <TaskCard
        task={mockTask}
        onTaskClick={handleTaskClick}
        onMenuClick={handleMenuClick}
      />
    );

    const menuButton = screen.getByLabelText('Opțiuni sarcină');
    fireEvent.click(menuButton);

    expect(handleMenuClick).toHaveBeenCalledTimes(1);
    expect(handleTaskClick).not.toHaveBeenCalled();
  });

  it('should render drag hint', () => {
    render(<TaskCard task={mockTask} />);
    expect(screen.getByText('Trageți pentru a muta')).toBeInTheDocument();
  });

  it('should truncate long descriptions', () => {
    const longDescription =
      'This is a very long description that should be truncated to avoid taking up too much space in the card. It should be cut off at around 100 characters and show an ellipsis.';
    const taskWithLongDescription = createTask({
      ...mockTask,
      description: longDescription,
    });

    render(<TaskCard task={taskWithLongDescription} />);
    const description = screen.getByText(/This is a very long/);
    expect(description.textContent).toContain('...');
  });

  it('should render different priority levels correctly', () => {
    const { rerender } = render(
      <TaskCard task={{ ...mockTask, priority: 'High' }} />
    );
    expect(screen.getByText('Înaltă')).toBeInTheDocument();

    rerender(<TaskCard task={{ ...mockTask, priority: 'Medium' }} />);
    expect(screen.getByText('Medie')).toBeInTheDocument();

    rerender(<TaskCard task={{ ...mockTask, priority: 'Low' }} />);
    expect(screen.getByText('Scăzută')).toBeInTheDocument();
  });
});
