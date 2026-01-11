import { gql } from '@apollo/client';

// ============================================================================
// Case Type Queries
// ============================================================================

export const GET_CASE_TYPES = gql`
  query GetCaseTypes($includeInactive: Boolean) {
    caseTypes(includeInactive: $includeInactive) {
      id
      name
      code
      isActive
      sortOrder
    }
  }
`;

// ============================================================================
// Team/User Queries
// ============================================================================

export const GET_TEAM_MEMBERS = gql`
  query GetTeamMembers {
    firmUsers {
      id
      firstName
      lastName
      email
      role
    }
  }
`;

// ============================================================================
// Case Queries
// ============================================================================

export const GET_CASES = gql`
  query GetCases($status: CaseStatus, $assignedToMe: Boolean) {
    cases(status: $status, assignedToMe: $assignedToMe) {
      id
      caseNumber
      title
      status
      type
      description
      openedDate
      closedDate
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
      updatedAt
      syncStatus
      syncError
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
      closedDate
      client {
        id
        name
        contactInfo
        address
      }
      teamMembers {
        id
        role
        user {
          id
          firstName
          lastName
          email
          role
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
      billingType
      fixedAmount
      customRates {
        partnerRate
        associateRate
        paralegalRate
      }
      keywords
      referenceNumbers
      createdAt
      updatedAt
      syncStatus
      syncError
    }
  }
`;

export const SEARCH_CASES = gql`
  query SearchCases($query: String!, $limit: Int) {
    searchCases(query: $query, limit: $limit) {
      id
      caseNumber
      title
      status
      type
      client {
        id
        name
      }
      syncStatus
      syncError
    }
  }
`;

// ============================================================================
// Case Approval Queries
// ============================================================================

export const GET_PENDING_CASES = gql`
  query GetPendingCases {
    pendingCases {
      id
      caseNumber
      title
      status
      type
      description
      openedDate
      closedDate
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
      approval {
        id
        submittedBy {
          id
          firstName
          lastName
        }
        submittedAt
        reviewedBy {
          id
          firstName
          lastName
        }
        reviewedAt
        status
        rejectionReason
        revisionCount
      }
      billingType
      fixedAmount
      customRates {
        partnerRate
        associateRate
        paralegalRate
      }
      createdAt
      updatedAt
      syncStatus
      syncError
    }
  }
`;

// ============================================================================
// Task Queries
// ============================================================================

export const GET_TASKS = gql`
  query GetTasks($filters: TaskFilterInput, $limit: Int, $offset: Int) {
    tasks(filters: $filters, limit: $limit, offset: $offset) {
      id
      title
      description
      type
      status
      priority
      dueDate
      dueTime
      estimatedHours
      scheduledDate
      scheduledStartTime
      loggedTime
      parentTaskId
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
      subtasks {
        id
        title
        status
        priority
        dueDate
        estimatedHours
        scheduledDate
        scheduledStartTime
        loggedTime
        assignee {
          id
          firstName
          lastName
        }
      }
      createdAt
      completedAt
    }
  }
`;

export const GET_CALENDAR_EVENTS = gql`
  query GetCalendarEvents($filters: TaskFilterInput, $limit: Int) {
    tasks(filters: $filters, limit: $limit) {
      id
      title
      description
      type
      status
      priority
      dueDate
      dueTime
      estimatedHours
      scheduledDate
      scheduledStartTime
      loggedTime
      typeMetadata
      parentTaskId
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
      subtasks {
        id
        title
        status
        priority
        dueDate
        estimatedHours
        scheduledDate
        scheduledStartTime
        loggedTime
        assignee {
          id
          firstName
          lastName
        }
      }
      createdAt
    }
  }
`;

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
      scheduledDate
      scheduledStartTime
      loggedTime
      parentTaskId
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
      subtasks {
        id
        title
        status
        priority
        dueDate
        estimatedHours
        scheduledDate
        scheduledStartTime
        loggedTime
        assignee {
          id
          firstName
          lastName
        }
      }
      createdAt
      completedAt
    }
  }
