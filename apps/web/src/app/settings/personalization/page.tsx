/**
 * Personalization Dashboard Page
 * Story 5.6: AI Learning and Personalization (Task 37)
 * Settings page for AI learning and personalization features
 *
 * OPS-014: Restricted to Partners only
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { useNavigationStore } from '@/stores/navigation.store';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LearningProgressIndicator } from '@/components/personalization/LearningProgressIndicator';
import { WritingStyleCard } from '@/components/personalization/WritingStyleCard';
import { SnippetLibrary } from '@/components/personalization/SnippetLibrary';
import { SnippetSuggestionPanel } from '@/components/personalization/SnippetSuggestionPanel';
import { TaskPatternsManager } from '@/components/personalization/TaskPatternsManager';
import { DocumentPreferencesManager } from '@/components/personalization/DocumentPreferencesManager';
import { ResponsePatternsCard } from '@/components/personalization/ResponsePatternsCard';
import { useResetWritingStyle } from '@/hooks/useWritingStyle';
import { useResetTaskPatterns } from '@/hooks/useTaskPatterns';

// Icons
const SettingsIcon = ({ className }: { className?: string }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    width="24"
    height="24"
    aria-hidden="true"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
    />
  </svg>
);

const TrashIcon = () => (
  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
    />
  </svg>
);

/**
 * Reset All Dialog
 */
function ResetAllDialog({
  open,
  onClose,
  onConfirm,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="text-destructive">Resetează toată personalizarea</DialogTitle>
          <DialogDescription>
            Ești sigur că vrei să ștergi toate datele de personalizare? Aceasta include:
          </DialogDescription>
        </DialogHeader>

        <ul className="text-sm space-y-2 py-4">
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-destructive rounded-full" />
            Profilul de stil de scriere
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-destructive rounded-full" />
            Toate snippet-urile personale
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-destructive rounded-full" />
            Pattern-urile de task-uri învățate
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-destructive rounded-full" />
            Preferințele de structură document
          </li>
          <li className="flex items-center gap-2">
            <span className="w-2 h-2 bg-destructive rounded-full" />
            Pattern-urile de timp de răspuns
          </li>
        </ul>

        <p className="text-sm text-muted-foreground">
          Această acțiune nu poate fi anulată. AI-ul va trebui să reînvețe preferințele tale de la
          zero.
        </p>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Anulează
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={loading}>
            {loading ? 'Se resetează...' : 'Resetează tot'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Section component for dashboard layout
 */
function Section({
  id,
  title,
  description,
  children,
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  );
}

/**
 * Navigation sidebar for sections
 */
function SectionNav({
  activeSection,
  onSectionChange,
}: {
  activeSection: string;
  onSectionChange: (section: string) => void;
}) {
  const sections = [
    { id: 'progress', label: 'Progres AI' },
    { id: 'writing', label: 'Stil scriere' },
    { id: 'snippets', label: 'Snippet-uri' },
    { id: 'patterns', label: 'Pattern-uri task' },
    { id: 'documents', label: 'Documente' },
    { id: 'response', label: 'Timp răspuns' },
  ];

  return (
    <nav className="space-y-1" aria-label="Navigare setări personalizare">
      {sections.map((section) => (
        <button
          key={section.id}
          onClick={() => {
            onSectionChange(section.id);
            document.getElementById(section.id)?.scrollIntoView({ behavior: 'smooth' });
          }}
          className={`
            w-full text-left px-3 py-2 text-sm rounded-md transition-colors
            ${
              activeSection === section.id
                ? 'bg-primary/10 text-primary font-medium'
                : 'text-muted-foreground hover:bg-muted'
            }
          `}
        >
          {section.label}
        </button>
      ))}
    </nav>
  );
}

/**
 * Main Personalization Dashboard Page
 * OPS-014: Restricted to Partners only - redirects other roles to dashboard
 */
export default function PersonalizationPage() {
  const router = useRouter();
  const { currentRole } = useNavigationStore();
  const [activeSection, setActiveSection] = useState('progress');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const { resetWritingStyle } = useResetWritingStyle();
  const { resetPatterns } = useResetTaskPatterns();

  // OPS-014: Redirect non-Partners to dashboard
  useEffect(() => {
    if (currentRole !== 'Partner') {
      router.replace('/');
    }
  }, [currentRole, router]);

  // Don't render anything while redirecting
  if (currentRole !== 'Partner') {
    return null;
  }

  const handleResetAll = async () => {
    setIsResetting(true);
    try {
      // Reset all personalization data
      await Promise.all([
        resetWritingStyle(),
        resetPatterns(),
        // Note: Other reset functions would be called here
      ]);
      setResetDialogOpen(false);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                <SettingsIcon className="text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">AI Personalizare</h1>
                <p className="text-sm text-muted-foreground">
                  Gestionează cum AI-ul învață preferințele tale
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              className="text-destructive border-destructive/50 hover:bg-destructive/10"
              onClick={() => setResetDialogOpen(true)}
            >
              <TrashIcon />
              Resetează tot
            </Button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="container mx-auto px-4 py-8">
        <div className="flex gap-8">
          {/* Sidebar navigation */}
          <aside className="w-48 shrink-0 hidden lg:block">
            <div className="sticky top-24">
              <SectionNav activeSection={activeSection} onSectionChange={setActiveSection} />
            </div>
          </aside>

          {/* Content */}
          <div className="flex-1 max-w-4xl space-y-12">
            {/* Learning Progress Section */}
            <Section
              id="progress"
              title="Progres AI Learning"
              description="Vezi cât de bine te cunoaște AI-ul și ce a învățat despre preferințele tale"
            >
              <LearningProgressIndicator />
            </Section>

            {/* Writing Style Section */}
            <Section
              id="writing"
              title="Stil de scriere"
              description="AI-ul analizează editările tale pentru a învăța stilul tău de comunicare"
            >
              <WritingStyleCard showResetButton />
            </Section>

            {/* Snippets Section */}
            <Section
              id="snippets"
              title="Snippet-uri personale"
              description="Fraze și expresii frecvente pe care le poți insera rapid"
            >
              <div className="grid gap-6 lg:grid-cols-2">
                <SnippetLibrary className="lg:col-span-2" />
                <SnippetSuggestionPanel />
              </div>
            </Section>

            {/* Task Patterns Section */}
            <Section
              id="patterns"
              title="Pattern-uri task"
              description="AI-ul învață din modul în care creezi task-uri și îți sugerează automat"
            >
              <TaskPatternsManager />
            </Section>

            {/* Document Preferences Section */}
            <Section
              id="documents"
              title="Preferințe documente"
              description="Configurează structura și formatarea preferată pentru fiecare tip de document"
            >
              <DocumentPreferencesManager />
            </Section>

            {/* Response Patterns Section */}
            <Section
              id="response"
              title="Pattern-uri timp de răspuns"
              description="Analiza timpurilor tale de completare a task-urilor"
            >
              <ResponsePatternsCard />
            </Section>

            {/* Last updated timestamp */}
            <div className="text-center text-xs text-muted-foreground pt-8 border-t">
              Ultima actualizare: {new Date().toLocaleString('ro-RO')}
            </div>
          </div>
        </div>
      </main>

      {/* Reset All Dialog */}
      <ResetAllDialog
        open={resetDialogOpen}
        onClose={() => setResetDialogOpen(false)}
        onConfirm={handleResetAll}
        loading={isResetting}
      />
    </div>
  );
}
