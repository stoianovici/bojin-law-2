/**
 * Task Management Page
 * Main page for task management with Calendar, Kanban, and List views
 */

'use client';

import React, { useEffect } from 'react';
import * as Tabs from '@radix-ui/react-tabs';
import { clsx } from 'clsx';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { MultiWeekCalendarView } from '../../components/task/MultiWeekCalendarView';
import { KanbanBoard } from '../../components/task/KanbanBoard';
import { ListView } from '../../components/task/ListView';
import { TaskCreationBar } from '../../components/task/TaskCreationBar';
import { TaskDetailModal } from '../../components/task/TaskDetailModal';
import { TaskFilterBar } from '../../components/task/TaskFilterBar';
import { useTaskManagementStore, useFilteredTasks } from '../../stores/task-management.store';
import type { Task, TaskType } from '@legal-platform/types';

/**
 * Mock users for task assignment - realistic Romanian law firm team
 */
export const MOCK_USERS = [
  { id: 'partner', name: 'Alex Popescu', initials: 'AP' },
  { id: 'associate1', name: 'Maria Ionescu', initials: 'MI' },
  { id: 'associate2', name: 'Ion Georgescu', initials: 'IG' },
  { id: 'paralegal1', name: 'Elena Popa', initials: 'EP' },
  { id: 'paralegal2', name: 'Mihai Dumitrescu', initials: 'MD' },
];

/**
 * Realistic Romanian legal case contexts
 */
const CASE_CONTEXTS = [
  { id: 'case-001', name: 'Litigiu Contract - ABC Industries vs XYZ Logistics' },
  { id: 'case-002', name: 'Contract Review - ABC Industries' },
  { id: 'case-003', name: 'Consultanta Restructurare - ABC Industries' },
  { id: 'case-006', name: 'Tranzactie Imobiliara - Familia Popescu' },
  { id: 'case-007', name: 'Planificare Succesorala - Familia Popescu' },
  { id: 'case-008', name: 'Aparare Penala - Frauda' },
  { id: 'case-009', name: 'Disputa Proprietate Intelectuala' },
  { id: 'case-010', name: 'Conformitate GDPR - ABC Industries' },
  { id: 'case-012', name: 'M&A Advisory - Tech Innovations' },
  { id: 'case-013', name: 'Divort - Familia Ionescu' },
  { id: 'case-014', name: 'Infiintare SRL - Tech Innovations' },
  { id: 'case-018', name: 'Licenta Software - Tech Innovations' },
  { id: 'case-019', name: 'Dizolvare Parteneriat - Familia Ionescu' },
];

/**
 * Generate mock tasks for prototype with realistic Romanian legal tasks
 * TODO: Replace with real API call when backend is ready
 */
function generateMockTasks(count: number): Task[] {
  const statuses: Task['status'][] = ['Pending', 'InProgress', 'Completed', 'Cancelled'];
  const priorities: Task['priority'][] = ['Low', 'Medium', 'High', 'Urgent'];
  const types: TaskType[] = [
    'Research',
    'DocumentCreation',
    'DocumentRetrieval',
    'CourtDate',
    'Meeting',
    'BusinessTrip',
  ];
  // Realistic Romanian legal task titles
  const titles = [
    'Redactare cerere chemare in judecata',
    'Pregatire dosar instanta',
    'Intalnire client - discutie strategie',
    'Cercetare jurisprudenta ICCJ',
    'Redactare memoriu aparare',
    'Depunere intampinare la tribunal',
    'Actualizare registru dosare',
    'Raspuns cerere probatoriu',
    'Programare audienta martori',
    'Analiza declaratii martori',
    'Evaluare propunere tranzactie',
    'Pregatire concluzii scrise',
    'Revizuire probe administrate',
    'Redactare interogatoriu',
    'Apel status client',
    'Interviu martor',
    'Consultatie expert contabil',
    'Termen instanta - Tribunalul Bucuresti',
    'Analiza pozitie parte adversa',
    'Pregatire documente mediere',
    'Verificare CF si extras carte funciara',
    'Redactare contract vanzare-cumparare',
    'Analiza due diligence financiar',
    'Pregatire hotarare AGA',
    'Revizuire act constitutiv SRL',
    'Negociere clauze NDA',
    'Analiza conformitate GDPR',
    'Redactare politica protectie date',
    'Pregatire documentatie fuziune',
    'Analiza contract licenta software',
    'Redactare conventie custodie',
    'Inventariere bunuri comune divort',
    'Pregatire cerere divort',
    'Consultatie expert evaluator',
    'Depunere documentatie ONRC',
  ];

  const tasks: Task[] = [];
  let attempts = 0;
  const maxAttempts = count * 3; // Safety limit to prevent infinite loop

  while (tasks.length < count && attempts < maxAttempts) {
    attempts++;

    const dueDate = new Date();
    // Generate dates within a 60-day range (30 days before and after today)
    dueDate.setDate(dueDate.getDate() + Math.floor(Math.random() * 60) - 30);

    // Skip weekends (Saturday = 6, Sunday = 0)
    const dayOfWeek = dueDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      continue; // Skip this iteration and generate a new date
    }

    // Mix of time-specific and all-day tasks
    // Court dates and meetings should have specific times
    const type = types[Math.floor(Math.random() * types.length)];
    const hasSpecificTime = type === 'CourtDate' || type === 'Meeting' || Math.random() > 0.5;

    if (hasSpecificTime) {
      // Set random hour between 8 AM and 6 PM
      dueDate.setHours(8 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60), 0, 0);
    } else {
      // All-day task (midnight)
      dueDate.setHours(0, 0, 0, 0);
    }

    const caseContext = CASE_CONTEXTS[Math.floor(Math.random() * CASE_CONTEXTS.length)];
    const taskTitle = titles[tasks.length % titles.length];

    tasks.push({
      id: `task-${tasks.length + 1}`,
      title: taskTitle,
      description: `${taskTitle} - ${caseContext.name}`,
      type,
      status: statuses[Math.floor(Math.random() * statuses.length)],
      priority: priorities[Math.floor(Math.random() * priorities.length)],
      dueDate,
      assignedTo: MOCK_USERS[Math.floor(Math.random() * MOCK_USERS.length)].id,
      caseId: caseContext.id,
      metadata: {
        duration: hasSpecificTime ? 30 + Math.floor(Math.random() * 90) : undefined, // 30-120 minutes
        caseName: caseContext.name,
      },
      createdAt: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000),
      updatedAt: new Date(),
    });
  }

  return tasks;
}

