'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@apollo/client/react';
import {
  MobileFormPage,
  MobileInput,
  MobileTextArea,
  MobileSelect,
  InlineError,
} from '@/components/mobile';
import { useCreateTask, useCases, type TaskType } from '@/hooks/mobile';
import { GET_TEAM_MEMBERS } from '@/graphql/queries';
import { useAuthStore } from '@/store/authStore';

const EVENT_TYPES: { value: TaskType; label: string }[] = [
  { value: 'Meeting', label: 'Întâlnire' },
  { value: 'CourtDate', label: 'Termen instanță' },
];

interface TeamMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

export default function NewEventPage() {
  const router = useRouter();
  const { user } = useAuthStore();
  const { createTask, loading: submitting, error: submitError } = useCreateTask();
  const { cases, loading: casesLoading } = useCases();

  // Fetch team members
  const { data: teamData } = useQuery<{ firmTeamMembers: TeamMember[] }>(GET_TEAM_MEMBERS);

  // Form state
  const [caseId, setCaseId] = useState('');
  const [title, setTitle] = useState('');
  const [type, setType] = useState<TaskType>('Meeting');
  const [assignedTo, setAssignedTo] = useState(user?.id || '');
  const [dueDate, setDueDate] = useState('');
  const [dueTime, setDueTime] = useState('');
  const [estimatedHours, setEstimatedHours] = useState('');
  const [description, setDescription] = useState('');

  // Validation
  const isValid = !!(
    caseId &&
    title.trim().length >= 3 &&
    type &&
    assignedTo &&
    dueDate &&
    dueTime &&
    estimatedHours &&
    parseFloat(estimatedHours) > 0
  );

  // Build options
  const caseOptions = cases.map((c) => ({
    value: c.id,
    label: c.title,
  }));

  const teamOptions =
    teamData?.firmTeamMembers?.map((m) => ({
      value: m.id,
      label: `${m.firstName} ${m.lastName}`,
    })) || [];

  const handleSubmit = async () => {
    if (!isValid || submitting) return;

    try {
      const result = await createTask({
        caseId,
        title: title.trim(),
        type,
        assignedTo,
        dueDate,
        dueTime,
        estimatedHours: parseFloat(estimatedHours),
        description: description.trim() || undefined,
      });

      if (result) {
        router.push('/m/calendar');
      }
    } catch (err) {
      console.error('Failed to create event:', err);
    }
  };

  return (
    <MobileFormPage
      title="Eveniment Nou"
      onSubmit={handleSubmit}
      submitLabel="Creează Eveniment"
      isSubmitting={submitting}
      isValid={isValid}
    >
      <div className="space-y-5">
        <MobileSelect
          label="Dosar *"
          placeholder={casesLoading ? 'Se încarcă...' : 'Selectează dosarul'}
          options={caseOptions}
          value={caseId}
          onChange={(e) => setCaseId(e.target.value)}
        />

        <MobileSelect
          label="Tip eveniment *"
          placeholder="Selectează tipul"
          options={EVENT_TYPES}
          value={type}
          onChange={(e) => setType(e.target.value as TaskType)}
        />

        <MobileInput
          label="Titlu *"
          placeholder={type === 'CourtDate' ? 'ex: Termen fond' : 'ex: Întâlnire client'}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          error={title.length > 0 && title.length < 3 ? 'Minim 3 caractere' : undefined}
        />

        <div className="grid grid-cols-2 gap-3">
          <MobileInput
            label="Data *"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />

          <MobileInput
            label="Ora *"
            type="time"
            value={dueTime}
            onChange={(e) => setDueTime(e.target.value)}
          />
        </div>

        <MobileSelect
          label="Responsabil *"
          placeholder="Selectează persoana"
          options={teamOptions}
          value={assignedTo}
          onChange={(e) => setAssignedTo(e.target.value)}
        />

        <MobileInput
          label="Timp estimat (ore) *"
          placeholder="ex: 1.5"
          type="number"
          value={estimatedHours}
          onChange={(e) => setEstimatedHours(e.target.value)}
          error={
            estimatedHours && parseFloat(estimatedHours) <= 0 ? 'Trebuie să fie > 0' : undefined
          }
        />

        <MobileTextArea
          label="Detalii (opțional)"
          placeholder={
            type === 'CourtDate'
              ? 'Sala, complet, observații...'
              : 'Locație, participanți, agendă...'
          }
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="min-h-[80px]"
        />

        {submitError && (
          <InlineError
            message="Nu s-a putut crea evenimentul. Încercați din nou."
            onRetry={handleSubmit}
          />
        )}
      </div>
    </MobileFormPage>
  );
}
