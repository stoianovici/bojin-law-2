import { gql } from '@apollo/client';

// ============================================================================
// Case Mutations
// ============================================================================

// Note: CreateCaseInput accepts expanded fields - some fields pending backend implementation
export const CREATE_CASE = gql`
  mutation CreateCase($input: CreateCaseInput!) {
    createCase(input: $input) {
      id
      caseNumber
      title
      status
      type
      description
      client {
        id
        name
      }
      teamMembers {
        id
        role
        user {
          id
          firstName
          lastName
        }
      }
      billingType
      fixedAmount
      customRates {
        partnerRate
        associateRate
        paralegalRate
      }
      createdAt
      syncStatus
      syncError
    }
  }
`;

export const UPDATE_CASE = gql`
  mutation UpdateCase($id: UUID!, $input: UpdateCaseInput!) {
    updateCase(id: $id, input: $input) {
      id
      caseNumber
      title
      status
      type
      description
      client {
        id
        name
      }
      teamMembers {
        id
        role
        user {
          id
          firstName
          lastName
        }
      }
      billingType
      fixedAmount
      customRates {
        partnerRate
        associateRate
        paralegalRate
      }
      updatedAt
      syncStatus
      syncError
    }
  }
`;

export const RETRY_CASE_SYNC = gql`
  mutation RetryCaseSync($caseId: UUID!) {
    retryCaseSync(caseId: $caseId) {
      id
      syncStatus
      syncError
    }
  }
`;

// ============================================================================
// Case Approval Mutations
// ============================================================================

export const APPROVE_CASE = gql`
  mutation ApproveCase($caseId: UUID!) {
    approveCase(caseId: $caseId) {
      id
      status
      approval {
        id
        status
        reviewedBy {
          id
          firstName
          lastName
        }
        reviewedAt
      }
    }
  }
`;

export const REJECT_CASE = gql`
  mutation RejectCase($input: RejectCaseInput!) {
    rejectCase(input: $input) {
      id
      status
      approval {
        id
        status
        rejectionReason
        reviewedBy {
          id
          firstName
          lastName
        }
        reviewedAt
      }
    }
  }
`;

// ============================================================================
// Case Team Mutations
// ============================================================================

export const ASSIGN_TEAM_MEMBER = gql`
  mutation AssignTeamMember($input: AssignTeamInput!) {
    assignTeam(input: $input) {
      id
      role
      user {
        id
        firstName
        lastName
      }
    }
  }
`;

export const REMOVE_TEAM_MEMBER = gql`
  mutation RemoveTeamMember($caseId: ID!, $userId: ID!) {
    removeTeamMember(caseId: $caseId, userId: $userId)
  }
`;

// ============================================================================
// Client Mutations (Pending backend implementation)
// ============================================================================

export const CREATE_CLIENT = gql`
  mutation CreateClient($input: CreateClientInput!) {
    createClient(input: $input) {
      id
      name
      email
      phone
      address
      caseCount
      activeCaseCount
    }
  }
`;

// ============================================================================
// Task Mutations
// ============================================================================

export const CREATE_TASK = gql`
  mutation CreateTask($input: CreateTaskInput!) {
    createTask(input: $input) {
      id
      title
      type
      status
      dueDate
      dueTime
      priority
      case {
        id
        title
      }
      assignee {
        id
        firstName
        lastName
      }
      createdAt
    }
  }
`;

export const COMPLETE_TASK = gql`
  mutation CompleteTask($id: ID!) {
    completeTask(id: $id) {
      id
      status
      completedAt
    }
  }
`;

export const UPDATE_TASK = gql`
  mutation UpdateTask($id: ID!, $input: UpdateTaskInput!) {
    updateTask(id: $id, input: $input) {
      id
      title
      description
      type
      status
      priority
      dueDate
      dueTime
      estimatedHours
      parentTaskId
      scheduledDate
      scheduledStartTime
      assignee {
        id
        firstName
        lastName
      }
      case {
        id
        title
      }
      subtasks {
        id
        title
        status
        priority
        dueDate
        estimatedHours
        assignee {
          id
          firstName
          lastName
        }
      }
    }
  }
`;

// ============================================================================
// Event Mutations
// ============================================================================

// Note: CreateEventInput should include:
// - title: String! (required)
// - caseId: ID! (required)
// - type: EventType! (e.g., 'Meeting', 'CourtDate', 'Deadline', 'Appointment')
// - startDate: String! (ISO date, required)
// - startTime: String (HH:mm format)
// - endDate: String (ISO date)
// - endTime: String (HH:mm format)
// - location: String
// - description: String
// - attendeeIds: [ID!] (user IDs for attendees)
export const CREATE_EVENT = gql`
  mutation CreateEvent($input: CreateEventInput!) {
    createEvent(input: $input) {
      id
      title
      type
      startDate
      startTime
      endDate
      endTime
      location
      description
      case {
        id
        title
      }
      attendees {
        id
        firstName
        lastName
      }
      createdAt
      rescheduledTasks {
        taskId
        taskTitle
        oldDate
        oldTime
        newDate
        newTime
      }
    }
  }
`;

// ============================================================================
// Case Note Mutations
// ============================================================================

export const CREATE_CASE_NOTE = gql`
  mutation CreateCaseNote($input: CreateCaseNoteInput!) {
    createCaseNote(input: $input) {
      id
      caseId
      content
      color
      author {
        id
        firstName
        lastName
      }
      createdAt
    }
  }
`;

