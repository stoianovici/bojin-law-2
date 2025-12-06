'use client';

import * as React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ResearchTaskForm } from './forms/ResearchTaskForm';
import { DocumentCreationTaskForm } from './forms/DocumentCreationTaskForm';
import { DocumentRetrievalTaskForm } from './forms/DocumentRetrievalTaskForm';
import { CourtDateTaskForm } from './forms/CourtDateTaskForm';
import { MeetingTaskForm } from './forms/MeetingTaskForm';
import { BusinessTripTaskForm } from './forms/BusinessTripTaskForm';
import type {
  TaskType,
  TaskPriority,
  TaskTypeMetadata,
  ResearchTaskMetadata,
  DocumentCreationTaskMetadata,
  DocumentRetrievalTaskMetadata,
  CourtDateTaskMetadata,
  MeetingTaskMetadata,
  BusinessTripTaskMetadata,
} from '@legal-platform/types';
import {
  Search,
  FileText,
  Download,
  Gavel,
  Users,
  Plane,
} from 'lucide-react';
import { TimeEstimationDisplay } from '../time/TimeEstimationDisplay';
import { useEstimateTaskTime } from '@/hooks/useTimeEstimation';
import type { TimeEstimation } from '@/hooks/useTimeEstimation';
import { DeadlineSuggestion } from '@/components/personalization/DeadlineSuggestion';

export interface TaskCreateModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  caseType?: string; // Used for deadline suggestions
  initialData?: {
    type?: TaskType;
    title?: string;
    description?: string;
    dueDate?: string;
    priority?: TaskPriority;
    typeMetadata?: TaskTypeMetadata;
  };
  onSubmit: (data: TaskCreateFormData) => Promise<void>;
}

export interface TaskCreateFormData {
  caseId: string;
  type: TaskType;
  title: string;
  description: string;
  assignedTo: string;
  dueDate: string;
  dueTime?: string;
  priority: TaskPriority;
  estimatedHours?: number;
  typeMetadata?: TaskTypeMetadata;
}

const TASK_TYPES: Array<{
  value: TaskType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}> = [
  {
    value: 'Research',
    label: 'Research',
    icon: Search,
    description: 'Legal research and case law',
  },
  {
    value: 'DocumentCreation',
    label: 'Document Creation',
    icon: FileText,
    description: 'Draft contracts, motions, letters',
  },
  {
    value: 'DocumentRetrieval',
    label: 'Document Retrieval',
    icon: Download,
    description: 'Obtain documents from external sources',
  },
  {
    value: 'CourtDate',
    label: 'Court Date',
    icon: Gavel,
    description: 'Court hearings and appearances',
  },
  {
    value: 'Meeting',
    label: 'Meeting',
    icon: Users,
    description: 'Client or internal meetings',
  },
  {
    value: 'BusinessTrip',
    label: 'Business Trip',
    icon: Plane,
    description: 'Travel for business purposes',
  },
];

const PRIORITIES: TaskPriority[] = ['Low', 'Medium', 'High', 'Urgent'];

