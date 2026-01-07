/**
 * ONRC Templates Seed Data
 *
 * CRITICAL: This file contains all 45+ ONRC procedure templates with their
 * document requirements. This is expensive to recreate - DO NOT DELETE.
 *
 * Run with: pnpm --filter database seed:onrc
 */

import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

// Generate a unique ID similar to cuid2
function createId(): string {
  return 'onrc_' + crypto.randomBytes(12).toString('hex');
}

const prisma = new PrismaClient();

// ============================================================================
// SLOT DEFINITION TYPES
// ============================================================================

interface SlotDefinition {
  name: string;
  description?: string;
  category: string;
  required: boolean;
  order: number;
}

interface ONRCTemplate {
  procedureId: string;
  name: string;
  description: string;
  sourceUrl: string;
  categoryId: string;
  subcategoryId: string;
  slots: SlotDefinition[];
}

// ============================================================================
// COMMON SLOT DEFINITIONS (reusable across procedures)
// ============================================================================

const COMMON_SLOTS = {
  // Formulare ONRC
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

  // Acte constitutive
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

  // Identitate
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

  // Declarații
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

  // Sediu
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

  // Financiar
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

  // Hotărâri
  hotarareAGA: {
    name: 'Hotărârea Adunării Generale a Asociaților',
    description: 'Hotărârea AGA privind modificarea',
    category: 'hotarari',
    required: true,
  },
  hotarareAsociatUnic: {
    name: 'Decizia asociatului unic',
    description: 'Decizia asociatului unic privind modificarea',
    category: 'hotarari',
    required: true,
  },

  // Certificate
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

  // Contracte
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
// ONRC TEMPLATES - ALL 45+ PROCEDURES
// ============================================================================

const ONRC_TEMPLATES: ONRCTemplate[] = [
  // ==========================================================================
  // ÎNMATRICULĂRI - OPERAȚIUNI PREALABILE
  // ==========================================================================
  {
    procedureId: 'verificare-rezervare-pj',
    name: 'Verificare și rezervare denumire (Persoană juridică)',
    description: 'Verificarea disponibilității și rezervarea denumirii pentru societăți',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/inmatriculari/operatiuni-prealabile',
    categoryId: 'inmatriculari',
    subcategoryId: 'operatiuni-prealabile',
    slots: [
      slot(
        {
          name: 'Cerere verificare disponibilitate denumire',
          category: 'formulare',
          required: true,
        },
        1
      ),
      slot(
        {
          name: 'Dovada achitării taxei',
          description: 'Chitanță sau OP pentru taxa ONRC',
          category: 'financiar',
          required: true,
        },
        2
      ),
      slot({ name: 'Act identitate solicitant', category: 'identitate', required: true }, 3),
      slot(
        {
          name: 'Împuternicire',
          description: 'Dacă cererea este depusă prin reprezentant',
          category: 'formulare',
          required: false,
        },
        4
      ),
    ],
  },
  {
    procedureId: 'verificare-rezervare-pf',
    name: 'Verificare și rezervare denumire (PFA/II/IF)',
    description: 'Verificarea disponibilității și rezervarea denumirii pentru PFA, II, IF',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/inmatriculari/operatiuni-prealabile',
    categoryId: 'inmatriculari',
    subcategoryId: 'operatiuni-prealabile',
    slots: [
      slot(
        {
          name: 'Cerere verificare disponibilitate denumire PFA/II/IF',
          category: 'formulare',
          required: true,
        },
        1
      ),
      slot({ name: 'Dovada achitării taxei', category: 'financiar', required: true }, 2),
      slot({ name: 'Act identitate solicitant', category: 'identitate', required: true }, 3),
    ],
  },

  // ==========================================================================
  // ÎNMATRICULĂRI - PERSOANE FIZICE
  // ==========================================================================
  {
    procedureId: 'infiintare-pfa',
    name: 'Înființare PFA',
    description: 'Persoană fizică autorizată să desfășoare activități economice',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-fizice',
    categoryId: 'inmatriculari',
    subcategoryId: 'persoane-fizice',
    slots: [
      slot({ name: 'Cerere de înregistrare PFA', category: 'formulare', required: true }, 1),
      slot(COMMON_SLOTS.dovadaRezervare, 2),
      slot(COMMON_SLOTS.actIdentitateTitular, 3),
      slot(
        {
          name: 'Documente care atestă pregătirea profesională',
          description: 'Diplome, certificate, atestate',
          category: 'calificare',
          required: true,
        },
        4
      ),
      slot(
        {
          name: 'Documente care atestă experiența profesională',
          description: 'Adeverințe, cărți de muncă',
          category: 'calificare',
          required: false,
        },
        5
      ),
      slot(COMMON_SLOTS.dovadaSediu, 6),
      slot(COMMON_SLOTS.declaratieProprieRaspundere, 7),
      slot(COMMON_SLOTS.specimenSemnatura, 8),
      slot(
        {
          name: 'Certificat de cazier judiciar',
          description: 'Pentru anumite activități reglementate',
          category: 'certificate',
          required: false,
        },
        9
      ),
    ],
  },
  {
    procedureId: 'infiintare-ii',
    name: 'Înființare Întreprindere Individuală',
    description: 'Întreprindere economică fără personalitate juridică',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-fizice',
    categoryId: 'inmatriculari',
    subcategoryId: 'persoane-fizice',
    slots: [
      slot({ name: 'Cerere de înregistrare II', category: 'formulare', required: true }, 1),
      slot(COMMON_SLOTS.dovadaRezervare, 2),
      slot(COMMON_SLOTS.actIdentitateTitular, 3),
      slot(
        {
          name: 'Documente care atestă pregătirea profesională',
          category: 'calificare',
          required: true,
        },
        4
      ),
      slot(COMMON_SLOTS.dovadaSediu, 5),
      slot(COMMON_SLOTS.declaratieProprieRaspundere, 6),
      slot(COMMON_SLOTS.specimenSemnatura, 7),
    ],
  },
  {
    procedureId: 'infiintare-if',
    name: 'Înființare Întreprindere Familială',
    description: 'Întreprindere constituită de membrii unei familii',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-fizice',
    categoryId: 'inmatriculari',
    subcategoryId: 'persoane-fizice',
    slots: [
      slot({ name: 'Cerere de înregistrare IF', category: 'formulare', required: true }, 1),
      slot(COMMON_SLOTS.dovadaRezervare, 2),
      slot(
        {
          name: 'Acordul de constituire a IF',
          description: 'Semnat de toți membrii familiei',
          category: 'acte_constitutive',
          required: true,
        },
        3
      ),
      slot(
        {
          name: 'Acte de identitate ale membrilor',
          description: 'CI/Pașaport pentru toți membrii IF',
          category: 'identitate',
          required: true,
        },
        4
      ),
      slot(
        {
          name: 'Acte de stare civilă',
          description: 'Certificate de naștere/căsătorie care dovedesc rudenia',
          category: 'identitate',
          required: true,
        },
        5
      ),
      slot(
        {
          name: 'Documente care atestă pregătirea profesională',
          category: 'calificare',
          required: true,
        },
        6
      ),
      slot(COMMON_SLOTS.dovadaSediu, 7),
      slot(COMMON_SLOTS.declaratieProprieRaspundere, 8),
      slot(COMMON_SLOTS.specimenSemnatura, 9),
    ],
  },

  // ==========================================================================
  // ÎNMATRICULĂRI - PERSOANE JURIDICE (SRL, SA, etc.)
  // ==========================================================================
  {
    procedureId: 'infiintare-srl',
    name: 'Înființare SRL (SNC/SCS/SRL)',
    description: 'Societate în nume colectiv, în comandită simplă sau cu răspundere limitată',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
    categoryId: 'inmatriculari',
    subcategoryId: 'persoane-juridice',
    slots: [
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
      slot(
        {
          name: 'Certificat căsătorie',
          description: 'Pentru asociați căsătoriți',
          category: 'identitate',
          required: false,
        },
        11
      ),
      slot(
        {
          name: 'Acordul soțului/soției',
          description: 'Pentru aport bunuri comune',
          category: 'declaratii',
          required: false,
        },
        12
      ),
    ],
  },
  {
    procedureId: 'infiintare-srl-d',
    name: 'Înființare SRL-D',
    description: 'Societate cu răspundere limitată - Debutant (microîntreprindere)',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
    categoryId: 'inmatriculari',
    subcategoryId: 'persoane-juridice',
    slots: [
      slot({ name: 'Cerere de înregistrare SRL-D', category: 'formulare', required: true }, 1),
      slot(COMMON_SLOTS.dovadaRezervare, 2),
      slot(
        {
          name: 'Actul constitutiv SRL-D',
          description: 'Formular tip pentru SRL-D',
          category: 'acte_constitutive',
          required: true,
        },
        3
      ),
      slot({ name: 'Act de identitate asociat unic', category: 'identitate', required: true }, 4),
      slot(
        {
          name: 'Declarație pe propria răspundere SRL-D',
          description: 'Declarație că îndeplinește condițiile pentru SRL-D',
          category: 'declaratii',
          required: true,
        },
        5
      ),
      slot(COMMON_SLOTS.declaratieBeneficiarReal, 6),
      slot(COMMON_SLOTS.specimenSemnatura, 7),
      slot(COMMON_SLOTS.dovadaSediu, 8),
      slot(
        {
          name: 'Declarație privind activitățile anterioare',
          description: 'Declarație că nu a mai deținut calitatea de asociat unic într-un SRL-D',
          category: 'declaratii',
          required: true,
        },
        9
      ),
    ],
  },
  {
    procedureId: 'infiintare-sa',
    name: 'Înființare SA/SCA',
    description: 'Societate pe acțiuni sau societate în comandită pe acțiuni',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
    categoryId: 'inmatriculari',
    subcategoryId: 'persoane-juridice',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrare, 1),
      slot(COMMON_SLOTS.dovadaRezervare, 2),
      slot(
        {
          name: 'Actul constitutiv SA/SCA',
          description: 'Statutul societății pe acțiuni',
          category: 'acte_constitutive',
          required: true,
        },
        3
      ),
      slot(
        {
          name: 'Acte de identitate fondatori',
          description: 'CI/Pașaport pentru toți fondatorii',
          category: 'identitate',
          required: true,
        },
        4
      ),
      slot(
        {
          name: 'Acte de identitate membri CA/Directori',
          description: 'CI/Pașaport pentru membrii consiliului de administrație',
          category: 'identitate',
          required: true,
        },
        5
      ),
      slot(COMMON_SLOTS.declaratieProprieRaspundere, 6),
      slot(COMMON_SLOTS.declaratieBeneficiarReal, 7),
      slot(
        {
          name: 'Specimene de semnătură membri CA',
          description: 'Specimene semnătură pentru toți membrii CA',
          category: 'declaratii',
          required: true,
        },
        8
      ),
      slot(COMMON_SLOTS.dovadaSediu, 9),
      slot(
        {
          name: 'Dovada capitalului social vărsat',
          description: 'Minimum 30% din capitalul subscris',
          category: 'financiar',
          required: true,
        },
        10
      ),
      slot(
        {
          name: 'Raport evaluare aport în natură',
          description: 'Pentru aporturi în natură',
          category: 'financiar',
          required: false,
        },
        11
      ),
      slot(
        {
          name: 'Acceptul cenzorilor/auditorului',
          description: 'Acceptul pentru funcția de cenzor sau auditor',
          category: 'declaratii',
          required: true,
        },
        12
      ),
    ],
  },
  {
    procedureId: 'infiintare-gie',
    name: 'Înființare GIE',
    description: 'Grup de interes economic',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
    categoryId: 'inmatriculari',
    subcategoryId: 'persoane-juridice',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrare, 1),
      slot(COMMON_SLOTS.dovadaRezervare, 2),
      slot(
        {
          name: 'Contractul de constituire GIE',
          description: 'Contractul între membrii GIE',
          category: 'acte_constitutive',
          required: true,
        },
        3
      ),
      slot(
        {
          name: 'Acte de identificare membri',
          description: 'Pentru persoane fizice și juridice membre',
          category: 'identitate',
          required: true,
        },
        4
      ),
      slot(
        {
          name: 'Hotărârile de aderare',
          description: 'Hotărârile AGA ale societăților membre',
          category: 'hotarari',
          required: true,
        },
        5
      ),
      slot(
        {
          name: 'Certificate constatator membri PJ',
          description: 'Pentru membrii persoane juridice',
          category: 'certificate',
          required: true,
        },
        6
      ),
      slot(COMMON_SLOTS.declaratieProprieRaspundere, 7),
      slot(COMMON_SLOTS.specimenSemnatura, 8),
      slot(COMMON_SLOTS.dovadaSediu, 9),
    ],
  },
  {
    procedureId: 'infiintare-societate-nationala',
    name: 'Înființare Societate/Companie Națională',
    description: 'Societate sau companie de interes național',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
    categoryId: 'inmatriculari',
    subcategoryId: 'persoane-juridice',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrare, 1),
      slot(
        {
          name: 'Hotărârea Guvernului de înființare',
          description: 'HG privind înființarea societății/companiei naționale',
          category: 'hotarari',
          required: true,
        },
        2
      ),
      slot(
        {
          name: 'Statutul societății/companiei naționale',
          category: 'acte_constitutive',
          required: true,
        },
        3
      ),
      slot(
        {
          name: 'Acte de identitate conducere',
          description: 'Pentru membrii organelor de conducere',
          category: 'identitate',
          required: true,
        },
        4
      ),
      slot({ name: 'Specimene de semnătură', category: 'declaratii', required: true }, 5),
      slot(COMMON_SLOTS.dovadaSediu, 6),
    ],
  },
  {
    procedureId: 'infiintare-se-holding',
    name: 'Înființare SE Holding',
    description: 'Societate europeană de tip holding',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
    categoryId: 'inmatriculari',
    subcategoryId: 'persoane-juridice',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrare, 1),
      slot(COMMON_SLOTS.dovadaRezervare, 2),
      slot(
        {
          name: 'Proiectul de constituire SE',
          description: 'Proiectul de constituire a SE holding',
          category: 'acte_constitutive',
          required: true,
        },
        3
      ),
      slot({ name: 'Statutul SE', category: 'acte_constitutive', required: true }, 4),
      slot(
        {
          name: 'Raportul organelor de conducere',
          description: 'Raport privind constituirea SE',
          category: 'rapoarte',
          required: true,
        },
        5
      ),
      slot({ name: 'Hotărârile societăților fondatoare', category: 'hotarari', required: true }, 6),
      slot(
        {
          name: 'Certificate constatator societăți fondatoare',
          category: 'certificate',
          required: true,
        },
        7
      ),
      slot(COMMON_SLOTS.declaratieProprieRaspundere, 8),
      slot(
        { name: 'Specimene semnătură organe conducere', category: 'declaratii', required: true },
        9
      ),
      slot(COMMON_SLOTS.dovadaSediu, 10),
      slot(COMMON_SLOTS.dovadaCapital, 11),
    ],
  },
  {
    procedureId: 'infiintare-se-fuziune',
    name: 'Înființare SE prin fuziune',
    description: 'Societate europeană constituită prin fuziune',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
    categoryId: 'inmatriculari',
    subcategoryId: 'persoane-juridice',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrare, 1),
      slot(
        {
          name: 'Proiectul de fuziune',
          description: 'Proiectul comun de fuziune',
          category: 'acte_constitutive',
          required: true,
        },
        2
      ),
      slot({ name: 'Statutul SE', category: 'acte_constitutive', required: true }, 3),
      slot({ name: 'Raportul organelor de conducere', category: 'rapoarte', required: true }, 4),
      slot({ name: 'Raportul expertului independent', category: 'rapoarte', required: true }, 5),
      slot(
        {
          name: 'Hotărârile de fuziune',
          description: 'Hotărârile AGA ale societăților participante',
          category: 'hotarari',
          required: true,
        },
        6
      ),
      slot(
        {
          name: 'Certificat de legalitate',
          description: 'Emis de autoritatea competentă din statul membru',
          category: 'certificate',
          required: true,
        },
        7
      ),
      slot(COMMON_SLOTS.declaratieProprieRaspundere, 8),
      slot(
        { name: 'Specimene semnătură organe conducere', category: 'declaratii', required: true },
        9
      ),
      slot(COMMON_SLOTS.dovadaSediu, 10),
    ],
  },
  {
    procedureId: 'infiintare-se-filiala',
    name: 'Înființare SE Filială',
    description: 'Filială a unei societăți europene',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
    categoryId: 'inmatriculari',
    subcategoryId: 'persoane-juridice',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrare, 1),
      slot(COMMON_SLOTS.dovadaRezervare, 2),
      slot({ name: 'Statutul filialei', category: 'acte_constitutive', required: true }, 3),
      slot(
        { name: 'Hotărârea SE de constituire filială', category: 'hotarari', required: true },
        4
      ),
      slot({ name: 'Certificat constatator SE mamă', category: 'certificate', required: true }, 5),
      slot(COMMON_SLOTS.declaratieProprieRaspundere, 6),
      slot(COMMON_SLOTS.specimenSemnatura, 7),
      slot(COMMON_SLOTS.dovadaSediu, 8),
      slot(COMMON_SLOTS.dovadaCapital, 9),
    ],
  },
  {
    procedureId: 'infiintare-regie-autonoma',
    name: 'Înființare Regie Autonomă',
    description: 'Regie autonomă de interes local sau național',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
    categoryId: 'inmatriculari',
    subcategoryId: 'persoane-juridice',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrare, 1),
      slot(
        {
          name: 'Hotărârea de înființare',
          description: 'HG sau hotărâre consiliu local/județean',
          category: 'hotarari',
          required: true,
        },
        2
      ),
      slot(
        {
          name: 'Regulamentul de organizare și funcționare',
          category: 'acte_constitutive',
          required: true,
        },
        3
      ),
      slot({ name: 'Acte de identitate conducere', category: 'identitate', required: true }, 4),
      slot({ name: 'Specimene de semnătură', category: 'declaratii', required: true }, 5),
      slot(COMMON_SLOTS.dovadaSediu, 6),
    ],
  },
  {
    procedureId: 'infiintare-cooperativa-credit',
    name: 'Înființare Organizație Cooperatistă de Credit',
    description: 'Organizație cooperatistă în domeniul financiar-bancar',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
    categoryId: 'inmatriculari',
    subcategoryId: 'persoane-juridice',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrare, 1),
      slot(COMMON_SLOTS.dovadaRezervare, 2),
      slot(
        {
          name: 'Statutul organizației cooperatiste',
          category: 'acte_constitutive',
          required: true,
        },
        3
      ),
      slot(
        {
          name: 'Autorizația BNR',
          description: 'Autorizația de funcționare de la BNR',
          category: 'autorizatii',
          required: true,
        },
        4
      ),
      slot(
        { name: 'Acte de identitate membri fondatori', category: 'identitate', required: true },
        5
      ),
      slot(
        { name: 'Acte de identitate organe conducere', category: 'identitate', required: true },
        6
      ),
      slot(COMMON_SLOTS.declaratieProprieRaspundere, 7),
      slot({ name: 'Specimene semnătură', category: 'declaratii', required: true }, 8),
      slot(COMMON_SLOTS.dovadaSediu, 9),
      slot(COMMON_SLOTS.dovadaCapital, 10),
    ],
  },
  {
    procedureId: 'infiintare-societate-cooperativa',
    name: 'Înființare Societate Cooperativă',
    description: 'Societate cooperativă de gradul I și II',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
    categoryId: 'inmatriculari',
    subcategoryId: 'persoane-juridice',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrare, 1),
      slot(COMMON_SLOTS.dovadaRezervare, 2),
      slot(
        {
          name: 'Actul constitutiv al cooperativei',
          category: 'acte_constitutive',
          required: true,
        },
        3
      ),
      slot(
        {
          name: 'Lista membrilor cooperatori',
          description: 'Cu semnături',
          category: 'formulare',
          required: true,
        },
        4
      ),
      slot(
        { name: 'Acte de identitate membri fondatori', category: 'identitate', required: true },
        5
      ),
      slot(
        { name: 'Acte de identitate organe conducere', category: 'identitate', required: true },
        6
      ),
      slot(COMMON_SLOTS.declaratieProprieRaspundere, 7),
      slot({ name: 'Specimene semnătură', category: 'declaratii', required: true }, 8),
      slot(COMMON_SLOTS.dovadaSediu, 9),
      slot(COMMON_SLOTS.dovadaCapital, 10),
    ],
  },
  {
    procedureId: 'infiintare-cooperativa-agricola',
    name: 'Înființare Cooperativă Agricolă',
    description: 'Cooperativă agricolă de gradul I, II sau III',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
    categoryId: 'inmatriculari',
    subcategoryId: 'persoane-juridice',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrare, 1),
      slot(COMMON_SLOTS.dovadaRezervare, 2),
      slot(
        { name: 'Statutul cooperativei agricole', category: 'acte_constitutive', required: true },
        3
      ),
      slot(
        { name: 'Procesul-verbal al adunării constitutive', category: 'hotarari', required: true },
        4
      ),
      slot(
        {
          name: 'Lista membrilor cooperatori',
          description: 'Minimum 5 membri pentru gradul I',
          category: 'formulare',
          required: true,
        },
        5
      ),
      slot(
        { name: 'Acte de identitate membri fondatori', category: 'identitate', required: true },
        6
      ),
      slot(
        { name: 'Acte de identitate organe conducere', category: 'identitate', required: true },
        7
      ),
      slot(COMMON_SLOTS.declaratieProprieRaspundere, 8),
      slot({ name: 'Specimene semnătură', category: 'declaratii', required: true }, 9),
      slot(COMMON_SLOTS.dovadaSediu, 10),
      slot(COMMON_SLOTS.dovadaCapital, 11),
    ],
  },
  {
    procedureId: 'infiintare-sce',
    name: 'Înființare SCE',
    description: 'Societate cooperativă europeană',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
    categoryId: 'inmatriculari',
    subcategoryId: 'persoane-juridice',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrare, 1),
      slot(COMMON_SLOTS.dovadaRezervare, 2),
      slot({ name: 'Statutul SCE', category: 'acte_constitutive', required: true }, 3),
      slot(
        {
          name: 'Documente membri fondatori din alte state',
          description: 'Certificate de la registrele din statele membre',
          category: 'certificate',
          required: true,
        },
        4
      ),
      slot(
        { name: 'Acte de identitate organe conducere', category: 'identitate', required: true },
        5
      ),
      slot(COMMON_SLOTS.declaratieProprieRaspundere, 6),
      slot({ name: 'Specimene semnătură', category: 'declaratii', required: true }, 7),
      slot(COMMON_SLOTS.dovadaSediu, 8),
      slot(
        {
          name: 'Dovada capitalului social',
          description: 'Minimum 30.000 EUR',
          category: 'financiar',
          required: true,
        },
        9
      ),
    ],
  },
  {
    procedureId: 'infiintare-sce-fuziune',
    name: 'Înființare SCE prin fuziune',
    description: 'Cooperativă europeană constituită prin fuziune',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
    categoryId: 'inmatriculari',
    subcategoryId: 'persoane-juridice',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrare, 1),
      slot({ name: 'Proiectul de fuziune', category: 'acte_constitutive', required: true }, 2),
      slot({ name: 'Statutul SCE', category: 'acte_constitutive', required: true }, 3),
      slot({ name: 'Raportul organelor de conducere', category: 'rapoarte', required: true }, 4),
      slot({ name: 'Raportul expertului independent', category: 'rapoarte', required: true }, 5),
      slot({ name: 'Hotărârile de fuziune', category: 'hotarari', required: true }, 6),
      slot({ name: 'Certificate de legalitate', category: 'certificate', required: true }, 7),
      slot(COMMON_SLOTS.declaratieProprieRaspundere, 8),
      slot({ name: 'Specimene semnătură', category: 'declaratii', required: true }, 9),
      slot(COMMON_SLOTS.dovadaSediu, 10),
    ],
  },

  // ==========================================================================
  // ÎNMATRICULĂRI - SUCURSALE
  // ==========================================================================
  {
    procedureId: 'infiintare-sucursala-romana',
    name: 'Înființare sucursală (societate română)',
    description: 'Sucursală a unei societăți înregistrate în România',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
    categoryId: 'inmatriculari',
    subcategoryId: 'sucursale',
    slots: [
      slot({ name: 'Cerere de înregistrare sucursală', category: 'formulare', required: true }, 1),
      slot(COMMON_SLOTS.hotarareAGA, 2),
      slot(
        { name: 'Certificat constatator societate mamă', category: 'certificate', required: true },
        3
      ),
      slot(
        { name: 'Act identitate reprezentant sucursală', category: 'identitate', required: true },
        4
      ),
      slot(
        {
          name: 'Împuternicire reprezentant',
          description: 'Împuternicire pentru reprezentantul sucursalei',
          category: 'declaratii',
          required: true,
        },
        5
      ),
      slot({ name: 'Specimen semnătură reprezentant', category: 'declaratii', required: true }, 6),
      slot({ name: 'Dovada sediului sucursalei', category: 'sediu', required: true }, 7),
    ],
  },
  {
    procedureId: 'infiintare-sucursala-straina',
    name: 'Înființare sucursală (societate străină)',
    description: 'Sucursală a unei societăți străine în România',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/inmatriculari/persoane-juridice',
    categoryId: 'inmatriculari',
    subcategoryId: 'sucursale',
    slots: [
      slot(
        {
          name: 'Cerere de înregistrare sucursală societate străină',
          category: 'formulare',
          required: true,
        },
        1
      ),
      slot(
        {
          name: 'Hotărârea organului competent',
          description: 'Hotărârea privind deschiderea sucursalei în România',
          category: 'hotarari',
          required: true,
        },
        2
      ),
      slot(
        {
          name: 'Actul constitutiv societate mamă',
          description: 'Tradus și legalizat',
          category: 'acte_constitutive',
          required: true,
        },
        3
      ),
      slot(
        {
          name: 'Certificat de înregistrare societate mamă',
          description: 'Apostilat/supralegalizat și tradus',
          category: 'certificate',
          required: true,
        },
        4
      ),
      slot(
        { name: 'Act identitate reprezentant sucursală', category: 'identitate', required: true },
        5
      ),
      slot(
        {
          name: 'Împuternicire reprezentant',
          description: 'Autentificată și tradusă',
          category: 'declaratii',
          required: true,
        },
        6
      ),
      slot({ name: 'Specimen semnătură reprezentant', category: 'declaratii', required: true }, 7),
      slot({ name: 'Dovada sediului sucursalei', category: 'sediu', required: true }, 8),
      slot(COMMON_SLOTS.declaratieBeneficiarReal, 9),
    ],
  },

  // ==========================================================================
  // MENȚIUNI - PERSOANE FIZICE
  // ==========================================================================
  {
    procedureId: 'modificari-pfa-ii-if',
    name: 'Modificări PFA/II/IF',
    description: 'Modificări generale pentru persoane fizice autorizate',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-fizice',
    categoryId: 'mentiuni',
    subcategoryId: 'mentiuni-pf',
    slots: [
      slot(
        {
          name: 'Cerere de înregistrare mențiuni PFA/II/IF',
          category: 'formulare',
          required: true,
        },
        1
      ),
      slot(
        {
          name: 'Documente justificative pentru modificare',
          description: 'În funcție de tipul modificării',
          category: 'dovezi',
          required: true,
        },
        2
      ),
      slot(COMMON_SLOTS.actIdentitateTitular, 3),
      slot(COMMON_SLOTS.declaratieProprieRaspundere, 4),
      slot(
        {
          name: 'Dovada noului sediu',
          description: 'Pentru schimbarea sediului',
          category: 'sediu',
          required: false,
        },
        5
      ),
      slot(
        {
          name: 'Documente calificare',
          description: 'Pentru modificarea obiectului de activitate',
          category: 'calificare',
          required: false,
        },
        6
      ),
    ],
  },
  {
    procedureId: 'suspendare-pfa-ii-if',
    name: 'Suspendare/Reluare activitate PFA/II/IF',
    description: 'Suspendarea sau reluarea activității',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-fizice',
    categoryId: 'mentiuni',
    subcategoryId: 'mentiuni-pf',
    slots: [
      slot(
        { name: 'Cerere suspendare/reluare activitate', category: 'formulare', required: true },
        1
      ),
      slot(COMMON_SLOTS.actIdentitateTitular, 2),
      slot(COMMON_SLOTS.declaratieProprieRaspundere, 3),
      slot(
        {
          name: 'Certificat fiscal ANAF',
          description: 'Pentru suspendare',
          category: 'certificate',
          required: false,
        },
        4
      ),
    ],
  },

  // ==========================================================================
  // MENȚIUNI - PERSOANE JURIDICE
  // ==========================================================================
  {
    procedureId: 'modificare-denumire',
    name: 'Modificarea denumirii',
    description: 'Schimbarea numelui societății',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
    categoryId: 'mentiuni',
    subcategoryId: 'mentiuni-pj',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
      slot(COMMON_SLOTS.dovadaRezervare, 2),
      slot(COMMON_SLOTS.hotarareAGA, 3),
      slot(COMMON_SLOTS.actConstitutivActualizat, 4),
    ],
  },
  {
    procedureId: 'schimbare-forma-juridica',
    name: 'Schimbarea formei juridice',
    description: 'Transformarea tipului de societate (ex: SRL în SA)',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
    categoryId: 'mentiuni',
    subcategoryId: 'mentiuni-pj',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
      slot(COMMON_SLOTS.hotarareAGA, 2),
      slot(
        {
          name: 'Noul act constitutiv',
          description: 'Conform noii forme juridice',
          category: 'acte_constitutive',
          required: true,
        },
        3
      ),
      slot(
        {
          name: 'Situații financiare',
          description: 'Bilanț la data transformării',
          category: 'financiar',
          required: true,
        },
        4
      ),
      slot(
        {
          name: 'Raport evaluare patrimoniu',
          description: 'Pentru transformare în SA',
          category: 'rapoarte',
          required: false,
        },
        5
      ),
      slot(COMMON_SLOTS.declaratieProprieRaspundere, 6),
      slot(COMMON_SLOTS.specimenSemnatura, 7),
    ],
  },
  {
    procedureId: 'transformare-sa-se',
    name: 'Transformarea SA în SE',
    description: 'Transformarea unei societăți pe acțiuni într-o societate europeană',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
    categoryId: 'mentiuni',
    subcategoryId: 'mentiuni-pj',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
      slot({ name: 'Proiectul de transformare', category: 'acte_constitutive', required: true }, 2),
      slot({ name: 'Statutul SE', category: 'acte_constitutive', required: true }, 3),
      slot({ name: 'Raportul organelor de conducere', category: 'rapoarte', required: true }, 4),
      slot({ name: 'Raportul expertului independent', category: 'rapoarte', required: true }, 5),
      slot(COMMON_SLOTS.hotarareAGA, 6),
      slot(
        {
          name: 'Dovada filialelor în alte state membre',
          description: 'Certificate constatator pentru filiale din UE',
          category: 'certificate',
          required: true,
        },
        7
      ),
    ],
  },
  {
    procedureId: 'schimbare-sediu-acelasi-judet',
    name: 'Schimbare sediu social (același județ)',
    description: 'Mutarea sediului în același județ',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
    categoryId: 'mentiuni',
    subcategoryId: 'mentiuni-pj',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
      slot(COMMON_SLOTS.hotarareAGA, 2),
      slot(COMMON_SLOTS.actConstitutivActualizat, 3),
      slot({ name: 'Dovada noului sediu social', category: 'sediu', required: true }, 4),
      slot(
        {
          name: 'Acordul asociației de proprietari',
          description: 'Pentru sediu în bloc',
          category: 'sediu',
          required: false,
        },
        5
      ),
    ],
  },
  {
    procedureId: 'schimbare-sediu-alt-judet',
    name: 'Schimbare sediu social (alt județ)',
    description: 'Mutarea sediului în alt județ',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
    categoryId: 'mentiuni',
    subcategoryId: 'mentiuni-pj',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
      slot(COMMON_SLOTS.hotarareAGA, 2),
      slot(COMMON_SLOTS.actConstitutivActualizat, 3),
      slot({ name: 'Dovada noului sediu social', category: 'sediu', required: true }, 4),
      slot(
        {
          name: 'Acordul asociației de proprietari',
          description: 'Pentru sediu în bloc',
          category: 'sediu',
          required: false,
        },
        5
      ),
      slot(COMMON_SLOTS.certificatFiscalANAF, 6),
      slot(COMMON_SLOTS.certificatFiscalLocal, 7),
    ],
  },
  {
    procedureId: 'transfer-sediu-se',
    name: 'Transfer sediu SE',
    description: 'Transferul sediului unei societăți europene în alt stat membru',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
    categoryId: 'mentiuni',
    subcategoryId: 'mentiuni-pj',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
      slot({ name: 'Proiectul de transfer', category: 'acte_constitutive', required: true }, 2),
      slot({ name: 'Raportul organelor de conducere', category: 'rapoarte', required: true }, 3),
      slot(COMMON_SLOTS.hotarareAGA, 4),
      slot({ name: 'Noul statut SE', category: 'acte_constitutive', required: true }, 5),
      slot(
        {
          name: 'Certificat de la noul registru',
          description: 'Din statul membru de destinație',
          category: 'certificate',
          required: true,
        },
        6
      ),
    ],
  },
  {
    procedureId: 'infiintare-sedii-secundare',
    name: 'Înființare/Desființare sedii secundare',
    description: 'Deschiderea sau închiderea punctelor de lucru',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
    categoryId: 'mentiuni',
    subcategoryId: 'mentiuni-pj',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
      slot(COMMON_SLOTS.hotarareAGA, 2),
      slot(
        {
          name: 'Dovada sediului secundar',
          description: 'Pentru înființare',
          category: 'sediu',
          required: false,
        },
        3
      ),
      slot(
        {
          name: 'Act identitate reprezentant punct de lucru',
          category: 'identitate',
          required: false,
        },
        4
      ),
    ],
  },
  {
    procedureId: 'radiere-sucursala',
    name: 'Radierea sucursalei',
    description: 'Închiderea unei sucursale',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
    categoryId: 'mentiuni',
    subcategoryId: 'mentiuni-pj',
    slots: [
      slot({ name: 'Cerere de radiere sucursală', category: 'formulare', required: true }, 1),
      slot({ name: 'Hotărârea de închidere sucursală', category: 'hotarari', required: true }, 2),
      slot(COMMON_SLOTS.certificatFiscalANAF, 3),
      slot(COMMON_SLOTS.certificatFiscalLocal, 4),
    ],
  },
  {
    procedureId: 'prelungire-durata',
    name: 'Prelungirea duratei de funcționare',
    description: 'Extinderea perioadei de funcționare a societății',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
    categoryId: 'mentiuni',
    subcategoryId: 'mentiuni-pj',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
      slot(COMMON_SLOTS.hotarareAGA, 2),
      slot(COMMON_SLOTS.actConstitutivActualizat, 3),
    ],
  },
  {
    procedureId: 'reducere-durata',
    name: 'Reducerea duratei de funcționare',
    description: 'Scurtarea perioadei de funcționare a societății',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
    categoryId: 'mentiuni',
    subcategoryId: 'mentiuni-pj',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
      slot(COMMON_SLOTS.hotarareAGA, 2),
      slot(COMMON_SLOTS.actConstitutivActualizat, 3),
    ],
  },
  {
    procedureId: 'modificare-obiect-activitate',
    name: 'Modificarea obiectului de activitate',
    description: 'Schimbarea domeniilor de activitate (coduri CAEN)',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
    categoryId: 'mentiuni',
    subcategoryId: 'mentiuni-pj',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
      slot(COMMON_SLOTS.hotarareAGA, 2),
      slot(COMMON_SLOTS.actConstitutivActualizat, 3),
      slot(
        {
          name: 'Autorizații/avize speciale',
          description: 'Pentru activități reglementate',
          category: 'autorizatii',
          required: false,
        },
        4
      ),
    ],
  },
  {
    procedureId: 'actualizare-obiect-activitate',
    name: 'Actualizarea obiectului de activitate',
    description: 'Actualizarea codurilor CAEN conform noii clasificări',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
    categoryId: 'mentiuni',
    subcategoryId: 'mentiuni-pj',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
      slot(
        {
          name: 'Declarație actualizare CAEN',
          description: 'Tabel de corespondență coduri CAEN',
          category: 'formulare',
          required: true,
        },
        2
      ),
    ],
  },
  {
    procedureId: 'suspendare-activitate',
    name: 'Suspendare/Reluare activitate',
    description: 'Suspendarea temporară sau reluarea activității',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
    categoryId: 'mentiuni',
    subcategoryId: 'mentiuni-pj',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
      slot(COMMON_SLOTS.hotarareAGA, 2),
      slot(COMMON_SLOTS.certificatFiscalANAF, 3),
      slot(COMMON_SLOTS.certificatFiscalLocal, 4),
    ],
  },
  {
    procedureId: 'majorare-capital',
    name: 'Majorare capital social',
    description: 'Creșterea capitalului social',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
    categoryId: 'mentiuni',
    subcategoryId: 'mentiuni-pj',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
      slot(COMMON_SLOTS.hotarareAGA, 2),
      slot(COMMON_SLOTS.actConstitutivActualizat, 3),
      slot(COMMON_SLOTS.dovadaAport, 4),
      slot(
        {
          name: 'Raport evaluare aport în natură',
          description: 'Pentru aport în natură',
          category: 'rapoarte',
          required: false,
        },
        5
      ),
      slot(
        {
          name: 'Acte identitate noi asociați',
          description: 'Pentru majorare cu aport nou asociat',
          category: 'identitate',
          required: false,
        },
        6
      ),
    ],
  },
  {
    procedureId: 'reducere-capital',
    name: 'Reducere capital social',
    description: 'Diminuarea capitalului social',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
    categoryId: 'mentiuni',
    subcategoryId: 'mentiuni-pj',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
      slot(COMMON_SLOTS.hotarareAGA, 2),
      slot(COMMON_SLOTS.actConstitutivActualizat, 3),
      slot(
        {
          name: 'Dovada publicării în Monitorul Oficial',
          description: 'Pentru opoziții',
          category: 'publicatii',
          required: true,
        },
        4
      ),
      slot({ name: 'Situații financiare', category: 'financiar', required: true }, 5),
    ],
  },
  {
    procedureId: 'cesiune-parti-sociale',
    name: 'Transmiterea părților sociale',
    description: 'Cesiunea sau vânzarea părților sociale/de interes',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
    categoryId: 'mentiuni',
    subcategoryId: 'mentiuni-pj',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
      slot(COMMON_SLOTS.contractCesiune, 2),
      slot(COMMON_SLOTS.hotarareAGA, 3),
      slot(COMMON_SLOTS.actConstitutivActualizat, 4),
      slot(
        {
          name: 'Act identitate cesionar',
          description: 'Pentru noul asociat',
          category: 'identitate',
          required: true,
        },
        5
      ),
      slot(COMMON_SLOTS.declaratieBeneficiarReal, 6),
    ],
  },
  {
    procedureId: 'excludere-retragere-asociati',
    name: 'Excludere/Retragere asociați',
    description: 'Excluderea sau retragerea asociaților din societate',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
    categoryId: 'mentiuni',
    subcategoryId: 'mentiuni-pj',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
      slot(COMMON_SLOTS.hotarareAGA, 2),
      slot(COMMON_SLOTS.actConstitutivActualizat, 3),
      slot(
        {
          name: 'Hotărâre judecătorească',
          description: 'Pentru excludere',
          category: 'hotarari',
          required: false,
        },
        4
      ),
      slot(
        {
          name: 'Cerere de retragere',
          description: 'Pentru retragere voluntară',
          category: 'formulare',
          required: false,
        },
        5
      ),
      slot(COMMON_SLOTS.declaratieBeneficiarReal, 6),
    ],
  },
  {
    procedureId: 'schimbare-administrator',
    name: 'Schimbarea organelor de conducere',
    description: 'Numirea/revocarea administratorilor, directorilor, cenzorilor',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
    categoryId: 'mentiuni',
    subcategoryId: 'mentiuni-pj',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
      slot(COMMON_SLOTS.hotarareAGA, 2),
      slot(COMMON_SLOTS.actConstitutivActualizat, 3),
      slot(
        { name: 'Act identitate noul administrator', category: 'identitate', required: true },
        4
      ),
      slot(
        { name: 'Specimen semnătură noul administrator', category: 'declaratii', required: true },
        5
      ),
      slot(
        {
          name: 'Declarație pe propria răspundere noul administrator',
          category: 'declaratii',
          required: true,
        },
        6
      ),
      slot(
        {
          name: 'Acceptul cenzorilor/auditorului',
          description: 'Pentru numire cenzori',
          category: 'declaratii',
          required: false,
        },
        7
      ),
    ],
  },
  {
    procedureId: 'modificare-date-identificare',
    name: 'Modificarea datelor de identificare',
    description: 'Actualizarea datelor personale ale asociaților/administratorilor',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
    categoryId: 'mentiuni',
    subcategoryId: 'mentiuni-pj',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
      slot(
        {
          name: 'Documente justificative',
          description: 'Noul act de identitate, certificat de căsătorie etc.',
          category: 'identitate',
          required: true,
        },
        2
      ),
      slot(COMMON_SLOTS.actConstitutivActualizat, 3),
    ],
  },
  {
    procedureId: 'modificari-gie-geie',
    name: 'Modificări GIE/GEIE',
    description: 'Modificări specifice grupurilor de interes economic',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
    categoryId: 'mentiuni',
    subcategoryId: 'mentiuni-pj',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
      slot({ name: 'Hotărârea organului competent GIE', category: 'hotarari', required: true }, 2),
      slot(
        {
          name: 'Actul modificator',
          description: 'Act adițional la contractul de constituire',
          category: 'acte_constitutive',
          required: true,
        },
        3
      ),
      slot(
        {
          name: 'Hotărârile membrilor PJ',
          description: 'Hotărârile societăților membre',
          category: 'hotarari',
          required: false,
        },
        4
      ),
    ],
  },
  {
    procedureId: 'fuziune-constituire',
    name: 'Fuziune prin constituire',
    description: 'Fuziunea societăților într-o societate nouă',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
    categoryId: 'mentiuni',
    subcategoryId: 'mentiuni-pj',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrare, 1),
      slot({ name: 'Proiectul de fuziune', category: 'acte_constitutive', required: true }, 2),
      slot({ name: 'Statutul noii societăți', category: 'acte_constitutive', required: true }, 3),
      slot({ name: 'Raportul organelor de conducere', category: 'rapoarte', required: true }, 4),
      slot(
        {
          name: 'Raportul expertului',
          description: 'Pentru SA/SCA',
          category: 'rapoarte',
          required: false,
        },
        5
      ),
      slot(
        { name: 'Hotărârile AGA ale societăților fuzionate', category: 'hotarari', required: true },
        6
      ),
      slot(
        { name: 'Situații financiare societăți fuzionate', category: 'financiar', required: true },
        7
      ),
      slot(
        { name: 'Dovada publicării în Monitorul Oficial', category: 'publicatii', required: true },
        8
      ),
      slot(
        {
          name: 'Certificate fiscale societăți fuzionate',
          category: 'certificate',
          required: true,
        },
        9
      ),
    ],
  },
  {
    procedureId: 'fuziune-absorbtie',
    name: 'Fuziune prin absorbție',
    description: 'Fuziunea societăților cu o societate existentă',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
    categoryId: 'mentiuni',
    subcategoryId: 'mentiuni-pj',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
      slot({ name: 'Proiectul de fuziune', category: 'acte_constitutive', required: true }, 2),
      slot(COMMON_SLOTS.actConstitutivActualizat, 3),
      slot({ name: 'Raportul organelor de conducere', category: 'rapoarte', required: true }, 4),
      slot(
        {
          name: 'Raportul expertului',
          description: 'Pentru SA/SCA',
          category: 'rapoarte',
          required: false,
        },
        5
      ),
      slot(
        { name: 'Hotărârile AGA ale tuturor societăților', category: 'hotarari', required: true },
        6
      ),
      slot({ name: 'Situații financiare', category: 'financiar', required: true }, 7),
      slot(
        { name: 'Dovada publicării în Monitorul Oficial', category: 'publicatii', required: true },
        8
      ),
      slot(
        {
          name: 'Certificate fiscale societăți absorbite',
          category: 'certificate',
          required: true,
        },
        9
      ),
    ],
  },
  {
    procedureId: 'fuziune-transfrontaliera',
    name: 'Fuziune transfrontalieră',
    description: 'Fuziunea cu societăți din alte state membre UE',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
    categoryId: 'mentiuni',
    subcategoryId: 'mentiuni-pj',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
      slot(
        {
          name: 'Proiectul comun de fuziune transfrontalieră',
          category: 'acte_constitutive',
          required: true,
        },
        2
      ),
      slot({ name: 'Raportul organelor de conducere', category: 'rapoarte', required: true }, 3),
      slot({ name: 'Raportul expertului independent', category: 'rapoarte', required: true }, 4),
      slot(
        {
          name: 'Hotărârile AGA ale societăților participante',
          category: 'hotarari',
          required: true,
        },
        5
      ),
      slot(
        {
          name: 'Certificate de legalitate',
          description: 'De la autoritățile din statele membre',
          category: 'certificate',
          required: true,
        },
        6
      ),
      slot(
        {
          name: 'Statutul/actul constitutiv rezultat',
          category: 'acte_constitutive',
          required: true,
        },
        7
      ),
    ],
  },
  {
    procedureId: 'transformare-transfrontaliera',
    name: 'Transformare transfrontalieră',
    description: 'Transformarea într-o societate din alt stat membru',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
    categoryId: 'mentiuni',
    subcategoryId: 'mentiuni-pj',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
      slot({ name: 'Proiectul de transformare', category: 'acte_constitutive', required: true }, 2),
      slot({ name: 'Raportul organelor de conducere', category: 'rapoarte', required: true }, 3),
      slot({ name: 'Raportul expertului independent', category: 'rapoarte', required: true }, 4),
      slot(COMMON_SLOTS.hotarareAGA, 5),
      slot(
        {
          name: 'Noul statut',
          description: 'Conform legislației statului de destinație',
          category: 'acte_constitutive',
          required: true,
        },
        6
      ),
    ],
  },
  {
    procedureId: 'divizare-transfrontaliera',
    name: 'Divizare transfrontalieră',
    description: 'Divizarea cu societăți din alte state membre UE',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
    categoryId: 'mentiuni',
    subcategoryId: 'mentiuni-pj',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
      slot(
        {
          name: 'Proiectul de divizare transfrontalieră',
          category: 'acte_constitutive',
          required: true,
        },
        2
      ),
      slot({ name: 'Raportul organelor de conducere', category: 'rapoarte', required: true }, 3),
      slot({ name: 'Raportul expertului independent', category: 'rapoarte', required: true }, 4),
      slot(COMMON_SLOTS.hotarareAGA, 5),
      slot({ name: 'Certificate de legalitate', category: 'certificate', required: true }, 6),
      slot(
        { name: 'Statutele societăților rezultate', category: 'acte_constitutive', required: true },
        7
      ),
    ],
  },
  {
    procedureId: 'divizare-partiala-existente',
    name: 'Divizare parțială (societăți existente)',
    description: 'Divizarea parțială către societăți existente',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
    categoryId: 'mentiuni',
    subcategoryId: 'mentiuni-pj',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrareMentiuni, 1),
      slot(
        { name: 'Proiectul de divizare parțială', category: 'acte_constitutive', required: true },
        2
      ),
      slot({ name: 'Raportul organelor de conducere', category: 'rapoarte', required: true }, 3),
      slot(
        { name: 'Hotărârile AGA ale societăților implicate', category: 'hotarari', required: true },
        4
      ),
      slot(
        { name: 'Actele constitutive actualizate', category: 'acte_constitutive', required: true },
        5
      ),
      slot({ name: 'Situații financiare', category: 'financiar', required: true }, 6),
      slot(
        { name: 'Dovada publicării în Monitorul Oficial', category: 'publicatii', required: true },
        7
      ),
    ],
  },
  {
    procedureId: 'divizare-partiala-noi',
    name: 'Divizare parțială (societăți noi)',
    description: 'Divizarea parțială către societăți nou constituite',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
    categoryId: 'mentiuni',
    subcategoryId: 'mentiuni-pj',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrare, 1),
      slot(
        { name: 'Proiectul de divizare parțială', category: 'acte_constitutive', required: true },
        2
      ),
      slot(
        { name: 'Statutele noilor societăți', category: 'acte_constitutive', required: true },
        3
      ),
      slot({ name: 'Raportul organelor de conducere', category: 'rapoarte', required: true }, 4),
      slot(COMMON_SLOTS.hotarareAGA, 5),
      slot(
        {
          name: 'Actul constitutiv actualizat societate care se divizează',
          category: 'acte_constitutive',
          required: true,
        },
        6
      ),
      slot({ name: 'Situații financiare', category: 'financiar', required: true }, 7),
      slot(
        { name: 'Dovada publicării în Monitorul Oficial', category: 'publicatii', required: true },
        8
      ),
    ],
  },
  {
    procedureId: 'divizare-totala',
    name: 'Divizare totală',
    description: 'Divizarea completă a societății',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/mentiuni/persoane-juridice',
    categoryId: 'mentiuni',
    subcategoryId: 'mentiuni-pj',
    slots: [
      slot(COMMON_SLOTS.cerereInregistrare, 1),
      slot(
        { name: 'Proiectul de divizare totală', category: 'acte_constitutive', required: true },
        2
      ),
      slot(
        {
          name: 'Statutele societăților beneficiare',
          category: 'acte_constitutive',
          required: true,
        },
        3
      ),
      slot({ name: 'Raportul organelor de conducere', category: 'rapoarte', required: true }, 4),
      slot(
        {
          name: 'Raportul expertului',
          description: 'Pentru SA/SCA',
          category: 'rapoarte',
          required: false,
        },
        5
      ),
      slot(COMMON_SLOTS.hotarareAGA, 6),
      slot({ name: 'Situații financiare', category: 'financiar', required: true }, 7),
      slot(
        { name: 'Dovada publicării în Monitorul Oficial', category: 'publicatii', required: true },
        8
      ),
      slot(
        { name: 'Certificate fiscale societate divizată', category: 'certificate', required: true },
        9
      ),
    ],
  },

  // ==========================================================================
  // DIZOLVĂRI / LICHIDĂRI / RADIERI - PERSOANE FIZICE
  // ==========================================================================
  {
    procedureId: 'desfiintare-pfa',
    name: 'Desființare PFA',
    description: 'Radierea persoanei fizice autorizate',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/dizolvari-lichidari-radieri/persoane-fizice',
    categoryId: 'dizolvari',
    subcategoryId: 'dizolvari-pf',
    slots: [
      slot({ name: 'Cerere de radiere PFA', category: 'formulare', required: true }, 1),
      slot(COMMON_SLOTS.actIdentitateTitular, 2),
      slot(COMMON_SLOTS.certificatFiscalANAF, 3),
      slot(COMMON_SLOTS.certificatFiscalLocal, 4),
      slot(COMMON_SLOTS.declaratieProprieRaspundere, 5),
    ],
  },
  {
    procedureId: 'desfiintare-ii',
    name: 'Desființare II',
    description: 'Radierea întreprinderii individuale',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/dizolvari-lichidari-radieri/persoane-fizice',
    categoryId: 'dizolvari',
    subcategoryId: 'dizolvari-pf',
    slots: [
      slot({ name: 'Cerere de radiere II', category: 'formulare', required: true }, 1),
      slot(COMMON_SLOTS.actIdentitateTitular, 2),
      slot(COMMON_SLOTS.certificatFiscalANAF, 3),
      slot(COMMON_SLOTS.certificatFiscalLocal, 4),
      slot(COMMON_SLOTS.declaratieProprieRaspundere, 5),
    ],
  },
  {
    procedureId: 'desfiintare-if',
    name: 'Desființare IF',
    description: 'Radierea întreprinderii familiale',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/dizolvari-lichidari-radieri/persoane-fizice',
    categoryId: 'dizolvari',
    subcategoryId: 'dizolvari-pf',
    slots: [
      slot({ name: 'Cerere de radiere IF', category: 'formulare', required: true }, 1),
      slot({ name: 'Acordul membrilor pentru dizolvare', category: 'hotarari', required: true }, 2),
      slot({ name: 'Acte de identitate membri', category: 'identitate', required: true }, 3),
      slot(COMMON_SLOTS.certificatFiscalANAF, 4),
      slot(COMMON_SLOTS.certificatFiscalLocal, 5),
      slot(COMMON_SLOTS.declaratieProprieRaspundere, 6),
    ],
  },

  // ==========================================================================
  // DIZOLVĂRI / LICHIDĂRI / RADIERI - PERSOANE JURIDICE
  // ==========================================================================
  {
    procedureId: 'dizolvare-lichidare-simultana',
    name: 'Dizolvare și lichidare simultană',
    description: 'Procedură simplificată pentru SNC, SCS, SRL și GIE',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/dizolvari-lichidari-radieri/persoane-juridice',
    categoryId: 'dizolvari',
    subcategoryId: 'dizolvari-pj',
    slots: [
      slot(
        {
          name: 'Cerere de înregistrare dizolvare și radiere',
          category: 'formulare',
          required: true,
        },
        1
      ),
      slot(
        { name: 'Hotărârea AGA de dizolvare și lichidare', category: 'hotarari', required: true },
        2
      ),
      slot(COMMON_SLOTS.certificatFiscalANAF, 3),
      slot(COMMON_SLOTS.certificatFiscalLocal, 4),
      slot(
        {
          name: 'Situații financiare de lichidare',
          description: 'Bilanț de lichidare',
          category: 'financiar',
          required: true,
        },
        5
      ),
      slot(
        { name: 'Declarație privind achitarea datoriilor', category: 'declaratii', required: true },
        6
      ),
      slot(
        {
          name: 'Declarație privind repartizarea activelor',
          category: 'declaratii',
          required: true,
        },
        7
      ),
    ],
  },
  {
    procedureId: 'dizolvare-voluntara-lichidator',
    name: 'Dizolvare voluntară cu lichidator',
    description: 'Dizolvare cu numire de lichidator pentru toate tipurile de societăți',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/dizolvari-lichidari-radieri/persoane-juridice',
    categoryId: 'dizolvari',
    subcategoryId: 'dizolvari-pj',
    slots: [
      slot({ name: 'Cerere înregistrare dizolvare', category: 'formulare', required: true }, 1),
      slot({ name: 'Hotărârea AGA de dizolvare', category: 'hotarari', required: true }, 2),
      slot({ name: 'Act identitate lichidator', category: 'identitate', required: true }, 3),
      slot({ name: 'Specimen semnătură lichidator', category: 'declaratii', required: true }, 4),
      slot(
        {
          name: 'Contract lichidator',
          description: 'Contract cu lichidatorul',
          category: 'contracte',
          required: true,
        },
        5
      ),
      slot(
        { name: 'Dovada publicării în Monitorul Oficial', category: 'publicatii', required: true },
        6
      ),
      // Pentru radiere (după lichidare):
      slot(
        {
          name: 'Cerere de radiere',
          description: 'După finalizarea lichidării',
          category: 'formulare',
          required: true,
        },
        7
      ),
      slot({ name: 'Raportul lichidatorului', category: 'rapoarte', required: true }, 8),
      slot({ name: 'Bilanțul final de lichidare', category: 'financiar', required: true }, 9),
      slot(COMMON_SLOTS.certificatFiscalANAF, 10),
      slot(COMMON_SLOTS.certificatFiscalLocal, 11),
    ],
  },
  {
    procedureId: 'dizolvare-judiciara-nulitate',
    name: 'Dizolvare judiciară pentru nulitate',
    description: 'Dizolvare dispusă de instanță pentru nulitatea actelor constitutive',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/dizolvari-lichidari-radieri/persoane-juridice',
    categoryId: 'dizolvari',
    subcategoryId: 'dizolvari-pj',
    slots: [
      slot({ name: 'Cerere înregistrare mențiune', category: 'formulare', required: true }, 1),
      slot(
        {
          name: 'Hotărârea judecătorească definitivă',
          description: 'Privind dizolvarea',
          category: 'hotarari',
          required: true,
        },
        2
      ),
      slot(
        {
          name: 'Act identitate lichidator',
          description: 'Numit de instanță',
          category: 'identitate',
          required: true,
        },
        3
      ),
      slot({ name: 'Specimen semnătură lichidator', category: 'declaratii', required: true }, 4),
    ],
  },
  {
    procedureId: 'dizolvare-deces',
    name: 'Dizolvare urmare deces',
    description: 'Dizolvare ca urmare a decesului asociatului unic',
    sourceUrl: 'https://www.onrc.ro/index.php/ro/dizolvari-lichidari-radieri/persoane-juridice',
    categoryId: 'dizolvari',
    subcategoryId: 'dizolvari-pj',
    slots: [
      slot({ name: 'Cerere înregistrare mențiune', category: 'formulare', required: true }, 1),
      slot({ name: 'Certificatul de deces', category: 'identitate', required: true }, 2),
      slot(
        {
          name: 'Certificat de moștenitor',
          description: 'Sau declarație notarială a moștenitorilor',
          category: 'certificate',
          required: true,
        },
        3
      ),
      slot({ name: 'Acte de identitate moștenitori', category: 'identitate', required: true }, 4),
      slot(
        {
          name: 'Hotărârea moștenitorilor',
          description: 'Privind dizolvarea sau continuarea',
          category: 'hotarari',
          required: true,
        },
        5
      ),
    ],
  },
];

