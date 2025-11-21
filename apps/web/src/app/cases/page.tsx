'use client';

import { useEffect } from 'react';
import type { CaseOverview } from '@legal-platform/types';
import { CaseCard } from '../../components/case/CaseCard';

// Mock cases data with enriched information
const mockCases: CaseOverview[] = [
  {
    id: 'case-001',
    caseNumber: '2024/001',
    title: 'Litigiu comercial - Contract furnizare',
    clientName: 'ABC Industries SRL',
    status: 'Active',
    caseType: 'Litigation',
    priority: 'High',
    assignedAttorneys: [
      { id: 'atty-1', name: 'Ion Popescu', initials: 'IP' },
      { id: 'atty-2', name: 'Maria Ionescu', initials: 'MI' },
    ],
    lastActivityDate: new Date('2024-11-10'),
    nextDeadline: new Date('2024-11-22'), // Urgent deadline
    documentCount: 15,
    taskCount: 8,
  },
  {
    id: 'case-002',
    caseNumber: '2024/002',
    title: 'Revizie contract de muncă',
    clientName: 'XYZ Corporation',
    status: 'Active',
    caseType: 'Contract',
    priority: 'Medium',
    assignedAttorneys: [{ id: 'atty-3', name: 'Andrei Georgescu', initials: 'AG' }],
    lastActivityDate: new Date('2024-11-12'),
    nextDeadline: new Date('2024-12-05'),
    documentCount: 8,
    taskCount: 4,
  },
  {
    id: 'case-003',
    caseNumber: '2024/003',
    title: 'Consultanță fuziune și achiziție',
    clientName: 'Global Tech Partners',
    status: 'OnHold',
    caseType: 'Advisory',
    priority: 'Low',
    assignedAttorneys: [
      { id: 'atty-2', name: 'Maria Ionescu', initials: 'MI' },
      { id: 'atty-4', name: 'Elena Dumitrescu', initials: 'ED' },
    ],
    lastActivityDate: new Date('2024-11-08'),
    documentCount: 22,
    taskCount: 3,
  },
  {
    id: 'case-004',
    caseNumber: '2024/004',
    title: 'Divorț cu partaj bunuri',
    clientName: 'Alexandru Popa',
    status: 'Active',
    caseType: 'Other',
    priority: 'High',
    assignedAttorneys: [{ id: 'atty-5', name: 'Victor Popa', initials: 'VP' }],
    lastActivityDate: new Date('2024-11-15'),
    nextDeadline: new Date('2024-11-20'), // Very urgent
    documentCount: 12,
    taskCount: 6,
  },
  {
    id: 'case-005',
    caseNumber: '2024/005',
    title: 'Vânzare proprietate comercială',
    clientName: 'Real Estate Partners SRL',
    status: 'Active',
    caseType: 'Contract',
    priority: 'Medium',
    assignedAttorneys: [{ id: 'atty-1', name: 'Ion Popescu', initials: 'IP' }],
    lastActivityDate: new Date('2024-11-14'),
    nextDeadline: new Date('2024-12-01'),
    documentCount: 18,
    taskCount: 5,
  },
  {
    id: 'case-006',
    caseNumber: '2024/006',
    title: 'Apărare penală - fraudă',
    clientName: 'Mihai Stanescu',
    status: 'Active',
    caseType: 'Criminal',
    priority: 'High',
    assignedAttorneys: [
      { id: 'atty-3', name: 'Andrei Georgescu', initials: 'AG' },
      { id: 'atty-5', name: 'Victor Popa', initials: 'VP' },
    ],
    lastActivityDate: new Date('2024-11-16'),
    nextDeadline: new Date('2024-11-25'),
    documentCount: 31,
    taskCount: 12,
  },
];

export default function CasesPage() {
  // Set document title
  useEffect(() => {
    document.title = 'Cazuri';
  }, []);

  const handleQuickAction = (
    action: 'addTask' | 'uploadDocument' | 'markComplete',
    caseId: string
  ) => {
    // TODO: Implement quick actions when backend is ready
    console.log(`Quick action: ${action} for case ${caseId}`);
    alert(`Quick action: ${action} for case ${caseId}`);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Grid of Case Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockCases.map((caseItem) => (
            <CaseCard key={caseItem.id} case={caseItem} onQuickAction={handleQuickAction} />
          ))}
        </div>
      </div>
    </main>
  );
}