`;

export const GET_TASKS_BY_CASE = gql`
  query GetTasksByCase($caseId: ID!, $filters: TaskFilterInput) {
    tasksByCase(caseId: $caseId, filters: $filters) {
      id
      title
      description
      type
      status
      priority
      dueDate
      dueTime
      estimatedHours
      scheduledDate
      scheduledStartTime
      loggedTime
      parentTaskId
      assignee {
        id
        firstName
        lastName
      }
      subtasks {
        id
        title
        status
        priority
        dueDate
        estimatedHours
        scheduledDate
        scheduledStartTime
        loggedTime
        assignee {
          id
          firstName
          lastName
        }
      }
      createdAt
      completedAt
    }
  }
`;

// ============================================================================
// Client Queries
// ============================================================================

export const SEARCH_CLIENTS = gql`
  query SearchClients($query: String!, $limit: Int) {
    searchClients(query: $query, limit: $limit) {
      id
      name
      contactInfo
      address
    }
  }
`;

// ============================================================================
// Document Queries
// ============================================================================

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
        thumbnailMedium
        uploadedBy {
          id
          firstName
          lastName
        }
      }
      linkedAt
      receivedAt
      linkedBy {
        id
        firstName
        lastName
      }
      isOriginal
      promotedFromAttachment
    }
  }
`;

export const GET_ALL_DOCUMENTS = gql`
  query GetAllDocuments(
    $caseId: UUID!
    $first: Int
    $sortBy: DocumentSortField
    $sortDirection: SortDirection
  ) {
    caseDocumentsGrid(
      caseId: $caseId
      first: $first
      sortBy: $sortBy
      sortDirection: $sortDirection
    ) {
      edges {
        node {
          id
          document {
            id
            fileName
            fileType
            fileSize
            status
            uploadedAt
            thumbnailMedium
            uploadedBy {
              id
              firstName
              lastName
            }
            client {
              id
              name
            }
          }
          linkedAt
          isOriginal
        }
      }
      totalCount
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
`;

// ============================================================================
// Document Preview Queries
// ============================================================================

export const GET_DOCUMENT_PREVIEW_URL = gql`
  query GetDocumentPreviewUrl($documentId: UUID!) {
    documentPreviewUrl(documentId: $documentId) {
      url
      source
      expiresAt
      syncResult {
        synced
        newVersionNumber
      }
    }
  }
`;

// Note: GET_DOCUMENT_DOWNLOAD_URL is defined in mutations.ts since it's a mutation

export const GET_DOCUMENT_TEXT_CONTENT = gql`
  query GetDocumentTextContent($documentId: UUID!) {
    documentTextContent(documentId: $documentId)
  }
`;

// ============================================================================
// Email Queries
// ============================================================================

export const GET_EMAILS = gql`
  query GetEmails($filters: EmailFilters, $limit: Int, $offset: Int) {
    emails(filters: $filters, limit: $limit, offset: $offset) {
      emails {
        id
        subject
        bodyPreview
        from {
          name
          address
        }
        toRecipients {
          name
          address
        }
        receivedDateTime
        hasAttachments
        isRead
        classificationState
        primaryCase {
          id
          caseNumber
          title
        }
      }
      totalCount
      hasMore
    }
  }
`;

export const GET_EMAIL_THREADS = gql`
  query GetEmailThreads($filters: EmailThreadFilters, $limit: Int, $offset: Int) {
    emailThreads(filters: $filters, limit: $limit, offset: $offset) {
      id
      conversationId
      subject
      participantCount
      messageCount
      hasUnread
      hasAttachments
      lastMessageDate
      firstMessageDate
      case {
        id
        caseNumber
        title
      }
    }
  }
`;

