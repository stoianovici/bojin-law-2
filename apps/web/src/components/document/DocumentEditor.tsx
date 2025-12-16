/**
 * Document Editor Component
 * Mock document editor with line numbers and Romanian legal content
 */

'use client';

import React from 'react';

export interface DocumentEditorProps {
  content?: string;
  onContentChange?: (content: string) => void;
  formatting?: {
    bold?: boolean;
    italic?: boolean;
    underline?: boolean;
    strikethrough?: boolean;
  };
  alignment?: 'left' | 'center' | 'right' | 'justify';
  heading?: 'h1' | 'h2' | 'h3' | 'normal';
}

const DEFAULT_CONTENT = `CONTRACT DE PRESTĂRI SERVICII JURIDICE

Număr: 2024/123
Data: 15 noiembrie 2024

ÎNTRE:

PĂRȚILE CONTRACTANTE:

1. Cabinet de Avocat "Bojin & Asociații" S.R.L., cu sediul în București, Sector 1, Strada Aviatorilor nr. 42, înregistrată la Registrul Comerțului sub nr. J40/1234/2020, CIF RO12345678, reprezentată legal prin avocat Mihai Bojin, în calitate de PRESTATOR,

și

2. SC "Tech Solutions" S.R.L., cu sediul în București, Sector 2, Calea Victoriei nr. 155, înregistrată la Registrul Comerțului sub nr. J40/5678/2018, CIF RO87654321, reprezentată legal prin Director General Elena Popescu, în calitate de BENEFICIAR.

AU CONVENIT CU PRIVIRE LA URMĂTOARELE CLAUZE:

ARTICOLUL 1 - OBIECTUL CONTRACTULUI

1.1. Prestatorul se obligă să furnizeze Beneficiarului servicii de consultanță juridică în următoarele domenii:
   a) Drept comercial și societar
   b) Drept al muncii
   c) Protecția datelor cu caracter personal (GDPR)
   d) Contracte și litigii comerciale

1.2. Serviciile includ, dar nu se limitează la: consultanță juridică curentă, redactarea și revizuirea contractelor, reprezentare în fața autorităților și instanțelor judecătorești.

ARTICOLUL 2 - DURATA CONTRACTULUI

2.1. Prezentul contract intră în vigoare la data de 1 decembrie 2024 și este valabil pe o perioadă de 12 (douăsprezece) luni.

2.2. Contractul se prelungește automat cu perioade succesive de 12 luni, cu excepția cazului în care una dintre părți notifică în scris intenția de reziliere cu cel puțin 60 de zile înainte de expirarea perioadei curente.

ARTICOLUL 3 - ONORARIUL ȘI MODALITATEA DE PLATĂ

3.1. Pentru serviciile prestate, Beneficiarul se obligă să plătească Prestatorului un onorariu lunar de 5.000 EUR (cinci mii euro), plătibil până la data de 5 a fiecărei luni.

3.2. Onorariul nu include taxele judiciare, taxele de timbru, cheltuielile de deplasare sau alte cheltuieli necesare pentru îndeplinirea serviciilor, care vor fi facturate separat.

3.3. În cazul nerespectării termenului de plată, Beneficiarul datorează penalități de întârziere calculate conform art. 3 din OUG 13/2011.

ARTICOLUL 4 - CONFIDENȚIALITATE

4.1. Prestatorul se obligă să păstreze confidențialitatea asupra tuturor informațiilor primite de la Beneficiar în cadrul executării prezentului contract.

4.2. Obligația de confidențialitate rămâne în vigoare și după încetarea contractului, pe o perioadă de 5 (cinci) ani.

ARTICOLUL 5 - REZILIEREA CONTRACTULUI

5.1. Prezentul contract poate fi reziliat de orice parte, printr-o notificare scrisă transmisă cu 30 de zile înainte.

5.2. În caz de încălcare gravă a obligațiilor contractuale, partea prejudiciată poate rezilia contractul cu efect imediat.

ARTICOLUL 6 - LITIGII

6.1. Orice litigiu decurgând din prezentul contract va fi soluționat pe cale amiabilă. În cazul în care părțile nu ajung la o înțelegere, litigiul va fi supus instanțelor competente de la sediul Prestatorului.

ARTICOLUL 7 - DISPOZIȚII FINALE

7.1. Prezentul contract a fost încheiat în 2 (două) exemplare originale, câte unul pentru fiecare parte.

7.2. Orice modificare a prezentului contract se va face prin act adițional semnat de ambele părți.

PRESTATOR                                    BENEFICIAR
Cabinet de Avocat "Bojin & Asociații"       SC "Tech Solutions" S.R.L.
Avocat Mihai Bojin                          Director General Elena Popescu

Semnătură: _________________                Semnătură: _________________
Data: _________________                     Data: _________________
Ștampilă                                    Ștampilă`;

export function DocumentEditor({
  content = DEFAULT_CONTENT,
  onContentChange,
  formatting,
  alignment = 'left',
  heading = 'normal',
}: DocumentEditorProps) {
  const editorRef = React.useRef<HTMLDivElement>(null);
  const [lines, setLines] = React.useState<string[]>([]);

  // Split content into lines for line number display
  React.useEffect(() => {
    const contentLines = content.split('\n');
    setLines(contentLines);
  }, [content]);

  // Handle content changes
  const handleInput = (e: React.FormEvent<HTMLDivElement>) => {
    const newContent = e.currentTarget.textContent || '';
    onContentChange?.(newContent);
  };

  // Apply formatting styles
  const getFormattingClasses = () => {
    const classes: string[] = [];

    if (formatting?.bold) classes.push('font-bold');
    if (formatting?.italic) classes.push('italic');
    if (formatting?.underline) classes.push('underline');
    if (formatting?.strikethrough) classes.push('line-through');

    return classes.join(' ');
  };

  // Apply alignment styles
  const getAlignmentClass = () => {
    switch (alignment) {
      case 'left':
        return 'text-left';
      case 'center':
        return 'text-center';
      case 'right':
        return 'text-right';
      case 'justify':
        return 'text-justify';
      default:
        return 'text-left';
    }
  };

  // Apply heading styles
  const getHeadingClass = () => {
    switch (heading) {
      case 'h1':
        return 'text-3xl font-bold';
      case 'h2':
        return 'text-2xl font-bold';
      case 'h3':
        return 'text-xl font-bold';
      case 'normal':
      default:
        return 'text-base';
    }
  };

  return (
    <div className="flex h-full bg-white border border-gray-200 rounded-lg overflow-hidden">
      {/* Line Numbers Gutter */}
      <div className="flex-shrink-0 w-16 bg-gray-50 border-r border-gray-200 py-4 px-2 overflow-hidden">
        <div className="text-right text-xs font-mono text-gray-500 leading-[1.6]">
          {lines.map((_, index) => (
            <div key={index} className="h-[25.6px] select-none" style={{ lineHeight: '1.6' }}>
              {index + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Editor Content */}
      <div className="flex-1 overflow-auto">
        <div
          ref={editorRef}
          className={`
            min-h-full p-6 outline-none
            text-base leading-[1.6]
            font-sans
            ${getFormattingClasses()}
            ${getAlignmentClass()}
            ${getHeadingClass()}
          `}
          contentEditable
          suppressContentEditableWarning
          onInput={handleInput}
          role="textbox"
          aria-label="Editor document"
          aria-multiline="true"
          spellCheck={false}
          style={{
            fontSize: '16px',
            lineHeight: '1.6',
            whiteSpace: 'pre-wrap',
            wordWrap: 'break-word',
          }}
        >
          {content}
        </div>
      </div>
    </div>
  );
}
