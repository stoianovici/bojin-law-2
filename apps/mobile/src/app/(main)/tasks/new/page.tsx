'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Briefcase, Calendar, Flag, Loader2, User } from 'lucide-react';
import { format } from 'date-fns';
import { ro } from 'date-fns/locale';
import {
  Card,
  Input,
  TextArea,
  Button,
  BottomSheet,
  BottomSheetContent,
  Badge,
} from '@/components/ui';
import { useTasks, type TaskPriority } from '@/hooks/useTasks';
import { useQuery } from '@apollo/client/react';
import { GET_CASES, GET_FIRM_USERS } from '@/graphql/queries';
import { clsx } from 'clsx';

// ============================================
// Types
// ============================================

interface CaseOption {
  id: string;
  caseNumber: string;
  title: string;
}

interface CasesData {
  paginatedCases: {
    edges: Array<{
      node: CaseOption;
    }>;
  };
}

interface UserOption {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

interface FirmUsersData {
  firmUsers: UserOption[];
}

// ============================================
// Page Component
// ============================================

export default function NewTaskPage() {
  const router = useRouter();
  const { createTask, creating } = useTasks();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedCase, setSelectedCase] = useState<CaseOption | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState<UserOption | null>(null);
  const [priority, setPriority] = useState<TaskPriority>('Normal');
  const [dueDate, setDueDate] = useState('');