// Query for getting email threads by participant contacts (for case email tab)
export const GET_EMAIL_THREADS_BY_PARTICIPANTS = gql`
  query GetEmailThreadsByParticipants(
    $participantEmails: [String!]!
    $caseId: ID
    $limit: Int
    $offset: Int
  ) {
    emailThreads(
      filters: { participantEmails: $participantEmails, caseId: $caseId }
      limit: $limit
      offset: $offset
    ) {
      id
      conversationId
      subject
      participantCount
      messageCount
      hasUnread
      hasAttachments
      lastMessageDate
      firstMessageDate
      case {
        id
        caseNumber
        title
      }
      emails {
        id
        graphMessageId
        subject
        bodyPreview
        bodyContent
        bodyContentType
        bodyContentClean
        folderType
        from {
          name
          address
        }
        toRecipients {
          name
          address
        }
        ccRecipients {
          name
          address
        }
        receivedDateTime
        sentDateTime
        hasAttachments
        importance
        isRead
        attachments {
          id
          name
          contentType
          size
        }
      }
    }
  }
`;

export const GET_EMAIL_STATS = gql`
  query GetEmailStats {
    emailStats {
      totalEmails
      unreadEmails
      uncategorizedEmails
      emailsWithAttachments
      emailsByCase {
        caseId
        caseName
        count
      }
    }
  }
`;

export const GET_EMAILS_BY_CASE = gql`
  query GetEmailsByCase($limit: Int, $offset: Int) {
    emailsByCase(limit: $limit, offset: $offset) {
      clients {
        id
        name
        inboxThreads {
          id
          conversationId
          subject
          lastMessageDate
          lastSenderName
          lastSenderEmail
          preview
          isUnread
          hasAttachments
          messageCount
          linkedCases {
            id
            title
            caseNumber
            isPrimary
          }
          isPersonal
          personalMarkedBy
        }
        inboxUnreadCount
        inboxTotalCount
        cases {
          id
          title
          caseNumber
          threads {
            id
            conversationId
            subject
            lastMessageDate
            lastSenderName
            lastSenderEmail
            preview
            isUnread
            hasAttachments
            messageCount
            linkedCases {
              id
              title
              caseNumber
              isPrimary
            }
            isPersonal
            personalMarkedBy
          }
          unreadCount
          totalCount
        }
        totalUnreadCount
        totalCount
      }
      cases {
        id
        title
        caseNumber
        threads {
          id
          conversationId
          subject
          lastMessageDate
          lastSenderName
          lastSenderEmail
          preview
          isUnread
          hasAttachments
          messageCount
          linkedCases {
            id
            title
            caseNumber
            isPrimary
          }
          isPersonal
          personalMarkedBy
        }
        unreadCount
        totalCount
      }
      unassignedCase {
        id
        title
        caseNumber
        threads {
          id
          conversationId
          subject
          lastMessageDate
          lastSenderName
          lastSenderEmail
          preview
          isUnread
          hasAttachments
          messageCount
        }
        unreadCount
        totalCount
      }
      courtEmails {
        id
        subject
        from {
          name
          address
        }
        bodyPreview
        receivedDateTime
        hasAttachments
        courtName
        extractedCaseNumbers
      }
      courtEmailsCount
      uncertainEmails {
        id
        conversationId
        subject
        from {
          name
          address
        }
        bodyPreview
        receivedDateTime
        hasAttachments
        suggestedCases {
          id
          title
          caseNumber
          confidence
        }
      }
      uncertainEmailsCount
    }
  }
`;

export const GET_EMAIL_THREAD = gql`
  query GetEmailThread($conversationId: String!) {
    emailThread(conversationId: $conversationId) {
      id
      conversationId
      subject
      case {
        id
        title
        caseNumber
      }
      participantCount
      emails {
        id
        subject
        bodyContent
        bodyContentClean
        bodyContentType
        folderType
        from {
          name
          address
        }
        toRecipients {
          name
          address
        }
        sentDateTime
        receivedDateTime
        attachments {
          id
          name
          size
          contentType
        }
        isRead
        hasAttachments
      }
      lastMessageDate
      hasUnread
      hasAttachments
      messageCount
    }
  }
`;

