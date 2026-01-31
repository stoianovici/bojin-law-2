/**
 * Case Comprehension Types
 * Agent-generated case understanding for Word Add-in
 */

export type AgentRunStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED';

export interface DataMapEntry {
  id: string;
  type: 'document' | 'email_thread' | 'task';
  title: string;
  topics: string[];
  tokenEstimate: number;
  excerpt?: string;
  fileType?: string;
  pageCount?: number;
  messageCount?: number;
  participants?: string[];
  lastMessageDate?: string;
  status?: string;
  dueDate?: string;
}

export interface DataMap {
  sources: DataMapEntry[];
}

export interface CaseComprehension {
  id: string;
  caseId: string;
  firmId: string;
  currentPicture: string;
  dataMap: DataMap;
  contentCritical: string;
  contentStandard: string;
  tokensFull: number;
  tokensCritical: number;
  tokensStandard: number;
  version: number;
  generatedAt: string;
  generatedBy?: string;
  validUntil: string;
  isStale: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ComprehensionCorrection {
  id: string;
  comprehensionId: string;
  anchorText: string;
  anchorHash: string;
  correctionType: 'OVERRIDE' | 'APPEND' | 'REMOVE' | 'NOTE';
  correctedValue: string;
  reason?: string;
  createdBy: string;
  isActive: boolean;
  appliedAt?: string;
  createdAt: string;
}

export interface ComprehensionAgentRun {
  id: string;
  comprehensionId?: string;
  caseId: string;
  firmId: string;
  trigger: string;
  triggerEvent?: string;
  status: AgentRunStatus;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  toolCalls: Array<{ tool: string; args: unknown; result?: unknown }>;
  tokensUsed?: number;
  modelId?: string;
  error?: string;
  retryCount: number;
  createdAt: string;
}

export type ComprehensionTier = 'full' | 'standard' | 'critical';