export default function TasksPage() {
  const {
    activeView,
    setActiveView,
    tasks,
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
  } = useTaskManagementStore();

  // Use filtered tasks instead of raw tasks for display
  const filteredTasks = useFilteredTasks();

  const [isCreationBarOpen, setIsCreationBarOpen] = React.useState(false);

  /**
   * Set document title
   */
  useEffect(() => {
    document.title = 'Sarcini';
  }, []);

  /**
   * Load mock tasks on mount
   * TODO: Replace with real API call when backend is ready
   */
  useEffect(() => {
    console.log('[TasksPage] Current tasks length:', tasks.length);
    if (tasks.length === 0) {
      const mockTasks = generateMockTasks(150);
      console.log('[TasksPage] Generated mock tasks:', mockTasks.length, mockTasks);
      setTasks(mockTasks);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  // Debug log to see tasks updates
  useEffect(() => {
    console.log('[TasksPage] Tasks updated, count:', tasks.length);
  }, [tasks]);

  /**
   * Handle task click (opens detail modal)
   */
  const handleTaskClick = (task: Task) => {
    openTaskDetailModal(task);
  };

  /**
   * Handle task creation from natural language bar
   */
  const handleCreateTaskFromNL = (_parsedText: string) => {
    // Open modal with empty task (create mode)
    openTaskDetailModal();
    // Close the creation bar modal
    setIsCreationBarOpen(false);
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
    <main className="h-full flex flex-col">
      {/* View Switcher & Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs.Root
          value={activeView}
          onValueChange={(value) => setActiveView(value as 'calendar' | 'kanban' | 'list')}
          className="h-full flex flex-col"
        >
          {/* Tab List with Create Button */}
          <Tabs.List className="flex items-center justify-between border-b border-gray-200 bg-white px-6">
            <div className="flex">
              {viewTabs.map((tab) => (
                <Tabs.Trigger
                  key={tab.value}
                  value={tab.value}
                  className={clsx(
                    'flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors',
                    'border-b-2 -mb-px',
                    'hover:text-gray-900 hover:border-gray-300',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2',
                    'data-[state=active]:border-blue-500 data-[state=active]:text-blue-600',
                    'data-[state=inactive]:border-transparent data-[state=inactive]:text-gray-600'
                  )}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </Tabs.Trigger>
              ))}
            </div>

            {/* Create Task Button */}
            <button
              onClick={() => setIsCreationBarOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
            >
              <div className="flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
          <div className="flex-1 overflow-auto bg-gray-50">
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

      {/* Task Creation Modal */}
      {isCreationBarOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 pt-20 px-4"
          onClick={() => setIsCreationBarOpen(false)}
        >
          <div
            className="w-full max-w-4xl animate-in fade-in slide-in-from-top-4 duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            <TaskCreationBar onCreateTask={handleCreateTaskFromNL} />
          </div>
        </div>
      )}
    </main>
  );
}
