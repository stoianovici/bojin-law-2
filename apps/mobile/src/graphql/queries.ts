import { gql } from '@apollo/client';

// ============================================
// Dashboard Queries
// ============================================

export const GET_DASHBOARD_DATA = gql`
  query GetDashboardData {
    cases(status: Active) {
      id
      caseNumber
      title
      type
      referenceNumbers
      client {
        id
        name
      }
      updatedAt
    }

    myTasks(filters: { statuses: [Pending, InProgress] }) {
      id
      title
      status
      priority
      dueDate
      case {
        id
        caseNumber
        title
        referenceNumbers
      }
    }
  }
`;

// ============================================
// Case Queries
// ============================================

export const GET_CASES = gql`
  query GetCases($status: CaseStatus, $first: Int, $after: String) {
    paginatedCases(status: $status, first: $first, after: $after) {
      edges {
        node {
          id
          caseNumber
          title
          status
          type
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
          referenceNumbers
          updatedAt
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;

export const GET_CASE = gql`
  query GetCase($id: UUID!) {
    case(id: $id) {
      id
      caseNumber
      title
      status
      type
      description
      openedDate
      client {
        id
        name
        contactInfo
      }
      teamMembers {
        id
        role
        user {
          id
          firstName
          lastName
          email
        }
      }
      actors {
        id
        name
        role
        organization
        email
        phone
      }
      keywords
      referenceNumbers
      updatedAt
    }
  }
`;

export const GET_CASE_SUMMARY = gql`
  query GetCaseSummary($caseId: ID!) {
    caseSummary(caseId: $caseId) {
      id
      executiveSummary
      currentStatus
      keyDevelopments
      openIssues
      generatedAt
      isStale
    }
  }
`;

export const GET_TASKS_BY_CASE = gql`
  query GetTasksByCase($caseId: ID!) {
    tasksByCase(caseId: $caseId) {
      id
      title
      status
      priority
      dueDate
      assignee {
        id
        firstName
        lastName
      }
    }
  }
`;

// ============================================
// Task Queries
// ============================================

export const GET_MY_TASKS = gql`
  query GetMyTasks($filters: TaskFilterInput) {
    myTasks(filters: $filters) {
      id
      title
      description
      type
      status
      priority
      dueDate
      dueTime
      estimatedHours
      loggedTime
      case {
        id
        caseNumber
        title
        referenceNumbers
      }
      assignee {
        id
        firstName
        lastName
      }
      createdAt
      completedAt
    }
  }
`;

export const GET_CALENDAR_EVENTS = gql`
  query GetCalendarEvents($filters: TaskFilterInput) {
    tasks(filters: $filters) {
      id
      title
      type
      status
      priority
      dueDate
      dueTime
      scheduledDate
      scheduledStartTime
      case {
        id
        caseNumber
        title
        referenceNumbers
      }
    }
  }
`;

// ============================================
// Search Queries
// ============================================

export const SEARCH_CASES = gql`
  query SearchCases($query: String!, $limit: Int) {
    searchCases(query: $query, limit: $limit) {
      id
      caseNumber
      title
      status
      type
      referenceNumbers
      client {
        id
        name
      }
    }
  }
`;

export const SEARCH_CLIENTS = gql`
  query SearchClients($query: String!, $limit: Int) {
    searchClients(query: $query, limit: $limit) {
      id
      name
      email
      phone
    }
  }
`;

// ============================================
// Client Queries
// ============================================

export const GET_CLIENTS = gql`
  query GetClients {
    clients {
      id
      name
      email
      phone
      clientType
      caseCount
      activeCaseCount
    }
  }
