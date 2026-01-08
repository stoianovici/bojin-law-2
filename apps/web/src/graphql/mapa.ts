import { gql } from '@apollo/client';

// ============================================================================
// Mapa Queries
// ============================================================================

export const GET_MAPA = gql`
  query GetMapa($id: UUID!) {
    mapa(id: $id) {
      id
      caseId
      name
      description
      templateId
      createdBy {
        id
        firstName
        lastName
        initials
      }
      createdAt
      updatedAt
      slots {
        id
        mapaId
        name
        description
        category
        required
        order
        status
        document {
          id
          fileName
          fileType
          fileSize
          status
          sourceType
          uploadedAt
          thumbnailUrl
        }
        assignedAt
        assignedBy {
          id
          firstName
          lastName
          initials
        }
        documentRequest {
          id
          status
          requestedAt
          dueDate
          remindersSent
        }
      }
      completionStatus {
        totalSlots
        filledSlots
        requiredSlots
        filledRequiredSlots
        isComplete
        missingRequired
        percentComplete
      }
    }
  }
`;

export const GET_MAPAS = gql`
  query GetMapas($caseId: UUID!) {
    caseMape(caseId: $caseId) {
      id
      caseId
      name
      description
      templateId
      createdBy {
        id
        firstName
        lastName
        initials
      }
      createdAt
      updatedAt
      completionStatus {
        totalSlots
        filledSlots
        requiredSlots
        filledRequiredSlots
        isComplete
        missingRequired
        percentComplete
      }
    }
  }
`;

export const GET_CASES_WITH_MAPE = gql`
  query GetCasesWithMape {
    casesWithMape {
      id
      caseNumber
      name
      status
      documentCount
      unassignedDocumentCount
      mape {
        id
        name
        description
        completionStatus {
          totalSlots
          filledSlots
          percentComplete
          isComplete
        }
      }
    }
  }
`;

// ============================================================================
// Mapa Mutations
// ============================================================================

export const CREATE_MAPA = gql`
  mutation CreateMapa($input: CreateMapaInput!) {
    createMapa(input: $input) {
      id
      caseId
      name
      description
      createdBy {
        id
        firstName
        lastName
        initials
      }
      createdAt
      slots {
        id
        name
        category
        required
        order
        status
      }
      completionStatus {
        totalSlots
        filledSlots
        requiredSlots
        filledRequiredSlots
        isComplete
        missingRequired
        percentComplete
      }
    }
  }
`;

export const UPDATE_MAPA = gql`
  mutation UpdateMapa($id: UUID!, $input: UpdateMapaInput!) {
    updateMapa(id: $id, input: $input) {
      id
      name
      description
      updatedAt
    }
  }
`;

export const DELETE_MAPA = gql`
  mutation DeleteMapa($id: UUID!) {
    deleteMapa(id: $id)
  }
`;

// ============================================================================
// Slot Mutations
// ============================================================================

export const ASSIGN_DOCUMENT_TO_SLOT = gql`
  mutation AssignDocumentToSlot($slotId: UUID!, $documentId: UUID!) {
    assignDocumentToSlot(slotId: $slotId, documentId: $documentId) {
      id
      mapaId
      document {
        id
        fileName
        fileType
        fileSize
        status
        uploadedAt
      }
      assignedAt
      assignedBy {
        id
        firstName
        lastName
        initials
      }
      status
    }
  }
`;

export const REMOVE_DOCUMENT_FROM_SLOT = gql`
  mutation RemoveDocumentFromSlot($slotId: UUID!) {
    removeDocumentFromSlot(slotId: $slotId) {
      id
      mapaId
      document
      assignedAt
      assignedBy
      status
    }
  }
`;

export const UPDATE_SLOT_STATUS = gql`
  mutation UpdateSlotStatus($slotId: UUID!, $status: SlotStatus!) {
    updateSlotStatus(slotId: $slotId, status: $status) {
      id
      status
    }
  }
`;

export const ADD_SLOT_TO_MAPA = gql`
  mutation AddSlotToMapa($mapaId: UUID!, $input: AddSlotInput!) {
    addSlotToMapa(mapaId: $mapaId, input: $input) {
      id
      mapaId
      name
      description
      category
      required
      order
      status
    }
  }
`;

export const REMOVE_SLOT_FROM_MAPA = gql`
  mutation RemoveSlotFromMapa($slotId: UUID!) {
    removeSlotFromMapa(slotId: $slotId) {
      success
      message
    }
  }
`;

export const REORDER_SLOTS = gql`
  mutation ReorderSlots($mapaId: UUID!, $slotIds: [UUID!]!) {
    reorderSlots(mapaId: $mapaId, slotIds: $slotIds) {
      id
      order
    }
  }
`;

// ============================================================================
// Document Request Mutations
// NOTE: These mutations are not yet implemented in the backend
// ============================================================================

// Placeholder - not implemented in backend yet
export const CREATE_DOCUMENT_REQUEST = gql`
  mutation CreateDocumentRequest($input: CreateDocumentRequestInput!) {
    __typename
  }
`;

// Placeholder - not implemented in backend yet
export const CANCEL_DOCUMENT_REQUEST = gql`
  mutation CancelDocumentRequest($requestId: UUID!) {
    __typename
  }
`;

// Placeholder - not implemented in backend yet
export const MARK_REQUEST_AS_RECEIVED = gql`
  mutation MarkRequestAsReceived($requestId: UUID!, $documentId: UUID!) {
    __typename
  }
`;
