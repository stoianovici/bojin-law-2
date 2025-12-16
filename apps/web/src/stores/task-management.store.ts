/**
 * Task Management Store
 * Zustand store for managing task management state (views, tasks, filters, sorting)
 * Uses persist middleware to save view preference to localStorage
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Task, TaskView, TaskFilters, TaskSortConfig } from '@legal-platform/types';

/**
 * Task Management state interface
 */
interface TaskManagementState {
  // State
  activeView: TaskView;
  tasks: Task[];
  selectedTask: Task | null;
  filters: TaskFilters;
  sortConfig: TaskSortConfig;
  isTaskDetailModalOpen: boolean;

  // Actions
  setActiveView: (view: TaskView) => void;
  setTasks: (tasks: Task[]) => void;
  selectTask: (task: Task | null) => void;
  updateTask: (taskId: string, updates: Partial<Task>) => void;
  createTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => void;
  deleteTask: (taskId: string) => void;
  setFilters: (filters: Partial<TaskFilters>) => void;
  clearFilters: () => void;
  setSortConfig: (config: TaskSortConfig) => void;
  openTaskDetailModal: (task?: Task) => void;
  closeTaskDetailModal: () => void;
}

/**
 * Initial filter state
 */
const initialFilters: TaskFilters = {
  types: undefined,
  statuses: undefined,
  priorities: undefined,
  assignedTo: undefined,
  dateRange: undefined,
  searchQuery: undefined,
};

/**
 * Initial sort configuration
 */
const initialSortConfig: TaskSortConfig = {
  field: 'dueDate',
  direction: 'asc',
};

/**
 * Task management store with persistent view preference
 * Only persists activeView to avoid storing large task arrays in localStorage
 */
export const useTaskManagementStore = create<TaskManagementState>()(
  persist(
    (set, _get) => ({
      // Initial state
      activeView: 'calendar',
      tasks: [],
      selectedTask: null,
      filters: initialFilters,
      sortConfig: initialSortConfig,
      isTaskDetailModalOpen: false,

      // Switch between task views (Calendar, Kanban, List)
      setActiveView: (view: TaskView) => {
        set({ activeView: view });
      },

      // Set the task list (used by mock data or API)
      setTasks: (tasks: Task[]) => {
        set({ tasks });
      },

      // Select a task (for editing or viewing details)
      selectTask: (task: Task | null) => {
        set({ selectedTask: task });
      },

      // Update an existing task (mock implementation for prototype)
      updateTask: (taskId: string, updates: Partial<Task>) => {
        set((state) => ({
          tasks: state.tasks.map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  ...updates,
                  updatedAt: new Date(),
                }
              : task
          ),
          // Update selected task if it's the one being updated
          selectedTask:
            state.selectedTask?.id === taskId
              ? { ...state.selectedTask, ...updates, updatedAt: new Date() }
              : state.selectedTask,
        }));
      },

      // Create a new task (mock implementation for prototype)
      createTask: (taskData: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => {
        const newTask: Task = {
          ...taskData,
          id: `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Mock UUID
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        set((state) => ({
          tasks: [...state.tasks, newTask],
        }));

        return newTask;
      },

      // Delete a task (mock implementation for prototype)
      deleteTask: (taskId: string) => {
        set((state) => ({
          tasks: state.tasks.filter((task) => task.id !== taskId),
          selectedTask: state.selectedTask?.id === taskId ? null : state.selectedTask,
        }));
      },

      // Apply filters to tasks
      setFilters: (filters: Partial<TaskFilters>) => {
        set((state) => ({
          filters: { ...state.filters, ...filters },
        }));
      },

      // Clear all filters
      clearFilters: () => {
        set({ filters: initialFilters });
      },

      // Set sort configuration
      setSortConfig: (config: TaskSortConfig) => {
        set({ sortConfig: config });
      },

      // Open task detail modal (optionally with a task pre-selected)
      openTaskDetailModal: (task?: Task) => {
        set({
          isTaskDetailModalOpen: true,
          selectedTask: task || null,
        });
      },

      // Close task detail modal
      closeTaskDetailModal: () => {
        set({
          isTaskDetailModalOpen: false,
          selectedTask: null,
        });
      },
    }),
    {
      name: 'task-management-storage',
      // Only persist the active view preference
      partialize: (state) => ({ activeView: state.activeView }),
    }
  )
);

/**
 * Selector hook for filtered and sorted tasks
 * Applies current filters and sort configuration to the task list
 */
export const useFilteredTasks = (): Task[] => {
  const { tasks, filters, sortConfig } = useTaskManagementStore((state) => ({
    tasks: state.tasks,
    filters: state.filters,
    sortConfig: state.sortConfig,
  }));

  let filteredTasks = tasks;

  // Apply filters
  if (filters.types && filters.types.length > 0) {
    filteredTasks = filteredTasks.filter((task) => filters.types!.includes(task.type));
  }

  if (filters.statuses && filters.statuses.length > 0) {
    filteredTasks = filteredTasks.filter((task) => filters.statuses!.includes(task.status));
  }

  if (filters.priorities && filters.priorities.length > 0) {
    filteredTasks = filteredTasks.filter((task) => filters.priorities!.includes(task.priority));
  }

  if (filters.assignedTo && filters.assignedTo.length > 0) {
    filteredTasks = filteredTasks.filter((task) => filters.assignedTo!.includes(task.assignedTo));
  }

  if (filters.dateRange) {
    filteredTasks = filteredTasks.filter((task) => {
      const taskDate = new Date(task.dueDate);
      return taskDate >= filters.dateRange!.start && taskDate <= filters.dateRange!.end;
    });
  }

  if (filters.searchQuery && filters.searchQuery.trim() !== '') {
    const query = filters.searchQuery.toLowerCase();
    filteredTasks = filteredTasks.filter(
      (task) =>
        task.title.toLowerCase().includes(query) || task.description.toLowerCase().includes(query)
    );
  }

  // Apply sorting
  filteredTasks.sort((a, b) => {
    const aValue = a[sortConfig.field];
    const bValue = b[sortConfig.field];

    // Handle date sorting
    if (aValue instanceof Date && bValue instanceof Date) {
      return sortConfig.direction === 'asc'
        ? aValue.getTime() - bValue.getTime()
        : bValue.getTime() - aValue.getTime();
    }

    // Handle string/number sorting (with null/undefined checks)
    if (aValue == null && bValue == null) return 0;
    if (aValue == null) return sortConfig.direction === 'asc' ? -1 : 1;
    if (bValue == null) return sortConfig.direction === 'asc' ? 1 : -1;
    if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
    if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
    return 0;
  });

  return filteredTasks;
};
