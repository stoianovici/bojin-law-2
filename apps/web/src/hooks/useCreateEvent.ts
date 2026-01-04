'use client';

import { useMutation } from '@apollo/client/react';
import { CREATE_EVENT } from '@/graphql/mutations';
import { GET_TASKS } from '@/graphql/queries';

export type EventType = 'Meeting' | 'CourtDate' | 'Deadline' | 'Appointment';

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
  };
}

// TODO: Backend team - CREATE_EVENT mutation needs to be implemented
// For now, this hook is ready for when the backend supports events
export function useCreateEvent() {
  const [createEventMutation, { loading, error }] = useMutation<
    CreateEventData,
    { input: CreateEventInput }
  >(CREATE_EVENT, {
    refetchQueries: [{ query: GET_TASKS }],
  });

  const createEvent = async (input: CreateEventInput) => {
    const result = await createEventMutation({ variables: { input } });
    return result.data?.createEvent;
  };

  return {
    createEvent,
    loading,
    error,
  };
}
