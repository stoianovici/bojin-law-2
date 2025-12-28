/**
 * Home Page - Role-Based Dashboard
 * Displays the appropriate dashboard based on user role
 * On mobile devices (< 768px), shows MobileHome instead
 */

'use client';

import { PartnerDashboard } from '../components/dashboard/PartnerDashboard';
import { AssociateDashboard } from '../components/dashboard/AssociateDashboard';
import { ParalegalDashboard } from '../components/dashboard/ParalegalDashboard';
import { MobileHome } from '../components/mobile';
// TODO: Revert to @ alias when Next.js/Turbopack path resolution is fixed
import { useNavigationStore } from '../stores/navigation.store';
import { useSetAIContext } from '../contexts/AIAssistantContext';
import { useIsMobile } from '../hooks/useIsMobile';
import { PageLayout } from '../components/linear/PageLayout';

export default function HomePage() {
  const { currentRole } = useNavigationStore();
  const isMobile = useIsMobile();

  // Set AI assistant context to dashboard
  useSetAIContext('dashboard');

  // On mobile, render MobileHome (all roles share the same mobile experience)
  if (isMobile) {
    return <MobileHome />;
  }

  // Desktop: Render appropriate dashboard based on role
  // All dashboards wrapped in PageLayout for consistent styling
  const getDashboard = () => {
    switch (currentRole) {
      case 'Partner':
        return <PartnerDashboard />;
      case 'Associate':
        return <AssociateDashboard />;
      case 'Paralegal':
        return <ParalegalDashboard />;
      default:
        return (
          <div className="flex items-center justify-center">
            <div className="text-center">
              <p className="text-linear-text-secondary">Configurație rol invalidă</p>
            </div>
          </div>
        );
    }
  };

  return <PageLayout withGlow>{getDashboard()}</PageLayout>;
}
