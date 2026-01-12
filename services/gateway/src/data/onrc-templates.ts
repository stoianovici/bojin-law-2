/**
 * ONRC Templates - Static Template Data for Gateway
 *
 * This file contains the ONRC (Romanian Trade Registry) template definitions
 * for use by the mapa service when creating mape from templates.
 *
 * NOTE: This is a copy of the template definitions from the web app.
 * The web app's templates-data.ts is the source of truth.
 */

// ============================================================================
// Types
// ============================================================================

interface SlotDefinition {
  name: string;
  description?: string;
  category?: string;
  required: boolean;
  order: number;
}

interface ONRCTemplateData {
  id: string;
  name: string;
  description: string;
  slotDefinitions: SlotDefinition[];
}

// ============================================================================
// Common Slot Definitions
// ============================================================================

const COMMON_SLOTS = {
  cerereInregistrare: {
    name: 'Cerere de înregistrare',
    description: 'Formularul tip pentru înregistrare la ONRC',
    category: 'formulare',
    required: true,
  },
  cerereInregistrareMentiuni: {
    name: 'Cerere de înregistrare mențiuni',
    description: 'Formularul tip pentru înregistrarea modificărilor',
    category: 'formulare',
    required: true,
  },
  dovadaRezervare: {
    name: 'Dovada verificării disponibilității denumirii',
    description: 'Rezervarea denumirii de la ONRC',
    category: 'formulare',
    required: true,
  },
  actConstitutiv: {
    name: 'Actul constitutiv',
    description: 'Statutul societății autentificat notarial',
    category: 'acte_constitutive',
    required: true,
  },
  actConstitutivActualizat: {
    name: 'Actul constitutiv actualizat',
    description: 'Statutul societății cu modificările operate',
    category: 'acte_constitutive',
    required: true,
  },
  actIdentitateAsociati: {
    name: 'Acte de identitate asociați',
    description: 'CI/Pașaport pentru toți asociații',
    category: 'identitate',
    required: true,
  },
  actIdentitateTitular: {
    name: 'Act de identitate titular',
    description: 'CI/Pașaport al titularului',
    category: 'identitate',
    required: true,
  },
  actIdentitateAdministrator: {
    name: 'Act de identitate administrator',
    description: 'CI/Pașaport al administratorului',
    category: 'identitate',
    required: true,
  },
  declaratieProprieRaspundere: {
    name: 'Declarație pe propria răspundere',
    description: 'Declarația administratorului privind îndeplinirea condițiilor legale',
    category: 'declaratii',
    required: true,
  },
  declaratieBeneficiarReal: {
    name: 'Declarație privind beneficiarul real',
    description: 'Formularul tip privind beneficiarul real',
    category: 'declaratii',
    required: true,
  },
  specimenSemnatura: {
    name: 'Specimen de semnătură',
    description: 'Specimen semnătură administrator legalizat notarial',
    category: 'declaratii',
    required: true,
  },
  dovadaSediu: {
    name: 'Dovada sediului social',
    description: 'Contract de închiriere/comodat sau act de proprietate',
    category: 'sediu',
    required: true,
  },
  acordAsociatieProp: {
    name: 'Acordul asociației de proprietari',
    description: 'Necesar dacă sediul este în bloc de locuințe',
    category: 'sediu',
    required: false,
  },
  dovadaCapital: {
    name: 'Dovada capitalului social',
    description: 'Extras de cont sau chitanță depunere capital social',
    category: 'financiar',
    required: true,
  },
  dovadaAport: {
    name: 'Dovada aportului',
    description: 'Extras de cont sau raport evaluare pentru aport în natură',
    category: 'financiar',
    required: true,
  },
  hotarareAGA: {
    name: 'Hotărârea Adunării Generale a Asociaților',
    description: 'Hotărârea AGA privind modificarea',
    category: 'hotarari',
    required: true,
  },
  certificatFiscalANAF: {
    name: 'Certificat de atestare fiscală ANAF',
    description: 'Certificat privind obligațiile fiscale de la ANAF',
    category: 'certificate',
    required: true,
  },
  certificatFiscalLocal: {
    name: 'Certificat de atestare fiscală local',
    description: 'Certificat de la primărie privind impozitele locale',
    category: 'certificate',
    required: true,
  },
  contractCesiune: {
    name: 'Contractul de cesiune',
    description: 'Contract de cesiune părți sociale autentificat notarial',
    category: 'contracte',
    required: true,
  },
};

