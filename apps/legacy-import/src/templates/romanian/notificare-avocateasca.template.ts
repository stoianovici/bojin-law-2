/**
 * Romanian Legal Template: Notificare Avocateasca (Legal Notice)
 * Story 2.12.1 - Task 5: Romanian Templates
 *
 * This template represents a standard Romanian legal notice used in legal correspondence
 * to formally notify parties of legal obligations, claims, or demands.
 */

export interface RomanianTemplateDefinition {
  metadata: {
    nameRo: string;
    nameEn: string;
    templateSlug: string;
    legalCategory: string;
    civilCodeReferences: string[];
    averageLength: number; // pages
    complexity: 'low' | 'medium' | 'high';
  };
  structure: {
    header: {
      ro: string;
      en: string;
    };
    sections: TemplateSection[];
  };
  standardClauses: {
    ro: string[];
    en: string[];
  };
  variableMappings: Record<string, string>;
}

export interface TemplateSection {
  id: string;
  labelRo: string;
  labelEn: string;
  required: boolean;
  variables?: string[];
  template?: string;
  references?: string[];
  placeholder?: string;
}

export const NotificareAvocateascaTemplate: RomanianTemplateDefinition = {
  metadata: {
    nameRo: 'Notificare Avocateasca',
    nameEn: 'Legal Notice',
    templateSlug: 'notificare-avocateasca',
    legalCategory: 'correspondence',
    civilCodeReferences: [
      'Art. 1350 Cod Civil',
      'Art. 1516 Cod Civil',
      'Art. 1350-1352 Cod Civil (Punerea în întârziere)',
    ],
    averageLength: 2,
    complexity: 'medium',
  },

  structure: {
    header: {
      ro: 'NOTIFICARE AVOCATEASCA',
      en: 'LEGAL NOTICE',
    },

    sections: [
      {
        id: 'emitent',
        labelRo: 'Emitent',
        labelEn: 'Sender',
        required: true,
        variables: ['{{FIRMA_NUME}}', '{{FIRMA_CUI}}', '{{FIRMA_ADRESA}}'],
        template:
          'Subscrisa {{FIRMA_NUME}}, societate comercială cu sediul în {{FIRMA_ADRESA}}, cod unic de înregistrare {{FIRMA_CUI}}',
      },
      {
        id: 'reprezentare',
        labelRo: 'Reprezentare legală',
        labelEn: 'Legal Representation',
        required: true,
        variables: ['{{AVOCAT_NUME}}', '{{BAROUL}}'],
        template:
          'prin avocat {{AVOCAT_NUME}}, înscris în {{BAROUL}}, cu sediul profesional în {{AVOCAT_ADRESA}}',
      },
      {
        id: 'destinatar',
        labelRo: 'Către',
        labelEn: 'To',
        required: true,
        variables: ['{{DESTINATAR_NUME}}', '{{DESTINATAR_ADRESA}}'],
        template: 'Către: {{DESTINATAR_NUME}}\nCu sediul/domiciliul în: {{DESTINATAR_ADRESA}}',
      },
      {
        id: 'referinta',
        labelRo: 'Referitor la',
        labelEn: 'Regarding',
        required: true,
        variables: ['{{OBIECT_NOTIFICARE}}'],
        template: 'Referitor la: {{OBIECT_NOTIFICARE}}',
      },
      {
        id: 'preambul',
        labelRo: 'Adresare formală',
        labelEn: 'Formal Address',
        required: true,
        template: 'Stimată Doamnă/Stimate Domn,',
      },
      {
        id: 'expunere',
        labelRo: 'Expunerea situației de fapt',
        labelEn: 'Statement of Facts',
        required: true,
        variables: ['{{DESCRIERE_FAPT}}', '{{DATA_FAPT}}'],
        placeholder:
          'Prin prezenta vă aducem la cunoștință faptul că, la data de {{DATA_FAPT}}, {{DESCRIERE_FAPT}}.',
      },
      {
        id: 'temei_legal',
        labelRo: 'Temeiul legal',
        labelEn: 'Legal Basis',
        required: true,
        references: ['Art. 1350 Cod Civil', 'Art. 1516 Cod Civil'],
        placeholder:
          'Potrivit prevederilor Art. 1350 Cod Civil, debitorul este pus în întârziere prin...',
      },
      {
        id: 'solicitare',
        labelRo: 'Solicităm',
        labelEn: 'We Request',
        required: true,
        variables: ['{{ACTIUNE_SOLICITATA}}', '{{TERMEN_CONFORMARE}}'],
        template:
          'Prin prezenta, vă solicităm ca, în termen de {{TERMEN_CONFORMARE}} zile de la primirea prezentei notificări, să {{ACTIUNE_SOLICITATA}}.',
      },
      {
        id: 'suma_cuantum',
        labelRo: 'Sumă/cuantum',
        labelEn: 'Amount',
        required: false,
        variables: ['{{SUMA_SOLICITATA}}', '{{MONEDA}}'],
        template: 'în cuantum de {{SUMA_SOLICITATA}} {{MONEDA}}',
      },
      {
        id: 'avertisment',
        labelRo: 'În caz contrar',
        labelEn: 'Otherwise',
        required: true,
        template:
          'În cazul în care nu veți da curs prezentei notificări în termenul acordat, vom fi nevoiți să ne adresăm instanței competente în vederea protejării drepturilor și intereselor clientului nostru.',
      },
      {
        id: 'consecinte',
        labelRo: 'Consecințe juridice',
        labelEn: 'Legal Consequences',
        required: false,
        template:
          'Facem precizarea că, în acest caz, veți fi obligat(ă) la plata cheltuielilor de judecată, inclusiv onorariul avocațial, precum și a dobânzilor legale/penalităților de întârziere calculate de la data scadenței obligației până la data plății efective.',
      },
      {
        id: 'dovezi',
        labelRo: 'Documente anexate',
        labelEn: 'Attached Documents',
        required: false,
        variables: ['{{LISTA_ANEXE}}'],
        template: 'În susținerea celor de mai sus, anexăm prezentei:\n{{LISTA_ANEXE}}',
      },
      {
        id: 'inchidere',
        labelRo: 'Formula de încheiere',
        labelEn: 'Closing Formula',
        required: true,
        template: 'Cu stimă,',
      },
      {
        id: 'semnatura',
        labelRo: 'Semnătură',
        labelEn: 'Signature',
        required: true,
        variables: ['{{AVOCAT_NUME}}', '{{DATA_EMITERII}}'],
        template: 'Avocat {{AVOCAT_NUME}}\nData: {{DATA_EMITERII}}',
      },
    ],
  },

  standardClauses: {
    ro: [
      'în termen de 15 zile de la primirea prezentei',
      'sub sancțiunea decăderii din drepturi',
      'vom fi nevoiți să ne adresăm instanței competente',
      'în vederea protejării drepturilor și intereselor',
      'veți fi obligat la plata cheltuielilor de judecată',
      'precum și a dobânzilor legale',
      'calculate de la data scadenței obligației',
      'până la data plății efective',
      'potrivit prevederilor legale în vigoare',
      'conform dispozițiilor Codului Civil',
    ],
    en: [
      'within 15 days from receipt of this notice',
      'under penalty of forfeiture of rights',
      'we will be forced to address the competent court',
      'in order to protect the rights and interests',
      'you will be obliged to pay legal costs',
      'as well as legal interest',
      'calculated from the due date of the obligation',
      'until the date of effective payment',
      'according to the legal provisions in force',
      'according to the provisions of the Civil Code',
    ],
  },

  variableMappings: {
    FIRMA_NUME: 'Company Name',
    FIRMA_CUI: 'Tax Registration Number',
    FIRMA_ADRESA: 'Company Address',
    AVOCAT_NUME: 'Attorney Name',
    BAROUL: 'Bar Association',
    AVOCAT_ADRESA: 'Attorney Office Address',
    DESTINATAR_NUME: 'Recipient Name',
    DESTINATAR_ADRESA: 'Recipient Address',
    OBIECT_NOTIFICARE: 'Subject of Notice',
    DESCRIERE_FAPT: 'Description of Facts',
    DATA_FAPT: 'Date of Event',
    ACTIUNE_SOLICITATA: 'Requested Action',
    TERMEN_CONFORMARE: 'Compliance Deadline (days)',
    SUMA_SOLICITATA: 'Requested Amount',
    MONEDA: 'Currency',
    LISTA_ANEXE: 'List of Attachments',
    DATA_EMITERII: 'Issuance Date',
  },
};

/**
 * Generate a formatted legal notice document from the template
 */
export function generateNotificareAvocateasca(variables: Record<string, string>): string {
  const template = NotificareAvocateascaTemplate;
  let document = '';

  // Add header
  document += `${template.structure.header.ro}\n\n`;

  // Add each section
  template.structure.sections.forEach((section) => {
    if (section.required || variables[section.id]) {
      document += `${section.labelRo}:\n`;

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
export function validateNotificareVariables(variables: Record<string, string>): {
  valid: boolean;
  missing: string[];
} {
  const template = NotificareAvocateascaTemplate;
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
