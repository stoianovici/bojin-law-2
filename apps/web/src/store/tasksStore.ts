import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// Task types
export type TaskStatus = 'planificat' | 'in_lucru' | 'review' | 'finalizat';
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';
export type TaskGroupBy = 'status' | 'priority' | 'assignee' | 'dueDate' | 'none';
export type TaskViewMode = 'list' | 'kanban' | 'calendar';
export type DueDateFilter = 'all' | 'overdue' | 'today' | 'thisWeek' | 'nextWeek' | 'noDate';

export interface TasksState {
  // View preferences
  viewMode: TaskViewMode;
  groupBy: TaskGroupBy;
  showCompleted: boolean;
  sortBy: 'dueDate' | 'priority' | 'createdAt' | 'title';
  sortDirection: 'asc' | 'desc';

  // Filters
  showMyTasks: boolean;
  selectedStatuses: TaskStatus[];
  selectedPriorities: TaskPriority[];
  selectedAssignees: string[]; // user IDs
  selectedCases: string[]; // case IDs
  dueDateFilter: DueDateFilter;

  // Search
  searchQuery: string;

  // Selected task (for drawer)
  selectedTaskId: string | null;

  // Expanded tasks (for subtask display)
  expandedTaskIds: string[];

  // Actions
  setViewMode: (viewMode: TaskViewMode) => void;
  setGroupBy: (groupBy: TaskGroupBy) => void;
  setShowCompleted: (show: boolean) => void;
  setSortBy: (sortBy: TasksState['sortBy']) => void;
  setSortDirection: (direction: TasksState['sortDirection']) => void;
  setShowMyTasks: (show: boolean) => void;
  toggleStatus: (status: TaskStatus) => void;
  togglePriority: (priority: TaskPriority) => void;
  toggleAssignee: (assigneeId: string) => void;
  toggleCase: (caseId: string) => void;
  setDueDateFilter: (filter: DueDateFilter) => void;
  setSearchQuery: (query: string) => void;
  selectTask: (taskId: string | null) => void;
  clearFilters: () => void;
  toggleTaskExpanded: (taskId: string) => void;
  setTaskExpanded: (taskId: string, expanded: boolean) => void;
}

const ALL_STATUSES: TaskStatus[] = ['planificat', 'in_lucru', 'review', 'finalizat'];
const ALL_PRIORITIES: TaskPriority[] = ['urgent', 'high', 'medium', 'low'];

export const useTasksStore = create<TasksState>()(
  persist(
    (set) => ({
      viewMode: 'list',
      groupBy: 'status',
      showCompleted: true,
      sortBy: 'dueDate',
      sortDirection: 'asc',
      showMyTasks: false,
      selectedStatuses: [],
      selectedPriorities: [],
      selectedAssignees: [],
      selectedCases: [],
      dueDateFilter: 'all',
      searchQuery: '',
      selectedTaskId: null,
      expandedTaskIds: [],

      setViewMode: (viewMode) => set({ viewMode }),

      setGroupBy: (groupBy) => set({ groupBy }),

      setShowCompleted: (showCompleted) => set({ showCompleted }),

      setSortBy: (sortBy) => set({ sortBy }),

      setSortDirection: (sortDirection) => set({ sortDirection }),

      setShowMyTasks: (showMyTasks) => set({ showMyTasks }),

      toggleStatus: (status) =>
        set((state) => ({
          selectedStatuses: state.selectedStatuses.includes(status)
            ? state.selectedStatuses.filter((s) => s !== status)
            : [...state.selectedStatuses, status],
        })),

      togglePriority: (priority) =>
        set((state) => ({
          selectedPriorities: state.selectedPriorities.includes(priority)
            ? state.selectedPriorities.filter((p) => p !== priority)
            : [...state.selectedPriorities, priority],
        })),

      toggleAssignee: (assigneeId) =>
        set((state) => ({
          selectedAssignees: state.selectedAssignees.includes(assigneeId)
            ? state.selectedAssignees.filter((id) => id !== assigneeId)
            : [...state.selectedAssignees, assigneeId],
        })),

      toggleCase: (caseId) =>
        set((state) => ({
          selectedCases: state.selectedCases.includes(caseId)
            ? state.selectedCases.filter((id) => id !== caseId)
            : [...state.selectedCases, caseId],
        })),

      setDueDateFilter: (dueDateFilter) => set({ dueDateFilter }),

      setSearchQuery: (searchQuery) => set({ searchQuery }),

      selectTask: (selectedTaskId) => set({ selectedTaskId }),

      clearFilters: () =>
        set({
          showMyTasks: false,
          selectedStatuses: [],
          selectedPriorities: [],
          selectedAssignees: [],
          selectedCases: [],
          dueDateFilter: 'all',
          searchQuery: '',
        }),

      toggleTaskExpanded: (taskId) =>
        set((state) => ({
          expandedTaskIds: state.expandedTaskIds.includes(taskId)
            ? state.expandedTaskIds.filter((id) => id !== taskId)
            : [...state.expandedTaskIds, taskId],
        })),

      setTaskExpanded: (taskId, expanded) =>
        set((state) => ({
          expandedTaskIds: expanded
            ? state.expandedTaskIds.includes(taskId)
              ? state.expandedTaskIds
              : [...state.expandedTaskIds, taskId]
            : state.expandedTaskIds.filter((id) => id !== taskId),
        })),
    }),
    {
      name: 'tasks-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        viewMode: state.viewMode,
        groupBy: state.groupBy,
        showCompleted: state.showCompleted,
        sortBy: state.sortBy,
        sortDirection: state.sortDirection,
        expandedTaskIds: state.expandedTaskIds,
      }),
    }
  )
);
