'use client';

import { Button } from '@/components/ui/button';

interface TutorialChoiceDialogProps {
  onChoice: (choice: 'skip' | 'continue') => void;
}

export function TutorialChoiceDialog({ onChoice }: TutorialChoiceDialogProps) {
  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[9999]"
      data-tutorial="choice-word-online"
    >
      <div className="bg-linear-bg-elevated border border-linear-border-subtle rounded-lg shadow-lg p-6 max-w-md mx-4">
        <h2 className="text-lg font-normal text-linear-text-primary mb-2">Continuați cu mape?</h2>
        <p className="text-sm text-linear-text-secondary mb-6">
          Mapele vă permit să generați documente pre-completate din șabloane. Puteți sări peste
          acest pas și să explorați singur mai târziu.
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => onChoice('skip')}>
            Sari peste
          </Button>
          <Button onClick={() => onChoice('continue')}>Continuă cu mape</Button>
        </div>
      </div>
    </div>
  );
}
