// Mobile hooks barrel export
// Import from '@/hooks/mobile' for all mobile-specific hooks

// Hook exports
export { useCases } from './useCases';
export { useCase } from './useCase';
export { useMyTasks } from './useMyTasks';
export { useTasksByCase } from './useTasksByCase';
export { useSearch } from './useSearch';
export { useClientSearch } from './useClientSearch';
export { useCalendar } from './useCalendar';
export { useCreateCase } from './useCreateCase';
export { useCreateClient } from './useCreateClient';
export { useCreateTask } from './useCreateTask';
export { useCreateCaseNote, useCaseNotes, useDeleteCaseNote } from './useCreateCaseNote';
export { useTeamMembers } from './useTeamMembers';
export { useCaseSummary } from './useCaseSummary';

// Type exports from useCase
export type {
  CaseClient,
  CaseTeamMemberUser,
  CaseTeamMember,
  CaseActor,
  CaseData,
} from './useCase';

// Type exports from useMyTasks
export type { Task, TaskFilterInput, TaskCase, TaskAssignee } from './useMyTasks';

// Type exports from useTasksByCase (re-exported with aliases to avoid conflicts)
export type {
  Task as TaskByCaseTask,
  TaskFilterInput as TaskByCaseFilterInput,
} from './useTasksByCase';

// Type exports from useCreateCase
export type { CreateCaseInput } from './useCreateCase';

// Type exports from useCreateTask
export type { CreateTaskInput, TaskType, TaskPriority } from './useCreateTask';

// Type exports from useCreateCaseNote
export type { CreateCaseNoteInput, CaseNote, NoteColor } from './useCreateCaseNote';

// Type exports from useTeamMembers
export type { TeamMember } from './useTeamMembers';

// Type exports from useClientSearch
export type { Client } from './useClientSearch';

// Type exports from useCaseSummary
export type { CaseSummary } from './useCaseSummary';
