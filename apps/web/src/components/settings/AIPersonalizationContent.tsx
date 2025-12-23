/**
 * AI Personalization Content Component
 * Story 5.6: AI Learning and Personalization
 *
 * Content for the AI Personalization tab in unified Settings page
 */

'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
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
 * AI Personalization Content
 * Rendered in the unified Settings page
 */
export default function AIPersonalizationContent() {
  const [activeSection, setActiveSection] = useState('progress');
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  const { resetWritingStyle } = useResetWritingStyle();
  const { resetPatterns } = useResetTaskPatterns();

  const handleResetAll = async () => {
    setIsResetting(true);
    try {
      await Promise.all([resetWritingStyle(), resetPatterns()]);
      setResetDialogOpen(false);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">
                Gestionează cum AI-ul învață preferințele tale
              </p>
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
      </div>

      {/* Main content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
