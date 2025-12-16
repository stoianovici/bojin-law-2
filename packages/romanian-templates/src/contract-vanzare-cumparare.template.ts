/**
 * Romanian Legal Template: Contract de Vanzare-Cumparare (Sales Purchase Agreement)
 * Story 2.12.1 - Task 5: Romanian Templates
 *
 * This template represents a standard Romanian sales-purchase agreement
 * used for the transfer of goods, real estate, or other assets.
 */

import type { RomanianTemplateDefinition } from './notificare-avocateasca.template';

export const ContractVanzareCumparareTemplate: RomanianTemplateDefinition = {
  metadata: {
    nameRo: 'Contract de Vanzare-Cumparare',
    nameEn: 'Sales Purchase Agreement',
    templateSlug: 'contract-vanzare-cumparare',
    legalCategory: 'contract',
    civilCodeReferences: [
      'Art. 1650-1766 Cod Civil (Vânzarea)',
      'Art. 1270 Cod Civil (Forma actului juridic)',
      'Art. 1350-1352 Cod Civil (Punerea în întârziere)',
      'Art. 1531-1548 Cod Civil (Răspunderea contractuală)',
    ],
    averageLength: 5,
    complexity: 'high',
  },

  structure: {
    header: {
      ro: 'CONTRACT DE VANZARE-CUMPARARE',
      en: 'SALES PURCHASE AGREEMENT',
    },

    sections: [
      {
        id: 'preambul',
        labelRo: 'Preambul',
        labelEn: 'Preamble',
        required: true,
        variables: ['{{DATA_CONTRACT}}', '{{LOCALITATE}}'],
        template: 'Încheiat astăzi, {{DATA_CONTRACT}}, în {{LOCALITATE}}, între:',
      },
      {
        id: 'parti_vanzator',
        labelRo: 'I. PĂRȚILE CONTRACTANTE - Vânzătorul',
        labelEn: 'I. CONTRACTING PARTIES - Seller',
        required: true,
        variables: [
          '{{VANZATOR_NUME}}',
          '{{VANZATOR_CNP}}',
          '{{VANZATOR_CI}}',
          '{{VANZATOR_ADRESA}}',
        ],
        template:
          'VÂNZĂTOR: {{VANZATOR_NUME}}, domiciliat în {{VANZATOR_ADRESA}}, posesor al C.I./B.I. seria {{VANZATOR_CI}}, CNP {{VANZATOR_CNP}}, denumit în continuare "Vânzător"',
      },
      {
        id: 'parti_cumparator',
        labelRo: 'PĂRȚILE CONTRACTANTE - Cumpărătorul',
        labelEn: 'CONTRACTING PARTIES - Buyer',
        required: true,
        variables: [
          '{{CUMPARATOR_NUME}}',
          '{{CUMPARATOR_CNP}}',
          '{{CUMPARATOR_CI}}',
          '{{CUMPARATOR_ADRESA}}',
        ],
        template:
          'CUMPĂRĂTOR: {{CUMPARATOR_NUME}}, domiciliat în {{CUMPARATOR_ADRESA}}, posesor al C.I./B.I. seria {{CUMPARATOR_CI}}, CNP {{CUMPARATOR_CNP}}, denumit în continuare "Cumpărător"',
      },
      {
        id: 'obiect_contract',
        labelRo: 'II. OBIECTUL CONTRACTULUI',
        labelEn: 'II. SUBJECT OF THE CONTRACT',
        required: true,
        variables: ['{{DESCRIERE_BUN}}'],
        template:
          'Prin prezentul contract, Vânzătorul transmite Cumpărătorului, în deplină proprietate, următorul bun:\n{{DESCRIERE_BUN}}',
      },
      {
        id: 'pret',
        labelRo: 'III. PREȚUL ȘI MODALITATEA DE PLATĂ',
        labelEn: 'III. PRICE AND PAYMENT TERMS',
        required: true,
        variables: ['{{PRET_TOTAL}}', '{{MONEDA}}', '{{PRET_LITERE}}', '{{MODALITATE_PLATA}}'],
        template:
          'Prețul total convenit între părți pentru bunul ce face obiectul prezentului contract este de {{PRET_TOTAL}} {{MONEDA}} ({{PRET_LITERE}}).\n\nModalitatea de plată: {{MODALITATE_PLATA}}',
      },
      {
        id: 'termene_plata',
        labelRo: 'Termene de plată',
        labelEn: 'Payment Deadlines',
        required: false,
        variables: ['{{AVANS}}', '{{DATA_SOLD}}'],
        template: 'Avans la semnare: {{AVANS}} {{MONEDA}}\nSold la data de: {{DATA_SOLD}}',
      },
      {
        id: 'garantii',
        labelRo: 'IV. GARANȚII ȘI DECLARAȚII',
        labelEn: 'IV. WARRANTIES AND REPRESENTATIONS',
        required: true,
        template:
          'Vânzătorul declară și garantează următoarele:\n- Bunul vândut este liber de orice sarcini sau ipoteci\n- Are dreptul deplin de a dispune de bunul vândut\n- Nu există litigii sau pretenții din partea terților cu privire la bunul vândut\n- Toate informațiile furnizate cu privire la bun sunt complete și corecte',
      },
      {
        id: 'predare_preluare',
        labelRo: 'V. PREDAREA-PRELUAREA BUNULUI',
        labelEn: 'V. DELIVERY AND ACCEPTANCE',
        required: true,
        variables: ['{{DATA_PREDARE}}', '{{LOC_PREDARE}}'],
        template:
          'Predarea bunului către Cumpărător se va face la data de {{DATA_PREDARE}}, la următoarea adresă: {{LOC_PREDARE}}.\n\nLa predare, părțile vor semna un proces-verbal de predare-primire.',
      },
      {
        id: 'riscuri',
        labelRo: 'VI. TRANSFERUL RISCURILOR',
        labelEn: 'VI. TRANSFER OF RISKS',
        required: true,
        template:
          'Riscul pieirii sau deteriorării bunului se transferă asupra Cumpărătorului la data predării efective a bunului, conform procesului-verbal de predare-primire.',
      },
      {
        id: 'vicii',
        labelRo: 'VII. VICII ASCUNSE',
        labelEn: 'VII. HIDDEN DEFECTS',
        required: true,
        template:
          'Vânzătorul răspunde pentru evicțiune și pentru viciile ascunse ale bunului vândut, conform prevederilor Art. 1691-1715 Cod Civil.\n\nCumpărătorul are obligația de a denunța viciile ascunse în termen de 30 de zile de la descoperire.',
      },
      {
        id: 'clauze_speciale',
        labelRo: 'VIII. CLAUZE SPECIALE',
        labelEn: 'VIII. SPECIAL CLAUSES',
        required: false,
        variables: ['{{CLAUZE_SPECIALE}}'],
        placeholder: '{{CLAUZE_SPECIALE}}',
      },
      {
        id: 'reziliere',
        labelRo: 'IX. REZILIEREA CONTRACTULUI',
        labelEn: 'IX. TERMINATION OF CONTRACT',
        required: true,
        template:
          'În cazul nerespectării obligațiilor contractuale de către una dintre părți, partea lezată are dreptul de a cere rezilierea contractului și daune-interese, conform Art. 1551-1554 Cod Civil.\n\nÎnainte de a se adresa instanței, partea interesată va pune în întârziere partea care nu și-a executat obligațiile, acordându-i un termen de minimum 15 zile pentru regularizare.',
      },
      {
        id: 'forta_majora',
        labelRo: 'X. FORȚA MAJORĂ',
        labelEn: 'X. FORCE MAJEURE',
        required: true,
        template:
          'Părțile contractante nu răspund pentru neexecutarea la termen sau executarea în mod necorespunzător, total sau parțial, a oricărei obligații ce le revine în baza prezentului contract, dacă neexecutarea obligației a fost cauzată de forță majoră.\n\nPrin forță majoră se înțelege un eveniment independent de voința părților, imprevizibil și insurmontabil, apărut după încheierea contractului și care împiedică părțile să execute total sau parțial obligațiile lor.',
      },
      {
        id: 'litigii',
        labelRo: 'XI. SOLUȚIONAREA LITIGIILOR',
        labelEn: 'XI. DISPUTE RESOLUTION',
        required: true,
        variables: ['{{INSTANTA_COMPETENTA}}'],
        template:
          'Eventualele litigii ce decurg din prezentul contract sau în legătură cu acesta vor fi soluționate pe cale amiabilă.\n\nÎn cazul în care nu se ajunge la o înțelegere amiabilă, litigiile vor fi soluționate de către {{INSTANTA_COMPETENTA}}, conform prevederilor legale în vigoare.',
      },
      {
        id: 'modificari',
        labelRo: 'XII. MODIFICĂRI ȘI COMPLETĂRI',
        labelEn: 'XII. AMENDMENTS',
        required: true,
        template:
          'Orice modificare sau completare a prezentului contract va fi valabilă numai dacă este făcută în scris, prin act adițional semnat de ambele părți.',
      },
      {
        id: 'dispozitii_finale',
        labelRo: 'XIII. DISPOZIȚII FINALE',
        labelEn: 'XIII. FINAL PROVISIONS',
        required: true,
        variables: ['{{NUMAR_EXEMPLARE}}'],
        template:
          'Prezentul contract a fost încheiat în {{NUMAR_EXEMPLARE}} exemplare originale, câte unul pentru fiecare parte contractantă.\n\nPentru orice aspect neacoperit de prezentul contract, se vor aplica prevederile Codului Civil român.',
      },
      {
        id: 'semnaturi',
        labelRo: 'SEMNĂTURI',
        labelEn: 'SIGNATURES',
        required: true,
        variables: ['{{VANZATOR_NUME}}', '{{CUMPARATOR_NUME}}', '{{DATA_SEMNARE}}'],
        template:
          'VÂNZĂTOR,                    CUMPĂRĂTOR,\n{{VANZATOR_NUME}}             {{CUMPARATOR_NUME}}\n\nSemnătură: __________        Semnătură: __________\nData: {{DATA_SEMNARE}}       Data: {{DATA_SEMNARE}}',
      },
    ],
  },

  standardClauses: {
    ro: [
      'în deplină proprietate',
      'liber de orice sarcini sau ipoteci',
      'are dreptul deplin de a dispune',
      'nu există litigii sau pretenții din partea terților',
      'proces-verbal de predare-primire',
      'răspunde pentru evicțiune și pentru viciile ascunse',
      'conform prevederilor Codului Civil',
      'în termen de 30 de zile de la descoperire',
      'partea lezată are dreptul de a cere rezilierea contractului',
      'pune în întârziere partea care nu și-a executat obligațiile',
      'forță majoră',
      'eveniment independent de voința părților',
      'pe cale amiabilă',
      'act adițional semnat de ambele părți',
      'prevederile Codului Civil român',
    ],
    en: [
      'in full ownership',
      'free of any encumbrances or mortgages',
      'has the full right to dispose',
      'there are no disputes or claims from third parties',
      'delivery-acceptance report',
      'liable for eviction and hidden defects',
      'according to the provisions of the Civil Code',
      'within 30 days from discovery',
      'the injured party has the right to request contract termination',
      'put in default the party that has not performed its obligations',
      'force majeure',
      'event independent of the will of the parties',
      'amicably',
      'additional act signed by both parties',
      'provisions of the Romanian Civil Code',
    ],
  },

  variableMappings: {
    DATA_CONTRACT: 'Contract Date',
    LOCALITATE: 'Location/City',
    VANZATOR_NUME: 'Seller Full Name',
    VANZATOR_CNP: 'Seller Personal ID Number',
    VANZATOR_CI: 'Seller ID Card Series',
    VANZATOR_ADRESA: 'Seller Address',
    CUMPARATOR_NUME: 'Buyer Full Name',
    CUMPARATOR_CNP: 'Buyer Personal ID Number',
    CUMPARATOR_CI: 'Buyer ID Card Series',
    CUMPARATOR_ADRESA: 'Buyer Address',
    DESCRIERE_BUN: 'Description of Goods/Property',
    PRET_TOTAL: 'Total Price (numeric)',
    MONEDA: 'Currency',
    PRET_LITERE: 'Total Price (in words)',
    MODALITATE_PLATA: 'Payment Method',
    AVANS: 'Down Payment Amount',
    DATA_SOLD: 'Balance Payment Date',
    DATA_PREDARE: 'Delivery Date',
    LOC_PREDARE: 'Delivery Location',
    CLAUZE_SPECIALE: 'Special Clauses',
    INSTANTA_COMPETENTA: 'Competent Court',
    NUMAR_EXEMPLARE: 'Number of Originals',
    DATA_SEMNARE: 'Signing Date',
  },
};

