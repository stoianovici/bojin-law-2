/**
 * Task Attendee Management React Hooks
 * Story 4.2: Task Type System Implementation - Meeting Tasks
 */

import { gql } from '@apollo/client';
import { useMutation, useQuery } from '@apollo/client/react';

// GraphQL Operations
const TASK_ATTENDEE_FRAGMENT = gql`
  fragment AttendeeFields on TaskAttendee {
    id
    taskId
    userId
    user {
      id
      firstName
      lastName
      email
    }
    externalName
    externalEmail
    isOrganizer
    response
  }
`;

const GET_TASK_ATTENDEES = gql`
  ${TASK_ATTENDEE_FRAGMENT}
  query GetTaskAttendees($taskId: ID!) {
    task(id: $taskId) {
      id
      attendees {
        ...AttendeeFields
      }
    }
  }
`;

const ADD_TASK_ATTENDEE = gql`
  ${TASK_ATTENDEE_FRAGMENT}
  mutation AddTaskAttendee($taskId: ID!, $input: AddAttendeeInput!) {
    addTaskAttendee(taskId: $taskId, input: $input) {
      ...AttendeeFields
    }
  }
`;

const REMOVE_TASK_ATTENDEE = gql`
  mutation RemoveTaskAttendee($taskId: ID!, $attendeeId: ID!) {
    removeTaskAttendee(taskId: $taskId, attendeeId: $attendeeId)
  }
`;

const UPDATE_ATTENDEE_RESPONSE = gql`
  ${TASK_ATTENDEE_FRAGMENT}
  mutation UpdateAttendeeResponse($attendeeId: ID!, $response: AttendeeResponse!) {
    updateAttendeeResponse(attendeeId: $attendeeId, response: $response) {
      ...AttendeeFields
    }
  }
`;

// Interfaces
export interface TaskAttendee {
  id: string;
  taskId: string;
  userId?: string;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  externalName?: string;
  externalEmail?: string;
  isOrganizer: boolean;
  response: 'Pending' | 'Accepted' | 'Declined' | 'Tentative';
}

export interface AddAttendeeInput {
  userId?: string;
  externalName?: string;
  externalEmail?: string;
  isOrganizer?: boolean;
}

// Custom Hooks

/**
 * Hook to get attendees for a task
 */
export function useTaskAttendees(taskId: string) {
  return useQuery<{ task: { id: string; attendees: TaskAttendee[] } }>(GET_TASK_ATTENDEES, {
    variables: { taskId },
    skip: !taskId,
  });
}

/**
 * Hook to add an attendee to a task
 */
export function useAddTaskAttendee() {
  return useMutation<
    { addTaskAttendee: TaskAttendee },
    { taskId: string; input: AddAttendeeInput }
  >(ADD_TASK_ATTENDEE, {
    refetchQueries: ['GetTaskAttendees', 'GetTask'],
  });
}

/**
 * Hook to remove an attendee from a task
 */
export function useRemoveTaskAttendee() {
  return useMutation<{ removeTaskAttendee: boolean }, { taskId: string; attendeeId: string }>(
    REMOVE_TASK_ATTENDEE,
    {
      refetchQueries: ['GetTaskAttendees', 'GetTask'],
    }
  );
}

/**
 * Hook to update an attendee's response status
 */
export function useUpdateAttendeeResponse() {
  return useMutation<
    { updateAttendeeResponse: TaskAttendee },
    { attendeeId: string; response: TaskAttendee['response'] }
  >(UPDATE_ATTENDEE_RESPONSE, {
    refetchQueries: ['GetTaskAttendees'],
  });
}
