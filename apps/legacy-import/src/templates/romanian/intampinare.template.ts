/**
 * Romanian Legal Template: Intampinare (Statement of Defense)
 * Story 2.12.1 - Task 5: Romanian Templates
 *
 * This template represents a standard Romanian statement of defense (întâmpinare)
 * filed in response to a lawsuit, used to contest claims and present defense arguments.
 */

import { RomanianTemplateDefinition, TemplateSection } from './notificare-avocateasca.template';

export const IntampinareTemplate: RomanianTemplateDefinition = {
  metadata: {
    nameRo: 'Intampinare',
    nameEn: 'Statement of Defense',
    templateSlug: 'intampinare',
    legalCategory: 'court_filing',
    civilCodeReferences: [
      'Art. 205-208 Cod Procedură Civilă (Întâmpinarea)',
      'Art. 22 Cod Procedură Civilă (Principiul contradictorialității)',
      'Art. 249-260 Cod Procedură Civilă (Dovezile)',
      'Art. 453-476 Cod Procedură Civilă (Căile de atac)',
    ],
    averageLength: 8,
    complexity: 'high',
  },

  structure: {
    header: {
      ro: 'ÎNTÂMPINARE',
      en: 'STATEMENT OF DEFENSE',
    },

    sections: [
      {
        id: 'instanta',
        labelRo: 'Către',
        labelEn: 'To',
        required: true,
        variables: ['{{INSTANTA_NUME}}', '{{INSTANTA_ADRESA}}'],
        template: 'Către: {{INSTANTA_NUME}}\nCu sediul în: {{INSTANTA_ADRESA}}',
      },
      {
        id: 'dosar',
        labelRo: 'Dosar nr.',
        labelEn: 'Case No.',
        required: true,
        variables: ['{{DOSAR_NR}}', '{{AN}}'],
        template: 'Dosar nr. {{DOSAR_NR}}/{{AN}}',
      },
      {
        id: 'parat',
        labelRo: 'Pârât',
        labelEn: 'Defendant',
        required: true,
        variables: [
          '{{PARAT_NUME}}',
          '{{PARAT_CNP}}',
          '{{PARAT_ADRESA}}',
          '{{PARAT_AVOCAT}}',
        ],
        template:
          'Pârât: {{PARAT_NUME}}, domiciliat în {{PARAT_ADRESA}}, CNP {{PARAT_CNP}}\nPrin avocat: {{PARAT_AVOCAT}}',
      },
      {
        id: 'reclamant',
        labelRo: 'împotriva',
        labelEn: 'Against',
        required: true,
        variables: ['{{RECLAMANT_NUME}}', '{{RECLAMANT_ADRESA}}'],
        template:
          'împotriva\n\nReclamant: {{RECLAMANT_NUME}}, domiciliat în {{RECLAMANT_ADRESA}}',
      },
      {
        id: 'obiect',
        labelRo: 'Obiect',
        labelEn: 'Subject Matter',
        required: true,
        variables: ['{{OBIECT_ACTIUNE}}'],
        template: 'Obiect: {{OBIECT_ACTIUNE}}',
      },
      {
        id: 'valoare',
        labelRo: 'Valoare',
        labelEn: 'Value',
        required: false,
        variables: ['{{VALOARE}}', '{{MONEDA}}'],
        template: 'Valoare: {{VALOARE}} {{MONEDA}}',
      },
      {
        id: 'introducere',
        labelRo: 'STIMATĂ INSTANȚĂ,',
        labelEn: 'HONORABLE COURT,',
        required: true,
        template: 'STIMATĂ INSTANȚĂ,',
      },
      {
        id: 'preambul',
        labelRo: 'Preambul',
        labelEn: 'Preamble',
        required: true,
        variables: ['{{DATA_CITARE}}', '{{DATA_TERMEN}}'],
        template:
          'Prin prezenta întâmpinare, formulată în temeiul art. 205-208 C.proc.civ., în contradictorialitate cu cererea de chemare în judecată înregistrată sub nr. {{DOSAR_NR}}/{{AN}}, ne permitem să aducem la cunoștința instanței următoarele:',
      },
      {
        id: 'exceptii',
        labelRo: 'I. EXCEPȚII',
        labelEn: 'I. PRELIMINARY OBJECTIONS',
        required: false,
        variables: ['{{EXCEPTII}}'],
        placeholder:
          'În principiu, invocăm următoarele excepții:\n\n{{EXCEPTII}}',
      },
      {
        id: 'exceptii_standard',
        labelRo: 'Excepții procedurale',
        labelEn: 'Procedural Objections',
        required: false,
        template:
          '1.1. Excepția lipsei calității procesuale active\n1.2. Excepția lipsei calității procesuale pasive\n1.3. Excepția lipsei de interes\n1.4. Excepția litispendenței\n1.5. Excepția autorității de lucru judecat\n1.6. Excepția prescripției dreptului material la acțiune',
      },
      {
        id: 'fond',
        labelRo: 'II. PE FONDUL CAUZEI',
        labelEn: 'II. ON THE MERITS',
        required: true,
        template: 'II. PE FONDUL CAUZEI',
      },
      {
        id: 'expunere_fapt',
        labelRo: 'A. Expunerea situației de fapt',
        labelEn: 'A. Statement of Facts',
        required: true,
        variables: ['{{EXPUNERE_FAPT_PARAT}}'],
        placeholder:
          'Din analiza cererii de chemare în judecată, constatăm că reclamantul prezintă situația de fapt într-o manieră eronată și incompletă.\n\nRealitatea faptică este următoarea:\n\n{{EXPUNERE_FAPT_PARAT}}',
      },
      {
        id: 'aparare_juridi ca',
        labelRo: 'B. Apărarea juridică',
        labelEn: 'B. Legal Defense',
        required: true,
        variables: ['{{APARARE_JURIDICA}}'],
        placeholder:
          'Din punct de vedere juridic, susținem că:\n\n{{APARARE_JURIDICA}}',
      },
      {
        id: 'critica_cerere',
        labelRo: 'C. Critica cererii de chemare în judecată',
        labelEn: 'C. Criticism of the Complaint',
        required: true,
        variables: ['{{CRITICA_CERERE}}'],
        placeholder:
          'Cererea de chemare în judecată formulată de reclamant este nefondată, atât în fapt, cât și în drept, pentru următoarele considerente:\n\n{{CRITICA_CERERE}}',
      },
      {
        id: 'dovezi_contrare',
        labelRo: 'III. DOVEZI',
        labelEn: 'III. EVIDENCE',
        required: true,
        variables: ['{{PROBE_ADMINISTRARE}}'],
        template:
          'În susținerea apărărilor formulate, solicităm administrarea următoarelor probe:\n\n{{PROBE_ADMINISTRARE}}',
      },
      {
        id: 'probe_tip',
        labelRo: 'Categorii de probe',
        labelEn: 'Types of Evidence',
        required: false,
        template:
          '- Proba cu înscrisuri (anexate prezentei întâmpinări)\n- Proba testimonială (lista martorilor anexată)\n- Expertiza tehnică/contabilă\n- Interogatoriul părților\n- Cercetarea la fața locului',
      },
      {
        id: 'cereri',
        labelRo: 'IV. CERERI',
        labelEn: 'IV. REQUESTS',
        required: true,
        template:
          'În lumina celor expuse mai sus și a probelor ce urmează a fi administrate, solicităm instanței să dispună:',
      },
      {
        id: 'cerere_principala',
        labelRo: 'Cerere principală',
        labelEn: 'Principal Request',
        required: true,
        template:
          '1. RESPINGEREA cererii de chemare în judecată ca nefondată, atât în fapt, cât și în drept;',
      },
      {
        id: 'cerere_cheltuieli',
        labelRo: 'Cerere cheltuieli judiciare',
        labelEn: 'Request for Legal Costs',
        required: true,
        template:
          '2. OBLIGAREA reclamantului la plata cheltuielilor de judecată ocazionate de prezentul proces, inclusiv onorariul avocațial;',
      },
      {
        id: 'cereri_accesorii',
        labelRo: 'Cereri accesorii',
        labelEn: 'Ancillary Requests',
        required: false,
        variables: ['{{CERERI_ACCESORII}}'],
        placeholder: '3. {{CERERI_ACCESORII}}',
      },
      {
        id: 'incheiere',
        labelRo: 'Formula de încheiere',
        labelEn: 'Closing Formula',
        required: true,
        template:
          'Cu deplină încredere în echitatea și imparțialitatea instanței, ne exprimăm convingerea că prezentele apărări vor fi primite și că cererea reclamantului va fi respinsă.',
      },
      {
        id: 'anexe',
        labelRo: 'ANEXE',
        labelEn: 'ATTACHMENTS',
        required: false,
        variables: ['{{LISTA_ANEXE}}'],
        template: 'ANEXE:\n{{LISTA_ANEXE}}',
      },
      {
        id: 'semnatura',
        labelRo: 'Semnătură',
        labelEn: 'Signature',
        required: true,
        variables: ['{{PARAT_AVOCAT}}', '{{DATA_DEPUNERE}}'],
        template:
          'Avocat,\n{{PARAT_AVOCAT}}\n\nSemnătură: __________\nData: {{DATA_DEPUNERE}}',
      },
    ],
  },

  standardClauses: {
    ro: [
      'în temeiul art. 205-208 C.proc.civ.',
      'în contradictorialitate cu cererea de chemare în judecată',
      'excepția lipsei calității procesuale',
      'excepția lipsei de interes',
      'excepția prescripției dreptului material la acțiune',
      'excepția autorității de lucru judecat',
      'situația de fapt prezentată într-o manieră eronată',
      'nefondată, atât în fapt, cât și în drept',
      'în susținerea apărărilor formulate',
      'solicităm administrarea următoarelor probe',
      'proba cu înscrisuri',
      'proba testimonială',
      'expertiza tehnică',
      'interogatoriul părților',
      'respingerea cererii de chemare în judecată',
      'obligarea la plata cheltuielilor de judecată',
      'inclusiv onorariul avocațial',
      'cu deplină încredere în echitatea instanței',
    ],
    en: [
      'pursuant to art. 205-208 Civil Procedure Code',
      'in contradiction to the complaint',
      'objection of lack of standing',
      'objection of lack of interest',
      'objection of prescription of substantive right to action',
      'objection of res judicata',
      'facts presented in an erroneous manner',
      'unfounded, both in fact and in law',
      'in support of the defenses formulated',
      'we request the administration of the following evidence',
      'documentary evidence',
      'testimonial evidence',
      'technical expertise',
      'interrogation of the parties',
      'dismissal of the complaint',
      'obligation to pay legal costs',
      'including attorney fees',
      'with full confidence in the fairness of the court',
    ],
  },

  variableMappings: {
    INSTANTA_NUME: 'Court Name',
    INSTANTA_ADRESA: 'Court Address',
    DOSAR_NR: 'Case Number',
    AN: 'Year',
    PARAT_NUME: 'Defendant Full Name',
    PARAT_CNP: 'Defendant Personal ID Number',
    PARAT_ADRESA: 'Defendant Address',
    PARAT_AVOCAT: 'Defense Attorney Name',
    RECLAMANT_NUME: 'Plaintiff Full Name',
    RECLAMANT_ADRESA: 'Plaintiff Address',
    OBIECT_ACTIUNE: 'Subject of Action',
    VALOARE: 'Claim Value',
    MONEDA: 'Currency',
    DATA_CITARE: 'Citation Date',
    DATA_TERMEN: 'Hearing Date',
    EXCEPTII: 'Preliminary Objections (detailed)',
    EXPUNERE_FAPT_PARAT: 'Defendant\'s Statement of Facts',
    APARARE_JURIDICA: 'Legal Defense Arguments',
    CRITICA_CERERE: 'Criticism of Plaintiff\'s Claims',
    PROBE_ADMINISTRARE: 'Evidence to be Administered',
    CERERI_ACCESORII: 'Ancillary Requests',
    LISTA_ANEXE: 'List of Attachments',
    DATA_DEPUNERE: 'Filing Date',
  },
};

/**
 * Generate a formatted statement of defense from the template
 */
export function generateIntampinare(variables: Record<string, string>): string {
  const template = IntampinareTemplate;
  let document = '';

  // Add header
  document += `${template.structure.header.ro}\n\n`;

  // Add each section
  template.structure.sections.forEach((section) => {
    if (section.required || variables[section.id]) {
      // Section label (except for some special sections)
      if (!['introducere', 'preambul', 'fond', 'cereri'].includes(section.id)) {
        document += `${section.labelRo}\n`;
      } else {
        document += `${section.labelRo}\n\n`;
      }

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
export function validateIntampinareVariables(
  variables: Record<string, string>
): { valid: boolean; missing: string[] } {
  const template = IntampinareTemplate;
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
