'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useTutorialStore } from '@/store/tutorialStore';
import { useTutorial } from '@/hooks/useTutorial';
import { getStepById, isLastStep } from './steps';
import { TutorialMask } from './TutorialMask';
import { TutorialChoiceDialog } from './TutorialChoiceDialog';

// DISABLED: Tutorial feature is disabled while in development
// To re-enable, set this to false
const TUTORIAL_DISABLED = true;

export function TutorialController() {
  const router = useRouter();
  const pathname = usePathname();

  // Initialize backend sync - this auto-starts tutorial for first-time users
  useTutorial();

  const { isActive, step, litRegions, setLitRegions, addLitRegion, advanceStep, completeTutorial } =
    useTutorialStore();

  const currentStep = getStepById(step);
  const filledFieldsRef = useRef<Set<string>>(new Set());

  // Initialize lit regions when step changes
  useEffect(() => {
    if (!isActive || !currentStep) return;

    // Set initial lit regions from step targets
    setLitRegions(currentStep.targets);
    filledFieldsRef.current.clear();

    // Force scroll if needed
    if (currentStep.forceScroll) {
      const target = currentStep.targets[0];
      setTimeout(() => {
        const el = document.querySelector(`[data-tutorial="${target}"]`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 100);
    }
  }, [isActive, step, currentStep, setLitRegions]);

  // Handle navigation requirements
  useEffect(() => {
    if (!isActive || !currentStep?.navigate) return;

    // Navigate if not already on target path
    if (!pathname.startsWith(currentStep.navigate)) {
      router.push(currentStep.navigate);
    }
  }, [isActive, currentStep, pathname, router]);

  // Advance to next step or complete
  const handleAdvance = useCallback(() => {
    if (!currentStep) return;

    if (isLastStep(currentStep.id)) {
      completeTutorial();
    } else {
      advanceStep();
    }
  }, [currentStep, advanceStep, completeTutorial]);

  // Click handler for advancing steps
  const handleClick = useCallback(
    (e: MouseEvent) => {
      if (!isActive || !currentStep) return;

      const target = e.target as HTMLElement;
      const tutorialAttr = target.closest('[data-tutorial]')?.getAttribute('data-tutorial');

      if (!tutorialAttr) return;

      // Progressive reveal: clicking a dimmed element reveals it
      if (currentStep.progressiveReveal && !litRegions.includes(tutorialAttr)) {
        addLitRegion(tutorialAttr);
        return;
      }

      // Check if this click satisfies the trigger
      const trigger = currentStep.nextTrigger;
      if (trigger.type === 'click' && trigger.selector === tutorialAttr) {
        handleAdvance();
      }
    },
    [isActive, currentStep, litRegions, addLitRegion, handleAdvance]
  );

  // Input handler for fill triggers
  const handleInput = useCallback(
    (e: Event) => {
      if (!isActive || !currentStep) return;

      const trigger = currentStep.nextTrigger;
      if (trigger.type !== 'fill') return;

      const target = e.target as HTMLElement;
      const tutorialAttr = target.closest('[data-tutorial]')?.getAttribute('data-tutorial');

      if (!tutorialAttr || !trigger.selectors.includes(tutorialAttr)) return;

      // Check if field has value
      const input = target as HTMLInputElement;
      if (input.value) {
        filledFieldsRef.current.add(tutorialAttr);
      } else {
        filledFieldsRef.current.delete(tutorialAttr);
      }

      // Check if all mandatory fields are filled
      const allFilled = trigger.selectors.every((sel) => filledFieldsRef.current.has(sel));
      if (allFilled) {
        handleAdvance();
      }
    },
    [isActive, currentStep, handleAdvance]
  );

  // Submit/save handler
  const handleSubmit = useCallback(
    (_e: Event) => {
      if (!isActive || !currentStep) return;

      const trigger = currentStep.nextTrigger;
      if (trigger.type === 'save') {
        handleAdvance();
      }
    },
    [isActive, currentStep, handleAdvance]
  );

  // Handle choice selection (for step 9)
  const handleChoice = useCallback(
    (choice: 'skip' | 'continue') => {
      if (choice === 'skip') {
        completeTutorial();
      } else {
        advanceStep();
      }
    },
    [advanceStep, completeTutorial]
  );

  // Set up event listeners
  useEffect(() => {
    if (!isActive) return;

    document.addEventListener('click', handleClick, true);
    document.addEventListener('input', handleInput, true);
    document.addEventListener('submit', handleSubmit, true);

    return () => {
      document.removeEventListener('click', handleClick, true);
      document.removeEventListener('input', handleInput, true);
      document.removeEventListener('submit', handleSubmit, true);
    };
  }, [isActive, handleClick, handleInput, handleSubmit]);

  // Kill switch - completely disable tutorial (must be after all hooks)
  if (TUTORIAL_DISABLED) return null;

  if (!isActive) return null;

  return (
    <>
      <TutorialMask />
      {currentStep?.showChoiceDialog && <TutorialChoiceDialog onChoice={handleChoice} />}
    </>
  );
}
