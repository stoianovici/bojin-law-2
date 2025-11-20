/**
 * Romanian Template: Cerere de Chemare în Judecată (Lawsuit Petition)
 * Story 2.12.1 - Task 8: Remaining Templates
 *
 * A formal petition to initiate a lawsuit in Romanian courts
 */

export interface CerereChemareJudecataVariables {
  // Court Information
  INSTANTA_NUME: string;
  INSTANTA_SEDIU: string;

  // Plaintiff Information
  RECLAMANT_NUME: string;
  RECLAMANT_CNP_CUI: string;
  RECLAMANT_DOMICILIU: string;
  RECLAMANT_AVOCAT: string;
  RECLAMANT_AVOCAT_BAROUL: string;

  // Defendant Information
  PARAT_NUME: string;
  PARAT_CNP_CUI: string;
  PARAT_DOMICILIU: string;

  // Case Details
  OBIECTUL_CERERII: string;
  VALOAREA_CERERII: string;
  MONEDA: string;
  COMPETENTA_MATERIALA: string; // e.g., "civilă", "comercială"
  COMPETENTA_TERRITORIALA: string;

  // Facts
  EXPUNEREA_FAPTELOR: string;
  DATA_INCIDENT?: string;

  // Legal Grounds
  TEMEIUL_DREPT: string; // Romanian Civil Code articles
  TEMEIUL_FAPT: string;

  // Claims
  PRETENTII: string[]; // Array of claims
  CHELTUIELI_JUDECATA: string;

  // Evidence
  DOVEZI: string[]; // Array of evidence descriptions

  // Additional
  CERERI_ACCESORII?: string[]; // Optional additional requests
  DATA_DEPUNERE: string;
  LOCALITATE: string;
}

export interface CerereChemareJudecataSection {
  id: string;
  labelRo: string;
  labelEn: string;
  content?: string;
  variables?: string[];
  required: boolean;
}

export const cerereChemareJudecataMetadata = {
  templateId: 'cerere-chemare-judecata-ro-v1',
  nameRo: 'Cerere de Chemare în Judecată',
  nameEn: 'Lawsuit Petition',
  category: 'court_filing',
  legalCategory: 'civil_procedure',
  averageLength: 5,
  complexity: 'high',
  estimatedTimeSavings: 3.0,
  civilCodeReferences: [
    'Art. 194 Cod Procedură Civilă - Conținutul cererii de chemare în judecată',
    'Art. 1350 Cod Civil - Răspunderea civilă delictuală',
    'Art. 1516 Cod Civil - Executarea obligațiilor',
  ],
  proceduralCodeReferences: [
    'Art. 194 CPC - Cererea de chemare în judecată',
    'Art. 195 CPC - Anexele cererii',
    'Art. 196 CPC - Lipsa cererii de chemare în judecată',
  ],
  commonUseCases: [
    'Contract breach lawsuits',
    'Debt recovery actions',
    'Civil damages claims',
    'Property disputes',
  ],
};

export const cerereChemareJudecataSections: CerereChemareJudecataSection[] = [
  {
    id: 'court_header',
    labelRo: 'Antet Instanță',
    labelEn: 'Court Header',
    variables: ['{{INSTANTA_NUME}}', '{{INSTANTA_SEDIU}}'],
    required: true,
  },
  {
    id: 'plaintiff',
    labelRo: 'Reclamant',
    labelEn: 'Plaintiff',
    variables: ['{{RECLAMANT_NUME}}', '{{RECLAMANT_CNP_CUI}}', '{{RECLAMANT_DOMICILIU}}', '{{RECLAMANT_AVOCAT}}'],
    required: true,
  },
  {
    id: 'defendant',
    labelRo: 'Pârât',
    labelEn: 'Defendant',
    variables: ['{{PARAT_NUME}}', '{{PARAT_CNP_CUI}}', '{{PARAT_DOMICILIU}}'],
    required: true,
  },
  {
    id: 'case_object',
    labelRo: 'Obiectul Cererii',
    labelEn: 'Object of the Claim',
    variables: ['{{OBIECTUL_CERERII}}', '{{VALOAREA_CERERII}}', '{{MONEDA}}'],
    required: true,
  },
  {
    id: 'competence',
    labelRo: 'Competența Instanței',
    labelEn: 'Court Jurisdiction',
    variables: ['{{COMPETENTA_MATERIALA}}', '{{COMPETENTA_TERRITORIALA}}'],
    required: true,
  },
  {
    id: 'facts',
    labelRo: 'Expunerea Situației de Fapt',
    labelEn: 'Statement of Facts',
    variables: ['{{EXPUNEREA_FAPTELOR}}'],
    required: true,
  },
  {
    id: 'legal_grounds',
    labelRo: 'Temeiul de Drept și de Fapt',
    labelEn: 'Legal and Factual Grounds',
    variables: ['{{TEMEIUL_DREPT}}', '{{TEMEIUL_FAPT}}'],
    required: true,
  },
  {
    id: 'claims',
    labelRo: 'Pretenții',
    labelEn: 'Claims',
    variables: ['{{PRETENTII}}'],
    required: true,
  },
  {
    id: 'evidence',
    labelRo: 'Dovezi',
    labelEn: 'Evidence',
    variables: ['{{DOVEZI}}'],
    required: true,
  },
  {
    id: 'costs',
    labelRo: 'Cheltuieli de Judecată',
    labelEn: 'Legal Costs',
    variables: ['{{CHELTUIELI_JUDECATA}}'],
    required: true,
  },
  {
    id: 'additional_requests',
    labelRo: 'Cereri Accesorii',
    labelEn: 'Additional Requests',
    variables: ['{{CERERI_ACCESORII}}'],
    required: false,
  },
  {
    id: 'conclusion',
    labelRo: 'Încheiere',
    labelEn: 'Conclusion',
    content: 'Pentru considerentele expuse mai sus, vă rugăm să admiteți prezenta cerere conform pretențiilor formulate.',
    required: true,
  },
  {
    id: 'footer',
    labelRo: 'Semnătură',
    labelEn: 'Signature',
    variables: ['{{DATA_DEPUNERE}}', '{{LOCALITATE}}', '{{RECLAMANT_AVOCAT}}'],
    required: true,
  },
];

