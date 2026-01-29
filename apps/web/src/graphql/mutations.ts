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

export const ARCHIVE_CASE = gql`
  mutation ArchiveCase($id: UUID!) {
    archiveCase(id: $id) {
      id
      status
      closedDate
    }
  }
`;

export const DELETE_CASE = gql`
  mutation DeleteCase($id: UUID!, $input: DeleteCaseInput!) {
    deleteCase(id: $id, input: $input) {
      id
      status
      closedDate
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
  mutation RemoveTeamMember($caseId: UUID!, $userId: UUID!) {
    removeTeamMember(caseId: $caseId, userId: $userId)
  }
`;

export const UPDATE_CASE_METADATA = gql`
  mutation UpdateCaseMetadata($caseId: UUID!, $input: CaseMetadataInput!) {
    updateCaseMetadata(caseId: $caseId, input: $input) {
      id
      keywords
      referenceNumbers
    }
  }
`;

// ============================================================================
// Client Team Mutations
// ============================================================================

export const ASSIGN_CLIENT_TEAM = gql`
  mutation AssignClientTeam($clientId: UUID!, $userId: UUID!, $role: String!) {
    assignClientTeam(clientId: $clientId, userId: $userId, role: $role) {
      id
      role
      assignedAt
      user {
        id
        firstName
        lastName
        email
        role
      }
    }
  }
`;

export const REMOVE_CLIENT_TEAM = gql`
  mutation RemoveClientTeam($clientId: UUID!, $userId: UUID!) {
    removeClientTeam(clientId: $clientId, userId: $userId)
  }
`;

// ============================================================================
// Client Mutations
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
      billingType
      fixedAmount
      customRates {
        partnerRate
        associateRate
        paralegalRate
      }
      retainerAmount
      retainerPeriod
      retainerAutoRenew
      retainerRollover
    }
  }
