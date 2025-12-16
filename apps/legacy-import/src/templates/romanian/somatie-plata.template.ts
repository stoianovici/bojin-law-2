/**
 * Romanian Template: Somatie de Plata (Payment Notice)
 * Story 2.12.1 - Task 8: Remaining Templates
 *
 * A formal notice demanding payment of an outstanding debt
 */

export interface SomatiePlataVariables {
  // Creditor Information
  CREDITOR_NUME: string;
  CREDITOR_CUI: string;
  CREDITOR_SEDIU: string;
  CREDITOR_REPREZENTANT: string;

  // Debtor Information
  DEBTOR_NUME: string;
  DEBTOR_CNP_CUI: string;
  DEBTOR_DOMICILIU: string;

  // Debt Details
  SUMA_DATORATA: string;
  MONEDA: string;
  TEMEIUL_JURIDIC: string; // e.g., "Contract nr. 123/2025"
  DATA_SCADENTA: string;
  DESCRIERE_OBLIGATIE: string;

  // Payment Terms
  TERMEN_PLATA: string; // e.g., "15 zile"
  CONT_BANCAR: string;
  BANCA: string;

  // Additional Details
  DOBANDA_INTARZIERE?: string;
  PENALITATI?: string;
  DATA_EMITERE: string;
  LOCALITATE: string;
}

export interface SomatiePlataSection {
  id: string;
  labelRo: string;
  labelEn: string;
  content?: string;
  variables?: string[];
  required: boolean;
}

export const somatiePlataMetadata = {
  templateId: 'somatie-plata-ro-v1',
  nameRo: 'Somație de Plată',
  nameEn: 'Payment Notice',
  category: 'debt_collection',
  legalCategory: 'civil_law',
  averageLength: 2,
  complexity: 'medium',
  estimatedTimeSavings: 1.5,
  civilCodeReferences: [
    'Art. 1516 Cod Civil - Obligația de plată',
    'Art. 1535 Cod Civil - Dobânda legală',
    'Art. 1457 Cod Civil - Punerea în întârziere',
  ],
  commonUseCases: [
    'Recovery of unpaid invoices',
    'Collection of contractual debts',
    'Formal demand before legal action',
  ],
};

