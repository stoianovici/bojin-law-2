'use client';

import { useMutation } from '@apollo/client/react';
import { CREATE_CLIENT } from '@/graphql/mutations';

export interface CreateClientInput {
  name: string;
  email?: string;
  phone?: string;
  address?: string;
}

interface CreateClientData {
  createClient: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    caseCount: number;
    activeCaseCount: number;
  };
}

export function useCreateClient() {
  const [createClientMutation, { loading, error }] = useMutation<
    CreateClientData,
    { input: CreateClientInput }
  >(CREATE_CLIENT);

  const createClient = async (input: CreateClientInput) => {
    const result = await createClientMutation({ variables: { input } });
    return result.data?.createClient;
  };

  return {
    createClient,
    loading,
    error,
  };
}
