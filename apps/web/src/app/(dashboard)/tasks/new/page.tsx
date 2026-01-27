'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { CreateTaskModal } from '@/components/modals/CreateTaskModal';

export default function NewTaskPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preSelectedCaseId = searchParams.get('caseId');

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      router.push('/tasks');
    }
  };

  const handleSuccess = () => {
    router.push('/tasks');
  };

  return (
    <CreateTaskModal
      open={true}
      onOpenChange={handleOpenChange}
      onSuccess={handleSuccess}
      defaults={preSelectedCaseId ? { caseId: preSelectedCaseId } : undefined}
    />
  );
}