export function TaskCreateModal({
  open,
  onOpenChange,
  caseId,
  caseType,
  initialData,
  onSubmit,
}: TaskCreateModalProps) {
  const [selectedType, setSelectedType] = React.useState<TaskType | null>(
    initialData?.type || null
  );
  const [formData, setFormData] = React.useState<Partial<TaskCreateFormData>>({
    caseId,
    title: initialData?.title || '',
    description: initialData?.description || '',
    dueDate: initialData?.dueDate || '',
    priority: initialData?.priority || 'Medium',
  });
  const [typeMetadata, setTypeMetadata] = React.useState<any>({});
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [estimation, setEstimation] = React.useState<TimeEstimation | null>(null);
  const [estimateTaskTime, { loading: isEstimating }] = useEstimateTaskTime();

  // Pre-fill type metadata from initialData
  React.useEffect(() => {
    if (initialData?.typeMetadata) {
      setTypeMetadata(initialData.typeMetadata.data);
      setSelectedType(initialData.typeMetadata.type);
    }
    if (initialData?.estimatedHours) {
      setFormData((prev) => ({ ...prev, estimatedHours: initialData.estimatedHours }));
    }
  }, [initialData]);

  // Auto-fetch AI time estimation when task type and title are entered
  React.useEffect(() => {
    const fetchEstimation = async () => {
      if (!selectedType || !formData.title || formData.title.length < 5) {
        setEstimation(null);
        return;
      }

      try {
        const { data } = await estimateTaskTime({
          variables: {
            input: {
              taskType: selectedType,
              taskTitle: formData.title,
              taskDescription: formData.description,
            },
          },
        });

        if (data?.estimateTaskTime) {
          setEstimation(data.estimateTaskTime);
          // Auto-fill estimatedHours if not manually set
          if (!formData.estimatedHours) {
            setFormData((prev) => ({
              ...prev,
              estimatedHours: data.estimateTaskTime.estimatedHours,
            }));
          }
        }
      } catch (error) {
        console.error('Failed to estimate task time:', error);
        setEstimation(null);
      }
    };

    // Debounce estimation fetch
    const timeoutId = setTimeout(fetchEstimation, 800);
    return () => clearTimeout(timeoutId);
  }, [selectedType, formData.title, formData.description, estimateTaskTime]);

  const handleEstimationOverride = (newEstimate: number) => {
    setFormData((prev) => ({ ...prev, estimatedHours: newEstimate }));
  };

  const handleTypeSelect = (type: TaskType) => {
    setSelectedType(type);
    setTypeMetadata({});
    setErrors({});
  };

  const handleFieldChange = (field: keyof TaskCreateFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const { [field]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!selectedType) {
      newErrors.type = 'Please select a task type';
    }
    if (!formData.title?.trim()) {
      newErrors.title = 'Title is required';
    }
    if (!formData.assignedTo) {
      newErrors.assignedTo = 'Assignee is required';
    }
    if (!formData.dueDate) {
      newErrors.dueDate = 'Due date is required';
    }

    // Validate type-specific metadata
    if (selectedType === 'Research' && !typeMetadata.researchTopic) {
      newErrors.researchTopic = 'Research topic is required';
    }
    if (selectedType === 'DocumentCreation' && !typeMetadata.documentType) {
      newErrors.documentType = 'Document type is required';
    }
    if (selectedType === 'DocumentRetrieval' && !typeMetadata.documentDescription) {
      newErrors.documentDescription = 'Document description is required';
    }
    if (selectedType === 'CourtDate') {
      if (!typeMetadata.courtName) newErrors.courtName = 'Court name is required';
      if (!typeMetadata.caseNumber) newErrors.caseNumber = 'Court case number is required';
      if (!typeMetadata.hearingType) newErrors.hearingType = 'Hearing type is required';
    }
    if (selectedType === 'Meeting' && !typeMetadata.meetingType) {
      newErrors.meetingType = 'Meeting type is required';
    }
    if (selectedType === 'BusinessTrip') {
      if (!typeMetadata.destination) newErrors.destination = 'Destination is required';
      if (!typeMetadata.purpose) newErrors.purpose = 'Trip purpose is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm() || !selectedType) return;

    setIsSubmitting(true);
    try {
      const taskData: TaskCreateFormData = {
        caseId,
        type: selectedType,
        title: formData.title!,
        description: formData.description || '',
        assignedTo: formData.assignedTo!,
        dueDate: formData.dueDate!,
        dueTime: formData.dueTime,
        priority: formData.priority || 'Medium',
        estimatedHours: formData.estimatedHours,
        typeMetadata: { type: selectedType, data: typeMetadata } as TaskTypeMetadata,
      };

      await onSubmit(taskData);
      onOpenChange(false);

      // Reset form
      setFormData({ caseId, priority: 'Medium' });
      setSelectedType(null);
      setTypeMetadata({});
      setErrors({});
    } catch (error) {
      console.error('Failed to create task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const renderTypeSpecificForm = () => {
    if (!selectedType) return null;

    switch (selectedType) {
      case 'Research':
        return (
          <ResearchTaskForm
            value={typeMetadata as ResearchTaskMetadata}
            onChange={setTypeMetadata}
            errors={errors}
          />
        );
      case 'DocumentCreation':
        return (
          <DocumentCreationTaskForm
            value={typeMetadata as DocumentCreationTaskMetadata}
            onChange={setTypeMetadata}
            errors={errors}
          />
        );
      case 'DocumentRetrieval':
        return (
          <DocumentRetrievalTaskForm
            value={typeMetadata as DocumentRetrievalTaskMetadata}
            onChange={setTypeMetadata}
            errors={errors}
          />
        );
      case 'CourtDate':
        return (
          <CourtDateTaskForm
            value={typeMetadata as CourtDateTaskMetadata}
            onChange={setTypeMetadata}
            errors={errors}
          />
        );
      case 'Meeting':
        return (
          <MeetingTaskForm
            value={typeMetadata as MeetingTaskMetadata}
            onChange={setTypeMetadata}
            errors={errors}
          />
        );
      case 'BusinessTrip':
        return (
          <BusinessTripTaskForm
            value={typeMetadata as BusinessTripTaskMetadata}
            onChange={setTypeMetadata}
            errors={errors}
          />
        );
      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Task</DialogTitle>
          <DialogDescription>
            Select a task type and fill in the details below.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          {/* Task Type Selector */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Task Type <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-3 gap-3">
              {TASK_TYPES.map((taskType) => {
                const Icon = taskType.icon;
                const isSelected = selectedType === taskType.value;
                return (
                  <button
                    key={taskType.value}
                    type="button"
                    onClick={() => handleTypeSelect(taskType.value)}
                    className={`p-4 border-2 rounded-lg text-left transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/5'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Icon className={`h-6 w-6 mb-2 ${isSelected ? 'text-primary' : ''}`} />
                    <div className="text-sm font-medium">{taskType.label}</div>
                    <div className="text-xs text-gray-500 mt-1">{taskType.description}</div>
                  </button>
                );
              })}
            </div>
            {errors.type && <p className="text-sm text-red-500 mt-1">{errors.type}</p>}
          </div>

          {/* Common Fields */}
          {selectedType && (
            <>
              <div>
                <label htmlFor="title" className="block text-sm font-medium mb-1">
                  Title <span className="text-red-500">*</span>
                </label>
                <Input
                  id="title"
                  value={formData.title || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFieldChange('title', e.target.value)}
                  placeholder="Enter task title"
                  className={errors.title ? 'border-red-500' : ''}
                />
                {errors.title && <p className="text-sm text-red-500 mt-1">{errors.title}</p>}
              </div>

              <div>
                <label htmlFor="description" className="block text-sm font-medium mb-1">
                  Description
                </label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFieldChange('description', e.target.value)}
                  placeholder="Enter task description"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="assignedTo" className="block text-sm font-medium mb-1">
                    Assign To <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="assignedTo"
                    value={formData.assignedTo || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFieldChange('assignedTo', e.target.value)}
                    placeholder="User ID"
                    className={errors.assignedTo ? 'border-red-500' : ''}
                  />
                  {errors.assignedTo && (
                    <p className="text-sm text-red-500 mt-1">{errors.assignedTo}</p>
                  )}
                </div>

                <div>
                  <label htmlFor="priority" className="block text-sm font-medium mb-1">
                    Priority
                  </label>
                  <Select
                    value={formData.priority || 'Medium'}
                    onValueChange={(val: string) => handleFieldChange('priority', val as TaskPriority)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {priority}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label htmlFor="dueDate" className="block text-sm font-medium mb-1">
                    Due Date <span className="text-red-500">*</span>
                  </label>
                  <Input
                    id="dueDate"
                    type="date"
                    value={formData.dueDate || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFieldChange('dueDate', e.target.value)}
                    className={errors.dueDate ? 'border-red-500' : ''}
                  />
                  {errors.dueDate && <p className="text-sm text-red-500 mt-1">{errors.dueDate}</p>}
                </div>

                <div>
                  <label htmlFor="dueTime" className="block text-sm font-medium mb-1">
                    Due Time
                  </label>
                  <Input
                    id="dueTime"
                    type="time"
                    value={formData.dueTime || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleFieldChange('dueTime', e.target.value)}
                  />
                </div>
              </div>

              {/* AI Deadline Suggestion based on response patterns */}
              {selectedType && (
                <DeadlineSuggestion
                  taskType={selectedType}
                  caseType={caseType}
                  currentDueDate={formData.dueDate}
                  onAccept={(date) => handleFieldChange('dueDate', date)}
                />
              )}

              {/* AI Time Estimation */}
              {(estimation || isEstimating) && (
                <TimeEstimationDisplay
                  estimation={estimation}
                  isLoading={isEstimating}
                  value={formData.estimatedHours}
                  onChange={(value) => handleFieldChange('estimatedHours', value)}
                  onOverride={handleEstimationOverride}
                />
              )}

              {/* Manual Estimated Hours Input (fallback when no estimation) */}
              {!estimation && !isEstimating && (
                <div>
                  <label htmlFor="estimatedHours" className="block text-sm font-medium mb-1">
                    Estimated Hours
                  </label>
                  <Input
                    id="estimatedHours"
                    type="number"
                    step="0.5"
                    min="0"
                    value={formData.estimatedHours || ''}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleFieldChange('estimatedHours', parseFloat(e.target.value) || undefined)
                    }
                    placeholder="e.g., 2.5"
                  />
                </div>
              )}

              {/* Type-Specific Form */}
              <div className="border-t pt-4">
                <h3 className="text-sm font-medium mb-4">
                  {TASK_TYPES.find((t) => t.value === selectedType)?.label} Details
                </h3>
                {renderTypeSpecificForm()}
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!selectedType || isSubmitting}>
            {isSubmitting ? 'Creating...' : 'Create Task'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