// ============================================================================
// SEEDING FUNCTIONS
// ============================================================================

async function seedONRCTemplates() {
  console.log('🏛️  Seeding ONRC Templates...');
  console.log(`   Found ${ONRC_TEMPLATES.length} procedure templates to seed`);

  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const template of ONRC_TEMPLATES) {
    try {
      const existingTemplate = await prisma.mapaTemplate.findFirst({
        where: { procedureId: template.procedureId },
      });

      const templateData = {
        name: template.name,
        description: template.description,
        sourceUrl: template.sourceUrl,
        isONRC: true,
        isLocked: true,
        isActive: true,
        slotDefinitions: template.slots as unknown as object,
        contentHash: Buffer.from(JSON.stringify(template.slots))
          .toString('base64')
          .substring(0, 32),
        lastSynced: new Date(),
        updatedAt: new Date(),
      };

      if (existingTemplate) {
        await prisma.mapaTemplate.update({
          where: { id: existingTemplate.id },
          data: templateData,
        });
        updated++;
      } else {
        await prisma.mapaTemplate.create({
          data: {
            id: createId(),
            procedureId: template.procedureId,
            ...templateData,
            createdAt: new Date(),
          } as any,
        });
        created++;
      }
    } catch (error) {
      console.error(`   ❌ Error with template ${template.procedureId}:`, error);
      errors++;
    }
  }

  console.log(`   ✅ Created: ${created}, Updated: ${updated}, Errors: ${errors}`);
  console.log(`   Total ONRC templates in database: ${created + updated}`);
}

async function main() {
  console.log('\n========================================');
  console.log('   ONRC Templates Seeder');
  console.log('========================================\n');

  try {
    await seedONRCTemplates();

    // Verify count
    const count = await prisma.mapaTemplate.count({
      where: { isONRC: true },
    });
    console.log(`\n✅ Total ONRC templates now in database: ${count}`);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
