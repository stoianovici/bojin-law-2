'use client';

import * as React from 'react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GripVertical, Trash2, Plus, Link2, Eye } from 'lucide-react';
import type { TaskType, CaseType, TaskTemplate, OffsetType } from '@legal-platform/types';

interface TemplateBuilderProps {
  template?: TaskTemplate;
  onSave: (template: TemplateBuilderData) => Promise<void>;
  onCancel: () => void;
}

export interface TemplateBuilderData {
  id?: string;
  name: string;
  description?: string;
  caseType?: CaseType;
  isDefault: boolean;
  steps: TemplateStepData[];
}

interface TemplateStepData {
  id: string;
  stepOrder: number;
  taskType: TaskType;
  title: string;
  description?: string;
  estimatedHours?: number;
  offsetDays: number;
  offsetFrom: OffsetType;
  isParallel: boolean;
  isCriticalPath: boolean;
  dependencies: string[]; // Array of sourceStepIds
}

const TASK_TYPES: TaskType[] = [
  'Research',
  'DocumentCreation',
  'DocumentRetrieval',
  'CourtDate',
  'Meeting',
  'BusinessTrip',
];

const CASE_TYPES: CaseType[] = ['Litigation', 'Contract', 'Corporate', 'RealEstate', 'IP'];

const OFFSET_TYPES: OffsetType[] = ['CaseStart', 'PreviousTask', 'CaseDeadline'];

interface SortableStepProps {
  step: TemplateStepData;
  stepIndex: number;
  allSteps: TemplateStepData[];
  onUpdate: (id: string, updates: Partial<TemplateStepData>) => void;
  onDelete: (id: string) => void;
  onAddDependency: (targetId: string, sourceId: string) => void;
  onRemoveDependency: (targetId: string, sourceId: string) => void;
}