export const cerereChemareJudecataStandardClauses = {
  ro: [
    'față de cele arătate mai sus, vă rugăm să admiteți prezenta cerere',
    'să obligați pârâtul la plata sumei de',
    'cu cheltuieli de judecată',
    'dovedim cele arătate cu',
    'competența instanței este dată de',
    'solicit citarea pârâtului la adresa menționată',
    'anexăm prezentei dovezile necesare',
  ],
  en: [
    'given the above, we request that you admit this petition',
    'to oblige the defendant to pay the amount of',
    'with legal costs',
    'we prove the stated facts with',
    'the court jurisdiction is based on',
    'we request the defendant be summoned at the mentioned address',
    'we attach the necessary evidence',
  ],
};

/**
 * Generate a Cerere de Chemare în Judecată document
 */
export function generateCerereChemareJudecata(
  variables: CerereChemareJudecataVariables
): string {
  const pretentiiList = variables.PRETENTII.map((p, i) => `${i + 1}. ${p}`).join('\n');
  const doveziList = variables.DOVEZI.map((d, i) => `${i + 1}. ${d}`).join('\n');
  const cereriAcList = variables.CERERI_ACCESORII
    ? variables.CERERI_ACCESORII.map((c, i) => `${i + 1}. ${c}`).join('\n')
    : '';

  return `
# CERERE DE CHEMARE ÎN JUDECATĂ

**Către:**
**${variables.INSTANTA_NUME}**
**${variables.INSTANTA_SEDIU}**

---

## Date de Identificare

### Reclamant

**${variables.RECLAMANT_NUME}**
- CNP/CUI: ${variables.RECLAMANT_CNP_CUI}
- Domiciliu/Sediu: ${variables.RECLAMANT_DOMICILIU}
- Reprezentant: ${variables.RECLAMANT_AVOCAT}, Baroul ${variables.RECLAMANT_AVOCAT_BAROUL}

### Pârât

**${variables.PARAT_NUME}**
- CNP/CUI: ${variables.PARAT_CNP_CUI}
- Domiciliu/Sediu: ${variables.PARAT_DOMICILIU}

---

## Obiectul Cererii

**${variables.OBIECTUL_CERERII}**

**Valoarea cererii:** ${variables.VALOAREA_CERERII} ${variables.MONEDA}

---

## Competența Instanței

Prezenta cerere este de competența **${variables.INSTANTA_NUME}** având în vedere:

1. **Competența materială:** ${variables.COMPETENTA_MATERIALA}
2. **Competența teritorială:** ${variables.COMPETENTA_TERRITORIALA}

Conform prevederilor **Codului de Procedură Civilă**, această instanță este competentă să soluționeze prezenta cauză.

---

## Expunerea Situației de Fapt

${variables.EXPUNEREA_FAPTELOR}

${variables.DATA_INCIDENT ? `\n**Data incidentului:** ${variables.DATA_INCIDENT}\n` : ''}

---

## Temeiul de Drept și de Fapt

### Temeiul de Drept

${variables.TEMEIUL_DREPT}

### Temeiul de Fapt

${variables.TEMEIUL_FAPT}

Potrivit prevederilor legale menționate, pârâtul este obligat să își îndeplinească obligațiile asumate/să repare prejudiciul cauzat.

---

## Pretenții

Față de cele arătate mai sus, solicit instanței să dispună:

${pretentiiList}

Cheltuieli de judecată în cuantum de ${variables.CHELTUIELI_JUDECATA}, reprezentând:
- Taxă de timbru
- Timbru judiciar
- Onorariu avocat
- Alte cheltuieli necesare

---

## Dovezi

Dovedim cele arătate cu următoarele mijloace de probă:

${doveziList}

Conform **Art. 195 Cod Procedură Civilă**, anexăm prezentei cereri documentele doveditoare în copie.

---

${variables.CERERI_ACCESORII && variables.CERERI_ACCESORII.length > 0 ? `
## Cereri Accesorii

Solicităm de asemenea:

${cereriAcList}

---
` : ''}

## Concluzie

Pentru considerentele expuse mai sus și având în vedere dispozițiile legale invocate, vă rugăm să admiteți prezenta cerere ca fiind **întemeiat** și să dispuneți conform pretențiilor formulate.

Solicit citarea pârâtului la adresa menționată pentru a-și formula apărările.

---

**Data:** ${variables.DATA_DEPUNERE}
**Localitate:** ${variables.LOCALITATE}

**Reclamant / Avocat,**
**${variables.RECLAMANT_AVOCAT}**
**Baroul ${variables.RECLAMANT_AVOCAT_BAROUL}**

---

## Anexe

Conform Art. 195 CPC, se anexează:
1. Copie act identitate reclamant
2. Copie act identitate pârât (dacă este disponibil)
3. Dovezi în susținerea cererii
4. Dovada plății taxei de timbru
5. Procură specială (dacă este cazul)

---

*Prezenta cerere este depusă în conformitate cu prevederile Art. 194 Cod Procedură Civilă și cuprinde toate elementele obligatorii prevăzute de lege.*
`.trim();
}