export const GET_COURT_EMAILS = gql`
  query GetCourtEmails($limit: Int, $offset: Int) {
    courtEmails(limit: $limit, offset: $offset) {
      emails {
        id
        subject
        from {
          name
          address
        }
        bodyPreview
        receivedDateTime
        hasAttachments
        courtName
        extractedCaseNumbers
      }
      totalCount
      hasMore
    }
  }
`;

export const GET_UNCERTAIN_EMAILS = gql`
  query GetUncertainEmails($limit: Int, $offset: Int) {
    uncertainEmails(limit: $limit, offset: $offset) {
      emails {
        id
        conversationId
        subject
        from {
          name
          address
        }
        bodyPreview
        receivedDateTime
        hasAttachments
        suggestedCases {
          id
          title
          caseNumber
          confidence
        }
      }
      totalCount
      hasMore
    }
  }
`;

export const GET_EMAIL_SYNC_STATUS = gql`
  query GetEmailSyncStatus {
    emailSyncStatus {
      status
      lastSyncAt
      emailCount
      pendingCategorization
    }
  }
`;

export const GET_ATTACHMENT_PREVIEW_URL = gql`
  query GetAttachmentPreviewUrl($attachmentId: ID!) {
    attachmentPreviewUrl(attachmentId: $attachmentId) {
      url
      source
      expiresAt
    }
  }
`;

export const GET_ATTACHMENT_CONTENT = gql`
  query GetAttachmentContent($emailId: ID!, $attachmentId: ID!) {
    emailAttachmentContent(emailId: $emailId, attachmentId: $attachmentId) {
      content
      name
      contentType
      size
    }
  }
`;

// ============================================================================
// Email Mutations
// ============================================================================

export const START_EMAIL_SYNC = gql`
  mutation StartEmailSync {
    startEmailSync {
      status
      emailCount
      lastSyncAt
      pendingCategorization
    }
  }
`;

export const ASSIGN_THREAD_TO_CASE = gql`
  mutation AssignThreadToCase($conversationId: String!, $caseId: ID!) {
    assignThreadToCase(conversationId: $conversationId, caseId: $caseId) {
      thread {
        id
        conversationId
        case {
          id
          title
          caseNumber
        }
      }
      newContactAdded
      contactName
      contactEmail
    }
  }
`;

export const CLASSIFY_UNCERTAIN_EMAIL = gql`
  mutation ClassifyUncertainEmail($emailId: ID!, $action: ClassificationActionInput!) {
    classifyUncertainEmail(emailId: $emailId, action: $action) {
      email {
        id
        classificationState
      }
      case {
        id
        title
        caseNumber
      }
      wasIgnored
    }
  }
`;

export const MARK_SENDER_AS_PERSONAL = gql`
  mutation MarkSenderAsPersonal($emailId: ID!, $ignoreEmail: Boolean) {
    markSenderAsPersonal(emailId: $emailId, ignoreEmail: $ignoreEmail) {
      id
      email
      createdAt
    }
  }
`;

export const MARK_THREAD_AS_PERSONAL = gql`
  mutation MarkThreadAsPersonal($conversationId: String!) {
    markThreadAsPersonal(conversationId: $conversationId) {
      id
      conversationId
    }
  }
`;

export const UNMARK_THREAD_AS_PERSONAL = gql`
  mutation UnmarkThreadAsPersonal($conversationId: String!) {
    unmarkThreadAsPersonal(conversationId: $conversationId)
  }
`;

export const IS_THREAD_PERSONAL = gql`
  query IsThreadPersonal($conversationId: String!) {
    isThreadPersonal(conversationId: $conversationId)
  }
`;

export const SEND_EMAIL = gql`
  mutation SendEmail($input: SendEmailInput!) {
    sendNewEmail(input: $input) {
      success
      messageId
      error
    }
  }
`;

export const REPLY_TO_EMAIL = gql`
  mutation ReplyToEmail($input: ReplyEmailInput!) {
    replyToEmail(input: $input) {
      success
      messageId
      error
    }
  }
`;

// ============================================================================
// Client Inbox Queries (Multi-Case Client Support)
// ============================================================================

