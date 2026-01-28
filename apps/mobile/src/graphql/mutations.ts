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

// ============================================
// Team Chat Mutations
// ============================================

export const SEND_TEAM_CHAT_MESSAGE = gql`
  mutation SendTeamChatMessage($content: String!, $parentId: ID, $mentions: [String!]) {
    sendTeamChatMessage(content: $content, parentId: $parentId, mentions: $mentions) {
      id
      content
      author {
        id
        email
        firstName
        lastName
      }
      parentId
      mentions
      type
      createdAt
      expiresAt
    }
  }
`;

export const DELETE_TEAM_CHAT_MESSAGE = gql`
  mutation DeleteTeamChatMessage($id: ID!) {
    deleteTeamChatMessage(id: $id)
  }
`;

export const SET_TEAM_CHAT_TYPING = gql`
  mutation SetTeamChatTyping($isTyping: Boolean!) {
    setTeamChatTyping(isTyping: $isTyping)
  }
`;

// ============================================
// Notification Mutations
// ============================================

export const MARK_IN_APP_NOTIFICATION_READ = gql`
  mutation MarkInAppNotificationRead($id: ID!) {
    markInAppNotificationRead(id: $id)
  }
`;

export const MARK_ALL_IN_APP_NOTIFICATIONS_READ = gql`
  mutation MarkAllInAppNotificationsRead {
    markAllInAppNotificationsRead
  }
`;