  // Sheet states
  const [showCasePicker, setShowCasePicker] = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);

  // Fetch cases for picker
  const { data: casesData, loading: casesLoading } = useQuery<CasesData>(GET_CASES, {
    variables: { status: 'Active' },
    fetchPolicy: 'cache-first',
  });

  // Fetch firm users for assignee picker
  const { data: usersData, loading: usersLoading } = useQuery<FirmUsersData>(GET_FIRM_USERS, {
    fetchPolicy: 'cache-first',
  });

  const handleSubmit = async () => {
    if (!title.trim()) return;

    try {
      await createTask({
        variables: {
          input: {
            title: title.trim(),
            description: description.trim() || null,
            caseId: selectedCase?.id || null,
            assignedTo: selectedAssignee?.id || null,
            priority,
            dueDate: dueDate || null,
            status: 'Pending',
          },
        },
      });
      router.back();
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const isValid = title.trim().length > 0 && selectedAssignee !== null;

  const priorityOptions: Array<{ value: TaskPriority; label: string; color: string }> = [
    { value: 'Low', label: 'Scăzută', color: 'bg-text-tertiary' },
    { value: 'Normal', label: 'Normală', color: 'bg-accent' },
    { value: 'High', label: 'Ridicată', color: 'bg-warning' },
    { value: 'Urgent', label: 'Urgentă', color: 'bg-error' },
  ];

  const selectedPriorityOption = priorityOptions.find((p) => p.value === priority);

  return (
    <div className="min-h-screen bg-bg-primary">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-bg-primary/80 backdrop-blur-lg border-b border-white/5">
        <div className="px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 flex items-center justify-center -ml-2"
            >
              <ArrowLeft className="w-5 h-5 text-text-primary" />
            </button>
            <h1 className="text-lg font-semibold text-text-primary">Sarcină nouă</h1>
          </div>

          <Button onClick={handleSubmit} disabled={!isValid || creating} size="sm">
            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Salvează'}
          </Button>
        </div>
      </div>

      {/* Form */}
      <div className="px-6 py-4 space-y-4">
        {/* Title */}
        <div>
          <Input
            label="Titlu"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ce trebuie făcut?"
            autoFocus
          />
        </div>

        {/* Description */}
        <div>
          <TextArea
            label="Descriere (opțional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Adaugă detalii..."
            rows={3}
          />
        </div>

        {/* Case Picker */}
        <div>
          <label className="text-sm font-medium text-text-secondary mb-2 block">Dosar</label>
          <button onClick={() => setShowCasePicker(true)} className="w-full">
            <Card padding="md">
              <div className="flex items-center gap-3">
                <Briefcase className="w-5 h-5 text-text-tertiary" />
                <span className={selectedCase ? 'text-text-primary' : 'text-text-tertiary'}>
                  {selectedCase
                    ? `${selectedCase.caseNumber} - ${selectedCase.title}`
                    : 'Selectează un dosar (opțional)'}
                </span>
              </div>
            </Card>
          </button>
        </div>

        {/* Assignee Picker */}
        <div>
          <label className="text-sm font-medium text-text-secondary mb-2 block">Atribuit lui</label>
          <button onClick={() => setShowAssigneePicker(true)} className="w-full">
            <Card padding="md">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-text-tertiary" />
                <span className={selectedAssignee ? 'text-text-primary' : 'text-text-tertiary'}>
                  {selectedAssignee
                    ? `${selectedAssignee.firstName} ${selectedAssignee.lastName}`
                    : 'Selectează persoana'}
                </span>
              </div>
            </Card>
          </button>
        </div>

        {/* Priority and Due Date - Same Row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Priority Picker */}
          <div>
            <label className="text-sm font-medium text-text-secondary mb-2 block">Prioritate</label>
            <button onClick={() => setShowPriorityPicker(true)} className="w-full">
              <Card padding="md">
                <div className="flex items-center gap-3">
                  <div className={clsx('w-3 h-3 rounded-full', selectedPriorityOption?.color)} />
                  <span className="text-text-primary">{selectedPriorityOption?.label}</span>
                </div>
              </Card>
            </button>
          </div>

          {/* Due Date */}
          <div>
            <label className="text-sm font-medium text-text-secondary mb-2 block">Termen</label>
            <Card padding="md">
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-text-tertiary" />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  className="flex-1 bg-transparent text-text-primary placeholder:text-text-tertiary outline-none"
                />
              </div>
            </Card>
          </div>
        </div>
      </div>

      {/* Case Picker Sheet */}
      <BottomSheet
        open={showCasePicker}
        onClose={() => setShowCasePicker(false)}
        title="Selectează dosar"
      >
        <BottomSheetContent>
          <div className="space-y-2">
            <button
              onClick={() => {
                setSelectedCase(null);
                setShowCasePicker(false);
              }}
              className={clsx(
                'w-full flex items-center gap-3 p-4 rounded-lg',
                !selectedCase
                  ? 'bg-accent-muted text-accent'
                  : 'bg-bg-card text-text-primary hover:bg-bg-hover'
              )}
            >
              <span className="font-medium">Fără dosar</span>
            </button>

            {casesLoading ? (
              <div className="p-4 text-center text-text-tertiary">Se încarcă...</div>
            ) : (
              casesData?.paginatedCases.edges.map(({ node: caseItem }) => (
                <button
                  key={caseItem.id}
                  onClick={() => {
                    setSelectedCase(caseItem);
                    setShowCasePicker(false);
                  }}
                  className={clsx(
                    'w-full flex items-center gap-3 p-4 rounded-lg text-left',
                    selectedCase?.id === caseItem.id
                      ? 'bg-accent-muted text-accent'
                      : 'bg-bg-card text-text-primary hover:bg-bg-hover'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{caseItem.caseNumber}</p>
                    <p className="text-sm text-text-tertiary truncate">{caseItem.title}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </BottomSheetContent>
      </BottomSheet>

      {/* Assignee Picker Sheet */}
      <BottomSheet
        open={showAssigneePicker}
        onClose={() => setShowAssigneePicker(false)}
        title="Atribuit lui"
      >
        <BottomSheetContent>
          <div className="space-y-2">
            {usersLoading ? (
              <div className="p-4 text-center text-text-tertiary">Se încarcă...</div>
            ) : (
              usersData?.firmUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => {
                    setSelectedAssignee(user);
                    setShowAssigneePicker(false);
                  }}
                  className={clsx(
                    'w-full flex items-center gap-3 p-4 rounded-lg text-left',
                    selectedAssignee?.id === user.id
                      ? 'bg-accent-muted text-accent'
                      : 'bg-bg-card text-text-primary hover:bg-bg-hover'
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">
                      {user.firstName} {user.lastName}
                    </p>
                    <p className="text-sm text-text-tertiary truncate">{user.email}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </BottomSheetContent>
      </BottomSheet>

      {/* Priority Picker Sheet */}
      <BottomSheet
        open={showPriorityPicker}
        onClose={() => setShowPriorityPicker(false)}
        title="Selectează prioritate"
      >
        <BottomSheetContent>
          <div className="space-y-2">
            {priorityOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => {
                  setPriority(option.value);
                  setShowPriorityPicker(false);
                }}
                className={clsx(
                  'w-full flex items-center gap-3 p-4 rounded-lg',
                  priority === option.value
                    ? 'bg-accent-muted text-accent'
                    : 'bg-bg-card text-text-primary hover:bg-bg-hover'
                )}
              >
                <div className={clsx('w-3 h-3 rounded-full', option.color)} />
                <span className="font-medium">{option.label}</span>
              </button>
            ))}
          </div>
        </BottomSheetContent>
      </BottomSheet>
    </div>
  );
}
