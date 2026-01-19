/**
 * StepTemplate Component
 * Step 2 for "Sablon" creation type - Template selection with search.
 *
 * Features:
 * - Search input with real-time fuzzy filtering
 * - Category filter chips
 * - Template results list with name, description, CPC reference
 * - Popular templates shown by default
 */

import { useState, useMemo } from 'react';
import { searchTemplates } from '../../utils/fuzzy-search';
import type { WizardState } from '.';

// ============================================================================
// Types
// ============================================================================

type CourtFilingCategory = 'faza-initiala' | 'interventii' | 'cai-atac' | 'executare' | 'speciale';

type FormCategory = 'A' | 'B' | 'C';

export interface CourtFilingTemplate {
  id: string;
  name: string;
  description: string;
  category: CourtFilingCategory;
  formCategory: FormCategory;
  cpcArticles: string[];
  partyLabels: {
    party1: string;
    party2: string;
    party3?: string;
  };
  requiredSections: string[];
  keywords: string[];
}

interface StepTemplateProps {
  state: WizardState;
  onBack?: () => void;
  onSelectTemplate: (template: CourtFilingTemplate) => void;
  animationClass?: string;
}

// ============================================================================
// Category Display Names (Romanian)
// ============================================================================

const CATEGORY_DISPLAY_NAMES: Record<CourtFilingCategory, string> = {
  'faza-initiala': 'Faza Initiala',
  interventii: 'Interventii',
  'cai-atac': 'Cai de Atac',
  executare: 'Executare Silita',
  speciale: 'Proceduri Speciale',
};

const CATEGORIES: CourtFilingCategory[] = [
  'faza-initiala',
  'interventii',
  'cai-atac',
  'executare',
  'speciale',
];

// Popular template IDs shown by default
const POPULAR_TEMPLATE_IDS = ['CF-01', 'CF-02', 'CF-10'];

// ============================================================================
// Template Data (Static - defined locally for frontend)
// ============================================================================

