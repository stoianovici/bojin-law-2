'use client';

import { cn } from '@/lib/utils';
import type { Mapa } from '@/types/mapa';
import { mapaCategories } from '@/types/mapa';

interface MapaCoverPageProps {
  mapa: Mapa;
  caseName: string;
  firmName?: string;
  className?: string;
}

/**
 * Cover page component for mapa print preview
 * This is a React component for use in previews - actual printing uses generateMapaPrintHtml
 */
export function MapaCoverPage({
  mapa,
  caseName,
  firmName = 'Cabinet de Avocatură',
  className,
}: MapaCoverPageProps) {
  const printDate = new Date().toLocaleDateString('ro-RO', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Group slots by category
  const groupedSlots: Record<string, typeof mapa.slots> = {};
  mapa.slots.forEach((slot) => {
    if (!groupedSlots[slot.category]) {
      groupedSlots[slot.category] = [];
    }
    groupedSlots[slot.category].push(slot);
  });

  // Get category display name
  const getCategoryName = (categoryId: string) => {
    const cat = mapaCategories.find((c) => c.id === categoryId);
    return cat ? cat.name : categoryId;
  };

  return (
    <div
      className={cn(
        'bg-white text-black p-8 print:p-0',
        'min-h-[297mm] w-[210mm] mx-auto',
        'flex flex-col font-serif',
        className
      )}
    >
      {/* Firm Header */}
      <header className="text-center mb-16 pb-6 border-b-2 border-black">
        <h1 className="text-2xl font-bold uppercase tracking-widest">{firmName}</h1>
      </header>

      {/* Mapa Info */}
      <div className="text-center mb-12">
        <h2 className="text-xl font-bold mb-3">{mapa.name}</h2>
        {mapa.description && <p className="text-gray-600 mb-6">{mapa.description}</p>}
        <div className="text-lg">
          <span className="font-bold">Dosar:</span> <span>{caseName}</span>
        </div>
      </div>

      {/* Completion Summary */}
      <div className="bg-gray-100 p-6 rounded mb-12">
        <h3 className="text-center font-bold mb-4">Sumar Completare</h3>

        <div className="flex justify-around mb-4">
          <div className="text-center">
            <span className="block text-3xl font-bold">{mapa.completionStatus.filledSlots}</span>
            <span className="text-sm text-gray-600">Documente completate</span>
          </div>
          <div className="text-center">
            <span className="block text-3xl font-bold">{mapa.completionStatus.totalSlots}</span>
            <span className="text-sm text-gray-600">Total sloturi</span>
          </div>
          <div className="text-center">
            <span className="block text-3xl font-bold">
              {mapa.completionStatus.percentComplete}%
            </span>
            <span className="text-sm text-gray-600">Progres</span>
          </div>
        </div>

        {mapa.completionStatus.missingRequired.length > 0 ? (
          <div className="bg-yellow-100 border-l-4 border-yellow-500 p-4 mt-4">
            <span className="font-bold text-yellow-800">Documente obligatorii lipsă:</span>
            <ul className="mt-2 ml-4 list-disc text-yellow-800">
              {mapa.completionStatus.missingRequired.map((name, idx) => (
                <li key={idx}>{name}</li>
              ))}
            </ul>
          </div>
        ) : (
          <div className="bg-green-100 border-l-4 border-green-500 p-4 mt-4 text-center">
            <span className="font-bold text-green-800">
              Toate documentele obligatorii sunt completate
            </span>
          </div>
        )}
      </div>

      {/* Table of Contents */}
      <div className="flex-grow">
        <h3 className="font-bold mb-4">Cuprins</h3>
        <ol className="list-decimal ml-6 space-y-2">
          {Object.entries(groupedSlots).map(([categoryId, slots]) => (
            <li key={categoryId}>
              <span className="font-bold">{getCategoryName(categoryId)}</span>{' '}
              <span className="text-gray-600 text-sm">({slots.length} documente)</span>
            </li>
          ))}
        </ol>
      </div>

      {/* Print Footer */}
      <footer className="text-center pt-6 border-t border-gray-300 text-sm text-gray-600">
        <span>Tipărit la: {printDate}</span>
      </footer>
    </div>
  );
}

/**
 * Table of contents item for the cover page
 */
interface TocItemProps {
  number: number;
  title: string;
  count: number;
}

export function MapaCoverPageTocItem({ number, title, count }: TocItemProps) {
  return (
    <li className="flex items-baseline">
      <span className="font-bold mr-2">{number}.</span>
      <span className="font-bold flex-grow">{title}</span>
      <span className="text-gray-600 text-sm">({count} documente)</span>
    </li>
  );
}
