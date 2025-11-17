'use client';

import { useState } from 'react';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { useCommunicationStore } from '../../stores/communication.store';
import { format } from 'date-fns';
import { Clock, ClipboardList, CheckCircle, ChevronDown, ChevronRight, Plus, ExternalLink, X } from 'lucide-react';
import { QuickTaskCreator } from './QuickTaskCreator';
import type { Task } from '@legal-platform/types';

export function ExtractedItemsSidebar() {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['deadlines']));
  const [creatingItemId, setCreatingItemId] = useState<string | null>(null);
  const [createdTasks, setCreatedTasks] = useState<Map<string, string>>(new Map()); // extractedItemId -> taskId
  const [dismissedItems, setDismissedItems] = useState<Set<string>>(new Set()); // Set of dismissed item IDs
  const [dismissingItemId, setDismissingItemId] = useState<string | null>(null); // ID of item being dismissed
  const { getSelectedThread } = useCommunicationStore();
  const thread = getSelectedThread();

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handleCreateTask = (taskData: Partial<Task>, extractedItemId: string) => {
    // Mock task creation - generate a task ID
    const taskId = `task-${Date.now()}`;

    // Store the task (in production, this would be saved to the task management store)
    console.log('Task created:', { ...taskData, id: taskId });

    // Update the created tasks map
    const newCreatedTasks = new Map(createdTasks);
    newCreatedTasks.set(extractedItemId, taskId);
    setCreatedTasks(newCreatedTasks);

    // Close the creator
    setCreatingItemId(null);

    // Show success message (in production, this would be a toast)
    alert('Task creat cu succes!');
  };

  const handleDismiss = (extractedItemId: string, reason?: string) => {
    // Log dismissal for AI learning (prototype - would be sent to AI training pipeline in Epic 5)
    console.log('Item dismissed:', {
      extractedItemId,
      reason,
      dismissedAt: new Date(),
    });

    // Add to dismissed items
    const newDismissed = new Set(dismissedItems);
    newDismissed.add(extractedItemId);
    setDismissedItems(newDismissed);

    // Close dismiss modal
    setDismissingItemId(null);
  };

  const showDismissPrompt = (extractedItemId: string) => {
    const reason = prompt(
      'De ce respingi acest element?\n\n1. Nu este relevant\n2. Deja gestionat\n3. Informație incorectă\n4. Altul\n\nIntroduceți numărul opțiunii sau textul:'
    );

    if (reason !== null) {
      // Map numeric choices to text
      const reasonMap: Record<string, string> = {
        '1': 'Nu este relevant',
        '2': 'Deja gestionat',
        '3': 'Informație incorectă',
        '4': 'Altul',
      };

      const dismissReason = reasonMap[reason] || reason;
      handleDismiss(extractedItemId, dismissReason);
    }
  };

  if (!thread) {
    return (
      <div className="p-4 text-sm text-gray-500">
        Selectați o conversație pentru a vedea elementele extrase
      </div>
    );
  }

  const { extractedItems } = thread;

  return (
    <div className="p-4 space-y-4">
      <h2 className="font-semibold">Elemente extrase</h2>

      {/* Deadlines */}
      <div className="border rounded">
        <button
          onClick={() => toggleSection('deadlines')}
          className="w-full p-3 text-left text-sm font-semibold flex items-center justify-between hover:bg-gray-50"
        >
          <span className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-orange-500" />
            Termene ({extractedItems.deadlines.length})
          </span>
          {expandedSections.has('deadlines') ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
        </button>
        {expandedSections.has('deadlines') && (
          <div className="p-3 border-t space-y-2">
            {extractedItems.deadlines.length === 0 ? (
              <p className="text-sm text-gray-500">Nu s-au detectat termene</p>
            ) : (
              extractedItems.deadlines.filter(d => !dismissedItems.has(d.id)).map(deadline => {
                const isCreating = creatingItemId === deadline.id;
                const taskId = createdTasks.get(deadline.id);
                const isConverted = !!taskId;

                if (isCreating) {
                  return (
                    <QuickTaskCreator
                      key={deadline.id}
                      extractedItemType="deadline"
                      extractedItemId={deadline.id}
                      threadId={thread.id}
                      messageId={deadline.sourceMessageId}
                      caseId={thread.caseId}
                      prefillTitle={deadline.description}
                      prefillDescription={`Termen extras din email: ${deadline.description}`}
                      prefillDueDate={deadline.dueDate}
                      prefillPriority="High"
                      onSave={(taskData) => handleCreateTask(taskData, deadline.id)}
                      onCancel={() => setCreatingItemId(null)}
                    />
                  );
                }

                return (
                  <div key={deadline.id} className={`p-2 rounded text-sm ${isConverted ? 'bg-green-50 border border-green-200' : 'bg-yellow-50'} relative group`}>
                    <button
                      onClick={() => showDismissPrompt(deadline.id)}
                      className="absolute top-1 right-1 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Respinge"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <div className="flex items-start justify-between gap-2 pr-6">
                      <div className="flex-1">
                        <div className="font-semibold">{deadline.description}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          {format(deadline.dueDate, 'dd.MM.yyyy')}
                        </div>
                      </div>
                      {isConverted ? (
                        <div className="flex items-center gap-1 text-xs">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <a
                            href={`/tasks?id=${taskId}`}
                            className="text-green-600 hover:underline flex items-center gap-1"
                          >
                            Task creat
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      ) : (
                        <button
                          onClick={() => setCreatingItemId(deadline.id)}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                          Creează Task
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Commitments */}
      <div className="border rounded">
        <button
          onClick={() => toggleSection('commitments')}
          className="w-full p-3 text-left text-sm font-semibold flex items-center justify-between hover:bg-gray-50"
        >
          <span className="flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-blue-500" />
            Angajamente ({extractedItems.commitments.length})
          </span>
          {expandedSections.has('commitments') ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
        </button>
        {expandedSections.has('commitments') && (
          <div className="p-3 border-t space-y-2">
            {extractedItems.commitments.length === 0 ? (
              <p className="text-sm text-gray-500">Nu s-au detectat angajamente</p>
            ) : (
              extractedItems.commitments.filter(c => !dismissedItems.has(c.id)).map(commitment => {
                const isCreating = creatingItemId === commitment.id;
                const taskId = createdTasks.get(commitment.id);
                const isConverted = !!taskId;

                if (isCreating) {
                  return (
                    <QuickTaskCreator
                      key={commitment.id}
                      extractedItemType="commitment"
                      extractedItemId={commitment.id}
                      threadId={thread.id}
                      messageId={commitment.sourceMessageId}
                      caseId={thread.caseId}
                      prefillTitle={`Angajament: ${commitment.party}`}
                      prefillDescription={commitment.commitmentText}
                      prefillDueDate={commitment.date}
                      prefillPriority="Medium"
                      onSave={(taskData) => handleCreateTask(taskData, commitment.id)}
                      onCancel={() => setCreatingItemId(null)}
                    />
                  );
                }

                return (
                  <div key={commitment.id} className={`p-2 rounded text-sm ${isConverted ? 'bg-green-50 border border-green-200' : 'bg-blue-50'} relative group`}>
                    <button
                      onClick={() => showDismissPrompt(commitment.id)}
                      className="absolute top-1 right-1 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Respinge"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <div className="flex items-start justify-between gap-2 pr-6">
                      <div className="flex-1">
                        <div className="font-semibold">{commitment.party}</div>
                        <div className="text-xs mt-1">{commitment.commitmentText}</div>
                      </div>
                      {isConverted ? (
                        <div className="flex items-center gap-1 text-xs">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <a
                            href={`/tasks?id=${taskId}`}
                            className="text-green-600 hover:underline flex items-center gap-1"
                          >
                            Task creat
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      ) : (
                        <button
                          onClick={() => setCreatingItemId(commitment.id)}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                          Creează Task
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Action Items */}
      <div className="border rounded">
        <button
          onClick={() => toggleSection('actions')}
          className="w-full p-3 text-left text-sm font-semibold flex items-center justify-between hover:bg-gray-50"
        >
          <span className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Acțiuni ({extractedItems.actionItems.length})
          </span>
          {expandedSections.has('actions') ? (
            <ChevronDown className="h-4 w-4 text-gray-500" />
          ) : (
            <ChevronRight className="h-4 w-4 text-gray-500" />
          )}
        </button>
        {expandedSections.has('actions') && (
          <div className="p-3 border-t space-y-2">
            {extractedItems.actionItems.length === 0 ? (
              <p className="text-sm text-gray-500">Nu s-au detectat acțiuni</p>
            ) : (
              extractedItems.actionItems.filter(a => !dismissedItems.has(a.id)).map(action => {
                const isCreating = creatingItemId === action.id;
                const taskId = createdTasks.get(action.id);
                const isConverted = !!taskId;

                if (isCreating) {
                  return (
                    <QuickTaskCreator
                      key={action.id}
                      extractedItemType="actionItem"
                      extractedItemId={action.id}
                      threadId={thread.id}
                      messageId={action.sourceMessageId}
                      caseId={thread.caseId}
                      prefillTitle={action.description}
                      prefillDescription={`Acțiune extrasă din email: ${action.description}`}
                      prefillPriority={action.priority}
                      prefillAssignedTo={action.suggestedAssignee}
                      onSave={(taskData) => handleCreateTask(taskData, action.id)}
                      onCancel={() => setCreatingItemId(null)}
                    />
                  );
                }

                return (
                  <div key={action.id} className={`p-2 rounded text-sm ${isConverted ? 'bg-green-50 border border-green-200' : 'bg-green-50'} relative group`}>
                    <button
                      onClick={() => showDismissPrompt(action.id)}
                      className="absolute top-1 right-1 p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      title="Respinge"
                    >
                      <X className="h-3 w-3" />
                    </button>
                    <div className="flex items-start justify-between gap-2 pr-6">
                      <div className="flex-1">
                        <div className="font-semibold">{action.description}</div>
                        <div className="text-xs text-gray-600 mt-1">
                          Prioritate: {action.priority}
                        </div>
                      </div>
                      {isConverted ? (
                        <div className="flex items-center gap-1 text-xs">
                          <CheckCircle className="h-4 w-4 text-green-600" />
                          <a
                            href={`/tasks?id=${taskId}`}
                            className="text-green-600 hover:underline flex items-center gap-1"
                          >
                            Task creat
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      ) : (
                        <button
                          onClick={() => setCreatingItemId(action.id)}
                          className="flex items-center gap-1 px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                          Creează Task
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}
