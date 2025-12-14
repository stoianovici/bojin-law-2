/**
 * Home Page - Role-Based Dashboard
 * Displays the appropriate dashboard based on user role
 */

'use client';

import { PartnerDashboard } from '../components/dashboard/PartnerDashboard';
import { AssociateDashboard } from '../components/dashboard/AssociateDashboard';
import { ParalegalDashboard } from '../components/dashboard/ParalegalDashboard';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { useNavigationStore } from '../stores/navigation.store';
import { useSetAIContext } from '../contexts/AIAssistantContext';

export default function HomePage() {
  const { currentRole } = useNavigationStore();

  // Set AI assistant context to dashboard
  useSetAIContext('dashboard');

  // Render appropriate dashboard based on role
  switch (currentRole) {
    case 'Partner':
      return <PartnerDashboard />;
    case 'Associate':
      return <AssociateDashboard />;
    case 'Paralegal':
      return <ParalegalDashboard />;
    default:
      return (
        <div className="flex min-h-screen items-center justify-center bg-gray-50">
          <div className="text-center">
            <p className="text-gray-600">Configurație rol invalidă</p>
          </div>
        </div>
      );
  }
}
