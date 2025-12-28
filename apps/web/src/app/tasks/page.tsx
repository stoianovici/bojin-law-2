/**
 * Task Management Page
 * Main page for task management with Calendar, Kanban, and List views
 * OPS-328: Mobile Page Consistency - Added mobile view
 */

'use client';

import React, { useEffect } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { clsx } from 'clsx';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { MultiWeekCalendarView } from '../../components/task/MultiWeekCalendarView';
import { KanbanBoard } from '../../components/task/KanbanBoard';
import { ListView } from '../../components/task/ListView';
import { TaskDetailModal } from '../../components/task/TaskDetailModal';
import { CreateTaskModal } from '../../components/task/CreateTaskModal';
import { TaskFilterBar } from '../../components/task/TaskFilterBar';
import { useTaskManagementStore, useFilteredTasks } from '../../stores/task-management.store';
import { useSetAIContext } from '../../contexts/AIAssistantContext';
import { useTasks } from '../../hooks/useTasks';
import { PageLayout } from '../../components/linear/PageLayout';
import { MobileTasks } from '../../components/mobile';
import { useIsMobile } from '../../hooks/useIsMobile';
import type { Task } from '@legal-platform/types';

export default function TasksPage() {
  const isMobile = useIsMobile();

  // On mobile, render MobileTasks
  if (isMobile) {
    return <MobileTasks />;
  }

  // Desktop: render full tasks page
  return <TasksPageDesktop />;
}

function TasksPageDesktop() {
  // Set AI assistant context to tasks
  useSetAIContext('tasks');
  const {
    activeView,
    setActiveView,
    tasks: _tasks,
    setTasks,
    filters,
    setFilters,
    clearFilters,
    isTaskDetailModalOpen,
    selectedTask,
    openTaskDetailModal,
    closeTaskDetailModal,
    updateTask,
    createTask,
    deleteTask,
    isCreateModalOpen,
    openCreateModal,
    closeCreateModal,
  } = useTaskManagementStore();

  // Fetch all tasks from API (not just current user's tasks)
  const { tasks: apiTasks, loading: tasksLoading, refetch: refetchTasks } = useTasks();

  // Sync API tasks to store when they change
  // Always sync, even when empty, to ensure stale data is cleared
  useEffect(() => {
    if (!tasksLoading) {
      setTasks(apiTasks);
    }
  }, [apiTasks, tasksLoading, setTasks]);

  // Use filtered tasks instead of raw tasks for display
  const filteredTasks = useFilteredTasks();

  /**
   * Set document title
   */
  useEffect(() => {
    document.title = 'Sarcini';
  }, []);

  /**
   * Handle task click (opens detail modal)
   */
  const handleTaskClick = (task: Task) => {
    openTaskDetailModal(task);
  };

  /**
   * Handle task save (create or update)
   */
  const handleTaskSave = (taskData: Partial<Task>) => {
    if (taskData.id) {
      // Update existing task
      updateTask(taskData.id, taskData);
    } else {
      // Create new task
      createTask(taskData as Omit<Task, 'id' | 'createdAt' | 'updatedAt'>);
    }
  };

  /**
   * Handle task delete
   */
  const handleTaskDelete = (taskId: string) => {
    deleteTask(taskId);
  };

  /**
   * Handle calendar task drag-and-drop
   */
  const handleCalendarTaskDrop = (taskId: string, newDate: Date) => {
    updateTask(taskId, { dueDate: newDate });
  };

  /**
   * Handle kanban task status change
   */
  const handleKanbanTaskStatusChange = (taskId: string, newStatus: Task['status']) => {
    updateTask(taskId, { status: newStatus });
  };

  const viewTabs = [
    {
      value: 'calendar',
      label: 'Calendar',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      value: 'kanban',
      label: 'Kanban',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7m0 10a2 2 0 002 2h2a2 2 0 002-2V7a2 2 0 00-2-2h-2a2 2 0 00-2 2"
          />
        </svg>
      ),
    },
    {
      value: 'list',
      label: 'Listă',
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      ),
    },
  ];

  return (
    <PageLayout className="flex h-full flex-col p-0">
      {/* View Switcher & Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs.Root
          value={activeView}
          onValueChange={(value) => setActiveView(value as 'calendar' | 'kanban' | 'list')}
          className="flex h-full flex-col"
        >
          {/* Tab List with Create Button */}
          <Tabs.List className="flex items-center justify-between border-b border-linear-border-subtle bg-linear-bg-secondary px-6">
            <div className="flex">
              {viewTabs.map((tab) => (
                <Tabs.Trigger
                  key={tab.value}
                  value={tab.value}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
                    'border-b-2 -mb-px',
                    'hover:text-linear-text-primary hover:border-linear-text-tertiary',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-linear-accent focus-visible:ring-offset-2 focus-visible:ring-offset-linear-bg-secondary',
                    'data-[state=active]:border-linear-accent data-[state=active]:text-linear-accent',
                    'data-[state=inactive]:border-transparent data-[state=inactive]:text-linear-text-secondary'
                  )}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </Tabs.Trigger>
              ))}
            </div>

            {/* Create Task Button */}
            <button
              onClick={openCreateModal}
              className="rounded-lg bg-linear-accent px-4 py-2 font-semibold text-white shadow-sm transition-colors hover:bg-linear-accent-hover"
            >
              <div className="flex items-center gap-2">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                <span>Creează</span>
              </div>
            </button>
          </Tabs.List>

          {/* Filter Bar */}
          <TaskFilterBar
            filters={filters}
            onFiltersChange={setFilters}
            onClearFilters={clearFilters}
          />

          {/* Tab Panels */}
          <div className="flex-1 overflow-auto bg-linear-bg-primary">
            <Tabs.Content value="calendar" className="h-full p-6">
              <MultiWeekCalendarView
                tasks={filteredTasks}
                onTaskClick={handleTaskClick}
                onTaskDrop={handleCalendarTaskDrop}
                weeksToShow={4}
              />
            </Tabs.Content>

            <Tabs.Content value="kanban" className="h-full p-6">
              <KanbanBoard
                tasks={filteredTasks}
                onTaskClick={handleTaskClick}
                onTaskStatusChange={handleKanbanTaskStatusChange}
              />
            </Tabs.Content>

            <Tabs.Content value="list" className="h-full p-6">
              <ListView tasks={filteredTasks} onTaskClick={handleTaskClick} />
            </Tabs.Content>
          </div>
        </Tabs.Root>
      </div>

      {/* Task Detail Modal */}
      <TaskDetailModal
        isOpen={isTaskDetailModalOpen}
        onClose={closeTaskDetailModal}
        task={selectedTask}
        onSave={handleTaskSave}
        onDelete={handleTaskDelete}
      />

      {/* Create Task Modal */}
      <CreateTaskModal
        isOpen={isCreateModalOpen}
        onClose={closeCreateModal}
        onSuccess={() => {
          refetchTasks();
        }}
      />
    </PageLayout>
  );
}