`;

export const DELETE_CLIENT = gql`
  mutation DeleteClient($id: UUID!) {
    deleteClient(id: $id) {
      id
      name
      caseCount
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
      client {
        id
        name
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
// Task Comment Mutations
// ============================================================================

export const CREATE_TASK_COMMENT = gql`
  mutation CreateTaskComment($input: CreateTaskCommentInput!) {
    createTaskComment(input: $input) {
      id
      taskId
      content
      author {
        id
        firstName
        lastName
      }
      createdAt
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
      client {
        id
        name
      }
      attendees {
        id
        firstName
        lastName
      }
      createdAt
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
      signaturePhone
      signatureTitle
      tutorialCompleted
      tutorialStep
      documentOpenMethod
      receiveAllDocNotifications
    }
  }
`;

export const CREATE_COURT = gql`
  mutation CreateCourt($input: CreateGlobalEmailSourceInput!) {
    createGlobalEmailSource(input: $input) {
      id
      name
      domains
      emails
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
      emails
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
      processWithAI
      extractionStatus
    }
  }
`;

/**
 * Enable or disable AI processing for a document
 * Triggers content extraction when enabled
 */
export const SET_DOCUMENT_PROCESS_WITH_AI = gql`
  mutation SetDocumentProcessWithAI($documentId: UUID!, $processWithAI: Boolean!) {
    setDocumentProcessWithAI(documentId: $documentId, processWithAI: $processWithAI) {
      id
      processWithAI
      extractionStatus
      extractionError
    }
  }
`;

/**
 * Retry content extraction for a document (including OCR for scanned documents)
 * Useful for re-processing documents that failed extraction or to trigger OCR
 */
export const RETRY_DOCUMENT_EXTRACTION = gql`
  mutation RetryDocumentExtraction($documentId: UUID!) {
    retryDocumentExtraction(documentId: $documentId) {
      id
      extractionStatus
      extractionError
      extractedContent
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

/**
 * Rename a document
 * Updates fileName in database (does NOT rename in SharePoint/OneDrive)
 */
export const RENAME_DOCUMENT = gql`
  mutation RenameDocument($documentId: UUID!, $newFileName: String!) {
    renameDocument(documentId: $documentId, newFileName: $newFileName) {
      id
      fileName
    }
  }
`;

/**
 * Permanently delete a document (Partners only)
 * Removes from all cases and deletes from storage
 */
export const PERMANENTLY_DELETE_DOCUMENT = gql`
  mutation PermanentlyDeleteDocument($documentId: UUID!) {
    permanentlyDeleteDocument(documentId: $documentId)
  }
`;

/**
 * Unlink a document from a case (soft delete)
 * Document remains in storage and other cases
 */
export const UNLINK_DOCUMENT_FROM_CASE = gql`
  mutation UnlinkDocumentFromCase($caseId: UUID!, $documentId: UUID!) {
    unlinkDocumentFromCase(caseId: $caseId, documentId: $documentId)
  }
`;

/**
 * Mark document as ready for review
 * Transitions status from DRAFT to READY_FOR_REVIEW
 * Only document author can call this
 */
export const MARK_DOCUMENT_READY_FOR_REVIEW = gql`
  mutation MarkDocumentReadyForReview($documentId: ID!) {
    markReadyForReview(documentId: $documentId) {
      id
      status
      updatedAt
    }
  }
`;

/**
 * Mark document as final (approved)
 * Transitions status from READY_FOR_REVIEW to FINAL
 * Only case supervisors (Partner, SeniorAssociate) can call this
 */
export const MARK_DOCUMENT_FINAL = gql`
  mutation MarkDocumentFinal($documentId: ID!) {
    markFinal(documentId: $documentId) {
      id
      status
      updatedAt
    }
  }
`;

// ============================================================================
// Privacy Mutations (Private-by-Default)
// ============================================================================

/**
 * Make a private email public (visible to team)
 * Only the email owner (Partner/BusinessOwner) can do this
 */
export const MARK_EMAIL_PUBLIC = gql`
  mutation MarkEmailPublic($emailId: ID!) {
    markEmailPublic(emailId: $emailId) {
      id
      isPrivate
      markedPublicAt
      markedPublicBy
    }
  }
`;

/**
 * Make an email private (hidden from team)
 * Only the email owner (Partner/BusinessOwner) can do this
 */
export const MARK_EMAIL_PRIVATE = gql`
  mutation MarkEmailPrivate($emailId: ID!) {
    markEmailPrivate(emailId: $emailId) {
      id
      isPrivate
      markedPrivateAt
      markedPrivateBy
    }
  }
`;

/**
 * Make a private document public (visible to team)
 * Only the document owner (Partner/BusinessOwner) can do this
 */
export const MARK_DOCUMENT_PUBLIC = gql`
  mutation MarkDocumentPublic($documentId: UUID!) {
    markDocumentPublic(documentId: $documentId) {
      id
      isPrivate
      markedPublicAt
      markedPublicBy
    }
  }
`;

/**
 * Make a public document private (hidden from team)
 * Only the document owner (Partner/BusinessOwner) can do this
 */
export const MARK_DOCUMENT_PRIVATE = gql`
  mutation MarkDocumentPrivate($documentId: UUID!) {
    markDocumentPrivate(documentId: $documentId) {
      id
      isPrivate
    }
  }
`;

/**
 * Make a private email attachment public (visible to team)
 * Attachments can be made public independently of the parent email
 */
export const MARK_ATTACHMENT_PUBLIC = gql`
  mutation MarkAttachmentPublic($attachmentId: ID!) {
    markAttachmentPublic(attachmentId: $attachmentId) {
      id
      name
      isPrivate
    }
  }
`;

/**
 * Make an email attachment private (hidden from team)
 * Only the email owner (Partner/BusinessOwner) can do this
 */
export const MARK_ATTACHMENT_PRIVATE = gql`
  mutation MarkAttachmentPrivate($attachmentId: ID!) {
    markAttachmentPrivate(attachmentId: $attachmentId) {
      id
      name
      isPrivate
    }
  }
`;

/**
 * Mark all emails in a thread as private
 * Only the thread owner (Partner/BusinessOwner) can do this
 */
export const MARK_THREAD_PRIVATE = gql`
  mutation MarkThreadPrivate($conversationId: String!) {
    markThreadPrivate(conversationId: $conversationId) {
      id
      isPrivate
    }
  }
`;

/**
 * Restore all private emails in a thread (make public)
 * Only the thread owner (Partner/BusinessOwner) can do this
 */
export const UNMARK_THREAD_PRIVATE = gql`
  mutation UnmarkThreadPrivate($conversationId: String!) {
    unmarkThreadPrivate(conversationId: $conversationId) {
      id
      isPrivate
    }
  }
`;

// ============================================================================
// Firm Document Template Mutations
// ============================================================================

/**
 * Update the firm's master document template
 * Authorization: Admin role required
 */
export const UPDATE_FIRM_DOCUMENT_TEMPLATE = gql`
  mutation UpdateFirmDocumentTemplate($input: UpdateDocumentTemplateInput!) {
    updateFirmDocumentTemplate(input: $input) {
      url
      driveItemId
      fileName
      updatedAt
    }
  }
`;

/**
 * Upload firm document template to SharePoint
 * Uploads the file and updates the template reference
 * Authorization: Admin role required
 */
export const UPLOAD_FIRM_DOCUMENT_TEMPLATE = gql`
  mutation UploadFirmDocumentTemplate($input: UploadFirmDocumentTemplateInput!) {
    uploadFirmDocumentTemplate(input: $input) {
      url
      driveItemId
      fileName
      updatedAt
    }
  }
`;

// ============================================================================
// Global Email Ignore Patterns Mutations
// ============================================================================

/**
 * Create a new global email ignore pattern
 * Pattern can be a full email address or @domain format
 * Authorization: Partner role required
 */
export const CREATE_GLOBAL_IGNORE_PATTERN = gql`
  mutation CreateGlobalIgnorePattern($pattern: String!, $notes: String) {
    createGlobalIgnorePattern(pattern: $pattern, notes: $notes) {
      id
      pattern
      notes
      createdAt
      createdBy {
        id
        firstName
        lastName
      }
    }
  }
`;

/**
 * Delete a global email ignore pattern
 * Authorization: Partner role required
 */
export const DELETE_GLOBAL_IGNORE_PATTERN = gql`
  mutation DeleteGlobalIgnorePattern($id: UUID!) {
    deleteGlobalIgnorePattern(id: $id)
  }
`;

// ============================================================================
// Email Rejection Mutations (Classification Enhancement)
// ============================================================================

/**
 * Reject an email from a case - indicates the email doesn't belong to this case
 * Optionally adds sender to excludePatterns, reassigns to correct case
 */
export const REJECT_EMAIL_FROM_CASE = gql`
  mutation RejectEmailFromCase($input: RejectEmailInput!) {
    rejectEmailFromCase(input: $input) {
      email {
        id
        classificationState
        caseId
      }
      patternAdded
      historicalReclassified
    }
  }
`;

// ============================================================================
// Invoice Mutations (Oblio Integration)
// ============================================================================

/**
 * Save Oblio configuration
 * Stores encrypted API credentials and default settings
 */
export const SAVE_OBLIO_CONFIG = gql`
  mutation SaveOblioConfig($input: OblioConfigInput!) {
    saveOblioConfig(input: $input) {
      email
      companyCif
      defaultSeries
      workStation
      isVatPayer
      defaultVatRate
      defaultDueDays
      exchangeRateSource
      autoSubmitEFactura
      isConfigured
      lastTestedAt
    }
  }
`;

/**
 * Test Oblio API connection
 * Validates credentials and returns company information
 */
export const TEST_OBLIO_CONNECTION = gql`
  mutation TestOblioConnection {
    testOblioConnection {
      success
      message
    }
  }
`;

/**
 * Create a prepared invoice (draft)
 * Creates invoice with line items from time entries
 */
export const CREATE_PREPARED_INVOICE = gql`
  mutation CreatePreparedInvoice($input: CreatePreparedInvoiceInput!) {
    createPreparedInvoice(input: $input) {
      id
      oblioSeries
      clientId
      caseId
      issueDate
      dueDate
      subtotalEur
      vatAmount
      total
      exchangeRate
      exchangeRateSource
      status
      notes
      internalNote
      lineItems {
        id
        name
        description
        quantity
        measuringUnit
        unitPriceEur
        vatRate
        total
        itemType
      }
      createdAt
    }
  }
`;

/**
 * Issue invoice to Oblio
 * Sends draft invoice to Oblio API and gets official number
 */
export const ISSUE_INVOICE = gql`
  mutation IssueInvoice($id: UUID!) {
    issueInvoice(id: $id) {
      id
      oblioNumber
      oblioDocumentId
      status
      pdfUrl
      issuedAt
    }
  }
`;

/**
 * Mark invoice as paid
 */
export const MARK_INVOICE_PAID = gql`
  mutation MarkInvoicePaid($id: UUID!, $paidAt: DateTime) {
    markInvoicePaid(id: $id, paidAt: $paidAt) {
      id
      status
      paidAt
    }
  }
`;

/**
 * Cancel an issued invoice
 * Creates storno in Oblio
 */
export const CANCEL_INVOICE = gql`
  mutation CancelInvoice($id: UUID!, $reason: String) {
    cancelInvoice(id: $id, reason: $reason) {
      id
      status
      cancelledAt
      cancellationReason
    }
  }
`;

/**
 * Delete a draft invoice
 * Only drafts can be deleted
 */
export const DELETE_INVOICE = gql`
  mutation DeleteInvoice($id: UUID!) {
    deleteInvoice(id: $id)
  }
`;

/**
 * Submit invoice to e-Factura (ANAF)
 */
export const SUBMIT_INVOICE_TO_EFACTURA = gql`
  mutation SubmitInvoiceToEFactura($id: UUID!) {
    submitInvoiceToEFactura(id: $id) {
      id
      eFacturaStatus
      eFacturaSubmittedAt
      eFacturaError
    }
  }
`;

// ============================================================================
// Proforma Mutations (for testing Oblio integration)
// ============================================================================

/**
 * Issue a draft as a proforma in Oblio
 * Proformas can be deleted and don't affect invoice numbering
 * Great for testing the integration
 */
export const ISSUE_AS_PROFORMA = gql`
  mutation IssueAsProforma($id: UUID!) {
    issueAsProforma(id: $id) {
      invoice {
        id
        oblioNumber
        oblioDocumentId
        pdfUrl
        internalNote
        status
      }
      proforma {
        seriesName
        number
        link
      }
    }
  }
`;

/**
 * Delete a proforma from Oblio
 * Only works if the invoice was issued as a proforma
 */
export const DELETE_PROFORMA = gql`
  mutation DeleteProforma($id: UUID!) {
    deleteProforma(id: $id) {
      id
      oblioNumber
      oblioDocumentId
      pdfUrl
      internalNote
    }
  }
`;

/**
 * Convert a proforma to a real invoice
 * Creates an actual invoice in Oblio with a real number
 */
export const CONVERT_PROFORMA_TO_INVOICE = gql`
  mutation ConvertProformaToInvoice($id: UUID!) {
    convertProformaToInvoice(id: $id) {
      id
      oblioSeries
      oblioNumber
      oblioDocumentId
      pdfUrl
      status
      issuedAt
    }
  }
`;

/**
 * Log time against a task (quick time entry)
 */
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

/**
 * Mark time entries as non-billable (excluded from future invoicing)
 */
export const MARK_TIME_ENTRIES_NON_BILLABLE = gql`
  mutation MarkTimeEntriesNonBillable($ids: [ID!]!) {
    markTimeEntriesNonBillable(ids: $ids)
  }
`;
