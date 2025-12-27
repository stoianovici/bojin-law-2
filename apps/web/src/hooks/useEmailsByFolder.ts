/**
 * useEmailsByFolder Hook
 * OPS-293: Add Outlook Folders Section to CaseSidebar
 *
 * Fetches emails grouped by Outlook folder for the sidebar display.
 * Returns folders containing unassigned emails with pagination support.
 */

import { gql } from '@apollo/client';
import { useQuery } from '@apollo/client/react';

// ============================================================================
// GraphQL Query
// ============================================================================

const EMAIL_ADDRESS_FRAGMENT = gql`
  fragment EmailAddressFieldsFolder on EmailAddress {
    name
    address
  }
`;

const GET_EMAILS_BY_FOLDER = gql`
  ${EMAIL_ADDRESS_FRAGMENT}
  query GetEmailsByFolder {
    emailsByFolder {
      id
      name
      emailCount
      unreadCount
      emails(limit: 50) {
        id
        subject
        bodyPreview
        hasAttachments
        isRead
        receivedDateTime
        from {
          ...EmailAddressFieldsFolder
        }
      }
    }
  }
`;

// ============================================================================
// Types
// ============================================================================

export interface FolderEmail {
  id: string;
  subject: string | null;
  bodyPreview: string | null;
  hasAttachments: boolean;
  isRead: boolean;
  receivedDateTime: string;
  from: {
    name: string | null;
    address: string;
  };
}

export interface OutlookFolder {
  id: string;
  name: string;
  emailCount: number;
  unreadCount: number;
  emails: FolderEmail[];
}

// ============================================================================
// Hook
// ============================================================================

export function useEmailsByFolder() {
  const { data, loading, error, refetch } = useQuery<{
    emailsByFolder: OutlookFolder[];
  }>(GET_EMAILS_BY_FOLDER, {
    fetchPolicy: 'cache-and-network',
  });

  return {
    folders: data?.emailsByFolder || [],
    loading,
    error,
    refetch,
  };
}

export default useEmailsByFolder;
