import { gql } from '@apollo/client';

// ============================================
// Task Mutations
// ============================================

export const UPDATE_TASK_STATUS = gql`
  mutation UpdateTaskStatus($id: ID!, $status: TaskStatus!) {
    updateTask(id: $id, input: { status: $status }) {
      id
      status
      completedAt
    }
  }
`;

export const CREATE_TASK = gql`
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      id
      title
      status
      priority
      dueDate
      case {
        id
        caseNumber
      }
    }
  }
`;

// ============================================
// Time Entry Mutations
// ============================================

export const CREATE_TIME_ENTRY = gql`
  mutation CreateTimeEntry($input: CreateTimeEntryInput!) {
    createTimeEntry(input: $input) {
      id
      description
      hours
      date
      case {
        id
        caseNumber
      }
    }
  }
`;

// ============================================
// Note Mutations
// ============================================

export const CREATE_NOTE = gql`
  mutation CreateNote($input: CreateNoteInput!) {
    createNote(input: $input) {
      id
      content
      createdAt
      case {
        id
        caseNumber
      }
    }
  }
`;

// ============================================
// Case Summary Mutations
// ============================================

export const TRIGGER_CASE_SUMMARY = gql`
  mutation TriggerCaseSummary($caseId: ID!) {
    triggerCaseSummaryGeneration(caseId: $caseId) {
      success
      message
      summary {
        id
        executiveSummary
        currentStatus
        keyDevelopments
        openIssues
        generatedAt
      }
    }
  }
`;

// ============================================
// Task Time Logging Mutations
// ============================================

export const LOG_TIME_AGAINST_TASK = gql`
  mutation LogTimeAgainstTask(
    $taskId: ID!
    $hours: Float!
    $description: String!
    $billable: Boolean
  ) {
    logTimeAgainstTask(
      taskId: $taskId
      hours: $hours
      description: $description
      billable: $billable
    ) {
      id
      hours
      description
      billable
      date
    }
  }
`;
