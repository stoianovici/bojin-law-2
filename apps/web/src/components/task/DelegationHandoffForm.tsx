'use client';

/**
 * Delegation Handoff Form Component
 * Story 4.5: Team Workload Management
 *
 * AC: 4 - Delegation preserves context with automatic handoff notes
 */

import { useState } from 'react';
import {
  FileText,
  Sparkles,
  Link2,
  ClipboardList,
  Loader2,
  Check,
  X,
  Eye,
} from 'lucide-react';
import type { GenerateHandoffInput, GenerateHandoffResponse } from '@legal-platform/types';

interface DelegationHandoffFormProps {
  delegationId: string;
  sourceTaskId: string;
  onGenerateAI: (input: GenerateHandoffInput) => Promise<GenerateHandoffResponse>;
  onSave: (data: {
    handoffNotes: string;
    contextSummary?: string;
    relatedTaskIds: string[];
    relatedDocIds: string[];
  }) => Promise<void>;
  onCancel: () => void;
  availableTasks?: Array<{ id: string; title: string }>;
  availableDocs?: Array<{ id: string; name: string }>;
  isLoading?: boolean;
}

export function DelegationHandoffForm({
  delegationId,
  sourceTaskId,
  onGenerateAI,
  onSave,
  onCancel,
  availableTasks = [],
  availableDocs = [],
  isLoading = false,
}: DelegationHandoffFormProps) {
  const [notes, setNotes] = useState('');
  const [contextSummary, setContextSummary] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [selectedDocs, setSelectedDocs] = useState<string[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [includeCaseContext, setIncludeCaseContext] = useState(true);
  const [includeRecentActivity, setIncludeRecentActivity] = useState(true);

  const handleGenerateAI = async () => {
    setIsGenerating(true);
    try {
      const response = await onGenerateAI({
        delegationId,
        sourceTaskId,
        delegatorNotes: notes || undefined,
        includeCaseContext,
        includeRecentActivity,
      });

      setNotes(response.handoffNotes);
      setContextSummary(response.contextSummary);
      if (response.suggestedDocs.length > 0) {
        setSelectedDocs(response.suggestedDocs);
      }
      if (response.suggestedTasks.length > 0) {
        setSelectedTasks(response.suggestedTasks);
      }
    } catch (error) {
      console.error('Failed to generate AI handoff:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    await onSave({
      handoffNotes: notes,
      contextSummary: contextSummary || undefined,
      relatedTaskIds: selectedTasks,
      relatedDocIds: selectedDocs,
    });
  };

  const toggleTask = (taskId: string) => {
    setSelectedTasks((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
  };

  const toggleDoc = (docId: string) => {
    setSelectedDocs((prev) =>
      prev.includes(docId) ? prev.filter((id) => id !== docId) : [...prev, docId]
    );
  };

  return (
    <div className="bg-white rounded-lg shadow-lg max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col">
      {/* Header */}
      <div className="px-6 py-4 border-b flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-semibold text-gray-900">Delegation Handoff</h2>
        </div>
        <button
          onClick={onCancel}
          className="p-1 hover:bg-gray-100 rounded"
          aria-label="Close"
        >
          <X className="h-5 w-5 text-gray-400" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* AI Generation Options */}
        <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-blue-900">AI-Generated Handoff</h3>
              <p className="text-sm text-blue-700 mt-1">
                Let AI create comprehensive handoff notes based on task context
              </p>

              <div className="mt-3 space-y-2">
                <label className="flex items-center gap-2 text-sm text-blue-800">
                  <input
                    type="checkbox"
                    checked={includeCaseContext}
                    onChange={(e) => setIncludeCaseContext(e.target.checked)}
                    className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                  />
                  Include case context
                </label>
                <label className="flex items-center gap-2 text-sm text-blue-800">
                  <input
                    type="checkbox"
                    checked={includeRecentActivity}
                    onChange={(e) => setIncludeRecentActivity(e.target.checked)}
                    className="rounded border-blue-300 text-blue-600 focus:ring-blue-500"
                  />
                  Include recent activity
                </label>
              </div>

              <button
                onClick={handleGenerateAI}
                disabled={isGenerating}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Generate AI Summary
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Manual Notes */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Handoff Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Describe important context, current status, and next steps..."
            rows={6}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Context Summary (if AI generated) */}
        {contextSummary && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              AI Context Summary
            </label>
            <div className="p-3 bg-gray-50 rounded-md border text-sm text-gray-700">
              {contextSummary}
            </div>
          </div>
        )}

        {/* Related Tasks */}
        {availableTasks.length > 0 && (
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <ClipboardList className="h-4 w-4" />
              Related Tasks
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
              {availableTasks.map((task) => (
                <label
                  key={task.id}
                  className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedTasks.includes(task.id)}
                    onChange={() => toggleTask(task.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{task.title}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Related Documents */}
        {availableDocs.length > 0 && (
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
              <Link2 className="h-4 w-4" />
              Related Documents
            </label>
            <div className="space-y-2 max-h-40 overflow-y-auto border rounded-md p-2">
              {availableDocs.map((doc) => (
                <label
                  key={doc.id}
                  className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer"
                >
                  <input
                    type="checkbox"
                    checked={selectedDocs.includes(doc.id)}
                    onChange={() => toggleDoc(doc.id)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{doc.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-6 py-4 border-t bg-gray-50 flex items-center justify-between">
        <button
          onClick={() => setShowPreview(!showPreview)}
          className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-800"
        >
          <Eye className="h-4 w-4" />
          {showPreview ? 'Hide Preview' : 'Preview'}
        </button>

        <div className="flex items-center gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!notes.trim() || isLoading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Check className="h-4 w-4" />
                Save Handoff
              </>
            )}
          </button>
        </div>
      </div>

      {/* Preview Modal */}
      {showPreview && (
        <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-lg max-w-lg w-full max-h-[60vh] overflow-auto p-6">
            <h3 className="text-lg font-semibold mb-4">Handoff Preview</h3>

            <div className="space-y-4">
              <div>
                <h4 className="text-sm font-medium text-gray-500">Handoff Notes</h4>
                <p className="mt-1 text-sm text-gray-700 whitespace-pre-wrap">
                  {notes || '(No notes added)'}
                </p>
              </div>

              {contextSummary && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500">AI Context Summary</h4>
                  <p className="mt-1 text-sm text-gray-700">{contextSummary}</p>
                </div>
              )}

              {selectedTasks.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500">
                    Related Tasks ({selectedTasks.length})
                  </h4>
                </div>
              )}

              {selectedDocs.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium text-gray-500">
                    Related Documents ({selectedDocs.length})
                  </h4>
                </div>
              )}
            </div>

            <button
              onClick={() => setShowPreview(false)}
              className="mt-6 w-full py-2 bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              Close Preview
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