export const DELETE_CASE_NOTE = gql`
  mutation DeleteCaseNote($id: ID!) {
    deleteCaseNote(id: $id)
  }
`;

// ============================================================================
// Case Note Queries
// ============================================================================

export const GET_CASE_NOTES = gql`
  query GetCaseNotes($caseId: ID!) {
    caseNotes(caseId: $caseId) {
      id
      caseId
      content
      color
      author {
        id
        firstName
        lastName
      }
      createdAt
      updatedAt
    }
  }
`;

// ============================================================================
// Settings Mutations
// ============================================================================

export const UPDATE_USER_PREFERENCES = gql`
  mutation UpdateUserPreferences($input: UpdateUserPreferencesInput!) {
    updateUserPreferences(input: $input) {
      theme
      emailSignature
    }
  }
`;

export const CREATE_COURT = gql`
  mutation CreateCourt($input: CreateGlobalEmailSourceInput!) {
    createGlobalEmailSource(input: $input) {
      id
      name
      domains
      category
      createdAt
    }
  }
`;

export const UPDATE_COURT = gql`
  mutation UpdateCourt($id: UUID!, $input: UpdateGlobalEmailSourceInput!) {
    updateGlobalEmailSource(id: $id, input: $input) {
      id
      name
      domains
      category
      createdAt
    }
  }
`;

export const DELETE_COURT = gql`
  mutation DeleteCourt($id: UUID!) {
    deleteGlobalEmailSource(id: $id)
  }
`;

export const UPDATE_DEFAULT_RATES = gql`
  mutation UpdateDefaultRates($input: DefaultRatesInput!) {
    updateDefaultRates(input: $input) {
      partnerRate
      associateRate
      paralegalRate
    }
  }
`;

export const ADD_PERSONAL_CONTACT = gql`
  mutation AddPersonalContact($email: String!) {
    addPersonalContact(email: $email) {
      id
      email
      createdAt
    }
  }
`;

export const REMOVE_PERSONAL_CONTACT = gql`
  mutation RemovePersonalContact($id: UUID!) {
    removePersonalContact(id: $id)
  }
`;

export const ACTIVATE_USER = gql`
  mutation ActivateUser($input: ActivateUserInput!) {
    activateUser(input: $input) {
      id
      firstName
      lastName
      email
      role
      status
    }
  }
`;

export const DEACTIVATE_USER = gql`
  mutation DeactivateUser($userId: UUID!) {
    deactivateUser(userId: $userId) {
      id
      firstName
      lastName
      email
      role
      status
    }
  }
`;

export const UPDATE_TEAM_MEMBER_ROLE = gql`
  mutation UpdateTeamMemberRole($input: UpdateTeamMemberRoleInput!) {
    updateTeamMemberRole(input: $input) {
      id
      firstName
      lastName
      email
      role
      status
    }
  }
`;

// ============================================================================
// Document Mutations
// ============================================================================

/**
 * Upload document with file content to SharePoint
 * Creates document in firm's SharePoint site under Cases/{CaseNumber}/Documents/
 */
export const UPLOAD_DOCUMENT_TO_SHAREPOINT = gql`
  mutation UploadDocumentToSharePoint($input: UploadDocumentWithFileInput!) {
    uploadDocumentToSharePoint(input: $input) {
      id
      fileName
      fileType
      fileSize
      status
      sourceType
      uploadedAt
      uploadedBy {
        id
        firstName
        lastName
      }
    }
  }
`;

/**
 * Get temporary download URL for a document
 * Returns a pre-signed URL from SharePoint/OneDrive that expires in 1 hour
 */
export const GET_DOCUMENT_DOWNLOAD_URL = gql`
  mutation GetDocumentDownloadUrl($documentId: UUID!) {
    getDocumentDownloadUrl(documentId: $documentId) {
      url
      expirationDateTime
    }
  }
`;

/**
 * Open document in Word (desktop or online)
 * Returns URLs for Word desktop app and Word Online fallback
 */
export const OPEN_IN_WORD = gql`
  mutation OpenInWord($documentId: UUID!) {
    openInWord(documentId: $documentId) {
      documentId
      wordUrl
      webUrl
      lockToken
      expiresAt
      oneDriveId
    }
  }
`;

// ============================================================================
// Notification Mutations
// ============================================================================

export const MARK_NOTIFICATION_AS_READ = gql`
  mutation MarkNotificationAsRead($id: UUID!) {
    markNotificationAsRead(id: $id) {
      id
      read
      readAt
    }
  }
`;

export const MARK_ALL_NOTIFICATIONS_AS_READ = gql`
  mutation MarkAllNotificationsAsRead {
    markAllNotificationsAsRead
  }
`;

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

// ============================================================================
// Create Blank Document Mutations
// ============================================================================

/**
 * Create a blank Word document and open it for editing
 * Creates new .docx in SharePoint and returns URLs to open in Word
 */
export const CREATE_BLANK_DOCUMENT = gql`
  mutation CreateBlankDocument($input: CreateBlankDocumentInput!) {
    createBlankDocument(input: $input) {
      success
      document {
        id
        fileName
        fileType
        fileSize
        status
        uploadedAt
      }
      wordUrl
      webUrl
      lockToken
      lockExpiresAt
      error
    }
  }
`;