export const somatiePlataSections: SomatiePlataSection[] = [
  {
    id: 'header',
    labelRo: 'Antet',
    labelEn: 'Header',
    content: 'SOMAȚIE DE PLATĂ',
    required: true,
  },
  {
    id: 'creditor',
    labelRo: 'Creditorul',
    labelEn: 'Creditor',
    variables: [
      '{{CREDITOR_NUME}}',
      '{{CREDITOR_CUI}}',
      '{{CREDITOR_SEDIU}}',
      '{{CREDITOR_REPREZENTANT}}',
    ],
    required: true,
  },
  {
    id: 'debtor',
    labelRo: 'Către Debitorul',
    labelEn: 'To the Debtor',
    variables: ['{{DEBTOR_NUME}}', '{{DEBTOR_CNP_CUI}}', '{{DEBTOR_DOMICILIU}}'],
    required: true,
  },
  {
    id: 'introducere',
    labelRo: 'Introducere',
    labelEn: 'Introduction',
    content:
      'Prin prezenta, vă somăm în mod formal să achitați suma datorată conform datelor de mai jos:',
    required: true,
  },
  {
    id: 'debt_details',
    labelRo: 'Detalii Datorie',
    labelEn: 'Debt Details',
    variables: [
      '{{SUMA_DATORATA}}',
      '{{MONEDA}}',
      '{{TEMEIUL_JURIDIC}}',
      '{{DATA_SCADENTA}}',
      '{{DESCRIERE_OBLIGATIE}}',
    ],
    required: true,
  },
  {
    id: 'temeiul_legal',
    labelRo: 'Temeiul Legal',
    labelEn: 'Legal Basis',
    content:
      'Potrivit prevederilor Art. 1516 și Art. 1535 din Codul Civil, sunteți obligat să achitați suma menționată.',
    required: true,
  },
  {
    id: 'punere_intarziere',
    labelRo: 'Punere în Întârziere',
    labelEn: 'Default Notice',
    content: 'Prin prezenta somație, vă punem oficial în întârziere conform Art. 1457 Cod Civil.',
    required: true,
  },
  {
    id: 'payment_instructions',
    labelRo: 'Modalitate de Plată',
    labelEn: 'Payment Instructions',
    variables: ['{{TERMEN_PLATA}}', '{{CONT_BANCAR}}', '{{BANCA}}'],
    required: true,
  },
  {
    id: 'dobanda',
    labelRo: 'Dobândă și Penalități',
    labelEn: 'Interest and Penalties',
    variables: ['{{DOBANDA_INTARZIERE}}', '{{PENALITATI}}'],
    required: false,
  },
  {
    id: 'consecinte',
    labelRo: 'Consecințe Nerespectare',
    labelEn: 'Consequences of Non-Compliance',
    content:
      'În cazul în care nu veți achita suma în termenul indicat, vom fi nevoiți să ne adresăm instanței judecătorești competente pentru recuperarea debitului, cu dobânzi, penalități și cheltuieli de judecată.',
    required: true,
  },
  {
    id: 'rezervare_drepturi',
    labelRo: 'Rezervarea Drepturilor',
    labelEn: 'Reservation of Rights',
    content:
      'Ne rezervăm dreptul de a solicita daune-interese suplimentare și executarea silită a creanței.',
    required: false,
  },
  {
    id: 'footer',
    labelRo: 'Încheiere',
    labelEn: 'Closing',
    variables: ['{{DATA_EMITERE}}', '{{LOCALITATE}}', '{{CREDITOR_REPREZENTANT}}'],
    required: true,
  },
];

export const somatiePlataStandardClauses = {
  ro: [
    'vă somăm în mod formal să achitați',
    'în termen de {{TERMEN_PLATA}} de la primirea prezentei',
    'sub sancțiunea declanșării procedurilor legale de recuperare',
    'prin prezenta somație, vă punem oficial în întârziere',
    'ne rezervăm dreptul de a solicita daune-interese',
    'vor fi adăugate dobânzi legale și penalități',
    'toate cheltuielile de judecată vor fi suportate de către dumneavoastră',
  ],
  en: [
    'we formally demand that you pay',
    'within {{TERMEN_PLATA}} from receipt of this notice',
    'under penalty of initiating legal recovery procedures',
    'through this notice, we officially put you in default',
    'we reserve the right to claim damages',
    'legal interest and penalties will be added',
    'all legal costs will be borne by you',
  ],
};

/**
 * Generate a Somatie de Plata document
 */
