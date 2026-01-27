'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  Clock,
  FolderKanban,
  ListTodo,
  Loader2,
  Plus,
  User,
  Users,
  X,
} from 'lucide-react';
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
import { GET_CASES, GET_FIRM_USERS, GET_CLIENTS } from '@/graphql/queries';
import { clsx } from 'clsx';

// ============================================
// Types
// ============================================

type TaskLevel = 'case' | 'client' | 'internal';

const TASK_LEVELS: Array<{
  value: TaskLevel;
  label: string;
  description: string;
  icon: typeof FolderKanban;
}> = [
  { value: 'case', label: 'Dosar', description: 'Sarcină legată de un dosar', icon: FolderKanban },
  { value: 'client', label: 'Client', description: 'Sarcină la nivel de client', icon: Building2 },
  { value: 'internal', label: 'Intern', description: 'Sarcină internă firmă', icon: Users },
];

type TaskType =
  | 'Research'
  | 'DocumentCreation'
  | 'DocumentRetrieval'
  | 'CourtDate'
  | 'Meeting'
  | 'BusinessTrip';

const TASK_TYPES: Array<{ value: TaskType; label: string }> = [
  { value: 'Research', label: 'Cercetare' },
  { value: 'DocumentCreation', label: 'Creare Document' },
  { value: 'DocumentRetrieval', label: 'Obținere Document' },
  { value: 'CourtDate', label: 'Termen Instanță' },
  { value: 'Meeting', label: 'Întâlnire' },
  { value: 'BusinessTrip', label: 'Deplasare' },
];

const HOUR_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 16, 24, 40];
const MINUTE_OPTIONS = [0, 15, 30, 45];

function formatDuration(hours: number, minutes: number): string {
  if (hours === 0 && minutes === 0) return '0min';
  if (hours === 0) return `${minutes}min`;
  if (minutes === 0) {
    if (hours === 8) return '1 zi';
    if (hours === 16) return '2 zile';
    if (hours === 24) return '3 zile';
    if (hours === 40) return '1 săpt.';
    return `${hours}h`;
  }
  return `${hours}h ${minutes}min`;
}

interface PendingSubtask {
  id: string;
  title: string;
  assigneeId: string;
  assigneeName: string;
}

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

interface ClientOption {
  id: string;
  name: string;
}

interface ClientsData {
  clients: ClientOption[];
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
  const [taskLevel, setTaskLevel] = useState<TaskLevel>('case');
  const [selectedCase, setSelectedCase] = useState<CaseOption | null>(null);
  const [selectedClient, setSelectedClient] = useState<ClientOption | null>(null);
  const [selectedAssignee, setSelectedAssignee] = useState<UserOption | null>(null);
  const [taskType, setTaskType] = useState<TaskType>('Research');
  const [priority, setPriority] = useState<TaskPriority>('Normal');
  const [durationHours, setDurationHours] = useState(0);
  const [durationMinutes, setDurationMinutes] = useState(0);
  const [dueDate, setDueDate] = useState('');
  const [pendingSubtasks, setPendingSubtasks] = useState<PendingSubtask[]>([]);
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  // Sheet states
  const [showTaskLevelPicker, setShowTaskLevelPicker] = useState(false);
  const [showCasePicker, setShowCasePicker] = useState(false);
  const [showClientPicker, setShowClientPicker] = useState(false);
  const [showAssigneePicker, setShowAssigneePicker] = useState(false);
  const [showTaskTypePicker, setShowTaskTypePicker] = useState(false);
  const [showPriorityPicker, setShowPriorityPicker] = useState(false);
  const [showDurationPicker, setShowDurationPicker] = useState(false);
  const [showSubtaskAssigneePicker, setShowSubtaskAssigneePicker] = useState(false);
  const [showSubtasksSection, setShowSubtasksSection] = useState(false);

  // Fetch cases for picker - always fetch, we'll use it if taskLevel is 'case'
  const {
    data: casesData,
    loading: casesLoading,
    error: casesError,
  } = useQuery<CasesData>(GET_CASES, {
    variables: {
      status: 'Active',
      first: 50,
    },
    fetchPolicy: 'network-only',
  });

  // Extract cases from edges with defensive null checks
  const cases = useMemo(() => {
    if (!casesData?.paginatedCases?.edges) return [];
    return casesData.paginatedCases.edges.map((edge) => edge.node);
  }, [casesData]);

  // Fetch clients for picker
  const { data: clientsData, loading: clientsLoading } = useQuery<ClientsData>(GET_CLIENTS, {
    fetchPolicy: 'cache-first',
    skip: taskLevel !== 'client',
  });

  // Fetch firm users for assignee picker
  const { data: usersData, loading: usersLoading } = useQuery<FirmUsersData>(GET_FIRM_USERS, {
    fetchPolicy: 'cache-first',
  });

