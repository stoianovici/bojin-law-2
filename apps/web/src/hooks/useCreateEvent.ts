'use client';

import { useMutation } from '@apollo/client/react';
import { CREATE_EVENT } from '@/graphql/mutations';
import { GET_TASKS } from '@/graphql/queries';
import { toast } from '@/components/ui/toast';

export type EventType =
  | 'CourtDate' // Termene Instanță
  | 'Hearing' // Audieri
  | 'LegalDeadline' // Termene Legale
  | 'Meeting' // Întâlniri
  | 'Task' // Sarcini
  | 'Reminder'; // Mementouri

export interface CreateEventInput {
  caseId: string;
  title: string;
  type: EventType;
  startDate: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  location?: string;
  description?: string;
  attendeeIds?: string[];
}

interface Attendee {
  id: string;
  firstName: string;
  lastName: string;
}

interface RescheduledTask {
  taskId: string;
  taskTitle: string;
  oldDate: string;
  oldTime: string;
  newDate: string;
  newTime: string;
}

interface CreateEventData {
  createEvent: {
    id: string;
    title: string;
    type: string;
    startDate: string;
    startTime: string | null;
    endDate: string | null;
    endTime: string | null;
    location: string | null;
    description: string | null;
    case: {
      id: string;
      title: string;
    };
    attendees: Attendee[];
    createdAt: string;
    rescheduledTasks: RescheduledTask[] | null;
  };
}

export function useCreateEvent() {
  const [createEventMutation, { loading, error }] = useMutation<
    CreateEventData,
    { input: CreateEventInput }
  >(CREATE_EVENT, {
    refetchQueries: [{ query: GET_TASKS }],
  });

  const createEvent = async (input: CreateEventInput) => {
    const result = await createEventMutation({ variables: { input } });
    const event = result.data?.createEvent;

    // Show toast notifications for rescheduled tasks (system change notifications)
    if (event?.rescheduledTasks && event.rescheduledTasks.length > 0) {
      for (const task of event.rescheduledTasks) {
        toast.info(
          'Sarcină reprogramată',
          `"${task.taskTitle}" a fost mutată din cauza evenimentului "${event.title}"`
        );
      }
    }

    return event;
  };

  return {
    createEvent,
    loading,
    error,
  };
}
