/**
 * Tests for task-management.store
 */

import { renderHook, act } from '@testing-library/react';
import { useTaskManagementStore, useFilteredTasks } from './task-management.store';
import { createMockTask, createMockTasks } from '@legal-platform/test-utils';
import type { Task } from '@legal-platform/types';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};

  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock,
});

describe('useTaskManagementStore', () => {
  beforeEach(() => {
    // Clear store and localStorage before each test
    localStorageMock.clear();
    const { result } = renderHook(() => useTaskManagementStore());
    act(() => {
      result.current.setActiveView('calendar');
      result.current.setTasks([]);
      result.current.selectTask(null);
      result.current.clearFilters();
      result.current.setSortConfig({ field: 'dueDate', direction: 'asc' });
      result.current.closeTaskDetailModal();
    });
  });

  describe('Initial State', () => {
    it('has correct initial state', () => {
      const { result } = renderHook(() => useTaskManagementStore());

      expect(result.current.activeView).toBe('calendar');
      expect(result.current.tasks).toEqual([]);
      expect(result.current.selectedTask).toBeNull();
      expect(result.current.isTaskDetailModalOpen).toBe(false);
      expect(result.current.filters).toEqual({
        types: undefined,
        statuses: undefined,
        priorities: undefined,
        assignedTo: undefined,
        dateRange: undefined,
        searchQuery: undefined,
      });
      expect(result.current.sortConfig).toEqual({
        field: 'dueDate',
        direction: 'asc',
      });
    });
  });

  describe('setActiveView', () => {
    it('sets active view to calendar', () => {
      const { result } = renderHook(() => useTaskManagementStore());

      act(() => {
        result.current.setActiveView('calendar');
      });

      expect(result.current.activeView).toBe('calendar');
    });

    it('sets active view to kanban', () => {
      const { result } = renderHook(() => useTaskManagementStore());

      act(() => {
        result.current.setActiveView('kanban');
      });

      expect(result.current.activeView).toBe('kanban');
    });

    it('sets active view to list', () => {
      const { result } = renderHook(() => useTaskManagementStore());

      act(() => {
        result.current.setActiveView('list');
      });

      expect(result.current.activeView).toBe('list');
    });
  });

  describe('setTasks', () => {
    it('sets task list', () => {
      const { result } = renderHook(() => useTaskManagementStore());
      const mockTasks = createMockTasks(5);

      act(() => {
        result.current.setTasks(mockTasks);
      });

      expect(result.current.tasks).toHaveLength(5);
      expect(result.current.tasks).toEqual(mockTasks);
    });

    it('replaces existing tasks', () => {
      const { result } = renderHook(() => useTaskManagementStore());
      const firstTasks = createMockTasks(3);
      const secondTasks = createMockTasks(5);

      act(() => {
        result.current.setTasks(firstTasks);
      });

      expect(result.current.tasks).toHaveLength(3);

      act(() => {
        result.current.setTasks(secondTasks);
      });

      expect(result.current.tasks).toHaveLength(5);
      expect(result.current.tasks).toEqual(secondTasks);
    });
  });

  describe('selectTask', () => {
    it('selects a task', () => {
      const { result } = renderHook(() => useTaskManagementStore());
      const mockTask = createMockTask();

      act(() => {
        result.current.selectTask(mockTask);
      });

      expect(result.current.selectedTask).toEqual(mockTask);
    });

    it('deselects task when null', () => {
      const { result } = renderHook(() => useTaskManagementStore());
      const mockTask = createMockTask();

      act(() => {
        result.current.selectTask(mockTask);
      });

      expect(result.current.selectedTask).toEqual(mockTask);

      act(() => {
        result.current.selectTask(null);
      });

      expect(result.current.selectedTask).toBeNull();
    });
  });

  describe('updateTask', () => {
    it('updates a task in the list', () => {
      const { result } = renderHook(() => useTaskManagementStore());
      const mockTasks = createMockTasks(3);

      act(() => {
        result.current.setTasks(mockTasks);
      });

      const taskToUpdate = mockTasks[1];

      act(() => {
        result.current.updateTask(taskToUpdate.id, { title: 'Updated Title' });
      });

      const updatedTask = result.current.tasks.find((t) => t.id === taskToUpdate.id);
      expect(updatedTask?.title).toBe('Updated Title');
    });

    it('updates selectedTask if it matches the updated task', () => {
      const { result } = renderHook(() => useTaskManagementStore());
      const mockTask = createMockTask();

      act(() => {
        result.current.setTasks([mockTask]);
        result.current.selectTask(mockTask);
      });

      expect(result.current.selectedTask?.title).toBe(mockTask.title);

      act(() => {
        result.current.updateTask(mockTask.id, { title: 'New Title' });
      });

      expect(result.current.selectedTask?.title).toBe('New Title');
    });

    it('does not affect selectedTask if different task is updated', () => {
      const { result } = renderHook(() => useTaskManagementStore());
      const mockTasks = createMockTasks(2);

      act(() => {
        result.current.setTasks(mockTasks);
        result.current.selectTask(mockTasks[0]);
      });

      act(() => {
        result.current.updateTask(mockTasks[1].id, { title: 'Updated' });
      });

      expect(result.current.selectedTask).toEqual(mockTasks[0]);
    });

    it('updates updatedAt timestamp', () => {
      const { result } = renderHook(() => useTaskManagementStore());
      const mockTask = createMockTask();
      const originalUpdatedAt = mockTask.updatedAt;

      act(() => {
        result.current.setTasks([mockTask]);
      });

      // Wait a bit to ensure timestamp difference
      act(() => {
        result.current.updateTask(mockTask.id, { title: 'Updated' });
      });

      const updatedTask = result.current.tasks.find((t) => t.id === mockTask.id);
      expect(updatedTask?.updatedAt).not.toEqual(originalUpdatedAt);
    });
  });

  describe('createTask', () => {
    it('creates a new task', () => {
      const { result } = renderHook(() => useTaskManagementStore());

      const newTaskData = {
        caseId: 'case-123',
        type: 'Research' as const,
        title: 'New Research Task',
        description: 'Research legal precedents',
        assignedTo: 'user-456',
        dueDate: new Date(),
        status: 'Pending' as const,
        priority: 'High' as const,
        metadata: {},
      };

      act(() => {
        result.current.createTask(newTaskData);
      });

      expect(result.current.tasks).toHaveLength(1);
      expect(result.current.tasks[0].title).toBe('New Research Task');
      expect(result.current.tasks[0].type).toBe('Research');
    });

    it('generates unique ID for new task', () => {
      const { result } = renderHook(() => useTaskManagementStore());

      const newTaskData = {
        caseId: 'case-123',
        type: 'Meeting' as const,
        title: 'Task 1',
        description: 'Description',
        assignedTo: 'user-1',
        dueDate: new Date(),
        status: 'Pending' as const,
        priority: 'Medium' as const,
        metadata: {},
      };

      act(() => {
        result.current.createTask(newTaskData);
        result.current.createTask({ ...newTaskData, title: 'Task 2' });
      });

      expect(result.current.tasks).toHaveLength(2);
      expect(result.current.tasks[0].id).not.toBe(result.current.tasks[1].id);
    });

    it('sets createdAt and updatedAt timestamps', () => {
      const { result } = renderHook(() => useTaskManagementStore());

      const newTaskData = {
        caseId: 'case-123',
        type: 'DocumentCreation' as const,
        title: 'New Task',
        description: 'Description',
        assignedTo: 'user-1',
        dueDate: new Date(),
        status: 'Pending' as const,
        priority: 'Low' as const,
        metadata: {},
      };

      act(() => {
        result.current.createTask(newTaskData);
      });

      const createdTask = result.current.tasks[0];
      expect(createdTask.createdAt).toBeInstanceOf(Date);
      expect(createdTask.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('deleteTask', () => {
    it('deletes a task from the list', () => {
      const { result } = renderHook(() => useTaskManagementStore());
      const mockTasks = createMockTasks(3);

      act(() => {
        result.current.setTasks(mockTasks);
      });

      expect(result.current.tasks).toHaveLength(3);

      act(() => {
        result.current.deleteTask(mockTasks[1].id);
      });

      expect(result.current.tasks).toHaveLength(2);
      expect(result.current.tasks.find((t) => t.id === mockTasks[1].id)).toBeUndefined();
    });

    it('clears selectedTask if deleted task was selected', () => {
      const { result } = renderHook(() => useTaskManagementStore());
      const mockTask = createMockTask();

      act(() => {
        result.current.setTasks([mockTask]);
        result.current.selectTask(mockTask);
      });

      expect(result.current.selectedTask).toEqual(mockTask);

      act(() => {
        result.current.deleteTask(mockTask.id);
      });

      expect(result.current.selectedTask).toBeNull();
    });

    it('does not clear selectedTask if different task is deleted', () => {
      const { result } = renderHook(() => useTaskManagementStore());
      const mockTasks = createMockTasks(2);

      act(() => {
        result.current.setTasks(mockTasks);
        result.current.selectTask(mockTasks[0]);
      });

      act(() => {
        result.current.deleteTask(mockTasks[1].id);
      });

      expect(result.current.selectedTask).toEqual(mockTasks[0]);
    });
  });

  describe('setFilters', () => {
    it('sets type filter', () => {
      const { result } = renderHook(() => useTaskManagementStore());

      act(() => {
        result.current.setFilters({ types: ['Research', 'Meeting'] });
      });

      expect(result.current.filters.types).toEqual(['Research', 'Meeting']);
    });

    it('sets status filter', () => {
      const { result } = renderHook(() => useTaskManagementStore());

      act(() => {
        result.current.setFilters({ statuses: ['Pending', 'InProgress'] });
      });

      expect(result.current.filters.statuses).toEqual(['Pending', 'InProgress']);
    });

    it('sets priority filter', () => {
      const { result } = renderHook(() => useTaskManagementStore());

      act(() => {
        result.current.setFilters({ priorities: ['High', 'Urgent'] });
      });

      expect(result.current.filters.priorities).toEqual(['High', 'Urgent']);
    });

    it('sets search query filter', () => {
      const { result } = renderHook(() => useTaskManagementStore());

      act(() => {
        result.current.setFilters({ searchQuery: 'contract' });
      });

      expect(result.current.filters.searchQuery).toBe('contract');
    });

    it('merges filters with existing ones', () => {
      const { result } = renderHook(() => useTaskManagementStore());

      act(() => {
        result.current.setFilters({ types: ['Research'] });
        result.current.setFilters({ statuses: ['Pending'] });
      });

      expect(result.current.filters.types).toEqual(['Research']);
      expect(result.current.filters.statuses).toEqual(['Pending']);
    });
  });

  describe('clearFilters', () => {
    it('clears all filters', () => {
      const { result } = renderHook(() => useTaskManagementStore());

      act(() => {
        result.current.setFilters({
          types: ['Research'],
          statuses: ['Pending'],
          priorities: ['High'],
          searchQuery: 'test',
        });
      });

      expect(result.current.filters.types).toEqual(['Research']);

      act(() => {
        result.current.clearFilters();
      });

      expect(result.current.filters).toEqual({
        types: undefined,
        statuses: undefined,
        priorities: undefined,
        assignedTo: undefined,
        dateRange: undefined,
        searchQuery: undefined,
      });
    });
  });

  describe('setSortConfig', () => {
    it('sets sort configuration', () => {
      const { result } = renderHook(() => useTaskManagementStore());

      act(() => {
        result.current.setSortConfig({ field: 'title', direction: 'desc' });
      });

      expect(result.current.sortConfig).toEqual({
        field: 'title',
        direction: 'desc',
      });
    });

    it('can sort by different fields', () => {
      const { result } = renderHook(() => useTaskManagementStore());

      act(() => {
        result.current.setSortConfig({ field: 'priority', direction: 'asc' });
      });

      expect(result.current.sortConfig.field).toBe('priority');
    });
  });

  describe('openTaskDetailModal', () => {
    it('opens modal without task', () => {
      const { result } = renderHook(() => useTaskManagementStore());

      act(() => {
        result.current.openTaskDetailModal();
      });

      expect(result.current.isTaskDetailModalOpen).toBe(true);
      expect(result.current.selectedTask).toBeNull();
    });

    it('opens modal with task', () => {
      const { result } = renderHook(() => useTaskManagementStore());
      const mockTask = createMockTask();

      act(() => {
        result.current.openTaskDetailModal(mockTask);
      });

      expect(result.current.isTaskDetailModalOpen).toBe(true);
      expect(result.current.selectedTask).toEqual(mockTask);
    });
  });

  describe('closeTaskDetailModal', () => {
    it('closes modal and clears selected task', () => {
      const { result } = renderHook(() => useTaskManagementStore());
      const mockTask = createMockTask();

      act(() => {
        result.current.openTaskDetailModal(mockTask);
      });

      expect(result.current.isTaskDetailModalOpen).toBe(true);
      expect(result.current.selectedTask).toEqual(mockTask);

      act(() => {
        result.current.closeTaskDetailModal();
      });

      expect(result.current.isTaskDetailModalOpen).toBe(false);
      expect(result.current.selectedTask).toBeNull();
    });
  });

  describe('localStorage persistence', () => {
    it('persists activeView to localStorage', () => {
      const { result: result1 } = renderHook(() => useTaskManagementStore());

      act(() => {
        result1.current.setActiveView('kanban');
      });

      // Create new hook instance to simulate page reload
      const { result: result2 } = renderHook(() => useTaskManagementStore());

      expect(result2.current.activeView).toBe('kanban');
    });

    it('does not persist tasks to localStorage', () => {
      const { result } = renderHook(() => useTaskManagementStore());
      const mockTasks = createMockTasks(10);

      act(() => {
        result.current.setTasks(mockTasks);
      });

      // Verify tasks are in memory
      expect(result.current.tasks).toHaveLength(10);

      // Verify tasks are NOT in localStorage (only activeView should be persisted)
      const persistedState = localStorageMock.getItem('task-management-storage');
      if (persistedState) {
        const parsed = JSON.parse(persistedState);
        // Tasks should either not be in localStorage or be empty
        expect(parsed.state?.tasks ?? []).toEqual([]);
      }
    });
  });
});

describe('useFilteredTasks', () => {
  beforeEach(() => {
    localStorageMock.clear();
    const { result } = renderHook(() => useTaskManagementStore());
    act(() => {
      result.current.setTasks([]);
      result.current.clearFilters();
      result.current.setSortConfig({ field: 'dueDate', direction: 'asc' });
    });
  });

  it('returns all tasks when no filters applied', () => {
    const { result: storeResult } = renderHook(() => useTaskManagementStore());
    const mockTasks = createMockTasks(10);

    act(() => {
      storeResult.current.setTasks(mockTasks);
    });

    const { result: filteredResult } = renderHook(() => useFilteredTasks());

    expect(filteredResult.current).toHaveLength(10);
  });

  it('filters by task type', () => {
    const { result: storeResult } = renderHook(() => useTaskManagementStore());
    const mockTasks = createMockTasks(20);

    act(() => {
      storeResult.current.setTasks(mockTasks);
      storeResult.current.setFilters({ types: ['Research'] });
    });

    const { result: filteredResult } = renderHook(() => useFilteredTasks());

    filteredResult.current.forEach((task) => {
      expect(task.type).toBe('Research');
    });
  });

  it('filters by status', () => {
    const { result: storeResult } = renderHook(() => useTaskManagementStore());
    const mockTasks = createMockTasks(20);

    act(() => {
      storeResult.current.setTasks(mockTasks);
      storeResult.current.setFilters({ statuses: ['Completed'] });
    });

    const { result: filteredResult } = renderHook(() => useFilteredTasks());

    filteredResult.current.forEach((task) => {
      expect(task.status).toBe('Completed');
    });
  });

  it('filters by priority', () => {
    const { result: storeResult } = renderHook(() => useTaskManagementStore());
    const mockTasks = createMockTasks(20);

    act(() => {
      storeResult.current.setTasks(mockTasks);
      storeResult.current.setFilters({ priorities: ['Urgent'] });
    });

    const { result: filteredResult } = renderHook(() => useFilteredTasks());

    filteredResult.current.forEach((task) => {
      expect(task.priority).toBe('Urgent');
    });
  });

  it('filters by search query in title', () => {
    const { result: storeResult } = renderHook(() => useTaskManagementStore());
    const mockTasks = [
      { ...createMockTask(), title: 'Contract Research' },
      { ...createMockTask(), title: 'Meeting Notes' },
      { ...createMockTask(), title: 'Draft Contract' },
    ];

    act(() => {
      storeResult.current.setTasks(mockTasks);
      storeResult.current.setFilters({ searchQuery: 'contract' });
    });

    const { result: filteredResult } = renderHook(() => useFilteredTasks());

    expect(filteredResult.current).toHaveLength(2);
    filteredResult.current.forEach((task) => {
      expect(task.title.toLowerCase()).toContain('contract');
    });
  });

  it('filters by search query in description', () => {
    const { result: storeResult } = renderHook(() => useTaskManagementStore());
    const mockTasks = [
      { ...createMockTask(), description: 'Analyze legal precedents' },
      { ...createMockTask(), description: 'Review contract terms' },
      { ...createMockTask(), description: 'Schedule meeting' },
    ];

    act(() => {
      storeResult.current.setTasks(mockTasks);
      storeResult.current.setFilters({ searchQuery: 'legal' });
    });

    const { result: filteredResult } = renderHook(() => useFilteredTasks());

    expect(filteredResult.current).toHaveLength(1);
    expect(filteredResult.current[0].description).toContain('legal');
  });

  it('sorts by due date ascending', () => {
    const { result: storeResult } = renderHook(() => useTaskManagementStore());
    const now = new Date();
    const mockTasks = [
      { ...createMockTask(), dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) },
      { ...createMockTask(), dueDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000) },
      { ...createMockTask(), dueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000) },
    ];

    act(() => {
      storeResult.current.setTasks(mockTasks);
      storeResult.current.setSortConfig({ field: 'dueDate', direction: 'asc' });
    });

    const { result: filteredResult } = renderHook(() => useFilteredTasks());

    expect(filteredResult.current[0].dueDate.getTime()).toBeLessThan(
      filteredResult.current[1].dueDate.getTime()
    );
    expect(filteredResult.current[1].dueDate.getTime()).toBeLessThan(
      filteredResult.current[2].dueDate.getTime()
    );
  });

  it('sorts by due date descending', () => {
    const { result: storeResult } = renderHook(() => useTaskManagementStore());
    const now = new Date();
    const mockTasks = [
      { ...createMockTask(), dueDate: new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000) },
      { ...createMockTask(), dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000) },
      { ...createMockTask(), dueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000) },
    ];

    act(() => {
      storeResult.current.setTasks(mockTasks);
      storeResult.current.setSortConfig({ field: 'dueDate', direction: 'desc' });
    });

    const { result: filteredResult } = renderHook(() => useFilteredTasks());

    expect(filteredResult.current[0].dueDate.getTime()).toBeGreaterThan(
      filteredResult.current[1].dueDate.getTime()
    );
    expect(filteredResult.current[1].dueDate.getTime()).toBeGreaterThan(
      filteredResult.current[2].dueDate.getTime()
    );
  });

  it('sorts by title ascending', () => {
    const { result: storeResult } = renderHook(() => useTaskManagementStore());
    const mockTasks = [
      { ...createMockTask(), title: 'Zebra' },
      { ...createMockTask(), title: 'Alpha' },
      { ...createMockTask(), title: 'Beta' },
    ];

    act(() => {
      storeResult.current.setTasks(mockTasks);
      storeResult.current.setSortConfig({ field: 'title', direction: 'asc' });
    });

    const { result: filteredResult } = renderHook(() => useFilteredTasks());

    expect(filteredResult.current[0].title).toBe('Alpha');
    expect(filteredResult.current[1].title).toBe('Beta');
    expect(filteredResult.current[2].title).toBe('Zebra');
  });

  it('applies multiple filters simultaneously', () => {
    const { result: storeResult } = renderHook(() => useTaskManagementStore());
    const mockTasks = createMockTasks(50);

    act(() => {
      storeResult.current.setTasks(mockTasks);
      storeResult.current.setFilters({
        types: ['Research', 'Meeting'],
        statuses: ['Pending'],
        priorities: ['High', 'Urgent'],
      });
    });

    const { result: filteredResult } = renderHook(() => useFilteredTasks());

    filteredResult.current.forEach((task) => {
      expect(['Research', 'Meeting']).toContain(task.type);
      expect(task.status).toBe('Pending');
      expect(['High', 'Urgent']).toContain(task.priority);
    });
  });
});