  const handleTaskLevelChange = (level: TaskLevel) => {
    setTaskLevel(level);
    // Clear selections when switching levels
    if (level !== 'case') setSelectedCase(null);
    if (level !== 'client') setSelectedClient(null);
    setShowTaskLevelPicker(false);
  };

  const handleAddSubtask = (assignee: UserOption) => {
    if (!newSubtaskTitle.trim()) return;
    setPendingSubtasks((prev) => [
      ...prev,
      {
        id: `pending-${Date.now()}`,
        title: newSubtaskTitle.trim(),
        assigneeId: assignee.id,
        assigneeName: `${assignee.firstName} ${assignee.lastName}`,
      },
    ]);
    setNewSubtaskTitle('');
    setShowSubtaskAssigneePicker(false);
  };

  const handleRemoveSubtask = (id: string) => {
    setPendingSubtasks((prev) => prev.filter((s) => s.id !== id));
  };

  const handleSubmit = async () => {
    if (!title.trim()) return;

    const estimatedHours = durationHours + durationMinutes / 60;

    try {
      // Create the main task
      await createTask({
        variables: {
          input: {
            title: title.trim(),
            description: description.trim() || null,
            caseId: taskLevel === 'case' ? selectedCase?.id : null,
            clientId: taskLevel === 'client' ? selectedClient?.id : null,
            assignedTo: selectedAssignee?.id || null,
            type: taskType,
            priority,
            estimatedHours: estimatedHours > 0 ? estimatedHours : null,
            dueDate: dueDate || null,
            status: 'Pending',
          },
        },
      });

      // Create subtasks (as separate tasks with same properties)
      for (const subtask of pendingSubtasks) {
        try {
          await createTask({
            variables: {
              input: {
                title: subtask.title,
                caseId: taskLevel === 'case' ? selectedCase?.id : null,
                clientId: taskLevel === 'client' ? selectedClient?.id : null,
                assignedTo: subtask.assigneeId,
                type: taskType,
                priority,
                dueDate: dueDate || null,
                status: 'Pending',
              },
            },
          });
        } catch (subtaskErr) {
          console.error('Failed to create subtask:', subtaskErr);
        }
      }

      router.back();
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  // Validation: assignee required, and for case/client level, the target is required
  const targetValid =
    taskLevel === 'internal' ||
    (taskLevel === 'case' && selectedCase !== null) ||
    (taskLevel === 'client' && selectedClient !== null);
  const isValid = title.trim().length > 0 && selectedAssignee !== null && targetValid;

  const selectedTaskLevel = TASK_LEVELS.find((l) => l.value === taskLevel);

  const priorityOptions: Array<{ value: TaskPriority; label: string; color: string }> = [
    { value: 'Low', label: 'Scăzută', color: 'bg-text-tertiary' },
    { value: 'Normal', label: 'Normală', color: 'bg-accent' },
    { value: 'High', label: 'Ridicată', color: 'bg-warning' },
    { value: 'Urgent', label: 'Urgentă', color: 'bg-error' },
  ];

  const selectedPriorityOption = priorityOptions.find((p) => p.value === priority);
  const selectedTaskTypeOption = TASK_TYPES.find((t) => t.value === taskType);

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

        {/* Task Level + Target Picker */}
        <div>
          <label className="text-sm font-medium text-text-secondary mb-2 block">
            Nivel sarcină
          </label>
          <div className="flex gap-2">
            {/* Task Level Selector */}
            <button onClick={() => setShowTaskLevelPicker(true)} className="shrink-0">
              <Card padding="md">
                <div className="flex items-center gap-2">
                  {selectedTaskLevel && <selectedTaskLevel.icon className="w-5 h-5 text-accent" />}
                  <span className="text-text-primary font-medium">{selectedTaskLevel?.label}</span>
                </div>
              </Card>
            </button>

            {/* Target Picker - Case */}
            {taskLevel === 'case' && (
              <button onClick={() => setShowCasePicker(true)} className="flex-1 min-w-0">
                <Card padding="md">
                  <div className="flex items-center gap-3">
                    <span
                      className={clsx(
                        'truncate',
                        selectedCase ? 'text-text-primary' : 'text-text-tertiary'
                      )}
                    >
                      {selectedCase ? selectedCase.title : 'Selectează dosar...'}
                    </span>
                  </div>
                </Card>
              </button>
            )}

            {/* Target Picker - Client */}
            {taskLevel === 'client' && (
              <button onClick={() => setShowClientPicker(true)} className="flex-1 min-w-0">
                <Card padding="md">
                  <div className="flex items-center gap-3">
                    <span
                      className={clsx(
                        'truncate',
                        selectedClient ? 'text-text-primary' : 'text-text-tertiary'
                      )}
                    >
                      {selectedClient ? selectedClient.name : 'Selectează client...'}
                    </span>
                  </div>
                </Card>
              </button>
            )}

            {/* Internal - no target needed */}
            {taskLevel === 'internal' && (
              <div className="flex-1">
                <Card padding="md">
                  <span className="text-text-tertiary">Sarcină internă</span>
                </Card>
              </div>
            )}
          </div>
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

        {/* Task Type and Priority - Same Row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Task Type Picker */}
          <div>
            <label className="text-sm font-medium text-text-secondary mb-2 block">Tip</label>
            <button onClick={() => setShowTaskTypePicker(true)} className="w-full">
              <Card padding="md">
                <div className="flex items-center gap-3">
                  <Briefcase className="w-5 h-5 text-text-tertiary" />
                  <span className="text-text-primary truncate">
                    {selectedTaskTypeOption?.label}
                  </span>
                </div>
              </Card>
            </button>
          </div>

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
        </div>

        {/* Duration and Due Date - Same Row */}
        <div className="grid grid-cols-2 gap-3">
          {/* Duration Picker */}
          <div>
            <label className="text-sm font-medium text-text-secondary mb-2 block">Durată</label>
            <button onClick={() => setShowDurationPicker(true)} className="w-full">
              <Card padding="md">
                <div className="flex items-center gap-3">
                  <Clock className="w-5 h-5 text-text-tertiary" />
                  <span className="text-text-primary">
                    {formatDuration(durationHours, durationMinutes)}
                  </span>
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

        {/* Subtasks Section */}
        <div>
          <button onClick={() => setShowSubtasksSection(!showSubtasksSection)} className="w-full">
            <Card padding="md">
              <div className="flex items-center gap-3">
                <ListTodo className="w-5 h-5 text-text-tertiary" />
                <span className="flex-1 text-left text-text-primary font-medium">Subtask-uri</span>
                {pendingSubtasks.length > 0 && (
                  <Badge variant="primary" size="sm">
                    {pendingSubtasks.length}
                  </Badge>
                )}
              </div>
            </Card>
          </button>

          {showSubtasksSection && (
            <div className="mt-3 space-y-2">
              {/* Existing subtasks */}
              {pendingSubtasks.map((subtask, index) => (
                <div
                  key={subtask.id}
                  className="flex items-center gap-3 p-3 rounded-lg bg-bg-elevated"
                >
                  <div className="w-6 h-6 rounded-full bg-bg-card flex items-center justify-center text-xs text-text-tertiary">
                    {index + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-text-primary truncate">{subtask.title}</p>
                    <p className="text-xs text-text-tertiary">{subtask.assigneeName}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveSubtask(subtask.id)}
                    className="p-2 text-text-tertiary hover:text-error"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}

              {/* Add new subtask */}
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newSubtaskTitle}
                  onChange={(e) => setNewSubtaskTitle(e.target.value)}
                  placeholder="Titlu subtask..."
                  className="flex-1 h-11 px-4 rounded-lg bg-bg-elevated text-text-primary placeholder:text-text-tertiary outline-none focus:ring-2 focus:ring-accent"
                />
                <button
                  onClick={() => {
                    if (newSubtaskTitle.trim()) {
                      setShowSubtaskAssigneePicker(true);
                    }
                  }}
                  disabled={!newSubtaskTitle.trim()}
                  className={clsx(
                    'h-11 px-4 rounded-lg flex items-center gap-2',
                    newSubtaskTitle.trim()
                      ? 'bg-accent text-white'
                      : 'bg-bg-elevated text-text-tertiary'
                  )}
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Task Level Picker Sheet */}
      <BottomSheet
        open={showTaskLevelPicker}
        onClose={() => setShowTaskLevelPicker(false)}
        title="Nivel sarcină"
      >
        <BottomSheetContent>
          <div className="space-y-2">
            {TASK_LEVELS.map((level) => {
              const Icon = level.icon;
              return (
                <button
                  key={level.value}
                  onClick={() => handleTaskLevelChange(level.value)}
                  className={clsx(
                    'w-full flex items-center gap-3 p-4 rounded-lg text-left',
                    taskLevel === level.value
                      ? 'bg-accent-muted text-accent'
                      : 'bg-bg-card text-text-primary hover:bg-bg-hover'
                  )}
                >
                  <Icon className="w-5 h-5" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{level.label}</p>
                    <p className="text-sm text-text-tertiary">{level.description}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </BottomSheetContent>
      </BottomSheet>

      {/* Case Picker Sheet */}
      <BottomSheet
        open={showCasePicker}
        onClose={() => setShowCasePicker(false)}
        title="Selectează dosar"
      >
        <BottomSheetContent>
          <div className="space-y-2">
            {casesLoading ? (
              <div className="p-4 text-center text-text-tertiary">Se încarcă...</div>
            ) : casesError ? (
              <div className="p-4 text-center text-error">Eroare: {casesError.message}</div>
            ) : cases.length === 0 ? (
              <div className="p-4 text-center text-text-tertiary">Niciun dosar activ găsit</div>
            ) : (
              cases.map((caseItem) => (
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

      {/* Client Picker Sheet */}
      <BottomSheet
        open={showClientPicker}
        onClose={() => setShowClientPicker(false)}
        title="Selectează client"
      >
        <BottomSheetContent>
          <div className="space-y-2">
            {clientsLoading ? (
              <div className="p-4 text-center text-text-tertiary">Se încarcă...</div>
            ) : clientsData?.clients.length === 0 ? (
              <div className="p-4 text-center text-text-tertiary">Niciun client găsit</div>
            ) : (
              clientsData?.clients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => {
                    setSelectedClient(client);
                    setShowClientPicker(false);
                  }}
                  className={clsx(
                    'w-full flex items-center gap-3 p-4 rounded-lg text-left',
                    selectedClient?.id === client.id
                      ? 'bg-accent-muted text-accent'
                      : 'bg-bg-card text-text-primary hover:bg-bg-hover'
                  )}
                >
                  <Building2 className="w-5 h-5 text-text-tertiary" />
                  <span className="font-medium">{client.name}</span>
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

      {/* Task Type Picker Sheet */}
      <BottomSheet
        open={showTaskTypePicker}
        onClose={() => setShowTaskTypePicker(false)}
        title="Selectează tip"
      >
        <BottomSheetContent>
          <div className="space-y-2">
            {TASK_TYPES.map((type) => (
              <button
                key={type.value}
                onClick={() => {
                  setTaskType(type.value);
                  setShowTaskTypePicker(false);
                }}
                className={clsx(
                  'w-full flex items-center gap-3 p-4 rounded-lg',
                  taskType === type.value
                    ? 'bg-accent-muted text-accent'
                    : 'bg-bg-card text-text-primary hover:bg-bg-hover'
                )}
              >
                <Briefcase className="w-5 h-5" />
                <span className="font-medium">{type.label}</span>
              </button>
            ))}
          </div>
        </BottomSheetContent>
      </BottomSheet>

      {/* Duration Picker Sheet */}
      <BottomSheet
        open={showDurationPicker}
        onClose={() => setShowDurationPicker(false)}
        title="Selectează durată"
      >
        <BottomSheetContent>
          <div className="space-y-4">
            {/* Hours */}
            <div>
              <label className="text-sm font-medium text-text-secondary mb-2 block">Ore</label>
              <div className="grid grid-cols-4 gap-2">
                {HOUR_OPTIONS.map((h) => (
                  <button
                    key={h}
                    onClick={() => setDurationHours(h)}
                    className={clsx(
                      'p-3 rounded-lg text-center font-medium',
                      durationHours === h
                        ? 'bg-accent text-white'
                        : 'bg-bg-card text-text-primary hover:bg-bg-hover'
                    )}
                  >
                    {h}h
                  </button>
                ))}
              </div>
            </div>

            {/* Minutes */}
            <div>
              <label className="text-sm font-medium text-text-secondary mb-2 block">Minute</label>
              <div className="grid grid-cols-4 gap-2">
                {MINUTE_OPTIONS.map((m) => (
                  <button
                    key={m}
                    onClick={() => setDurationMinutes(m)}
                    className={clsx(
                      'p-3 rounded-lg text-center font-medium',
                      durationMinutes === m
                        ? 'bg-accent text-white'
                        : 'bg-bg-card text-text-primary hover:bg-bg-hover'
                    )}
                  >
                    {m}min
                  </button>
                ))}
              </div>
            </div>

            {/* Confirm */}
            <Button onClick={() => setShowDurationPicker(false)} fullWidth>
              Confirmă ({formatDuration(durationHours, durationMinutes)})
            </Button>
          </div>
        </BottomSheetContent>
      </BottomSheet>

      {/* Subtask Assignee Picker Sheet */}
      <BottomSheet
        open={showSubtaskAssigneePicker}
        onClose={() => setShowSubtaskAssigneePicker(false)}
        title="Atribuie subtask"
      >
        <BottomSheetContent>
          <div className="space-y-2">
            {usersLoading ? (
              <div className="p-4 text-center text-text-tertiary">Se încarcă...</div>
            ) : (
              usersData?.firmUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleAddSubtask(user)}
                  className="w-full flex items-center gap-3 p-4 rounded-lg text-left bg-bg-card text-text-primary hover:bg-bg-hover"
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
    </div>
  );
}
