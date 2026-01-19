import { gql } from '@apollo/client';

// ============================================================================
// Template Queries
// ============================================================================

export const GET_TEMPLATES = gql`
  query GetTemplates {
    mapaTemplates {
      id
      name
      description
      caseType
      isActive
      usageCount
      slotDefinitions {
        name
        description
        category
        required
        order
      }
      createdBy {
        id
        firstName
        lastName
      }
      createdAt
    }
  }
`;

export const GET_TEMPLATE = gql`
  query GetTemplate($id: UUID!) {
    mapaTemplate(id: $id) {
      id
      name
      description
      caseType
      isActive
      usageCount
      slotDefinitions {
        name
        description
        category
        required
        order
      }
      createdBy {
        id
        firstName
        lastName
      }
      createdAt
    }
  }
`;

// Note: ONRC templates are no longer a separate concept in the backend
// Use mapaTemplates query instead
export const GET_ONRC_TEMPLATES = gql`
  query GetONRCTemplates {
    mapaTemplates {
      id
      name
      description
      slotDefinitions {
        name
        description
        category
        required
        order
      }
    }
  }
`;

// ============================================================================
// Template Mutations
// ============================================================================

export const CREATE_MAPA_FROM_TEMPLATE = gql`
  mutation CreateMapaFromTemplate($templateId: String!, $caseId: UUID, $clientId: UUID) {
    createMapaFromTemplate(templateId: $templateId, caseId: $caseId, clientId: $clientId) {
      id
      name
      description
      createdBy {
        id
        firstName
        lastName
      }
      createdAt
      slots {
        id
        name
        description
        category
        required
        order
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

export const CREATE_TEMPLATE = gql`
  mutation CreateTemplate($input: CreateTemplateInput!) {
    createMapaTemplate(input: $input) {
      id
      name
      description
      caseType
      isActive
      slotDefinitions {
        name
        description
        category
        required
        order
      }
      createdBy {
        id
        firstName
        lastName
      }
      createdAt
    }
  }
`;

export const UPDATE_TEMPLATE = gql`
  mutation UpdateTemplate($id: UUID!, $input: UpdateTemplateInput!) {
    updateMapaTemplate(id: $id, input: $input) {
      id
      name
      description
      caseType
      isActive
      slotDefinitions {
        name
        description
        category
        required
        order
      }
    }
  }
`;

export const DELETE_TEMPLATE = gql`
  mutation DeleteTemplate($id: UUID!) {
    deleteMapaTemplate(id: $id)
  }
`;

// Note: These mutations may not be fully implemented in the backend yet
export const DUPLICATE_TEMPLATE = gql`
  mutation DuplicateTemplate($templateId: UUID!, $newName: String!) {
    duplicateTemplate(templateId: $templateId, newName: $newName) {
      id
      name
      description
      slotDefinitions {
        name
        description
        category
        required
        order
      }
      createdAt
    }
  }
`;

// ONRC sync mutations - may not exist in current backend
export const SYNC_ONRC_TEMPLATES = gql`
  mutation SyncONRCTemplates {
    syncONRCTemplates {
      success
      message
      syncedCount
    }
  }
`;

export const SYNC_SINGLE_TEMPLATE = gql`
  mutation SyncSingleTemplate($templateId: UUID!) {
    syncSingleTemplate(templateId: $templateId) {
      success
      message
    }
  }
`;