`;

export const GET_CLIENT = gql`
  query GetClient($id: UUID!) {
    client(id: $id) {
      id
      name
      email
      phone
      address
      clientType
      companyType
      cui
      caseCount
      activeCaseCount
      cases {
        id
        caseNumber
        title
        status
        type
        referenceNumbers
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
    }
  }
`;

export const GET_TASKS_BY_CLIENT = gql`
  query GetTasksByClient($clientId: ID!) {
    tasksByClient(clientId: $clientId) {
      id
      title
      status
      priority
      dueDate
      assignee {
        id
        firstName
        lastName
      }
    }
  }
`;

export const GET_CASE_DOCUMENT_COUNTS = gql`
  query GetCaseDocumentCounts($clientId: ID) {
    caseDocumentCounts(clientId: $clientId) {
      caseId
      documentCount
    }
  }
`;

export const GET_CLIENT_INBOX_DOCUMENTS = gql`
  query GetClientInboxDocuments($clientId: UUID!) {
    clientInboxDocuments(clientId: $clientId) {
      id
      document {
        id
        fileName
        fileType
        fileSize
        status
        sourceType
        uploadedAt
        senderName
        senderEmail
        thumbnailMedium
      }
      linkedAt
      receivedAt
      isOriginal
      promotedFromAttachment
    }
  }
`;

export const GET_CASE_DOCUMENTS = gql`
  query GetCaseDocuments($caseId: UUID!) {
    caseDocuments(caseId: $caseId) {
      id
      document {
        id
        fileName
        fileType
        fileSize
        status
        sourceType
        uploadedAt
        senderName
        senderEmail
        thumbnailMedium
      }
      linkedAt
      receivedAt
      isOriginal
      promotedFromAttachment
    }
  }
`;

// ============================================
// Document Preview Queries
// ============================================

export const GET_DOCUMENT_PREVIEW_URL = gql`
  query GetDocumentPreviewUrl($documentId: UUID!) {
    documentPreviewUrl(documentId: $documentId) {
      url
      source
      expiresAt
    }
  }
`;

export const GET_DOCUMENT_THUMBNAIL = gql`
  query GetDocumentThumbnail($documentId: UUID!) {
    getDocumentThumbnail(documentId: $documentId) {
      url
      source
    }
  }
`;

// ============================================
// User Queries
// ============================================

export const GET_FIRM_USERS = gql`
  query GetFirmUsers {
    firmUsers {
      id
      firstName
      lastName
      email
      role
    }
  }
`;

// ============================================
// Task Detail & Time Entries Queries
// ============================================

export const GET_TASK = gql`
  query GetTask($id: UUID!) {
    task(id: $id) {
      id
      title
      description
      type
      status
      priority
      dueDate
      dueTime
      estimatedHours
      loggedTime
      case {
        id
        caseNumber
        title
      }
      assignee {
        id
        firstName
        lastName
      }
      createdAt
      completedAt
    }
  }
`;

export const GET_TIME_ENTRIES_BY_TASK = gql`
  query GetTimeEntriesByTask($taskId: ID!) {
    timeEntriesByTask(taskId: $taskId) {
      id
      date
      hours
      description
      user {
        id
        firstName
        lastName
      }
    }
  }
`;

// ============================================
// Team Chat Queries
// ============================================

export const GET_TEAM_CHAT_MESSAGES = gql`
  query GetTeamChatMessages($limit: Int, $offset: Int) {
    teamChatMessages(limit: $limit, offset: $offset) {
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

export const GET_TEAM_CHAT_TYPING_USERS = gql`
  query GetTeamChatTypingUsers {
    teamChatTypingUsers {
      userId
      userName
    }
  }
`;

// ============================================
// Notification Queries
// ============================================

export const GET_IN_APP_NOTIFICATIONS = gql`
  query GetInAppNotifications($includeRead: Boolean, $limit: Int) {
    inAppNotifications(includeRead: $includeRead, limit: $limit) {
      id
      title
      body
      icon
      read
      action {
        type
        entityId
        caseId
      }
      createdAt
    }
  }
`;

export const GET_IN_APP_NOTIFICATION_COUNT = gql`
  query GetInAppNotificationCount {
    inAppNotificationCount
  }
`;

// ============================================
// Firm Briefing Queries (V2 - Editor-in-Chief Model)
// ============================================

// Fragment for StoryItem - used across lead, secondary, tertiary
const STORY_ITEM_FRAGMENT = `
  fragment StoryItemFields on StoryItem {
    id
    headline
    summary
    details {
      id
      title
      subtitle
      dueDate
      dueDateLabel
      status
      href
    }
    category
    urgency
    href
    entityType
    entityId
    canAskFollowUp
  }
`;

export const GET_FIRM_BRIEFING = gql`
  ${STORY_ITEM_FRAGMENT}
  query FirmBriefing {
    firmBriefing {
      id
      schemaVersion
      edition {
        date
        mood
        editorNote
      }
      lead {
        ...StoryItemFields
      }
      secondary {
        title
        items {
          ...StoryItemFields
        }
      }
      tertiary {
        title
        items {
          ...StoryItemFields
        }
      }
      quickStats {
        activeCases
        urgentTasks
        teamUtilization
        unreadEmails
        overdueItems
        upcomingDeadlines
      }
      totalTokens
      totalCostEur
      isStale
      isViewed
      generatedAt
      rateLimitInfo {
        limited
        message
        retryAfterMinutes
      }
    }
  }
`;

// ============================================
// Flipboard Briefing Queries
// ============================================

export const GET_FLIPBOARD_PAGES = gql`
  query GetFlipboardPages($limit: Int, $after: String) {
    flipboardPagesConnection(limit: $limit, after: $after) {
      pages {
        pageIndex
        layoutVariant
        notifications {
          id
          notificationId
          headline
          summary
          imageUrl
          priority
          relatedItems {
            type
            id
            title
            subtitle
            href
          }
          suggestedActions {
            id
            label
            icon
            type
            payload
            href
          }
          originalTitle
          action {
            type
            entityId
            caseId
          }
          createdAt
          read
          enrichmentStatus
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
      totalCount
    }
  }
`;

export const EXECUTE_NOTIFICATION_ACTION = gql`
  mutation ExecuteNotificationAction($notificationId: ID!, $actionId: ID!) {
    executeNotificationAction(notificationId: $notificationId, actionId: $actionId)
  }
`;

// ============================================
// User Flipboard Queries (AI-generated actionable items)
// ============================================

export const GET_USER_FLIPBOARD = gql`
  query GetUserFlipboard($refreshOnLogin: Boolean) {
    userFlipboard(refreshOnLogin: $refreshOnLogin) {
      id
      items {
        id
        headline
        summary
        priority
        category
        source
        entityType
        entityId
        caseId
        caseName
        suggestedActions {
          id
          label
          icon
          type
          href
          isPrimary
        }
        dueDate
        actorName
        createdAt
      }
      isRefreshing
      generatedAt
      totalTokens
      totalCostEur
    }
  }
`;

export const REFRESH_FLIPBOARD = gql`
  mutation RefreshFlipboard {
    refreshFlipboard {
      id
      items {
        id
        headline
        summary
        priority
        category
        source
        entityType
        entityId
        caseId
        caseName
        suggestedActions {
          id
          label
          icon
          type
          href
          isPrimary
        }
        dueDate
        actorName
        createdAt
      }
      isRefreshing
      generatedAt
      totalTokens
      totalCostEur
    }
  }
`;

export const EXECUTE_FLIPBOARD_ACTION = gql`
  mutation ExecuteFlipboardAction($itemId: String!, $actionId: String!) {
    executeFlipboardAction(itemId: $itemId, actionId: $actionId)
  }
`;

export const DISMISS_FLIPBOARD_ITEM = gql`
  mutation DismissFlipboardItem($itemId: String!) {
    dismissFlipboardItem(itemId: $itemId)
  }
`;