export const GET_CLIENTS_WITH_EMAIL_INBOX = gql`
  query GetClientsWithEmailInbox {
    clientsWithEmailInbox {
      id
      name
      activeCasesCount
      activeCases {
        id
        caseNumber
        title
      }
      unreadCount
      totalCount
    }
  }
`;

export const GET_CLIENT_INBOX_EMAILS = gql`
  query GetClientInboxEmails($clientId: ID!, $limit: Int, $offset: Int) {
    clientInboxEmails(clientId: $clientId, limit: $limit, offset: $offset) {
      client {
        id
        name
        activeCasesCount
        activeCases {
          id
          caseNumber
          title
        }
        unreadCount
        totalCount
      }
      threads {
        id
        conversationId
        subject
        lastMessageDate
        lastSenderName
        lastSenderEmail
        preview
        isUnread
        hasAttachments
        messageCount
      }
      totalCount
    }
  }
`;

export const ASSIGN_CLIENT_INBOX_TO_CASE = gql`
  mutation AssignClientInboxToCase($conversationId: String!, $caseId: ID!) {
    assignClientInboxToCase(conversationId: $conversationId, caseId: $caseId) {
      thread {
        id
        conversationId
        subject
        case {
          id
          title
          caseNumber
        }
      }
      newContactAdded
      contactName
      contactEmail
    }
  }
`;

// Email drafting mutations - uses backend's generateEmailDraft
export const GENERATE_AI_REPLY = gql`
  mutation GenerateAiReply($input: GenerateDraftInput!) {
    generateEmailDraft(input: $input) {
      id
      body
      subject
      tone
      confidence
    }
  }
`;

export const GENERATE_QUICK_REPLY = gql`
  mutation GenerateQuickReply($emailId: ID!) {
    generateMultipleDrafts(emailId: $emailId) {
      recommendedTone
      drafts {
        tone
        draft {
          id
          body
          confidence
        }
      }
    }
  }
`;

// ============================================================================
// Dashboard Queries
// ============================================================================

export const GET_DASHBOARD_STATS = gql`
  query GetDashboardStats($dateRange: DateRangeInput!) {
    # Active cases count
    cases(status: Active) {
      id
    }

    # My tasks for today and urgent
    myTasks {
      id
      status
      priority
      dueDate
      estimatedHours
      scheduledDate
      scheduledStartTime
      loggedTime
    }

    # Team workload for utilization
    teamWorkload(dateRange: $dateRange) {
      teamAverageUtilization
      members {
        userId
        user {
          id
          firstName
          lastName
        }
        averageUtilization
        status
      }
    }

    # Overdue analytics
    overdueAnalytics(filters: { dateRange: $dateRange }) {
      totalOverdue
    }
  }
`;

export const GET_TEAM_WORKLOAD = gql`
  query GetTeamWorkload($dateRange: DateRangeInput!) {
    teamWorkload(dateRange: $dateRange) {
      teamAverageUtilization
      overloadedCount
      underUtilizedCount
      members {
        userId
        user {
          id
          firstName
          lastName
        }
        averageUtilization
        weeklyAllocated
        weeklyCapacity
        status
      }
    }
  }
`;

export const GET_RECENT_CASES = gql`
  query GetRecentCases($limit: Int) {
    cases(status: Active) {
      id
      caseNumber
      title
      status
      type
      client {
        id
        name
      }
      updatedAt
    }
  }
`;

export const GET_FIRM_METRICS = gql`
  query GetFirmMetrics($dateRange: DateRangeInput!) {
    # All tasks for counting
    tasks(filters: { dateRange: $dateRange }) {
      id
      status
      dueDate
      estimatedHours
      scheduledDate
      scheduledStartTime
      loggedTime
    }

    # Overdue info
    overdueAnalytics(filters: { dateRange: $dateRange }) {
      totalOverdue
      overdueByType {
        taskType
        count
      }
    }
  }
`;

// ============================================================================
// Historical Email Sync Queries
// ============================================================================