function SortableStep({
  step,
  stepIndex,
  allSteps,
  onUpdate,
  onDelete,
  onAddDependency,
  onRemoveDependency,
}: SortableStepProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: step.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const availableDependencies = allSteps.filter((s, idx) => idx < stepIndex && s.id !== step.id);

  return (
    <div ref={setNodeRef} style={style} className="mb-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <button className="cursor-grab active:cursor-grabbing" {...attributes} {...listeners}>
              <GripVertical className="h-5 w-5 text-gray-400" />
            </button>
            <CardTitle className="text-base">
              Step {stepIndex + 1}: {step.title || 'Untitled Step'}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => onDelete(step.id)} className="ml-auto">
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Task Type</label>
              <Select
                value={step.taskType}
                onValueChange={(val: string) => onUpdate(step.id, { taskType: val as TaskType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Title</label>
              <Input
                value={step.title}
                onChange={(e: React.MouseEvent) => onUpdate(step.id, { title: e.target.value })}
                placeholder="Step title"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <Textarea
              value={step.description || ''}
              onChange={(e: React.MouseEvent) => onUpdate(step.id, { description: e.target.value })}
              placeholder="Step description"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Offset Days</label>
              <Input
                type="number"
                value={step.offsetDays}
                onChange={(e: React.MouseEvent) =>
                  onUpdate(step.id, { offsetDays: parseInt(e.target.value) || 0 })
                }
                min="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Offset From</label>
              <Select
                value={step.offsetFrom}
                onValueChange={(val: string) =>
                  onUpdate(step.id, { offsetFrom: val as OffsetType })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OFFSET_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Est. Hours</label>
              <Input
                type="number"
                step="0.5"
                value={step.estimatedHours || ''}
                onChange={(e: React.MouseEvent) =>
                  onUpdate(step.id, { estimatedHours: parseFloat(e.target.value) || undefined })
                }
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={step.isParallel}
                onChange={(e) => onUpdate(step.id, { isParallel: e.target.checked })}
                className="rounded"
              />
              Can run in parallel
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={step.isCriticalPath}
                onChange={(e) => onUpdate(step.id, { isCriticalPath: e.target.checked })}
                className="rounded"
              />
              Critical path
            </label>
          </div>

          {availableDependencies.length > 0 && (
            <div>
              <label className="block text-sm font-medium mb-1">
                <Link2 className="inline h-4 w-4 mr-1" />
                Dependencies
              </label>
              <div className="space-y-2">
                {availableDependencies.map((prevStep) => {
                  const isDependent = step.dependencies.includes(prevStep.id);
                  return (
                    <label key={prevStep.id} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={isDependent}
                        onChange={(e) => {
                          if (e.target.checked) {
                            onAddDependency(step.id, prevStep.id);
                          } else {
                            onRemoveDependency(step.id, prevStep.id);
                          }
                        }}
                        className="rounded"
                      />
                      Step {allSteps.indexOf(prevStep) + 1}: {prevStep.title}
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function TemplateBuilder({ template, onSave, onCancel }: TemplateBuilderProps) {
  const [name, setName] = React.useState(template?.name || '');
  const [description, setDescription] = React.useState(template?.description || '');
  const [caseType, setCaseType] = React.useState<CaseType | undefined>(template?.caseType);
  const [isDefault, setIsDefault] = React.useState(template?.isDefault || false);
  const [steps, setSteps] = React.useState<TemplateStepData[]>(
    template?.steps.map((s: (typeof steps)[number]) => ({
      id: s.id,
      stepOrder: s.stepOrder,
      taskType: s.taskType,
      title: s.title,
      description: s.description,
      estimatedHours: s.estimatedHours,
      offsetDays: s.offsetDays,
      offsetFrom: s.offsetFrom,
      isParallel: s.isParallel,
      isCriticalPath: s.isCriticalPath,
      dependencies: s.dependencies.map((d: (typeof s.dependencies)[number]) => d.sourceStepId),
    })) || []
  );
  const [isSaving, setIsSaving] = React.useState(false);
  const [errors, setErrors] = React.useState<Record<string, string>>({});

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const addStep = () => {
    const newStep: TemplateStepData = {
      id: `temp-${Date.now()}`,
      stepOrder: steps.length,
      taskType: 'Research',
      title: '',
      offsetDays: 0,
      offsetFrom: 'CaseStart',
      isParallel: false,
      isCriticalPath: false,
      dependencies: [],
    };
    setSteps([...steps, newStep]);
  };

  const updateStep = (id: string, updates: Partial<TemplateStepData>) => {
    setSteps((prev) => prev.map((s) => (s.id === id ? { ...s, ...updates } : s)));
  };

  const deleteStep = (id: string) => {
    setSteps((prev) => {
      const filtered = prev.filter((s) => s.id !== id);
      // Remove dependencies pointing to deleted step
      return filtered.map((s) => ({
        ...s,
        dependencies: s.dependencies.filter((depId) => depId !== id),
      }));
    });
  };

  const addDependency = (targetId: string, sourceId: string) => {
    setSteps((prev) =>
      prev.map((s) =>
        s.id === targetId && !s.dependencies.includes(sourceId)
          ? { ...s, dependencies: [...s.dependencies, sourceId] }
          : s
      )
    );
  };

  const removeDependency = (targetId: string, sourceId: string) => {
    setSteps((prev) =>
      prev.map((s) =>
        s.id === targetId ? { ...s, dependencies: s.dependencies.filter((d) => d !== sourceId) } : s
      )
    );
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setSteps((items) => {
      const oldIndex = items.findIndex((item) => item.id === active.id);
      const newIndex = items.findIndex((item) => item.id === over.id);
      const reordered = arrayMove(items, oldIndex, newIndex);

      // Update dependencies after reordering - remove invalid ones
      return reordered.map((step, idx) => ({
        ...step,
        stepOrder: idx,
        dependencies: step.dependencies.filter((depId) => {
          const depIdx = reordered.findIndex((s) => s.id === depId);
          return depIdx < idx; // Only keep dependencies to earlier steps
        }),
      }));
    });
  };

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!name.trim()) {
      newErrors.name = 'Template name is required';
    }

    if (steps.length === 0) {
      newErrors.steps = 'At least one step is required';
    }

    steps.forEach((step, idx) => {
      if (!step.title.trim()) {
        newErrors[`step-${idx}-title`] = `Step ${idx + 1} title is required`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSave = async () => {
    if (!validate()) return;

    setIsSaving(true);
    try {
      const data: TemplateBuilderData = {
        id: template?.id,
        name,
        description,
        caseType,
        isDefault,
        steps: steps.map((s, idx) => ({ ...s, stepOrder: idx })),
      };
      await onSave(data);
    } catch (error) {
      console.error('Failed to save template:', error);
    } finally {
      setIsSaving(false);
    }
  };

  const generatePreview = () => {
    const timeline = steps.map((step, idx) => {
      let startDay = step.offsetDays;
      if (step.offsetFrom === 'PreviousTask' && idx > 0) {
        const prevStep = steps[idx - 1];
        startDay = prevStep.offsetDays + Math.ceil((prevStep.estimatedHours || 0) / 8);
      }
      const duration = Math.ceil((step.estimatedHours || 0) / 8) || 1;
      return {
        ...step,
        startDay,
        endDay: startDay + duration,
      };
    });

    return (
      <div className="space-y-2">
        <h4 className="font-medium text-sm mb-3">Example Timeline (from case start)</h4>
        {timeline.map((step, idx) => (
          <div key={step.id} className="flex items-center gap-2 text-sm">
            <div className="w-16 text-gray-500">Day {step.startDay}</div>
            <div className="flex-1">
              <div
                className={`px-3 py-2 rounded ${
                  step.isCriticalPath ? 'bg-red-100 border-red-300' : 'bg-blue-100 border-blue-300'
                } border`}
              >
                <div className="font-medium">
                  Step {idx + 1}: {step.title}
                </div>
                <div className="text-xs text-gray-600">
                  {step.estimatedHours}h ({Math.ceil((step.estimatedHours || 0) / 8)}d)
                  {step.dependencies.length > 0 && (
                    <span className="ml-2">
                      Depends on:{' '}
                      {step.dependencies
                        .map((depId) => {
                          const depIdx = steps.findIndex((s) => s.id === depId);
                          return `Step ${depIdx + 1}`;
                        })
                        .join(', ')}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="w-24 text-right text-gray-500">→ Day {step.endDay}</div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold mb-4">
          {template ? 'Edit Template' : 'Create New Template'}
        </h2>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">
              Template Name <span className="text-red-500">*</span>
            </label>
            <Input
              value={name}
              onChange={(e: React.MouseEvent) => setName(e.target.value)}
              placeholder="e.g., Standard Litigation Workflow"
              className={errors.name ? 'border-red-500' : ''}
            />
            {errors.name && <p className="text-sm text-red-500 mt-1">{errors.name}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <Textarea
              value={description}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                setDescription(e.target.value)
              }
              placeholder="Describe when to use this template"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">Case Type</label>
              <Select
                value={caseType}
                onValueChange={(val: string) => setCaseType(val as CaseType)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional - any case type" />
                </SelectTrigger>
                <SelectContent>
                  {CASE_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={isDefault}
                  onChange={(e) => setIsDefault(e.target.checked)}
                  className="rounded"
                />
                Set as firm default template
              </label>
            </div>
          </div>
        </div>
      </div>

      <Tabs defaultValue="builder">
        <TabsList>
          <TabsTrigger value="builder">Template Builder</TabsTrigger>
          <TabsTrigger value="preview">
            <Eye className="h-4 w-4 mr-1" />
            Preview Timeline
          </TabsTrigger>
        </TabsList>

        <TabsContent value="builder" className="mt-4">
          <div className="mb-4 flex justify-between items-center">
            <h3 className="text-lg font-semibold">Workflow Steps</h3>
            <Button onClick={addStep} size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Add Step
            </Button>
          </div>

          {errors.steps && <p className="text-sm text-red-500 mb-4">{errors.steps}</p>}

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext items={steps.map((s) => s.id)} strategy={verticalListSortingStrategy}>
              {steps.map((step, idx) => (
                <SortableStep
                  key={step.id}
                  step={step}
                  stepIndex={idx}
                  allSteps={steps}
                  onUpdate={updateStep}
                  onDelete={deleteStep}
                  onAddDependency={addDependency}
                  onRemoveDependency={removeDependency}
                />
              ))}
            </SortableContext>
          </DndContext>

          {steps.length === 0 && (
            <div className="text-center py-12 border-2 border-dashed rounded-lg">
              <p className="text-gray-500 mb-4">No steps yet. Add your first workflow step.</p>
              <Button onClick={addStep}>
                <Plus className="h-4 w-4 mr-1" />
                Add Step
              </Button>
            </div>
          )}
        </TabsContent>

        <TabsContent value="preview" className="mt-4">
          {steps.length > 0 ? (
            generatePreview()
          ) : (
            <div className="text-center py-12 text-gray-500">Add steps to see timeline preview</div>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-3 mt-6 pt-6 border-t">
        <Button variant="outline" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={isSaving}>
          {isSaving ? 'Saving...' : template ? 'Update Template' : 'Create Template'}
        </Button>
      </div>
    </div>
  );
}