/**
 * Generate a formatted sales-purchase contract from the template
 */
export function generateContractVanzareCumparare(variables: Record<string, string>): string {
  const template = ContractVanzareCumparareTemplate;
  let document = '';

  // Add header
  document += `${template.structure.header.ro}\n\n`;

  // Add each section
  template.structure.sections.forEach((section) => {
    if (section.required || variables[section.id]) {
      document += `${section.labelRo}\n\n`;

      if (section.template) {
        let sectionText = section.template;

        // Replace all variables
        Object.entries(variables).forEach(([key, value]) => {
          sectionText = sectionText.replace(new RegExp(`{{${key}}}`, 'g'), value);
        });

        document += `${sectionText}\n\n`;
      } else if (section.placeholder) {
        let placeholderText = section.placeholder;

        // Replace all variables in placeholder
        Object.entries(variables).forEach(([key, value]) => {
          placeholderText = placeholderText.replace(new RegExp(`{{${key}}}`, 'g'), value);
        });

        document += `${placeholderText}\n\n`;
      }
    }
  });

  return document;
}

/**
 * Validate that all required variables are provided
 */
export function validateContractVariables(variables: Record<string, string>): {
  valid: boolean;
  missing: string[];
} {
  const template = ContractVanzareCumparareTemplate;
  const missing: string[] = [];

  template.structure.sections.forEach((section) => {
    if (section.required && section.variables) {
      section.variables.forEach((variable) => {
        const varName = variable.replace(/[{}]/g, '');
        if (!variables[varName] || variables[varName].trim() === '') {
          missing.push(varName);
        }
      });
    }
  });

  return {
    valid: missing.length === 0,
    missing: [...new Set(missing)], // Remove duplicates
  };
}
