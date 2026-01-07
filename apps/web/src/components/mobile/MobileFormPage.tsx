'use client';

import { ChevronLeft, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface MobileFormPageProps {
  title: string;
  children: React.ReactNode;
  onSubmit: () => void;
  submitLabel?: string;
  isSubmitting?: boolean;
  isValid?: boolean;
}

export function MobileFormPage({
  title,
  children,
  onSubmit,
  submitLabel = 'Salvează',
  isSubmitting = false,
  isValid = true,
}: MobileFormPageProps) {
  const router = useRouter();

  const handleBack = () => {
    router.back();
  };

  return (
    <div className="animate-fadeIn min-h-screen flex flex-col">
      {/* Header */}
      <header className="flex items-center gap-3 px-6 pt-12 pb-4 border-b border-mobile-border-subtle">
        <button
          onClick={handleBack}
          className="w-8 h-8 -ml-2 flex items-center justify-center text-mobile-text-secondary rounded-lg hover:bg-mobile-bg-hover transition-colors"
        >
          <ChevronLeft className="w-5 h-5" strokeWidth={2} />
        </button>
        <h1 className="flex-1 text-[17px] font-medium tracking-[-0.02em]">{title}</h1>
      </header>

      {/* Content */}
      <main className="flex-1 px-6 py-6 pb-32">{children}</main>

      {/* Bottom Action Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-mobile-bg-primary border-t border-mobile-border px-6 py-4 pb-8 z-50">
        <button
          onClick={onSubmit}
          disabled={isSubmitting || !isValid}
          className={cn(
            'w-full py-3.5 rounded-[12px] font-normal text-[15px] transition-all',
            'flex items-center justify-center gap-2',
            isValid && !isSubmitting
              ? 'bg-mobile-text-primary text-mobile-bg-primary active:scale-[0.98]'
              : 'bg-mobile-bg-elevated text-mobile-text-tertiary cursor-not-allowed'
          )}
        >
          {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
          {submitLabel}
        </button>
      </div>
    </div>
  );
}
