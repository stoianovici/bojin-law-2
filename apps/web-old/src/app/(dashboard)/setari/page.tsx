/**
 * Settings Page
 * Linear-style settings with sidebar navigation
 * OPS-364: Settings Page Implementation
 */

'use client';

import * as React from 'react';
import { useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { User, Building2, Link2, Users, CreditCard, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';
import { PageLayout } from '@/components/linear/PageLayout';

// Lazy load settings sections
import dynamic from 'next/dynamic';

const ProfileSettings = dynamic(
  () => import('@/components/settings-v2/ProfileSettings').then((m) => m.ProfileSettings),
  { loading: () => <SettingsLoading /> }
);

const FirmSettings = dynamic(
  () => import('@/components/settings-v2/FirmSettings').then((m) => m.FirmSettings),
  { loading: () => <SettingsLoading /> }
);

const IntegrationSettings = dynamic(
  () => import('@/components/settings-v2/IntegrationSettings').then((m) => m.IntegrationSettings),
  { loading: () => <SettingsLoading /> }
);

const TeamSettings = dynamic(
  () => import('@/components/settings-v2/TeamSettings').then((m) => m.TeamSettings),
  { loading: () => <SettingsLoading /> }
);

const BillingSettings = dynamic(
  () => import('@/components/settings-v2/BillingSettings').then((m) => m.BillingSettings),
  { loading: () => <SettingsLoading /> }
);

// ====================================================================
// Types
// ====================================================================

type SettingsSection = 'profile' | 'firm' | 'integrations' | 'team' | 'billing';

interface SectionConfig {
  id: SettingsSection;
  label: string;
  icon: React.ReactNode;
  description: string;
  adminOnly?: boolean;
}

// ====================================================================
// Constants
// ====================================================================

const SECTIONS: SectionConfig[] = [
  {
    id: 'profile',
    label: 'Profil',
    icon: <User className="h-4 w-4" />,
    description: 'Informații personale și preferințe',
  },
  {
    id: 'firm',
    label: 'Firmă',
    icon: <Building2 className="h-4 w-4" />,
    description: 'Configurări firmă și branding',
    adminOnly: true,
  },
  {
    id: 'integrations',
    label: 'Integrări',
    icon: <Link2 className="h-4 w-4" />,
    description: 'Microsoft 365 și alte servicii',
  },
  {
    id: 'team',
    label: 'Echipă',
    icon: <Users className="h-4 w-4" />,
    description: 'Membri și roluri',
    adminOnly: true,
  },
  {
    id: 'billing',
    label: 'Facturare',
    icon: <CreditCard className="h-4 w-4" />,
    description: 'Tarife și setări facturare',
    adminOnly: true,
  },
];

// ====================================================================
// Loading Component
// ====================================================================

function SettingsLoading() {
  return (
    <div className="flex items-center justify-center py-12">
      <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-linear-accent border-r-transparent" />
    </div>
  );
}

// ====================================================================
// Sidebar Component
// ====================================================================

interface SettingsSidebarProps {
  sections: SectionConfig[];
  activeSection: SettingsSection;
  onSectionChange: (section: SettingsSection) => void;
}

function SettingsSidebar({ sections, activeSection, onSectionChange }: SettingsSidebarProps) {
  return (
    <nav className="w-64 flex-shrink-0 border-r border-linear-border-subtle bg-linear-bg-secondary">
      <div className="p-4">
        <h2 className="mb-4 text-lg font-semibold text-linear-text-primary">Setări</h2>
        <ul className="space-y-1">
          {sections.map((section) => (
            <li key={section.id}>
              <button
                type="button"
                onClick={() => onSectionChange(section.id)}
                className={cn(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition-colors',
                  activeSection === section.id
                    ? 'bg-linear-accent/10 text-linear-accent'
                    : 'text-linear-text-secondary hover:bg-linear-bg-tertiary hover:text-linear-text-primary'
                )}
              >
                <span
                  className={cn(
                    'flex-shrink-0',
                    activeSection === section.id
                      ? 'text-linear-accent'
                      : 'text-linear-text-tertiary'
                  )}
                >
                  {section.icon}
                </span>
                <span className="flex-1">{section.label}</span>
                {activeSection === section.id && (
                  <ChevronRight className="h-4 w-4 text-linear-accent" />
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </nav>
  );
}

// ====================================================================
// Content Area Component
// ====================================================================

interface SettingsContentProps {
  section: SectionConfig;
  children: React.ReactNode;
}

function SettingsContent({ section, children }: SettingsContentProps) {
  return (
    <div className="flex-1 overflow-auto">
      <div className="mx-auto max-w-3xl p-6">
        {/* Section Header */}
        <div className="mb-6 border-b border-linear-border-subtle pb-4">
          <div className="flex items-center gap-3">
            <span className="rounded-lg bg-linear-accent/10 p-2 text-linear-accent">
              {section.icon}
            </span>
            <div>
              <h1 className="text-xl font-semibold text-linear-text-primary">{section.label}</h1>
              <p className="text-sm text-linear-text-secondary">{section.description}</p>
            </div>
          </div>
        </div>

        {/* Section Content */}
        {children}
      </div>
    </div>
  );
}

// ====================================================================
// Main Settings Page
// ====================================================================

export default function SettingsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();

  // Set document title
  useEffect(() => {
    document.title = 'Setări';
  }, []);

  // Filter sections based on user role
  const isAdmin = user?.role === 'Partner';
  const availableSections = SECTIONS.filter((section) => !section.adminOnly || isAdmin);

  // Get active section from URL or default to first available
  const sectionParam = searchParams.get('section') as SettingsSection | null;
  const activeSection =
    sectionParam && availableSections.some((s) => s.id === sectionParam)
      ? sectionParam
      : (availableSections[0]?.id ?? 'profile');

  const activeSectionConfig = SECTIONS.find((s) => s.id === activeSection)!;

  // Handle section change
  const handleSectionChange = (section: SettingsSection) => {
    router.push(`/setari?section=${section}`);
  };

  // Render section content
  const renderContent = () => {
    switch (activeSection) {
      case 'profile':
        return <ProfileSettings />;
      case 'firm':
        return <FirmSettings />;
      case 'integrations':
        return <IntegrationSettings />;
      case 'team':
        return <TeamSettings />;
      case 'billing':
        return <BillingSettings />;
      default:
        return <ProfileSettings />;
    }
  };

  return (
    <PageLayout className="flex h-screen flex-col p-0">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <SettingsSidebar
          sections={availableSections}
          activeSection={activeSection}
          onSectionChange={handleSectionChange}
        />

        {/* Content */}
        <SettingsContent section={activeSectionConfig}>
          <React.Suspense fallback={<SettingsLoading />}>{renderContent()}</React.Suspense>
        </SettingsContent>
      </div>
    </PageLayout>
  );
}
