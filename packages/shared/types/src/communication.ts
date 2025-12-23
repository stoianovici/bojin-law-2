// Communication Hub Types
// These types define the data models for the communication hub feature

import type { CaseType } from './entities';

export interface CommunicationThread {
  id: string; // UUID
  conversationId?: string; // MS Graph conversation ID for email threads
  subject: string;
  caseId: string; // UUID
  caseName: string;
  caseType: CaseType; // From entities.ts
  participants: CommunicationParticipant[];
  messages: CommunicationMessage[];
  hasAttachments: boolean;
  isUnread: boolean;
  lastMessageDate: Date;
  extractedItems: ExtractedItems;
  isProcessed?: boolean; // User marked as processed
  processedAt?: Date; // When marked as processed
  createdAt: Date;
  updatedAt: Date;
}

export interface CommunicationMessage {
  id: string; // UUID
  threadId: string; // UUID
  senderId: string; // UUID (User ID)
  senderName: string;
  senderEmail: string;
  recipientIds: string[]; // UUID[] (User IDs)
  subject: string;
  body: string; // Plain text
  htmlBody?: string; // HTML formatted
  bodyClean?: string; // OPS-090: AI-cleaned content (no signatures, quotes)
  sentDate: Date;
  attachments: Attachment[];
  isFromUser: boolean; // Is current user the sender
  isRead: boolean;
  folderType?: 'inbox' | 'sent' | null; // OPS-126: Source folder (authoritative direction)
}

export interface CommunicationParticipant {
  userId: string; // UUID
  name: string;
  email: string;
  role: 'sender' | 'recipient' | 'cc' | 'bcc';
}

export interface Attachment {
  id: string; // UUID
  filename: string;
  fileSize: number; // bytes
  mimeType: string;
  downloadUrl: string; // Mock URL for prototype
}

export interface ExtractedItems {
  deadlines: ExtractedDeadline[];
  commitments: ExtractedCommitment[];
  actionItems: ExtractedActionItem[];
}

export interface ExtractedDeadline {
  id: string;
  description: string;
  dueDate: Date;
  sourceMessageId: string; // Link to message where extracted
  confidence: 'Low' | 'Medium' | 'High';
  convertedToTaskId?: string; // UUID of created task
  isDismissed?: boolean; // User dismissed this item
  dismissedAt?: Date; // When dismissed (for AI learning)
  dismissReason?: string; // Optional user feedback
}

export interface ExtractedCommitment {
  id: string;
  party: string; // Who made the commitment
  commitmentText: string;
  date: Date;
  sourceMessageId: string;
  confidence: 'Low' | 'Medium' | 'High';
  convertedToTaskId?: string; // UUID of created task
  isDismissed?: boolean; // User dismissed this item
  dismissedAt?: Date; // When dismissed (for AI learning)
  dismissReason?: string; // Optional user feedback
}

export interface ExtractedActionItem {
  id: string;
  description: string;
  suggestedAssignee?: string;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  sourceMessageId: string;
  confidence: 'Low' | 'Medium' | 'High';
  convertedToTaskId?: string; // UUID of created task
  isDismissed?: boolean; // User dismissed this item
  dismissedAt?: Date; // When dismissed (for AI learning)
  dismissReason?: string; // Optional user feedback
}

export interface AIDraftResponse {
  id: string;
  threadId: string;
  tone: 'formal' | 'professional' | 'brief' | 'detailed'; // Added 'detailed' for Story 5.3
  draftBody: string;
  htmlBody?: string; // Added for rich text support (Story 5.3)
  suggestedAttachments: string[]; // Document titles
  confidence: 'Low' | 'Medium' | 'High';
  recipientType?: 'Client' | 'OpposingCounsel' | 'Court' | 'ThirdParty' | 'Internal'; // Added for Story 5.3
  generatedAt: Date;
}

export interface CommunicationFilters {
  caseIds: string[]; // Filter by specific cases
  senderIds: string[]; // Filter by specific senders
  dateRange: { start: Date; end: Date } | null;
  hasDeadline: boolean;
  hasAttachment: boolean;
  unreadOnly: boolean;
}