const COURT_FILING_TEMPLATES: CourtFilingTemplate[] = [
  // Faza Initiala (CF-01 to CF-04)
  {
    id: 'CF-01',
    name: 'Cerere de chemare in judecata',
    description:
      'Actul introductiv de instanta prin care reclamantul solicita protectia unui drept subiectiv civil sau a unei situatii juridice. Trebuie sa cuprinda toate elementele prevazute de Art. 194 CPC.',
    category: 'faza-initiala',
    formCategory: 'A',
    cpcArticles: ['Art. 194', 'Art. 195', 'Art. 196'],
    partyLabels: { party1: 'Reclamant', party2: 'Parat' },
    requiredSections: [
      'Antet instanta',
      'Identificare Reclamant',
      'Identificare Parat',
      'Obiectul cererii si valoarea',
      'Competenta instantei',
      'Situatia de fapt',
      'Temeiul de drept',
      'Pretentii',
      'Dovezi',
      'Cheltuieli de judecata',
      'Anexe',
      'Semnatura',
    ],
    keywords: [
      'cerere',
      'chemare in judecata',
      'actiune',
      'reclamant',
      'parat',
      'pretentii',
      'civil',
    ],
  },
  {
    id: 'CF-02',
    name: 'Intampinare',
    description:
      'Actul de procedura prin care paratul raspunde la cererea de chemare in judecata, invocand exceptii si aparari. Depunere obligatorie in 25 zile de la comunicare conform Art. 205 CPC.',
    category: 'faza-initiala',
    formCategory: 'B',
    cpcArticles: ['Art. 205', 'Art. 206', 'Art. 207', 'Art. 208'],
    partyLabels: { party1: 'Parat', party2: 'Reclamant' },
    requiredSections: [
      'Instanta si numar dosar',
      'Identificare parti',
      'Obiect',
      'Exceptii procesuale',
      'Situatia de fapt',
      'Apararea juridica',
      'Dovezi',
      'Cereri',
      'Anexe',
      'Semnatura',
    ],
    keywords: ['intampinare', 'raspuns', 'aparare', 'exceptii', 'parat', 'defensiva'],
  },
  {
    id: 'CF-03',
    name: 'Raspuns la intampinare',
    description:
      'Actul prin care reclamantul raspunde la intampinarea paratului. Facultativ, termen 10 zile de la comunicarea intampinarii.',
    category: 'faza-initiala',
    formCategory: 'C',
    cpcArticles: ['Art. 201', 'Art. 148'],
    partyLabels: { party1: 'Reclamant', party2: 'Parat' },
    requiredSections: [
      'Instanta si numar dosar',
      'Identificare parti',
      'Raspuns la exceptii',
      'Contraargumente',
      'Mentinerea pretentiilor',
      'Dovezi suplimentare',
      'Semnatura',
    ],
    keywords: ['raspuns', 'intampinare', 'replica', 'reclamant', 'contraargumente'],
  },
  {
    id: 'CF-04',
    name: 'Cerere reconventionala',
    description:
      'Cererea prin care paratul formuleaza pretentii proprii impotriva reclamantului in cadrul aceluiasi proces.',
    category: 'faza-initiala',
    formCategory: 'A',
    cpcArticles: ['Art. 209', 'Art. 210', 'Art. 194'],
    partyLabels: {
      party1: 'Parat-Reclamant reconventional',
      party2: 'Reclamant-Parat reconventional',
    },
    requiredSections: [
      'Antet instanta + numar dosar',
      'Identificare parti',
      'Obiect si valoare',
      'Legatura cu cererea principala',
      'Situatia de fapt',
      'Temeiul de drept',
      'Pretentii',
      'Dovezi',
      'Anexe',
      'Semnatura',
    ],
    keywords: ['reconventionala', 'cerere', 'parat', 'pretentii', 'contraactiune'],
  },
  // Interventii (CF-05 to CF-09)
  {
    id: 'CF-05',
    name: 'Cerere de interventie principala',
    description:
      'Cererea prin care un tert pretinde pentru sine, in tot sau in parte, dreptul dedus judecatii.',
    category: 'interventii',
    formCategory: 'A',
    cpcArticles: ['Art. 61', 'Art. 62', 'Art. 194'],
    partyLabels: { party1: 'Intervenient principal', party2: 'Reclamant', party3: 'Parat' },
    requiredSections: [
      'Instanta si numar dosar',
      'Parti initiale',
      'Intervenient principal',
      'Obiectul interventiei',
      'Situatia de fapt',
      'Temeiul de drept',
      'Pretentii',
      'Dovezi',
      'Anexe',
      'Semnatura',
    ],
    keywords: ['interventie', 'principala', 'tert', 'drept propriu', 'intervenient'],
  },
  {
    id: 'CF-06',
    name: 'Cerere de interventie accesorie',
    description:
      'Cererea prin care un tert intervine in proces pentru a sprijini apararea uneia dintre parti.',
    category: 'interventii',
    formCategory: 'C',
    cpcArticles: ['Art. 63', 'Art. 148'],
    partyLabels: { party1: 'Intervenient accesoriu', party2: 'in favoarea [parte]' },
    requiredSections: [
      'Instanta si numar dosar',
      'Parti initiale',
      'Intervenient accesoriu',
      'Partea in favoarea careia intervine',
      'Interesul interventiei',
      'Motivele sprijinirii',
      'Dovezi',
      'Semnatura',
    ],
    keywords: ['interventie', 'accesorie', 'tert', 'sprijin', 'interes'],
  },
  {
    id: 'CF-07',
    name: 'Cerere de chemare in judecata a altor persoane',
    description:
      'Cererea prin care o parte solicita introducerea in proces a unui tert care ar putea pretinde aceleasi drepturi ca reclamantul.',
    category: 'interventii',
    formCategory: 'A',
    cpcArticles: ['Art. 68', 'Art. 69', 'Art. 194'],
    partyLabels: { party1: '[Parte]', party2: 'Tert chemat' },
    requiredSections: [
      'Instanta si numar dosar',
      'Parte solicitanta',
      'Tert chemat in judecata',
      'Motivarea',
      'Inscrisuri anexate',
      'Semnatura',
    ],
    keywords: ['chemare', 'tert', 'introducere', 'alte persoane', 'proces'],
  },
  {
    id: 'CF-08',
    name: 'Cerere de chemare in garantie',
    description:
      'Cererea prin care o parte introduce in proces un tert care ar putea fi obligat la despagubiri in cazul pierderii procesului.',
    category: 'interventii',
    formCategory: 'A',
    cpcArticles: ['Art. 72', 'Art. 73', 'Art. 74', 'Art. 194'],
    partyLabels: { party1: 'Chemator in garantie', party2: 'Chemat in garantie' },
    requiredSections: [
      'Instanta si numar dosar',
      'Chemator in garantie',
      'Chemat in garantie',
      'Temeiul garantiei',
      'Situatia de fapt',
      'Prejudiciul potential',
      'Solicitari',
      'Dovezi',
      'Anexe',
      'Semnatura',
    ],
    keywords: ['garantie', 'chemare', 'tert', 'despagubiri', 'regres'],
  },
  {
    id: 'CF-09',
    name: 'Cerere de aratare a titularului dreptului',
    description:
      'Cererea prin care paratul indica pe adevaratul titular al dreptului litigios, pentru a fi scos din proces.',
    category: 'interventii',
    formCategory: 'C',
    cpcArticles: ['Art. 75', 'Art. 76', 'Art. 77', 'Art. 148'],
    partyLabels: { party1: 'Parat', party2: 'Titular indicat' },
    requiredSections: [
      'Instanta si numar dosar',
      'Parat (detentor)',
      'Titularul dreptului indicat',
      'Calitatea in care paratul detine bunul',
      'Motivarea',
      'Dovezi',
      'Semnatura',
    ],
    keywords: ['titular', 'drept', 'aratare', 'detentor', 'drepturi reale'],
  },
  // Cai de Atac (CF-10 to CF-16)
  {
    id: 'CF-10',
    name: 'Cerere de apel',
    description:
      'Cale ordinara de atac prin care se solicita reformarea hotararii primei instante. Termen 30 zile de la comunicare.',
    category: 'cai-atac',
    formCategory: 'A',
    cpcArticles: ['Art. 466', 'Art. 467', 'Art. 468', 'Art. 469', 'Art. 470'],
    partyLabels: { party1: 'Apelant', party2: 'Intimat' },
    requiredSections: [
      'Instanta a carei hotarare se ataca',
      'Hotararea atacata',
      'Identificare parti',
      'Obiectul cererii',
      'Motivele de fapt',
      'Motivele de drept',
      'Probele invocate',
      'Semnatura',
    ],
    keywords: ['apel', 'cale de atac', 'reformare', 'hotarare', 'apelant'],
  },
  {
    id: 'CF-11',
    name: 'Intampinare la apel',
    description:
      'Raspunsul intimatului la cererea de apel, cuprinzand aparari pe exceptii si pe fondul motivelor de apel.',
    category: 'cai-atac',
    formCategory: 'B',
    cpcArticles: ['Art. 471', 'Art. 205'],
    partyLabels: { party1: 'Intimat', party2: 'Apelant' },
    requiredSections: [
      'Instanta si numar dosar',
      'Identificare parti',
      'Exceptii procesuale',
      'Aparari pe fondul motivelor de apel',
      'Critica fiecarui motiv de apel',
      'Dovezi',
      'Solicitare',
      'Semnatura',
    ],
    keywords: ['intampinare', 'apel', 'intimat', 'raspuns', 'aparare'],
  },
  {
    id: 'CF-12',
    name: 'Cerere de recurs',
    description:
      'Cale extraordinara de atac pentru motive de nelegalitate. Motivele sunt limitativ prevazute la Art. 488 CPC.',
    category: 'cai-atac',
    formCategory: 'A',
    cpcArticles: ['Art. 483', 'Art. 486', 'Art. 487', 'Art. 488'],
    partyLabels: { party1: 'Recurent', party2: 'Intimat' },
    requiredSections: [
      'Instanta a carei hotarare se ataca',
      'Hotararea atacata',
      'Identificare parti',
      'Motivele de nelegalitate',
      'Dezvoltarea motivelor',
      'Dovezi',
      'Semnatura',
    ],
    keywords: ['recurs', 'cale de atac', 'nelegalitate', 'casare', 'recurent'],
  },
  {
    id: 'CF-13',
    name: 'Motive de recurs (dezvoltare)',
    description:
      'Dezvoltarea motivelor de recurs conform Art. 488 CPC. Cuprinde analiza fiecarui motiv de casare invocat.',
    category: 'cai-atac',
    formCategory: 'C',
    cpcArticles: ['Art. 487', 'Art. 488', 'Art. 148'],
    partyLabels: { party1: 'Recurent', party2: 'Intimat' },
    requiredSections: [
      'Instanta si numar dosar',
      'Identificare parti',
      'Motivul 1',
      'Dezvoltare motiv 1',
      'Motivul 2',
      'Dezvoltare motiv 2',
      'Concluzii',
      'Semnatura',
    ],
    keywords: ['motive', 'recurs', 'dezvoltare', 'casare', 'nelegalitate', '488'],
  },
  {
    id: 'CF-14',
    name: 'Apel/Recurs incident',
    description:
      'Calea de atac formulata de intimat dupa expirarea termenului de apel/recurs principal.',
    category: 'cai-atac',
    formCategory: 'C',
    cpcArticles: ['Art. 472', 'Art. 473', 'Art. 148'],
    partyLabels: { party1: 'Intimat-Apelant incident', party2: 'Apelant principal' },
    requiredSections: [
      'Instanta si numar dosar',
      'Intimat (apelant incident)',
      'Motivele reformarii solicitate',
      'Legatura cu apelul principal',
      'Dovezi',
      'Semnatura',
    ],
    keywords: ['apel', 'incident', 'recurs', 'intimat', 'accesoriu'],
  },
  {
    id: 'CF-15',
    name: 'Contestatie in anulare',
    description:
      'Cale extraordinara de atac impotriva hotararilor definitive pentru nelegala citare sau eroare materiala.',
    category: 'cai-atac',
    formCategory: 'C',
    cpcArticles: [
      'Art. 503',
      'Art. 504',
      'Art. 505',
      'Art. 506',
      'Art. 507',
      'Art. 508',
      'Art. 148',
    ],
    partyLabels: { party1: 'Contestator', party2: 'Intimat' },
    requiredSections: [
      'Instanta a carei hotarare se ataca',
      'Hotararea contestata',
      'Identificare parti',
      'Motivul contestatiei',
      'Dovezi ale motivului',
      'Solicitare',
      'Semnatura',
    ],
    keywords: ['contestatie', 'anulare', 'hotarare definitiva', 'citare', 'eroare'],
  },
  {
    id: 'CF-16',
    name: 'Cerere de revizuire',
    description:
      'Cale extraordinara de atac pentru retractarea hotararii in cazurile prevazute de Art. 509 CPC.',
    category: 'cai-atac',
    formCategory: 'C',
    cpcArticles: ['Art. 509', 'Art. 510', 'Art. 511', 'Art. 512', 'Art. 513', 'Art. 148'],
    partyLabels: { party1: 'Revizuent', party2: 'Intimat' },
    requiredSections: [
      'Instanta',
      'Hotararea atacata',
      'Identificare parti',
      'Motivul de revizuire',
      'Dezvoltarea motivului',
      'Dovezi noi',
      'Verificare termen',
      'Semnatura',
    ],
    keywords: ['revizuire', 'retractare', 'inscrisuri noi', 'hotarari contradictorii'],
  },
  // Executare Silita (CF-17 to CF-20)
  {
    id: 'CF-17',
    name: 'Cerere de incuviintare a executarii silite',
    description:
      'Cererea adresata executorului judecatoresc pentru incuviintarea executarii unui titlu executoriu.',
    category: 'executare',
    formCategory: 'C',
    cpcArticles: ['Art. 666', 'Art. 148'],
    partyLabels: { party1: 'Creditor', party2: 'Debitor' },
    requiredSections: [
      'Executor judecatoresc',
      'Identificare Creditor',
      'Identificare Debitor',
      'Titlul executoriu',
      'Suma datorata',
      'Modalitatea de executare',
      'Anexe',
      'Semnatura',
    ],
    keywords: ['executare', 'incuviintare', 'titlu executoriu', 'creditor', 'debitor'],
  },
  {
    id: 'CF-18',
    name: 'Contestatie la executare',
    description:
      'Mijlocul procedural de contestare a executarii silite sau a actelor de executare. Termen 15 zile.',
    category: 'executare',
    formCategory: 'C',
    cpcArticles: ['Art. 712', 'Art. 713', 'Art. 714', 'Art. 715', 'Art. 148'],
    partyLabels: { party1: 'Contestator', party2: 'Intimat', party3: 'Executor' },
    requiredSections: [
      'Instanta de executare',
      'Contestator',
      'Intimat',
      'Actul contestat',
      'Motivele contestatiei',
      'Dovezi',
      'Solicitare',
      'Cautiune',
      'Semnatura',
    ],
    keywords: ['contestatie', 'executare', 'anulare', 'suspendare', 'executor'],
  },
  {
    id: 'CF-19',
    name: 'Cerere de suspendare a executarii silite',
    description:
      'Cererea de suspendare a executarii pana la solutionarea contestatiei. Necesita plata cautiunii.',
    category: 'executare',
    formCategory: 'C',
    cpcArticles: ['Art. 719', 'Art. 148'],
    partyLabels: { party1: 'Solicitant', party2: 'Creditor' },
    requiredSections: [
      'Instanta de executare',
      'Solicitant',
      'Creditor',
      'Dosarul de executare',
      'Motivele suspendarii',
      'Cautiune',
      'Dovada platii cautiunii',
      'Solicitare',
      'Semnatura',
    ],
    keywords: ['suspendare', 'executare', 'cautiune', 'contestatie'],
  },
  {
    id: 'CF-20',
    name: 'Cerere de ridicare poprire/sechestru',
    description:
      'Cererea de ridicare a masurii de poprire sau sechestru in cadrul executarii silite.',
    category: 'executare',
    formCategory: 'C',
    cpcArticles: ['Art. 733', 'Art. 745', 'Art. 148'],
    partyLabels: { party1: 'Debitor sau Tert', party2: 'Creditor' },
    requiredSections: [
      'Instanta de executare',
      'Debitor/Tert afectat',
      'Creditor',
      'Dosarul de executare',
      'Masura contestata',
      'Motivul ridicarii',
      'Dovezi',
      'Solicitare',
      'Semnatura',
    ],
    keywords: ['poprire', 'sechestru', 'ridicare', 'executare', 'debitor'],
  },
  // Proceduri Speciale (CF-21 to CF-30)
  {
    id: 'CF-21',
    name: 'Cerere de ordonanta de plata',
    description:
      'Procedura speciala pentru recuperarea creantelor certe, lichide si exigibile. Necesita somatie prealabila.',
    category: 'speciale',
    formCategory: 'C',
    cpcArticles: ['Art. 1014', 'Art. 1015', 'Art. 1016', 'Art. 1017', 'Art. 148'],
    partyLabels: { party1: 'Creditor', party2: 'Debitor' },
    requiredSections: [
      'Instanta',
      'Identificare Creditor',
      'Identificare Debitor',
      'Temeiul creantei',
      'Suma datorata',
      'Dovada caracterului cert, lichid, exigibil',
      'Somatia prealabila',
      'Dovezi',
      'Semnatura',
    ],
    keywords: ['ordonanta', 'plata', 'creanta', 'somatie', 'recuperare', 'procedura speciala'],
  },
  {
    id: 'CF-22',
    name: 'Cerere cu valoare redusa',
    description: 'Procedura simplificata pentru litigii cu valoare de pana la 50.000 lei.',
    category: 'speciale',
    formCategory: 'C',
    cpcArticles: ['Art. 1026', 'Art. 1027', 'Art. 1028', 'Art. 148'],
    partyLabels: { party1: 'Reclamant', party2: 'Parat' },
    requiredSections: [
      'Instanta',
      'Identificare Reclamant',
      'Identificare Parat',
      'Obiect (max 50.000 lei)',
      'Situatia de fapt',
      'Dovezi',
      'Mentiune procedura',
      'Semnatura',
    ],
    keywords: ['valoare redusa', 'procedura simplificata', 'litigii mici'],
  },
  {
    id: 'CF-23',
    name: 'Cerere de ordonanta presedintiala',
    description:
      'Procedura speciala pentru luarea de masuri provizorii in cazuri grabnice. Conditii: aparenta dreptului, urgenta.',
    category: 'speciale',
    formCategory: 'C',
    cpcArticles: ['Art. 996', 'Art. 997', 'Art. 998', 'Art. 148'],
    partyLabels: { party1: 'Reclamant', party2: 'Parat' },
    requiredSections: [
      'Instanta',
      'Identificare Reclamant',
      'Identificare Parat',
      'Aparenta dreptului',
      'Urgenta',
      'Masurile provizorii solicitate',
      'Prejudiciul iminent',
      'Dovezi',
      'Semnatura',
    ],
    keywords: ['ordonanta', 'presedintiala', 'urgenta', 'masuri provizorii', 'grabnic'],
  },
  {
    id: 'CF-24',
    name: 'Cerere de recuzare',
    description:
      'Cererea prin care o parte solicita indepartarea judecatorului pentru motive de incompatibilitate.',
    category: 'speciale',
    formCategory: 'C',
    cpcArticles: ['Art. 44', 'Art. 45', 'Art. 46', 'Art. 148'],
    partyLabels: { party1: 'Parte solicitanta', party2: 'Judecator recuzat' },
    requiredSections: [
      'Instanta si numar dosar',
      'Parte solicitanta',
      'Judecatorul recuzat',
      'Cazul de incompatibilitate',
      'Probele pentru dovedire',
      'Semnatura',
    ],
    keywords: ['recuzare', 'judecator', 'incompatibilitate', 'impartialitate'],
  },
  {
    id: 'CF-25',
    name: 'Cerere de stramutare',
    description:
      'Cererea de mutare a judecarii cauzei la o alta instanta pentru banuiala legitima sau siguranta publica.',
    category: 'speciale',
    formCategory: 'C',
    cpcArticles: ['Art. 140', 'Art. 141', 'Art. 142', 'Art. 148'],
    partyLabels: { party1: 'Solicitant', party2: 'Partea adversa' },
    requiredSections: [
      'Instanta competenta',
      'Instanta de la care se cere stramutarea',
      'Dosarul',
      'Parte solicitanta',
      'Temeiul',
      'Circumstantele justificative',
      'Dovezi',
      'Cautiune',
      'Semnatura',
    ],
    keywords: ['stramutare', 'banuiala legitima', 'siguranta publica', 'mutare'],
  },
  {
    id: 'CF-26',
    name: 'Cerere de suspendare a judecatii',
    description: 'Cererea de suspendare a procesului in cazurile prevazute de Art. 411-412 CPC.',
    category: 'speciale',
    formCategory: 'C',
    cpcArticles: ['Art. 411', 'Art. 412', 'Art. 413', 'Art. 148'],
    partyLabels: { party1: 'Parte solicitanta', party2: '' },
    requiredSections: [
      'Instanta si numar dosar',
      'Parte solicitanta',
      'Temeiul suspendarii',
      'Dovezi',
      'Solicitare',
      'Semnatura',
    ],
    keywords: ['suspendare', 'judecata', 'chestiune prejudiciala', 'acordul partilor'],
  },
  {
    id: 'CF-27',
    name: 'Cerere de repunere in termen',
    description:
      'Cererea prin care o parte solicita repunerea in termenul procedat pentru motive temeinic justificate.',
    category: 'speciale',
    formCategory: 'C',
    cpcArticles: ['Art. 186', 'Art. 148'],
    partyLabels: { party1: 'Parte solicitanta', party2: '' },
    requiredSections: [
      'Instanta',
      'Parte solicitanta',
      'Actul de procedura neexercitat',
      'Termenul depasit',
      'Motivele temeinic justificate',
      'Dovezi',
      'Actul de procedura anexat',
      'Semnatura',
    ],
    keywords: ['repunere', 'termen', 'impiedicare', 'restabilire'],
  },
  {
    id: 'CF-28',
    name: 'Cerere de asigurare probe',
    description:
      'Cererea de administrare anticipata a probelor cand exista pericolul ca acestea sa dispara.',
    category: 'speciale',
    formCategory: 'C',
    cpcArticles: ['Art. 359', 'Art. 360', 'Art. 361', 'Art. 148'],
    partyLabels: { party1: 'Solicitant', party2: 'Parte adversa' },
    requiredSections: [
      'Instanta',
      'Parte solicitanta',
      'Parte adversa',
      'Probele solicitate',
      'Faptele de dovedit',
      'Pericolul disparitiei',
      'Semnatura',
    ],
    keywords: ['asigurare', 'probe', 'conservare', 'pericol', 'anticipat'],
  },
  {
    id: 'CF-29',
    name: 'Cerere de perimare (constatare)',
    description:
      'Cererea de constatare a perimarii pentru lipsa de activitate procesala timp de 1 an sau 6 luni.',
    category: 'speciale',
    formCategory: 'C',
    cpcArticles: ['Art. 416', 'Art. 417', 'Art. 418', 'Art. 148'],
    partyLabels: { party1: 'Parte solicitanta', party2: 'Parte adversa' },
    requiredSections: [
      'Instanta si numar dosar',
      'Parte solicitanta',
      'Data ultimului act de procedura',
      'Perioada de inactivitate',
      'Lipsa actelor de procedura',
      'Solicitare',
      'Semnatura',
    ],
    keywords: ['perimare', 'inactivitate', 'stingere', 'termen'],
  },
  {
    id: 'CF-30',
    name: 'Cerere de indreptare eroare materiala',
    description:
      'Cererea de corectare a erorilor materiale din hotarare (nume, calcule, alte greseli).',
    category: 'speciale',
    formCategory: 'C',
    cpcArticles: ['Art. 442', 'Art. 148'],
    partyLabels: { party1: 'Parte solicitanta', party2: '' },
    requiredSections: [
      'Instanta',
      'Hotararea vizata',
      'Parte solicitanta',
      'Erorile materiale identificate',
      'Cum ar fi corect',
      'Dovezi ale erorii',
      'Semnatura',
    ],
    keywords: ['indreptare', 'eroare', 'materiala', 'corectare', 'hotarare'],
  },
];

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Truncate text to a maximum length with ellipsis
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 3) + '...';
}

