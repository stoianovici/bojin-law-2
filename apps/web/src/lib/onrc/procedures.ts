/**
 * Comprehensive ONRC Procedures Configuration
 *
 * This file defines all available procedures from ONRC.ro,
 * organized to match their website navigation structure.
 */

export interface ONRCProcedure {
  id: string;
  name: string;
  description: string;
  url: string;
  fallbackUrl?: string;
}

export interface ONRCSubcategory {
  id: string;
  name: string;
  description: string;
  procedures: ONRCProcedure[];
}

export interface ONRCCategory {
  id: string;
  name: string;
  icon: string;
  description: string;
  subcategories: ONRCSubcategory[];
}

/**
 * Complete ONRC structure matching their website navigation
 */
export const ONRC_STRUCTURE: ONRCCategory[] = [
  // ============================================================================
  // ÎNMATRICULĂRI (Registrations)
  // ============================================================================
  {
    id: 'inmatriculari',
    name: 'Înmatriculări',
    icon: 'plus-circle',
    description: 'Înregistrarea de noi entități în Registrul Comerțului',
    subcategories: [
      {
        id: 'operatiuni-prealabile',
        name: 'Operațiuni prealabile',
        description: 'Servicii preliminare înregistrării',
        procedures: [
          {
            id: 'verificare-rezervare-pj',
            name: 'Verificare și rezervare denumire (Persoană juridică)',
            description: 'Verificarea disponibilității și rezervarea denumirii pentru societăți',
            url: 'https://www.onrc.ro/index.php/ro/inmatriculari/operatiuni-prealabile',
          },
          {
            id: 'verificare-rezervare-pf',
            name: 'Verificare și rezervare denumire (PFA/II/IF)',
            description: 'Verificarea disponibilității și rezervarea denumirii pentru PFA, II, IF',
            url: 'https://www.onrc.ro/index.php/ro/inmatriculari/operatiuni-prealabile',
          },
        ],
      },
      {
        id: 'persoane-fizice',
        name: 'Persoane fizice',
        description: 'Înregistrarea PFA, Întreprinderi individuale și familiale',
        procedures: [
          {
            id: 'infiintare-pfa',
            name: 'Înființare PFA',
            description: 'Persoană fizică autorizată să desfășoare activități economice',
            url: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-fizice',
          },
          {
            id: 'infiintare-ii',
            name: 'Înființare Întreprindere Individuală',
            description: 'Întreprindere economică fără personalitate juridică',
            url: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-fizice',
          },
          {
            id: 'infiintare-if',
            name: 'Înființare Întreprindere Familială',
            description: 'Întreprindere constituită de membrii unei familii',
            url: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-fizice',
          },
        ],
      },
      {
        id: 'persoane-juridice',
        name: 'Persoane juridice',
        description:
          'Înregistrarea societăților comerciale și a altor entități cu personalitate juridică',
        procedures: [
          {
            id: 'infiintare-srl',
            name: 'Înființare SRL (SNC/SCS/SRL)',
            description:
              'Societate în nume colectiv, în comandită simplă sau cu răspundere limitată',
            url: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
          },
          {
            id: 'infiintare-srl-d',
            name: 'Înființare SRL-D',
            description: 'Societate cu răspundere limitată - Debutant (microîntreprindere)',
            url: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
          },
          {
            id: 'infiintare-sa',
            name: 'Înființare SA/SCA',
            description: 'Societate pe acțiuni sau societate în comandită pe acțiuni',
            url: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
          },
          {
            id: 'infiintare-gie',
            name: 'Înființare GIE',
            description: 'Grup de interes economic',
            url: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
          },
          {
            id: 'infiintare-societate-nationala',
            name: 'Înființare Societate/Companie Națională',
            description: 'Societate sau companie de interes național',
            url: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
          },
          {
            id: 'infiintare-se-holding',
            name: 'Înființare SE Holding',
            description: 'Societate europeană de tip holding',
            url: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
          },
          {
            id: 'infiintare-se-fuziune',
            name: 'Înființare SE prin fuziune',
            description: 'Societate europeană constituită prin fuziune',
            url: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
          },
          {
            id: 'infiintare-se-filiala',
            name: 'Înființare SE Filială',
            description: 'Filială a unei societăți europene',
            url: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
          },
          {
            id: 'infiintare-regie-autonoma',
            name: 'Înființare Regie Autonomă',
            description: 'Regie autonomă de interes local sau național',
            url: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
          },
          {
            id: 'infiintare-cooperativa-credit',
            name: 'Înființare Organizație Cooperatistă de Credit',
            description: 'Organizație cooperatistă în domeniul financiar-bancar',
            url: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
          },
          {
            id: 'infiintare-societate-cooperativa',
            name: 'Înființare Societate Cooperativă',
            description: 'Societate cooperativă de gradul I și II',
            url: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
          },
          {
            id: 'infiintare-cooperativa-agricola',
            name: 'Înființare Cooperativă Agricolă',
            description: 'Cooperativă agricolă de gradul I, II sau III',
            url: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
          },
          {
            id: 'infiintare-sce',
            name: 'Înființare SCE',
            description: 'Societate cooperativă europeană',
            url: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
          },
          {
            id: 'infiintare-sce-fuziune',
            name: 'Înființare SCE prin fuziune',
            description: 'Cooperativă europeană constituită prin fuziune',
            url: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
          },
        ],
      },
      {
        id: 'sucursale',
        name: 'Sucursale',
        description: 'Înregistrarea sucursalelor societăților române și străine',
        procedures: [
          {
            id: 'infiintare-sucursala-romana',
            name: 'Înființare sucursală (societate română)',
            description: 'Sucursală a unei societăți înregistrate în România',
            url: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
          },
          {
            id: 'infiintare-sucursala-straina',
            name: 'Înființare sucursală (societate străină)',
            description: 'Sucursală a unei societăți străine în România',
            url: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
          },
        ],
      },
    ],
  },

  // ============================================================================
  // MENȚIUNI (Modifications)
  // ============================================================================
  {
    id: 'mentiuni',
    name: 'Mențiuni',
    icon: 'edit',
    description: 'Modificări ale datelor înregistrate în Registrul Comerțului',
    subcategories: [
      {
        id: 'mentiuni-pf',
        name: 'Persoane fizice',
        description: 'Modificări pentru PFA, II, IF',
        procedures: [
          {
            id: 'modificari-pfa-ii-if',
            name: 'Modificări PFA/II/IF',
            description: 'Modificări generale pentru persoane fizice autorizate',
            url: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-fizice',
          },
          {
            id: 'suspendare-pfa-ii-if',
            name: 'Suspendare/Reluare activitate PFA/II/IF',
            description: 'Suspendarea sau reluarea activității',
            url: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-fizice',
          },
        ],
      },
      {
        id: 'mentiuni-pj',
        name: 'Persoane juridice',
        description: 'Modificări pentru societăți comerciale',
        procedures: [
          // Denumire și formă juridică
          {
            id: 'modificare-denumire',
            name: 'Modificarea denumirii',
            description: 'Schimbarea numelui societății',
            url: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
          },
          {
            id: 'schimbare-forma-juridica',
            name: 'Schimbarea formei juridice',
            description: 'Transformarea tipului de societate (ex: SRL în SA)',
            url: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
          },
          {
            id: 'transformare-sa-se',
            name: 'Transformarea SA în SE',
            description: 'Transformarea unei societăți pe acțiuni într-o societate europeană',
            url: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
          },

          // Sediu
          {
            id: 'schimbare-sediu-acelasi-judet',
            name: 'Schimbare sediu social (același județ)',
            description: 'Mutarea sediului în același județ',
            url: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
          },
          {
            id: 'schimbare-sediu-alt-judet',
            name: 'Schimbare sediu social (alt județ)',
            description: 'Mutarea sediului în alt județ',
            url: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
          },
          {
            id: 'transfer-sediu-se',
            name: 'Transfer sediu SE',
            description: 'Transferul sediului unei societăți europene în alt stat membru',
            url: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
          },
          {
            id: 'infiintare-sedii-secundare',
            name: 'Înființare/Desființare sedii secundare',
            description: 'Deschiderea sau închiderea punctelor de lucru',
            url: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
          },
          {
            id: 'radiere-sucursala',
            name: 'Radierea sucursalei',
            description: 'Închiderea unei sucursale',
            url: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
          },

          // Durată și activitate
          {
            id: 'prelungire-durata',
            name: 'Prelungirea duratei de funcționare',
            description: 'Extinderea perioadei de funcționare a societății',
            url: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
          },
          {
            id: 'reducere-durata',
            name: 'Reducerea duratei de funcționare',
            description: 'Scurtarea perioadei de funcționare a societății',
            url: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
          },
          {
            id: 'modificare-obiect-activitate',
            name: 'Modificarea obiectului de activitate',
            description: 'Schimbarea domeniilor de activitate (coduri CAEN)',
            url: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
          },
          {
            id: 'actualizare-obiect-activitate',
            name: 'Actualizarea obiectului de activitate',
            description: 'Actualizarea codurilor CAEN conform noii clasificări',
            url: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
          },
          {
            id: 'suspendare-activitate',
            name: 'Suspendare/Reluare activitate',
            description: 'Suspendarea temporară sau reluarea activității',
            url: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
          },

          // Capital social
          {
            id: 'majorare-capital',
            name: 'Majorare capital social',
            description: 'Creșterea capitalului social',
            url: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
          },
          {
            id: 'reducere-capital',
            name: 'Reducere capital social',
            description: 'Diminuarea capitalului social',
            url: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
          },

          // Asociați și părți sociale
          {
            id: 'cesiune-parti-sociale',
            name: 'Transmiterea părților sociale',
            description: 'Cesiunea sau vânzarea părților sociale/de interes',
            url: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
          },
          {
            id: 'excludere-retragere-asociati',
            name: 'Excludere/Retragere asociați',
            description: 'Excluderea sau retragerea asociaților din societate',
            url: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
          },

          // Conducere și control
          {
            id: 'schimbare-administrator',
            name: 'Schimbarea organelor de conducere',
            description: 'Numirea/revocarea administratorilor, directorilor, cenzorilor',
            url: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
          },

          // Date identificare
          {
            id: 'modificare-date-identificare',
            name: 'Modificarea datelor de identificare',
            description: 'Actualizarea datelor personale ale asociaților/administratorilor',
            url: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
          },

          // GIE/GEIE
          {
            id: 'modificari-gie-geie',
            name: 'Modificări GIE/GEIE',
            description: 'Modificări specifice grupurilor de interes economic',
            url: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
          },

          // Fuziuni
          {
            id: 'fuziune-constituire',
            name: 'Fuziune prin constituire',
            description: 'Fuziunea societăților într-o societate nouă',
            url: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
          },
          {
            id: 'fuziune-absorbtie',
            name: 'Fuziune prin absorbție',
            description: 'Fuziunea societăților cu o societate existentă',
            url: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
          },
          {
            id: 'fuziune-transfrontaliera',
            name: 'Fuziune transfrontalieră',
            description: 'Fuziunea cu societăți din alte state membre UE',
            url: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
          },
          {
            id: 'transformare-transfrontaliera',
            name: 'Transformare transfrontalieră',
            description: 'Transformarea într-o societate din alt stat membru',
            url: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
          },

          // Divizări
          {
            id: 'divizare-transfrontaliera',
            name: 'Divizare transfrontalieră',
            description: 'Divizarea cu societăți din alte state membre UE',
            url: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
          },
          {
            id: 'divizare-partiala-existente',
            name: 'Divizare parțială (societăți existente)',
            description: 'Divizarea parțială către societăți existente',
            url: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
          },
          {
            id: 'divizare-partiala-noi',
            name: 'Divizare parțială (societăți noi)',
            description: 'Divizarea parțială către societăți nou constituite',
            url: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
          },
          {
            id: 'divizare-totala',
            name: 'Divizare totală',
            description: 'Divizarea completă a societății',
            url: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
          },
        ],
      },
    ],
  },

  // ============================================================================
  // DIZOLVĂRI / LICHIDĂRI / RADIERI
  // ============================================================================
  {
    id: 'dizolvari',
    name: 'Dizolvări / Lichidări / Radieri',
    icon: 'x-circle',
    description: 'Încetarea activității și radierea din Registrul Comerțului',
    subcategories: [
      {
        id: 'dizolvari-pf',
        name: 'Persoane fizice',
        description: 'Radiere PFA, II, IF',
        procedures: [
          {
            id: 'desfiintare-pfa',
            name: 'Desființare PFA',
            description: 'Radierea persoanei fizice autorizate',
            url: 'https://www.onrc.ro/index.php/ro/dizolvari-lichidari-radieri/persoane-fizice',
          },
          {
            id: 'desfiintare-ii',
            name: 'Desființare II',
            description: 'Radierea întreprinderii individuale',
            url: 'https://www.onrc.ro/index.php/ro/dizolvari-lichidari-radieri/persoane-fizice',
          },
          {
            id: 'desfiintare-if',
            name: 'Desființare IF',
            description: 'Radierea întreprinderii familiale',
            url: 'https://www.onrc.ro/index.php/ro/dizolvari-lichidari-radieri/persoane-fizice',
          },
        ],
      },
      {
        id: 'dizolvari-pj',
        name: 'Persoane juridice',
        description: 'Dizolvare și radiere societăți comerciale',
        procedures: [
          {
            id: 'dizolvare-lichidare-simultana',
            name: 'Dizolvare și lichidare simultană',
            description: 'Procedură simplificată pentru SNC, SCS, SRL și GIE',
            url: 'https://www.onrc.ro/index.php/ro/dizolvari-lichidari-radieri/persoane-juridice',
          },
          {
            id: 'dizolvare-voluntara-lichidator',
            name: 'Dizolvare voluntară cu lichidator',
            description: 'Dizolvare cu numire de lichidator pentru toate tipurile de societăți',
            url: 'https://www.onrc.ro/index.php/ro/dizolvari-lichidari-radieri/persoane-juridice',
          },
          {
            id: 'dizolvare-judiciara-nulitate',
            name: 'Dizolvare judiciară pentru nulitate',
            description: 'Dizolvare dispusă de instanță pentru nulitatea actelor constitutive',
            url: 'https://www.onrc.ro/index.php/ro/dizolvari-lichidari-radieri/persoane-juridice',
          },
          {
            id: 'dizolvare-deces',
            name: 'Dizolvare urmare deces',
            description: 'Dizolvare ca urmare a decesului asociatului unic',
            url: 'https://www.onrc.ro/index.php/ro/dizolvari-lichidari-radieri/persoane-juridice',
          },
        ],
      },
    ],
  },
];

