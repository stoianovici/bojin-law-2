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
