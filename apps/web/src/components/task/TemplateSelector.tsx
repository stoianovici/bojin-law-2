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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Calendar, Users, Clock, CheckCircle2, Layers } from 'lucide-react';
import type { TaskTemplate, CaseType, User } from '@legal-platform/types';

export interface TemplateSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  caseId: string;
  caseType?: CaseType;
  templates: TaskTemplate[];
  users: User[];
  onApply: (data: ApplyTemplateData) => Promise<void>;
}

export interface ApplyTemplateData {
  templateId: string;
  caseId: string;
  startDate: Date;
  assignees: Record<string, string>; // stepId -> userId
}

export function TemplateSelector({
  open,
  onOpenChange,
  caseId,
  caseType,
  templates,
  users,
  onApply,
}: TemplateSelectorProps) {
  const [selectedTemplate, setSelectedTemplate] = React.useState<TaskTemplate | null>(null);
  const [startDate, setStartDate] = React.useState<string>(new Date().toISOString().split('T')[0]);
  const [assignees, setAssignees] = React.useState<Record<string, string>>({});
  const [isApplying, setIsApplying] = React.useState(false);
  const [step, setStep] = React.useState<'select' | 'configure'>('select');

  React.useEffect(() => {
    if (!open) {
      // Reset state when dialog closes
      setSelectedTemplate(null);
      setStep('select');
      setStartDate(new Date().toISOString().split('T')[0]);
      setAssignees({});
    }
  }, [open]);

  const filteredTemplates = React.useMemo(() => {
    if (!caseType) return templates;
    return templates.filter((t) => !t.caseType || t.caseType === caseType);
  }, [templates, caseType]);

  const handleTemplateSelect = (template: TaskTemplate) => {
    setSelectedTemplate(template);
    setStep('configure');

    // Pre-populate assignees with empty values
    const defaultAssignees: Record<string, string> = {};
    template.steps.forEach((step: (typeof selectedTemplate.steps)[number]) => {
      defaultAssignees[step.id] = '';
    });
    setAssignees(defaultAssignees);
  };

  const calculateTotalDuration = (template: TaskTemplate): number => {
    if (template.steps.length === 0) return 0;

    const lastStep = template.steps[template.steps.length - 1];
    const durationDays = Math.ceil((lastStep.estimatedHours || 0) / 8);
    return lastStep.offsetDays + durationDays;
  };

  const calculateTotalHours = (template: TaskTemplate): number => {
    return template.steps.reduce(
      (sum: number, step: (typeof selectedTemplate.steps)[number]) =>
        sum + (step.estimatedHours || 0),
      0
    );
  };

  const handleApply = async () => {
    if (!selectedTemplate) return;

    setIsApplying(true);
    try {
      const data: ApplyTemplateData = {
        templateId: selectedTemplate.id,
        caseId,
        startDate: new Date(startDate),
        assignees,
      };
      await onApply(data);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to apply template:', error);
    } finally {
      setIsApplying(false);
    }
  };

  const renderTemplateList = () => (
    <>
      <DialogHeader>
        <DialogTitle>Select Workflow Template</DialogTitle>
        <DialogDescription>
          Choose a template to apply to this case
          {caseType && ` (filtered for ${caseType} cases)`}
        </DialogDescription>
      </DialogHeader>

      <ScrollArea className="max-h-[500px] pr-4">
        <div className="space-y-3 py-4">
          {filteredTemplates.map((template: (typeof templates)[number]) => {
            const duration = calculateTotalDuration(template);
            const totalHours = calculateTotalHours(template);

            return (
              <Card
                key={template.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => handleTemplateSelect(template)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{template.name}</CardTitle>
                      {template.description && (
                        <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                      )}
                    </div>
                    {template.isDefault && (
                      <Badge variant="outline" className="ml-2">
                        Default
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Layers className="h-4 w-4" />
                      {template.steps.length} steps
                    </div>
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      {totalHours}h total
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />~{duration} days
                    </div>
                    {template.caseType && <Badge variant="secondary">{template.caseType}</Badge>}
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {filteredTemplates.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No templates available
              {caseType && ' for this case type'}
            </div>
          )}
        </div>
      </ScrollArea>

      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Cancel
        </Button>
      </DialogFooter>
    </>
  );

  const renderConfiguration = () => {
    if (!selectedTemplate) return null;

    const allStepsAssigned = selectedTemplate.steps.every(
      (step: (typeof selectedTemplate.steps)[number]) => assignees[step.id]
    );

    return (
      <>
        <DialogHeader>
          <DialogTitle>Configure Template: {selectedTemplate.name}</DialogTitle>
          <DialogDescription>Set start date and assign team members to each step</DialogDescription>
        </DialogHeader>

        <div className="py-4 space-y-6">
          {/* Start Date */}
          <div>
            <label className="block text-sm font-medium mb-2">
              <Calendar className="inline h-4 w-4 mr-1" />
              Start Date
            </label>
            <Input
              type="date"
              value={startDate}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setStartDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
            <p className="text-xs text-gray-500 mt-1">
              Tasks will be scheduled from this date based on step offsets
            </p>
          </div>

          {/* Assignee Mapping */}
          <div>
            <label className="block text-sm font-medium mb-2">
              <Users className="inline h-4 w-4 mr-1" />
              Assign Team Members
            </label>
            <ScrollArea className="max-h-[300px] border rounded-md p-4">
              <div className="space-y-4">
                {selectedTemplate.steps.map(
                  (step: (typeof selectedTemplate.steps)[number], idx: number) => (
                    <div key={step.id} className="space-y-2">
                      <div className="flex items-start gap-2">
                        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-medium">
                          {idx + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium truncate">{step.title}</div>
                          <div className="text-xs text-gray-500">{step.taskType}</div>
                        </div>
                      </div>
                      <Select
                        value={assignees[step.id] || ''}
                        onValueChange={(userId: string) =>
                          setAssignees((prev) => ({ ...prev, [step.id]: userId }))
                        }
                      >
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selectează responsabil" />
                        </SelectTrigger>
                        <SelectContent>
                          {users.map((user) => (
                            <SelectItem key={user.id} value={user.id}>
                              {user.name} ({user.email})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Summary */}
          <div className="bg-gray-50 p-4 rounded-lg space-y-2">
            <h4 className="font-medium text-sm mb-2">Sumar</h4>
            <div className="text-sm text-gray-700 space-y-1">
              <div className="flex justify-between">
                <span>Total pași:</span>
                <span className="font-medium">{selectedTemplate.steps.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Durată estimată:</span>
                <span className="font-medium">
                  ~{calculateTotalDuration(selectedTemplate)} zile
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total ore:</span>
                <span className="font-medium">{calculateTotalHours(selectedTemplate)}h</span>
              </div>
              <div className="flex justify-between">
                <span>Assigned:</span>
                <span
                  className={allStepsAssigned ? 'text-green-600 font-medium' : 'text-orange-600'}
                >
                  {Object.values(assignees).filter(Boolean).length} /{' '}
                  {selectedTemplate.steps.length}
                </span>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              setSelectedTemplate(null);
              setStep('select');
            }}
            disabled={isApplying}
          >
            Back
          </Button>
          <Button onClick={handleApply} disabled={!allStepsAssigned || isApplying}>
            {isApplying ? (
              'Applying...'
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Apply Template
              </>
            )}
          </Button>
        </DialogFooter>
      </>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        {step === 'select' ? renderTemplateList() : renderConfiguration()}
      </DialogContent>
    </Dialog>
  );
}