export function generateSomatiePlata(variables: SomatiePlataVariables): string {
  return `
# SOMAȚIE DE PLATĂ

**De la:** ${variables.CREDITOR_NUME}
**CUI:** ${variables.CREDITOR_CUI}
**Sediu:** ${variables.CREDITOR_SEDIU}
**Reprezentant:** ${variables.CREDITOR_REPREZENTANT}

---

**Către:**
**${variables.DEBTOR_NUME}**
**CNP/CUI:** ${variables.DEBTOR_CNP_CUI}
**Domiciliu/Sediu:** ${variables.DEBTOR_DOMICILIU}

---

## Obiectul Somației

Prin prezenta, vă somăm în mod formal să achitați suma datorată conform datelor de mai jos:

### Detalii Datorie

- **Suma datorată:** ${variables.SUMA_DATORATA} ${variables.MONEDA}
- **Temeiul juridic:** ${variables.TEMEIUL_JURIDIC}
- **Data scadentă:** ${variables.DATA_SCADENTA}
- **Descriere obligație:** ${variables.DESCRIERE_OBLIGATIE}

## Temeiul Legal

Potrivit prevederilor **Art. 1516** și **Art. 1535** din **Codul Civil**, sunteți obligat să achitați suma menționată mai sus, reprezentând contravaloarea obligației asumate prin ${variables.TEMEIUL_JURIDIC}.

## Punere în Întârziere

Prin prezenta somație, vă punem oficial în întârziere conform **Art. 1457 Cod Civil**, începând cu data primirii acesteia.

## Modalitate de Plată

Vă solicităm să achitați suma în termen de **${variables.TERMEN_PLATA}** de la primirea prezentei, prin transfer bancar în contul:

- **Cont IBAN:** ${variables.CONT_BANCAR}
- **Banca:** ${variables.BANCA}
- **Beneficiar:** ${variables.CREDITOR_NUME}

${
  variables.DOBANDA_INTARZIERE || variables.PENALITATI
    ? `
## Dobândă și Penalități

${variables.DOBANDA_INTARZIERE ? `- **Dobândă de întârziere:** ${variables.DOBANDA_INTARZIERE}` : ''}
${variables.PENALITATI ? `- **Penalități contractuale:** ${variables.PENALITATI}` : ''}
`
    : ''
}

## Consecințe în Caz de Nerespectare

În cazul în care nu veți achita suma în termenul indicat mai sus, vom fi nevoiți să ne adresăm instanței judecătorești competente pentru:

1. Recuperarea debitului principal
2. Dobânzi de întârziere calculate conform legii
3. Penalități contractuale
4. Cheltuieli de judecată
5. Onorariul avocatului

## Rezervarea Drepturilor

Ne rezervăm dreptul de a solicita daune-interese suplimentare pentru prejudiciile cauzate prin neonorarea obligațiilor contractuale, precum și dreptul de a solicita executarea silită a creanței.

---

**Data:** ${variables.DATA_EMITERE}
**Localitate:** ${variables.LOCALITATE}

**Creditor,**
**${variables.CREDITOR_REPREZENTANT}**

---

*Prezenta somație constituie punere în întârziere conform Art. 1457 Cod Civil și îndeplinește condițiile prealabile pentru declanșarea procedurilor judiciare de recuperare a creanței.*
`.trim();
}

/**
 * Validate Somatie de Plata variables
 */
export function validateSomatiePlata(variables: Partial<SomatiePlataVariables>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Required creditor fields
  if (!variables.CREDITOR_NUME) errors.push('CREDITOR_NUME is required');
  if (!variables.CREDITOR_CUI) errors.push('CREDITOR_CUI is required');
  if (!variables.CREDITOR_SEDIU) errors.push('CREDITOR_SEDIU is required');
  if (!variables.CREDITOR_REPREZENTANT) errors.push('CREDITOR_REPREZENTANT is required');

  // Required debtor fields
  if (!variables.DEBTOR_NUME) errors.push('DEBTOR_NUME is required');
  if (!variables.DEBTOR_CNP_CUI) errors.push('DEBTOR_CNP_CUI is required');
  if (!variables.DEBTOR_DOMICILIU) errors.push('DEBTOR_DOMICILIU is required');

  // Required debt fields
  if (!variables.SUMA_DATORATA) errors.push('SUMA_DATORATA is required');
  if (!variables.MONEDA) errors.push('MONEDA is required');
  if (!variables.TEMEIUL_JURIDIC) errors.push('TEMEIUL_JURIDIC is required');
  if (!variables.DATA_SCADENTA) errors.push('DATA_SCADENTA is required');
  if (!variables.DESCRIERE_OBLIGATIE) errors.push('DESCRIERE_OBLIGATIE is required');

  // Required payment fields
  if (!variables.TERMEN_PLATA) errors.push('TERMEN_PLATA is required');
  if (!variables.CONT_BANCAR) errors.push('CONT_BANCAR is required');
  if (!variables.BANCA) errors.push('BANCA is required');

  // Required footer fields
  if (!variables.DATA_EMITERE) errors.push('DATA_EMITERE is required');
  if (!variables.LOCALITATE) errors.push('LOCALITATE is required');

  return {
    valid: errors.length === 0,
    errors,
  };
}