// Helper to create slot with order
function slot(def: Omit<SlotDefinition, 'order'>, order: number): SlotDefinition {
  return { ...def, order };
}

// ============================================================================
// Template Definitions Map (procedureId -> template data)
// ============================================================================

const ONRC_TEMPLATES_MAP: Map<string, ONRCTemplateData> = new Map([
  // ÎNMATRICULĂRI - OPERAȚIUNI PREALABILE
  [
    'verificare-rezervare-pj',
    {
      id: 'onrc-verificare-rezervare-pj',
      name: 'Verificare și rezervare denumire (Persoană juridică)',
      description: 'Verificarea disponibilității și rezervarea denumirii pentru societăți',
      slotDefinitions: [
        slot({ name: 'Cerere verificare disponibilitate denumire', category: 'formulare', required: true }, 1),
        slot({ name: 'Dovada achitării taxei', description: 'Chitanță sau OP pentru taxa ONRC', category: 'financiar', required: true }, 2),
        slot({ name: 'Act identitate solicitant', category: 'identitate', required: true }, 3),
        slot({ name: 'Împuternicire', description: 'Dacă cererea este depusă prin reprezentant', category: 'formulare', required: false }, 4),
      ],
    },
  ],
  [
    'verificare-rezervare-pf',
    {
      id: 'onrc-verificare-rezervare-pf',
      name: 'Verificare și rezervare denumire (PFA/II/IF)',
      description: 'Verificarea disponibilității și rezervarea denumirii pentru PFA, II, IF',
      slotDefinitions: [
        slot({ name: 'Cerere verificare disponibilitate denumire PFA/II/IF', category: 'formulare', required: true }, 1),
        slot({ name: 'Dovada achitării taxei', category: 'financiar', required: true }, 2),
        slot({ name: 'Act identitate solicitant', category: 'identitate', required: true }, 3),
      ],
    },
  ],

  // ÎNMATRICULĂRI - PERSOANE FIZICE
  [
    'infiintare-pfa',
    {
      id: 'onrc-infiintare-pfa',
      name: 'Înființare PFA',
      description: 'Persoană fizică autorizată să desfășoare activități economice',
      slotDefinitions: [
        slot({ name: 'Cerere de înregistrare PFA', category: 'formulare', required: true }, 1),
        slot(COMMON_SLOTS.dovadaRezervare, 2),
        slot(COMMON_SLOTS.actIdentitateTitular, 3),
        slot({ name: 'Documente care atestă pregătirea profesională', description: 'Diplome, certificate, atestate', category: 'calificare', required: true }, 4),
        slot({ name: 'Documente care atestă experiența profesională', description: 'Adeverințe, cărți de muncă', category: 'calificare', required: false }, 5),
        slot(COMMON_SLOTS.dovadaSediu, 6),
        slot(COMMON_SLOTS.declaratieProprieRaspundere, 7),
        slot(COMMON_SLOTS.specimenSemnatura, 8),
        slot({ name: 'Certificat de cazier judiciar', description: 'Pentru anumite activități reglementate', category: 'certificate', required: false }, 9),
      ],
    },
  ],
  [
    'infiintare-ii',
    {
      id: 'onrc-infiintare-ii',
      name: 'Înființare Întreprindere Individuală',
      description: 'Întreprindere economică fără personalitate juridică',
      slotDefinitions: [
        slot({ name: 'Cerere de înregistrare II', category: 'formulare', required: true }, 1),
        slot(COMMON_SLOTS.dovadaRezervare, 2),
        slot(COMMON_SLOTS.actIdentitateTitular, 3),
        slot({ name: 'Documente care atestă pregătirea profesională', category: 'calificare', required: true }, 4),
        slot(COMMON_SLOTS.dovadaSediu, 5),
        slot(COMMON_SLOTS.declaratieProprieRaspundere, 6),
        slot(COMMON_SLOTS.specimenSemnatura, 7),
      ],
    },
  ],
  [
    'infiintare-if',
    {
      id: 'onrc-infiintare-if',
      name: 'Înființare Întreprindere Familială',
      description: 'Întreprindere constituită de membrii unei familii',
      slotDefinitions: [
        slot({ name: 'Cerere de înregistrare IF', category: 'formulare', required: true }, 1),
        slot(COMMON_SLOTS.dovadaRezervare, 2),
        slot({ name: 'Acordul de constituire a IF', description: 'Semnat de toți membrii familiei', category: 'acte_constitutive', required: true }, 3),
        slot({ name: 'Acte de identitate ale membrilor', description: 'CI/Pașaport pentru toți membrii IF', category: 'identitate', required: true }, 4),
        slot({ name: 'Acte de stare civilă', description: 'Certificate de naștere/căsătorie care dovedesc rudenia', category: 'identitate', required: true }, 5),
        slot({ name: 'Documente care atestă pregătirea profesională', category: 'calificare', required: true }, 6),
        slot(COMMON_SLOTS.dovadaSediu, 7),
        slot(COMMON_SLOTS.declaratieProprieRaspundere, 8),
        slot(COMMON_SLOTS.specimenSemnatura, 9),
      ],
    },
  ],

  // ÎNMATRICULĂRI - PERSOANE JURIDICE
  [
    'infiintare-srl',
    {
      id: 'onrc-infiintare-srl',
      name: 'Înființare SRL (SNC/SCS/SRL)',
      description: 'Societate în nume colectiv, în comandită simplă sau cu răspundere limitată',
      slotDefinitions: [
        slot(COMMON_SLOTS.cerereInregistrare, 1),
        slot(COMMON_SLOTS.dovadaRezervare, 2),
        slot(COMMON_SLOTS.actConstitutiv, 3),
        slot(COMMON_SLOTS.actIdentitateAsociati, 4),
        slot(COMMON_SLOTS.declaratieProprieRaspundere, 5),
        slot(COMMON_SLOTS.declaratieBeneficiarReal, 6),
        slot(COMMON_SLOTS.specimenSemnatura, 7),
        slot(COMMON_SLOTS.dovadaSediu, 8),
        slot(COMMON_SLOTS.dovadaCapital, 9),
        slot(COMMON_SLOTS.acordAsociatieProp, 10),
        slot({ name: 'Certificat căsătorie', description: 'Pentru asociați căsătoriți', category: 'identitate', required: false }, 11),
        slot({ name: 'Acordul soțului/soției', description: 'Pentru aport bunuri comune', category: 'declaratii', required: false }, 12),
      ],
    },
  ],
  [
    'infiintare-srl-d',
    {
      id: 'onrc-infiintare-srl-d',
      name: 'Înființare SRL-D',
      description: 'Societate cu răspundere limitată - Debutant (microîntreprindere)',
      slotDefinitions: [
        slot({ name: 'Cerere de înregistrare SRL-D', category: 'formulare', required: true }, 1),
        slot(COMMON_SLOTS.dovadaRezervare, 2),
        slot({ name: 'Actul constitutiv SRL-D', description: 'Formular tip pentru SRL-D', category: 'acte_constitutive', required: true }, 3),
        slot({ name: 'Act de identitate asociat unic', category: 'identitate', required: true }, 4),
        slot({ name: 'Declarație pe propria răspundere SRL-D', description: 'Declarație că îndeplinește condițiile pentru SRL-D', category: 'declaratii', required: true }, 5),
        slot(COMMON_SLOTS.declaratieBeneficiarReal, 6),
        slot(COMMON_SLOTS.specimenSemnatura, 7),
        slot(COMMON_SLOTS.dovadaSediu, 8),
        slot({ name: 'Declarație privind activitățile anterioare', description: 'Declarație că nu a mai deținut calitatea de asociat unic într-un SRL-D', category: 'declaratii', required: true }, 9),
      ],
    },
  ],
  [
    'infiintare-sa',
    {
      id: 'onrc-infiintare-sa',
      name: 'Înființare SA/SCA',
      description: 'Societate pe acțiuni sau societate în comandită pe acțiuni',
      slotDefinitions: [
        slot(COMMON_SLOTS.cerereInregistrare, 1),
        slot(COMMON_SLOTS.dovadaRezervare, 2),
        slot({ name: 'Actul constitutiv SA/SCA', description: 'Statutul societății pe acțiuni', category: 'acte_constitutive', required: true }, 3),
        slot({ name: 'Acte de identitate fondatori', description: 'CI/Pașaport pentru toți fondatorii', category: 'identitate', required: true }, 4),
        slot({ name: 'Acte de identitate membri CA/Directori', description: 'CI/Pașaport pentru membrii consiliului de administrație', category: 'identitate', required: true }, 5),
        slot(COMMON_SLOTS.declaratieProprieRaspundere, 6),
        slot(COMMON_SLOTS.declaratieBeneficiarReal, 7),
        slot({ name: 'Specimene de semnătură membri CA', description: 'Specimene semnătură pentru toți membrii CA', category: 'declaratii', required: true }, 8),
        slot(COMMON_SLOTS.dovadaSediu, 9),
        slot({ name: 'Dovada capitalului social vărsat', description: 'Minimum 30% din capitalul subscris', category: 'financiar', required: true }, 10),
        slot({ name: 'Raport evaluare aport în natură', description: 'Pentru aporturi în natură', category: 'financiar', required: false }, 11),
        slot({ name: 'Acceptul cenzorilor/auditorului', description: 'Acceptul pentru funcția de cenzor sau auditor', category: 'declaratii', required: true }, 12),
      ],
    },
  ],

  // MENȚIUNI - PERSOANE JURIDICE (most common ones)
  [
    'modificare-denumire',
    {
      id: 'onrc-modificare-denumire',
      name: 'Modificarea denumirii',
      description: 'Schimbarea numelui societății',
      slotDefinitions: [
        slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
        slot(COMMON_SLOTS.dovadaRezervare, 2),
        slot(COMMON_SLOTS.hotarareAGA, 3),
        slot(COMMON_SLOTS.actConstitutivActualizat, 4),
      ],
    },
  ],
  [
    'schimbare-sediu-acelasi-judet',
    {
      id: 'onrc-schimbare-sediu-acelasi-judet',
      name: 'Schimbare sediu social (același județ)',
      description: 'Mutarea sediului în același județ',
      slotDefinitions: [
        slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
        slot(COMMON_SLOTS.hotarareAGA, 2),
        slot(COMMON_SLOTS.actConstitutivActualizat, 3),
        slot({ name: 'Dovada noului sediu social', category: 'sediu', required: true }, 4),
        slot({ name: 'Acordul asociației de proprietari', description: 'Pentru sediu în bloc', category: 'sediu', required: false }, 5),
      ],
    },
  ],
  [
    'schimbare-sediu-alt-judet',
    {
      id: 'onrc-schimbare-sediu-alt-judet',
      name: 'Schimbare sediu social (alt județ)',
      description: 'Mutarea sediului în alt județ',
      slotDefinitions: [
        slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
        slot(COMMON_SLOTS.hotarareAGA, 2),
        slot(COMMON_SLOTS.actConstitutivActualizat, 3),
        slot({ name: 'Dovada noului sediu social', category: 'sediu', required: true }, 4),
        slot({ name: 'Acordul asociației de proprietari', description: 'Pentru sediu în bloc', category: 'sediu', required: false }, 5),
        slot(COMMON_SLOTS.certificatFiscalANAF, 6),
        slot(COMMON_SLOTS.certificatFiscalLocal, 7),
      ],
    },
  ],
  [
    'modificare-obiect-activitate',
    {
      id: 'onrc-modificare-obiect-activitate',
      name: 'Modificarea obiectului de activitate',
      description: 'Schimbarea domeniilor de activitate (coduri CAEN)',
      slotDefinitions: [
        slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
        slot(COMMON_SLOTS.hotarareAGA, 2),
        slot(COMMON_SLOTS.actConstitutivActualizat, 3),
        slot({ name: 'Autorizații/avize speciale', description: 'Pentru activități reglementate', category: 'autorizatii', required: false }, 4),
      ],
    },
  ],
  [
    'majorare-capital',
    {
      id: 'onrc-majorare-capital',
      name: 'Majorare capital social',
      description: 'Creșterea capitalului social',
      slotDefinitions: [
        slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
        slot(COMMON_SLOTS.hotarareAGA, 2),
        slot(COMMON_SLOTS.actConstitutivActualizat, 3),
        slot(COMMON_SLOTS.dovadaAport, 4),
        slot({ name: 'Raport evaluare aport în natură', description: 'Pentru aport în natură', category: 'rapoarte', required: false }, 5),
        slot({ name: 'Acte identitate noi asociați', description: 'Pentru majorare cu aport nou asociat', category: 'identitate', required: false }, 6),
      ],
    },
  ],
  [
    'cesiune-parti-sociale',
    {
      id: 'onrc-cesiune-parti-sociale',
      name: 'Transmiterea părților sociale',
      description: 'Cesiunea sau vânzarea părților sociale/de interes',
      slotDefinitions: [
        slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
        slot(COMMON_SLOTS.contractCesiune, 2),
        slot(COMMON_SLOTS.hotarareAGA, 3),
        slot(COMMON_SLOTS.actConstitutivActualizat, 4),
        slot({ name: 'Act identitate cesionar', description: 'Pentru noul asociat', category: 'identitate', required: true }, 5),
        slot(COMMON_SLOTS.declaratieBeneficiarReal, 6),
      ],
    },
  ],
  [
    'schimbare-administrator',
    {
      id: 'onrc-schimbare-administrator',
      name: 'Schimbarea organelor de conducere',
      description: 'Numirea/revocarea administratorilor, directorilor, cenzorilor',
      slotDefinitions: [
        slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
        slot(COMMON_SLOTS.hotarareAGA, 2),
        slot(COMMON_SLOTS.actConstitutivActualizat, 3),
        slot({ name: 'Act identitate noul administrator', category: 'identitate', required: true }, 4),
        slot({ name: 'Specimen semnătură noul administrator', category: 'declaratii', required: true }, 5),
        slot({ name: 'Declarație pe propria răspundere noul administrator', category: 'declaratii', required: true }, 6),
        slot({ name: 'Acceptul cenzorilor/auditorului', description: 'Pentru numire cenzori', category: 'declaratii', required: false }, 7),
      ],
    },
  ],

  // DIZOLVĂRI / RADIERI
  [
    'dizolvare-lichidare-simultana',
    {
      id: 'onrc-dizolvare-lichidare-simultana',
      name: 'Dizolvare și lichidare simultană',
      description: 'Procedură simplificată pentru SNC, SCS, SRL și GIE',
      slotDefinitions: [
        slot({ name: 'Cerere de înregistrare dizolvare și radiere', category: 'formulare', required: true }, 1),
        slot({ name: 'Hotărârea AGA de dizolvare și lichidare', category: 'hotarari', required: true }, 2),
        slot(COMMON_SLOTS.certificatFiscalANAF, 3),
        slot(COMMON_SLOTS.certificatFiscalLocal, 4),
        slot({ name: 'Situații financiare de lichidare', description: 'Bilanț de lichidare', category: 'financiar', required: true }, 5),
        slot({ name: 'Declarație privind achitarea datoriilor', category: 'declaratii', required: true }, 6),
        slot({ name: 'Declarație privind repartizarea activelor', category: 'declaratii', required: true }, 7),
      ],
    },
  ],
  [
    'desfiintare-pfa',
    {
      id: 'onrc-desfiintare-pfa',
      name: 'Desființare PFA',
      description: 'Radierea persoanei fizice autorizate',
      slotDefinitions: [
        slot({ name: 'Cerere de radiere PFA', category: 'formulare', required: true }, 1),
        slot(COMMON_SLOTS.actIdentitateTitular, 2),
        slot(COMMON_SLOTS.certificatFiscalANAF, 3),
        slot(COMMON_SLOTS.certificatFiscalLocal, 4),
        slot(COMMON_SLOTS.declaratieProprieRaspundere, 5),
      ],
    },
  ],
]);

// ============================================================================
// Exported Functions
// ============================================================================

/**
 * Get ONRC template by ID (supports both "onrc-{procedureId}" and "{procedureId}" formats)
 */
export function getONRCTemplateById(id: string): ONRCTemplateData | undefined {
  // Try direct lookup first (for "onrc-{procedureId}" format)
  if (id.startsWith('onrc-')) {
    const procedureId = id.replace('onrc-', '');
    return ONRC_TEMPLATES_MAP.get(procedureId);
  }

  // Try as procedureId directly
  return ONRC_TEMPLATES_MAP.get(id);
}

/**
 * Check if an ID is an ONRC template ID
 */
export function isONRCTemplateId(id: string): boolean {
  return id.startsWith('onrc-');
}

/**
 * Get all ONRC template IDs
 */
export function getAllONRCTemplateIds(): string[] {
  return Array.from(ONRC_TEMPLATES_MAP.keys()).map((id) => `onrc-${id}`);
}
