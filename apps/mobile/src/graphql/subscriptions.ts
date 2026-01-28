import { gql } from '@apollo/client';

// ============================================
// Fragments
// ============================================

export const CHAT_AUTHOR_FRAGMENT = gql`
  fragment ChatAuthorFields on User {
    id
    email
    firstName
    lastName
  }
`;

export const CHAT_MESSAGE_FRAGMENT = gql`
  fragment ChatMessageFields on TeamChatMessage {
    id
    content
    author {
      ...ChatAuthorFields
    }
    parentId
    mentions
    type
    createdAt
    expiresAt
  }
  ${CHAT_AUTHOR_FRAGMENT}
`;

// ============================================
// Chat Subscriptions
// ============================================

export const TEAM_CHAT_MESSAGE_RECEIVED = gql`
  subscription TeamChatMessageReceived {
    teamChatMessageReceived {
      ...ChatMessageFields
    }
  }
  ${CHAT_MESSAGE_FRAGMENT}
`;

export const TEAM_CHAT_MESSAGE_DELETED = gql`
  subscription TeamChatMessageDeleted {
    teamChatMessageDeleted
  }
`;

export const TEAM_CHAT_TYPING_UPDATED = gql`
  subscription TeamChatTypingUpdated {
    teamChatTypingUpdated {
      userId
      userName
    }
  }
`;