/**
 * Format CPC articles for display
 */
function formatCpcArticles(articles: string[]): string {
  if (articles.length === 0) return '';
  if (articles.length === 1) return articles[0];
  if (articles.length === 2) return articles.join(', ');
  return `${articles[0]}, ${articles[1]} (+${articles.length - 2})`;
}

// ============================================================================
// Component
// ============================================================================

export function StepTemplate({ onBack, onSelectTemplate, animationClass = '' }: StepTemplateProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CourtFilingCategory | null>(null);

  // Filter templates based on search and category
  const filteredTemplates = useMemo(() => {
    let results: CourtFilingTemplate[];

    // If searching, use fuzzy search
    if (searchQuery.trim()) {
      const searchResults = searchTemplates(COURT_FILING_TEMPLATES, searchQuery);
      results = searchResults.map((r) => r.item);
    } else {
      results = COURT_FILING_TEMPLATES;
    }

    // Apply category filter
    if (selectedCategory) {
      results = results.filter((t) => t.category === selectedCategory);
    }

    return results;
  }, [searchQuery, selectedCategory]);

  // Get popular templates for default view
  const popularTemplates = useMemo(() => {
    return COURT_FILING_TEMPLATES.filter((t) => POPULAR_TEMPLATE_IDS.includes(t.id));
  }, []);

  // Show popular templates when no search query and no category filter
  const showPopular = !searchQuery.trim() && !selectedCategory;
  const templatesToShow = showPopular ? popularTemplates : filteredTemplates;

  const handleCategoryClick = (category: CourtFilingCategory) => {
    if (selectedCategory === category) {
      setSelectedCategory(null);
    } else {
      setSelectedCategory(category);
    }
  };

  return (
    <div className={`wizard-step step-template ${animationClass}`.trim()}>
      {/* Search Input */}
      <div className="wizard-section" style={{ padding: '12px 16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--text-tertiary)"
            strokeWidth="2"
          >
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            type="text"
            className="input-field"
            placeholder="Cauta sabloane..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ border: 'none', padding: '4px 0', flex: 1 }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 4,
                color: 'var(--text-tertiary)',
              }}
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Category Filter Chips */}
      <div className="source-chips" style={{ marginBottom: 12 }}>
        {CATEGORIES.map((category) => (
          <button
            key={category}
            className={`source-chip ${selectedCategory === category ? 'active' : ''}`}
            onClick={() => handleCategoryClick(category)}
          >
            {CATEGORY_DISPLAY_NAMES[category]}
          </button>
        ))}
      </div>

      {/* Results Header */}
      <div style={{ marginBottom: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
        {showPopular ? (
          <span>Sabloane populare</span>
        ) : (
          <span>
            {templatesToShow.length}{' '}
            {templatesToShow.length === 1 ? 'sablon gasit' : 'sabloane gasite'}
            {selectedCategory && ` in "${CATEGORY_DISPLAY_NAMES[selectedCategory]}"`}
          </span>
        )}
      </div>

      {/* Template List */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {templatesToShow.length === 0 ? (
          <div className="empty-state" style={{ padding: 24 }}>
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="var(--text-tertiary)"
              strokeWidth="1.5"
              className="empty-state-icon"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <p className="empty-state-text">
              Niciun sablon gasit pentru &ldquo;{searchQuery}&rdquo;
              {selectedCategory && ` in categoria "${CATEGORY_DISPLAY_NAMES[selectedCategory]}"`}
            </p>
          </div>
        ) : (
          templatesToShow.map((template) => (
            <div
              key={template.id}
              className="suggestion-card"
              onClick={() => onSelectTemplate(template)}
              style={{ marginBottom: 8 }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 8,
                }}
              >
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontWeight: 500,
                      fontSize: 13,
                      color: 'var(--text-primary)',
                      marginBottom: 4,
                    }}
                  >
                    {template.name}
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                    {truncateText(template.description, 100)}
                  </div>
                </div>
                <div
                  style={{
                    flexShrink: 0,
                    padding: '2px 6px',
                    background: 'var(--bg-secondary)',
                    borderRadius: 4,
                    fontSize: 10,
                    color: 'var(--text-tertiary)',
                    fontWeight: 500,
                  }}
                >
                  {template.id}
                </div>
              </div>
              <div style={{ marginTop: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span
                  style={{
                    fontSize: 10,
                    padding: '2px 6px',
                    background: 'var(--bg-hover)',
                    borderRadius: 4,
                    color: 'var(--text-secondary)',
                  }}
                >
                  {CATEGORY_DISPLAY_NAMES[template.category]}
                </span>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
                  {formatCpcArticles(template.cpcArticles)}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Navigation */}
      {onBack && (
        <div className="wizard-nav">
          <button className="btn btn-secondary" onClick={onBack} style={{ width: '100%' }}>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{ marginRight: 8 }}
            >
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Inapoi
          </button>
        </div>
      )}
    </div>
  );
}
