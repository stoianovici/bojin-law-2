/**
 * AI Assistant Test Utilities
 * OPS-079: Integration Tests
 *
 * Helper functions and factories for testing AI assistant functionality.
 */

import type {
  AssistantContext,
  UserContext,
  AIMessage,
  ProposedAction,
} from '../services/ai-orchestrator.service';
import { AssistantIntent } from '../services/ai-orchestrator.service';

// ============================================================================
// Types
// ============================================================================

export interface MockAIResponse {
  intent: AssistantIntent;
  confidence: number;
  params: Record<string, unknown>;
  reasoning?: string;
}

export interface MockConversation {
  id: string;
  firmId: string;
  userId: string;
  caseId: string | null;
  status: 'Active' | 'Completed' | 'AwaitingConfirmation' | 'Expired';
  context: Record<string, unknown>;
  messages: AIMessage[];
  createdAt: Date;
  updatedAt: Date;
  closedAt: Date | null;
}

export interface MockTask {
  id: string;
  title: string;
  description?: string;
  caseId?: string;
  firmId: string;
  assignedTo: string;
  dueDate?: Date;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  status: 'Pending' | 'InProgress' | 'Completed' | 'Cancelled';
  createdAt: Date;
  updatedAt: Date;
}

export interface MockEmail {
  id: string;
  graphMessageId: string;
  userId: string;
  subject: string;
  bodyPreview: string;
  from: { name: string; address: string };
  toRecipients: Array<{ name: string; address: string }>;
  receivedDateTime: Date;
  hasAttachments: boolean;
  isRead: boolean;
  importance: string;
  caseId?: string;
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a mock user context for testing.
 */
export function createMockUserContext(overrides: Partial<UserContext> = {}): UserContext {
  return {
    userId: `user-${Date.now()}`,
    firmId: `firm-${Date.now()}`,
    role: 'Associate',
    email: 'test@lawfirm.com',
    ...overrides,
  };
}

/**
 * Create a mock assistant context for testing.
 */
export function createMockAssistantContext(
  overrides: Partial<AssistantContext> = {}
): AssistantContext {
  return {
    currentScreen: '/dashboard',
    currentCaseId: undefined,
    currentDocumentId: undefined,
    selectedEmailId: undefined,
    selectedText: undefined,
    ...overrides,
  };
}

/**
 * Create a mock AI message for testing.
 */
export function createMockAIMessage(overrides: Partial<AIMessage> = {}): AIMessage {
  return {
    role: 'User',
    content: 'Test message',
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock conversation for testing.
 */
export function createMockConversation(
  overrides: Partial<MockConversation> = {}
): MockConversation {
  const id = `conv-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return {
    id,
    firmId: 'firm-test',
    userId: 'user-test',
    caseId: null,
    status: 'Active',
    context: {},
    messages: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    closedAt: null,
    ...overrides,
  };
}

/**
 * Create a mock task for testing.
 */
export function createMockTask(overrides: Partial<MockTask> = {}): MockTask {
  const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return {
    id,
    title: 'Test Task',
    firmId: 'firm-test',
    assignedTo: 'user-test',
    priority: 'Medium',
    status: 'Pending',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/**
 * Create a mock email for testing.
 */
export function createMockEmail(overrides: Partial<MockEmail> = {}): MockEmail {
  const id = `email-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  return {
    id,
    graphMessageId: `graph-${id}`,
    userId: 'user-test',
    subject: 'Test Email Subject',
    bodyPreview: 'This is a test email body preview...',
    from: { name: 'Sender Name', address: 'sender@example.com' },
    toRecipients: [{ name: 'Recipient', address: 'recipient@firm.com' }],
    receivedDateTime: new Date(),
    hasAttachments: false,
    isRead: false,
    importance: 'normal',
    ...overrides,
  };
}

/**
 * Create a mock proposed action for testing.
 */
export function createMockProposedAction(overrides: Partial<ProposedAction> = {}): ProposedAction {
  return {
    type: 'CREATE_TASK',
    displayText: 'Create a new task',
    payload: { title: 'Test Task' },
    requiresConfirmation: true,
    confirmationPrompt: 'Do you want to create this task?',
    entityPreview: { title: 'Test Task' },
    ...overrides,
  };
}

// ============================================================================
// AI Response Generators
// ============================================================================

/**
 * Generate a mock AI response for intent detection.
 */
export function createMockIntentResponse(
  intent: AssistantIntent,
  confidence: number = 0.9,
  params: Record<string, unknown> = {}
): string {
  const response: MockAIResponse = {
    intent,
    confidence,
    params,
    reasoning: `Detected ${intent} with ${confidence} confidence`,
  };
  return JSON.stringify(response);
}

/**
 * Generate a high-confidence task creation response.
 */
export function createTaskCreationResponse(title: string, dueDate?: string): string {
  return createMockIntentResponse(AssistantIntent.CreateTask, 0.95, {
    taskTitle: title,
    dueDate,
    priority: 'Medium',
  });
}

/**
 * Generate a case query response.
 */
export function createCaseQueryResponse(caseId: string): string {
  return createMockIntentResponse(AssistantIntent.CaseQuery, 0.9, { caseId });
}

/**
 * Generate an email search response.
 */
export function createEmailSearchResponse(query: string): string {
  return createMockIntentResponse(AssistantIntent.SearchEmails, 0.85, { searchQuery: query });
}

/**
 * Generate a low-confidence response requiring clarification.
 */
export function createLowConfidenceResponse(): string {
  return createMockIntentResponse(AssistantIntent.GeneralChat, 0.3, {});
}

/**
 * Generate an invalid JSON response to test error handling.
 */
export function createInvalidJsonResponse(): string {
  return 'This is not valid JSON and should trigger error handling';
}

// ============================================================================
// Conversation History Builders
// ============================================================================

/**
 * Build a conversation history with alternating user/assistant messages.
 */
export function buildConversationHistory(
  exchanges: Array<{ user: string; assistant: string }>
): AIMessage[] {
  const history: AIMessage[] = [];
  const baseTime = new Date();

  exchanges.forEach((exchange, index) => {
    history.push({
      role: 'User',
      content: exchange.user,
      createdAt: new Date(baseTime.getTime() + index * 2 * 60000), // 2 min apart
    });
    history.push({
      role: 'Assistant',
      content: exchange.assistant,
      createdAt: new Date(baseTime.getTime() + (index * 2 + 1) * 60000),
    });
  });

  return history;
}

/**
 * Build a conversation history about a specific case.
 */
export function buildCaseConversationHistory(caseTitle: string): AIMessage[] {
  return buildConversationHistory([
    {
      user: `Arată-mi dosarul ${caseTitle}`,
      assistant: `Iată informațiile despre dosarul ${caseTitle}. E un dosar de litigii civile deschis în 2024.`,
    },
  ]);
}

/**
 * Build a conversation history about tasks.
 */
export function buildTaskConversationHistory(): AIMessage[] {
  return buildConversationHistory([
    {
      user: 'Ce sarcini am pentru astăzi?',
      assistant:
        'Aveți 3 sarcini pentru astăzi: 1. Pregătire documente, 2. Apel client, 3. Revizuire contract.',
    },
  ]);
}

// ============================================================================
// Assertion Helpers
// ============================================================================

/**
 * Assert that a result has a valid proposed action.
 */
export function expectValidProposedAction(
  result: { proposedAction?: ProposedAction },
  expectedType: string
): void {
  expect(result.proposedAction).toBeDefined();
  expect(result.proposedAction?.type).toBe(expectedType);
  expect(result.proposedAction?.displayText).toBeDefined();
  expect(result.proposedAction?.payload).toBeDefined();
}

/**
 * Assert that a result requires confirmation.
 */
export function expectRequiresConfirmation(result: { proposedAction?: ProposedAction }): void {
  expect(result.proposedAction?.requiresConfirmation).toBe(true);
  expect(result.proposedAction?.confirmationPrompt).toBeDefined();
}

/**
 * Assert that an error response is user-friendly (in Romanian).
 */
export function expectRomanianErrorMessage(response: string): void {
  // Romanian error messages typically contain these patterns
  const romanianPatterns = [
    'Nu am',
    'nu am',
    'Încercați',
    'încercați',
    'eroare',
    'Eroare',
    'verificați',
    'Verificați',
    'Specificați',
    'specificați',
    'doriți',
    'Doriți',
  ];

  const hasRomanianPattern = romanianPatterns.some((pattern) => response.includes(pattern));
  expect(hasRomanianPattern).toBe(true);
}

// ============================================================================
// Mock Setup Helpers
// ============================================================================

/**
 * Setup standard database mocks for assistant tests.
 */
export function setupDatabaseMocks(
  prisma: any,
  options: {
    conversations?: MockConversation[];
    tasks?: MockTask[];
    emails?: MockEmail[];
  } = {}
): void {
  // Conversation mocks
  prisma.aIConversation.findFirst.mockImplementation(async (query: any) => {
    const conversations = options.conversations || [];
    return (
      conversations.find(
        (c) =>
          (!query.where?.id || c.id === query.where.id) &&
          (!query.where?.firmId || c.firmId === query.where.firmId)
      ) || null
    );
  });

  prisma.aIConversation.create.mockImplementation(async (data: any) => ({
    ...createMockConversation(),
    ...data.data,
  }));

  prisma.aIConversation.update.mockImplementation(async (data: any) => ({
    ...(options.conversations?.find((c) => c.id === data.where?.id) || createMockConversation()),
    ...data.data,
  }));

  // Task mocks
  prisma.task.findMany.mockResolvedValue(options.tasks || []);
  prisma.task.create.mockImplementation(async (data: any) => ({
    ...createMockTask(),
    ...data.data,
  }));

  // Email mocks
  prisma.email.findMany.mockResolvedValue(options.emails || []);
  prisma.email.findUnique.mockImplementation(async (query: any) => {
    const emails = options.emails || [];
    return emails.find((e) => e.id === query.where?.id) || null;
  });
}

/**
 * Setup AI service mock with predictable responses.
 */
export function setupAIServiceMock(mockGenerate: jest.Mock, responses: string[]): void {
  let callIndex = 0;
  mockGenerate.mockImplementation(() => {
    const response = responses[callIndex] || responses[responses.length - 1];
    callIndex++;
    return Promise.resolve({ content: response });
  });
}

/**
 * Reset all standard mocks between tests.
 */
export function resetAllMocks(mocks: { [key: string]: jest.Mock }): void {
  Object.values(mocks).forEach((mock) => mock.mockReset());
}

// ============================================================================
// Time Helpers
// ============================================================================

/**
 * Get date for "tomorrow".
 */
export function getTomorrow(): Date {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(9, 0, 0, 0);
  return tomorrow;
}

/**
 * Get date for "next week".
 */
export function getNextWeek(): Date {
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  nextWeek.setHours(9, 0, 0, 0);
  return nextWeek;
}

/**
 * Get date for "yesterday" (for overdue tests).
 */
export function getYesterday(): Date {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  yesterday.setHours(17, 0, 0, 0);
  return yesterday;
}

// ============================================================================
// Romanian Locale Helpers
// ============================================================================

/**
 * Common Romanian task-related phrases for testing.
 */
export const ROMANIAN_PHRASES = {
  createTask: ['Creează o sarcină', 'Adaugă un task', 'Fă-mi un reminder', 'Trebuie să fac'],
  queryTasks: ['Ce sarcini am', 'Arată-mi sarcinile', 'Ce am de făcut', 'Taskurile mele'],
  caseQuery: ['Arată-mi dosarul', 'Statusul dosarului', 'Ce se întâmplă cu', 'Informații despre'],
  emailSearch: ['Caută email', 'Găsește mesaj', 'Email de la', 'Mailuri despre'],
  briefing: ['Ce am pe azi', 'Briefing zilnic', 'Rezumatul dimineții', 'Ce trebuie să fac'],
  greetings: ['Bună ziua', 'Salut', 'Bună', 'Bună dimineața'],
};

/**
 * Generate a random Romanian phrase for a given intent type.
 */
export function getRandomPhrase(type: keyof typeof ROMANIAN_PHRASES): string {
  const phrases = ROMANIAN_PHRASES[type];
  return phrases[Math.floor(Math.random() * phrases.length)];
}