/**
 * Flatten all procedures into a single array for the scraper
 */
export function getAllProcedures(): ONRCProcedure[] {
  const procedures: ONRCProcedure[] = [];

  for (const category of ONRC_STRUCTURE) {
    for (const subcategory of category.subcategories) {
      for (const procedure of subcategory.procedures) {
        procedures.push(procedure);
      }
    }
  }

  return procedures;
}

/**
 * Get procedure by ID
 */
export function getProcedureById(id: string): ONRCProcedure | undefined {
  for (const category of ONRC_STRUCTURE) {
    for (const subcategory of category.subcategories) {
      const procedure = subcategory.procedures.find((p) => p.id === id);
      if (procedure) return procedure;
    }
  }
  return undefined;
}

/**
 * Get category and subcategory for a procedure
 */
export function getProcedureLocation(
  procedureId: string
): { category: ONRCCategory; subcategory: ONRCSubcategory } | undefined {
  for (const category of ONRC_STRUCTURE) {
    for (const subcategory of category.subcategories) {
      if (subcategory.procedures.some((p) => p.id === procedureId)) {
        return { category, subcategory };
      }
    }
  }
  return undefined;
}

/**
 * Count total procedures
 */
export function getTotalProcedureCount(): number {
  return getAllProcedures().length;
}
