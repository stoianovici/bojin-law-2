'use client';

import { useMutation } from '@apollo/client/react';
import { CREATE_EVENT } from '@/graphql/mutations';
import { GET_TASKS, GET_CALENDAR_EVENTS } from '@/graphql/queries';

export type EventType =
  | 'CourtDate' // Termene Instanță
  | 'Hearing' // Audieri
  | 'LegalDeadline' // Termene Legale
  | 'Meeting' // Întâlniri
  | 'Task' // Sarcini
  | 'Reminder'; // Mementouri

export interface CreateEventInput {
  caseId?: string; // Optional - set for case-level events
  clientId?: string; // Optional - set for client-level events
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
    } | null;
    client: {
      id: string;
      name: string;
    } | null;
    attendees: Attendee[];
    createdAt: string;
  };
}

export function useCreateEvent() {
  const [createEventMutation, { loading, error }] = useMutation<
    CreateEventData,
    { input: CreateEventInput }
  >(CREATE_EVENT, {
    refetchQueries: [{ query: GET_TASKS }, { query: GET_CALENDAR_EVENTS }],
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