export const GET_HISTORICAL_EMAIL_SYNC_STATUS = gql`
  query GetHistoricalEmailSyncStatus($caseId: ID!) {
    historicalEmailSyncStatus(caseId: $caseId) {
      id
      caseId
      contactEmail
      contactRole
      status
      totalEmails
      syncedEmails
      errorMessage
      startedAt
      completedAt
      createdAt
    }
  }
`;

// ============================================================================
// Settings Queries
// ============================================================================

export const GET_USER_PREFERENCES = gql`
  query GetUserPreferences {
    userPreferences {
      theme
      emailSignature
    }
  }
`;

export const GET_COURTS = gql`
  query GetCourts {
    globalEmailSources {
      id
      name
      domains
      category
      createdAt
    }
  }
`;

export const GET_DEFAULT_RATES = gql`
  query GetDefaultRates {
    defaultRates {
      partnerRate
      associateRate
      paralegalRate
    }
  }
`;

export const GET_PERSONAL_CONTACTS = gql`
  query GetPersonalContacts {
    personalContacts {
      id
      email
      createdAt
    }
  }
`;

export const GET_SETTINGS_TEAM_MEMBERS = gql`
  query GetSettingsTeamMembers {
    teamMembers {
      id
      firstName
      lastName
      email
      role
      status
    }
  }
`;

export const GET_PENDING_USERS = gql`
  query GetPendingUsers {
    pendingUsers {
      id
      firstName
      lastName
      email
      createdAt
    }
  }
`;

// ============================================================================
// Case Summary Queries
// ============================================================================

export const GET_CASE_SUMMARY = gql`
  query GetCaseSummary($caseId: ID!) {
    caseSummary(caseId: $caseId) {
      id
      caseId
      executiveSummary
      currentStatus
      keyDevelopments
      openIssues
      generatedAt
      isStale
      emailCount
      documentCount
      noteCount
      taskCount
    }
  }
`;

export const TRIGGER_CASE_SUMMARY_GENERATION = gql`
  mutation TriggerCaseSummaryGeneration($caseId: ID!) {
    triggerCaseSummaryGeneration(caseId: $caseId) {
      success
      message
      summary {
        id
        caseId
        executiveSummary
        currentStatus
        keyDevelopments
        openIssues
        generatedAt
        isStale
      }
    }
  }
`;

// ============================================================================
// Notification Queries
// ============================================================================

export const GET_NOTIFICATIONS = gql`
  query GetNotifications($read: Boolean, $limit: Int) {
    notifications(read: $read, limit: $limit) {
      id
      type
      title
      message
      link
      read
      caseId
      createdAt
      readAt
    }
  }
`;

export const GET_UNREAD_NOTIFICATION_COUNT = gql`
  query GetUnreadNotificationCount {
    unreadNotificationCount
  }
`;

export const GET_IN_APP_NOTIFICATIONS = gql`
  query GetInAppNotifications($includeRead: Boolean, $limit: Int) {
    inAppNotifications(includeRead: $includeRead, limit: $limit) {
      id
      title
      body
      icon
      read
      createdAt
      action {
        type
        entityId
        caseId
      }
    }
  }
`;

export const GET_IN_APP_NOTIFICATION_COUNT = gql`
  query GetInAppNotificationCount {
    inAppNotificationCount
  }
`;

// ============================================================================
// Nav Badge Counts Query
// ============================================================================

export const GET_NAV_BADGE_COUNTS = gql`
  query GetNavBadgeCounts {
    # Email unread count
    emailStats {
      unreadEmails
    }

    # Pending tasks assigned to current user
    myTasks(filters: { statuses: [Pending, InProgress] }) {
      id
    }

    # Upcoming events (hearings and meetings)
    tasks(filters: { types: [Hearing, Meeting], statuses: [Pending, InProgress] }, limit: 100) {
      id
    }
  }
`;

// ============================================================================
// Storage Quota Query
// ============================================================================

export const GET_STORAGE_QUOTA = gql`
  query GetStorageQuota {
    storageQuota {
      total
      used
      remaining
      state
    }
  }
`;