/**
 * Validate Cerere de Chemare în Judecată variables
 */
export function validateCerereChemareJudecata(
  variables: Partial<CerereChemareJudecataVariables>
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Required court fields
  if (!variables.INSTANTA_NUME) errors.push('INSTANTA_NUME is required');
  if (!variables.INSTANTA_SEDIU) errors.push('INSTANTA_SEDIU is required');

  // Required plaintiff fields
  if (!variables.RECLAMANT_NUME) errors.push('RECLAMANT_NUME is required');
  if (!variables.RECLAMANT_CNP_CUI) errors.push('RECLAMANT_CNP_CUI is required');
  if (!variables.RECLAMANT_DOMICILIU) errors.push('RECLAMANT_DOMICILIU is required');
  if (!variables.RECLAMANT_AVOCAT) errors.push('RECLAMANT_AVOCAT is required');
  if (!variables.RECLAMANT_AVOCAT_BAROUL) errors.push('RECLAMANT_AVOCAT_BAROUL is required');

  // Required defendant fields
  if (!variables.PARAT_NUME) errors.push('PARAT_NUME is required');
  if (!variables.PARAT_CNP_CUI) errors.push('PARAT_CNP_CUI is required');
  if (!variables.PARAT_DOMICILIU) errors.push('PARAT_DOMICILIU is required');

  // Required case fields
  if (!variables.OBIECTUL_CERERII) errors.push('OBIECTUL_CERERII is required');
  if (!variables.VALOAREA_CERERII) errors.push('VALOAREA_CERERII is required');
  if (!variables.MONEDA) errors.push('MONEDA is required');
  if (!variables.COMPETENTA_MATERIALA) errors.push('COMPETENTA_MATERIALA is required');
  if (!variables.COMPETENTA_TERRITORIALA) errors.push('COMPETENTA_TERRITORIALA is required');

  // Required content fields
  if (!variables.EXPUNEREA_FAPTELOR) errors.push('EXPUNEREA_FAPTELOR is required');
  if (!variables.TEMEIUL_DREPT) errors.push('TEMEIUL_DREPT is required');
  if (!variables.TEMEIUL_FAPT) errors.push('TEMEIUL_FAPT is required');

  // Required arrays
  if (!variables.PRETENTII || variables.PRETENTII.length === 0) {
    errors.push('At least one PRETENTII (claim) is required');
  }
  if (!variables.DOVEZI || variables.DOVEZI.length === 0) {
    errors.push('At least one DOVEZI (evidence) is required');
  }

  // Required footer fields
  if (!variables.CHELTUIELI_JUDECATA) errors.push('CHELTUIELI_JUDECATA is required');
  if (!variables.DATA_DEPUNERE) errors.push('DATA_DEPUNERE is required');
  if (!variables.LOCALITATE) errors.push('LOCALITATE is required');

  return {
    valid: errors.length === 0,
    errors,
  };
}
