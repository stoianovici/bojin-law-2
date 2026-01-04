'use client';

interface InlineErrorProps {
  message: string;
  onRetry: () => void;
}

export function InlineError({ message, onRetry }: InlineErrorProps) {
  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-center">
      <p className="text-red-400 mb-3">{message}</p>
      <button onClick={onRetry} className="text-blue-500 font-medium">
        Încearcă din nou
      </button>
    </div>
  );
}
