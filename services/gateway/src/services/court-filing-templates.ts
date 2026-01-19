// ============================================================================
// Court Filing Templates - Romanian Civil Procedure Code (CPC)
// ============================================================================
// Defines 30 court filing document templates for AI-powered document generation.
// Each template includes party labels, required sections, and CPC article references.
// ============================================================================

// ============================================================================
// Types
// ============================================================================

export type CourtFilingCategory =
  | 'faza-initiala'
  | 'interventii'
  | 'cai-atac'
  | 'executare'
  | 'speciale';

export type FormCategory = 'A' | 'B' | 'C';

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

// ============================================================================
// Templates - Faza Initiala (CF-01 to CF-04)
// ============================================================================

const fazaInitialaTemplates: CourtFilingTemplate[] = [
  {
    id: 'CF-01',
    name: 'Cerere de chemare in judecata',
    description:
      'Actul introductiv de instanta prin care reclamantul solicita protectia unui drept subiectiv civil sau a unei situatii juridice. Trebuie sa cuprinda toate elementele prevazute de Art. 194 CPC.',
    category: 'faza-initiala',
    formCategory: 'A',
    cpcArticles: ['Art. 194', 'Art. 195', 'Art. 196'],
    partyLabels: {
      party1: 'Reclamant',
      party2: 'Parat',
    },
    requiredSections: [
      'Antet instanta (denumire, sediu)',
      'Identificare Reclamant (nume, domiciliu/sediu, CNP/CUI)',
      'Identificare Parat (nume, domiciliu/sediu)',
      'Obiectul cererii si valoarea (in lei)',
      'Competenta instantei (materiala si teritoriala)',
      'Situatia de fapt',
      'Temeiul de drept',
      'Pretentii (claims)',
      'Dovezi (inscrisuri, martori, expertize)',
      'Cheltuieli de judecata',
      'Cereri accesorii (optional)',
      'Anexe conform Art. 195',
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
    partyLabels: {
      party1: 'Parat',
      party2: 'Reclamant',
    },
    requiredSections: [
      'Instanta si numar dosar',
      'Identificare parti (Parat vs Reclamant)',
      'Obiect',
      'I. Exceptii procesuale (daca exista)',
      'II. Pe fondul cauzei - Situatia de fapt',
      'II. Pe fondul cauzei - Apararea juridica',
      'II. Pe fondul cauzei - Critica cererii de chemare in judecata',
      'III. Dovezi',
      'IV. Cereri (respingerea actiunii, cheltuieli)',
      'Anexe',
      'Semnatura',
    ],
    keywords: ['intampinare', 'raspuns', 'aparare', 'exceptii', 'parat', 'defensiva'],
  },
  {
    id: 'CF-03',
    name: 'Raspuns la intampinare',
    description:
      'Actul prin care reclamantul raspunde la intampinarea paratului. Facultativ, termen 10 zile de la comunicarea intampinarii. Nu se comunica paratului.',
    category: 'faza-initiala',
    formCategory: 'C',
    cpcArticles: ['Art. 201', 'Art. 148'],
    partyLabels: {
      party1: 'Reclamant',
      party2: 'Parat',
    },
    requiredSections: [
      'Instanta si numar dosar',
      'Identificare parti',
      'Raspuns la exceptii (daca au fost invocate)',
      'Contraargumente la apararile paratului',
      'Mentinerea pretentiilor',
      'Dovezi suplimentare (optional)',
      'Semnatura',
    ],
    keywords: ['raspuns', 'intampinare', 'replica', 'reclamant', 'contraargumente'],
  },
  {
    id: 'CF-04',
    name: 'Cerere reconventionala',
    description:
      'Cererea prin care paratul formuleaza pretentii proprii impotriva reclamantului in cadrul aceluiasi proces. Trebuie sa indeplineasca conditiile Art. 194 CPC.',
    category: 'faza-initiala',
    formCategory: 'A',
    cpcArticles: ['Art. 209', 'Art. 210', 'Art. 194'],
    partyLabels: {
      party1: 'Parat-Reclamant reconventional',
      party2: 'Reclamant-Parat reconventional',
    },
    requiredSections: [
      'Antet instanta + numar dosar existent',
      'Identificare parti (Parat-Reclamant reconventional / Reclamant-Parat reconventional)',
      'Obiect si valoare',
      'Legatura cu cererea principala (Art. 209 alin. 1)',
      'Situatia de fapt',
      'Temeiul de drept',
      'Pretentii',
      'Dovezi',
      'Cheltuieli de judecata',
      'Anexe',
      'Semnatura',
    ],
    keywords: ['reconventionala', 'cerere', 'parat', 'pretentii', 'contraactiune'],
  },
];

// ============================================================================
// Templates - Interventii (CF-05 to CF-09)
// ============================================================================

const interventiiTemplates: CourtFilingTemplate[] = [
  {
    id: 'CF-05',
    name: 'Cerere de interventie principala',
    description:
      'Cererea prin care un tert pretinde pentru sine, in tot sau in parte, dreptul dedus judecatii. Se depune pana la inchiderea dezbaterilor in fond.',
    category: 'interventii',
    formCategory: 'A',
    cpcArticles: ['Art. 61', 'Art. 62', 'Art. 194'],
    partyLabels: {
      party1: 'Intervenient principal',
      party2: 'Reclamant',
      party3: 'Parat',
    },
    requiredSections: [
      'Instanta si numar dosar',
      'Parti initiale (informativ)',
      'Intervenient principal (identificare completa)',
      'Obiectul interventiei (dreptul pretins)',
      'Legatura cu dreptul dedus judecatii',
      'Situatia de fapt',
      'Temeiul de drept',
      'Pretentii',
      'Dovezi',
      'Taxa de timbru',
      'Anexe',
      'Semnatura',
    ],
    keywords: ['interventie', 'principala', 'tert', 'drept propriu', 'intervenient'],
  },
  {
    id: 'CF-06',
    name: 'Cerere de interventie accesorie',
    description:
      'Cererea prin care un tert intervine in proces pentru a sprijini apararea uneia dintre parti. Nu se plateste taxa de timbru.',
    category: 'interventii',
    formCategory: 'C',
    cpcArticles: ['Art. 63', 'Art. 148'],
    partyLabels: {
      party1: 'Intervenient accesoriu',
      party2: 'in favoarea [parte]',
    },
    requiredSections: [
      'Instanta si numar dosar',
      'Parti initiale',
      'Intervenient accesoriu (identificare)',
      'Partea in favoarea careia intervine',
      'Interesul interventiei',
      'Motivele sprijinirii partii respective',
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
    partyLabels: {
      party1: '[Parte]',
      party2: 'Tert chemat',
    },
    requiredSections: [
      'Instanta si numar dosar',
      'Parte solicitanta (Reclamant/Parat)',
      'Tert chemat in judecata (identificare completa)',
      'Motivarea (de ce tertul ar putea pretinde aceleasi drepturi ca reclamantul)',
      'Inscrisuri anexate',
      'Copii de pe cererea de chemare in judecata, intampinare, inscrisuri dosar',
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
    partyLabels: {
      party1: 'Chemator in garantie',
      party2: 'Chemat in garantie',
    },
    requiredSections: [
      'Instanta si numar dosar',
      'Chemator in garantie (Reclamant/Parat)',
      'Chemat in garantie (identificare completa)',
      'Temeiul garantiei (contract, lege)',
      'Situatia de fapt',
      'Prejudiciul potential',
      'Solicitari (despagubiri, garantie)',
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
      'Cererea prin care paratul indica pe adevaratul titular al dreptului litigios, pentru a fi scos din proces. Doar in materia drepturilor reale.',
    category: 'interventii',
    formCategory: 'C',
    cpcArticles: ['Art. 75', 'Art. 76', 'Art. 77', 'Art. 148'],
    partyLabels: {
      party1: 'Parat',
      party2: 'Titular indicat',
    },
    requiredSections: [
      'Instanta si numar dosar',
      'Parat (detentor) - identificare',
      'Titularul dreptului indicat (identificare)',
      'Calitatea in care paratul detine bunul',
      'Motivarea (de ce nu este titular)',
      'Dovezi ale detentiei pentru altul',
      'Semnatura',
    ],
    keywords: ['titular', 'drept', 'aratare', 'detentor', 'drepturi reale'],
  },
];

// ============================================================================
// Templates - Cai de Atac (CF-10 to CF-16)
// ============================================================================

const caiAtacTemplates: CourtFilingTemplate[] = [
  {
    id: 'CF-10',
    name: 'Cerere de apel',
    description:
      'Cale ordinara de atac prin care se solicita reformarea hotararii primei instante. Termen 30 zile de la comunicare.',
    category: 'cai-atac',
    formCategory: 'A',
    cpcArticles: ['Art. 466', 'Art. 467', 'Art. 468', 'Art. 469', 'Art. 470'],
    partyLabels: {
      party1: 'Apelant',
      party2: 'Intimat',
    },
    requiredSections: [
      'Instanta a carei hotarare se ataca',
      'Hotararea atacata (numar, data)',
      'Identificare parti (Apelant / Intimat)',
      'Obiectul cererii (admiterea apelului, schimbarea hotararii)',
      'Motivele de fapt',
      'Motivele de drept',
      'Probele invocate in sustinerea apelului',
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
    partyLabels: {
      party1: 'Intimat',
      party2: 'Apelant',
    },
    requiredSections: [
      'Instanta si numar dosar',
      'Identificare parti (Intimat / Apelant)',
      'Exceptii procesuale',
      'Aparari pe fondul motivelor de apel',
      'Critica fiecarui motiv de apel',
      'Dovezi',
      'Solicitare (respingerea apelului, mentinerea hotararii)',
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
    partyLabels: {
      party1: 'Recurent',
      party2: 'Intimat',
    },
    requiredSections: [
      'Instanta a carei hotarare se ataca',
      'Hotararea atacata',
      'Identificare parti (Recurent / Intimat)',
      'Motivele de nelegalitate (Art. 488 pct. 1-8)',
      'Dezvoltarea motivelor',
      'Dovezi (limitate)',
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
    partyLabels: {
      party1: 'Recurent',
      party2: 'Intimat',
    },
    requiredSections: [
      'Instanta si numar dosar',
      'Identificare parti',
      'Motivul 1: [text motiv Art. 488]',
      'Dezvoltare motiv 1: norma incalcata, explicatia nelegalitatii',
      'Motivul 2: [daca exista]',
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
      'Calea de atac formulata de intimat dupa expirarea termenului de apel/recurs principal. Are caracter accesoriu.',
    category: 'cai-atac',
    formCategory: 'C',
    cpcArticles: ['Art. 472', 'Art. 473', 'Art. 148'],
    partyLabels: {
      party1: 'Intimat-Apelant incident',
      party2: 'Apelant principal',
    },
    requiredSections: [
      'Instanta si numar dosar',
      'Intimat (care devine apelant incident)',
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
      'Cale extraordinara de atac impotriva hotararilor definitive pentru nelegala citare sau eroare materiala in dezlegarea recursului.',
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
    partyLabels: {
      party1: 'Contestator',
      party2: 'Intimat',
    },
    requiredSections: [
      'Instanta a carei hotarare se ataca',
      'Hotararea contestata (definitiva)',
      'Identificare parti (Contestator / Intimat)',
      'Motivul contestatiei (Art. 503 alin. 1 sau 2)',
      'Dovezi ale motivului',
      'Solicitare (anularea hotararii)',
      'Semnatura',
    ],
    keywords: ['contestatie', 'anulare', 'hotarare definitiva', 'citare', 'eroare'],
  },
  {
    id: 'CF-16',
    name: 'Cerere de revizuire',
    description:
      'Cale extraordinara de atac pentru retractarea hotararii in cazurile prevazute de Art. 509 CPC (inscrisuri noi, hotarari contradictorii etc.).',
    category: 'cai-atac',
    formCategory: 'C',
    cpcArticles: ['Art. 509', 'Art. 510', 'Art. 511', 'Art. 512', 'Art. 513', 'Art. 148'],
    partyLabels: {
      party1: 'Revizuent',
      party2: 'Intimat',
    },
    requiredSections: [
      'Instanta (cea care a pronuntat hotararea)',
      'Hotararea atacata',
      'Identificare parti (Revizuent / Intimat)',
      'Motivul de revizuire (Art. 509 alin. 1 pct. 1-11)',
      'Dezvoltarea motivului',
      'Dovezi noi (daca e cazul)',
      'Verificare termen respectat',
      'Semnatura',
    ],
    keywords: ['revizuire', 'retractare', 'inscrisuri noi', 'hotarari contradictorii'],
  },
];

// ============================================================================
// Templates - Executare Silita (CF-17 to CF-20)
// ============================================================================

const executareTemplates: CourtFilingTemplate[] = [
  {
    id: 'CF-17',
    name: 'Cerere de incuviintare a executarii silite',
    description:
      'Cererea adresata executorului judecatoresc pentru incuviintarea executarii unui titlu executoriu. Se solutioneaza in 3 zile.',
    category: 'executare',
    formCategory: 'C',
    cpcArticles: ['Art. 666', 'Art. 148'],
    partyLabels: {
      party1: 'Creditor',
      party2: 'Debitor',
    },
    requiredSections: [
      'Executor judecatoresc',
      'Identificare Creditor',
      'Identificare Debitor',
      'Titlul executoriu (hotarare/inscris)',
      'Suma datorata + accesorii',
      'Modalitatea de executare solicitata',
      'Anexe (titlu executoriu, dovada creanta)',
      'Semnatura',
    ],
    keywords: ['executare', 'incuviintare', 'titlu executoriu', 'creditor', 'debitor'],
  },
  {
    id: 'CF-18',
    name: 'Contestatie la executare',
    description:
      'Mijlocul procedural de contestare a executarii silite sau a actelor de executare. Termen 15 zile de la comunicare.',
    category: 'executare',
    formCategory: 'C',
    cpcArticles: [
      'Art. 712',
      'Art. 713',
      'Art. 714',
      'Art. 715',
      'Art. 716',
      'Art. 717',
      'Art. 718',
      'Art. 719',
      'Art. 720',
      'Art. 148',
    ],
    partyLabels: {
      party1: 'Contestator',
      party2: 'Intimat',
      party3: 'Executor',
    },
    requiredSections: [
      'Instanta de executare',
      'Contestator (creditor/debitor/tert)',
      'Intimat (partea adversa + executor)',
      'Actul/incheierea contestata',
      'Motivele contestatiei (nelegalitate executare, acte de executare, lamurire titlu)',
      'Dovezi',
      'Solicitare (anulare act, suspendare - daca se cere)',
      'Cautiune (daca se cere suspendare)',
      'Semnatura',
    ],
    keywords: ['contestatie', 'executare', 'anulare', 'suspendare', 'executor'],
  },
  {
    id: 'CF-19',
    name: 'Cerere de suspendare a executarii silite',
    description:
      'Cererea de suspendare a executarii pana la solutionarea contestatiei. Necesita plata cautiunii conform Art. 719 alin. 2 CPC.',
    category: 'executare',
    formCategory: 'C',
    cpcArticles: ['Art. 719', 'Art. 148'],
    partyLabels: {
      party1: 'Solicitant',
      party2: 'Creditor',
    },
    requiredSections: [
      'Instanta de executare',
      'Solicitant (debitor/tert interesat)',
      'Creditor',
      'Dosarul de executare',
      'Motivele temeinice ale suspendarii',
      'Cautiune calculata conform Art. 719(2)',
      'Dovada platii cautiunii',
      'Solicitare (suspendare pana la solutionarea contestatiei)',
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
    partyLabels: {
      party1: 'Debitor sau Tert',
      party2: 'Creditor',
    },
    requiredSections: [
      'Instanta de executare',
      'Debitor/Tert afectat',
      'Creditor',
      'Dosarul de executare',
      'Masura contestata (poprire/sechestru)',
      'Motivul ridicarii (plata datoriei, nelegalitate, bunuri neurmaribiIe)',
      'Dovezi',
      'Solicitare (ridicare masura)',
      'Semnatura',
    ],
    keywords: ['poprire', 'sechestru', 'ridicare', 'executare', 'debitor'],
  },
];

// ============================================================================
// Templates - Proceduri Speciale (CF-21 to CF-30)
// ============================================================================

const specialeTemplates: CourtFilingTemplate[] = [
  {
    id: 'CF-21',
    name: 'Cerere de ordonanta de plata',
    description:
      'Procedura speciala pentru recuperarea creantelor certe, lichide si exigibile. Necesita somatie prealabila obligatorie.',
    category: 'speciale',
    formCategory: 'C',
    cpcArticles: ['Art. 1014', 'Art. 1015', 'Art. 1016', 'Art. 1017', 'Art. 148'],
    partyLabels: {
      party1: 'Creditor',
      party2: 'Debitor',
    },
    requiredSections: [
      'Instanta (judecatorie competenta pe fond)',
      'Identificare Creditor (completa)',
      'Identificare Debitor (completa)',
      'Temeiul creantei (contract, factura)',
      'Suma datorata + accesorii',
      'Dovada caracterului cert, lichid, exigibil',
      'Somatia prealabila (anexa obligatorie)',
      'Dovezi',
      'Semnatura',
    ],
    keywords: ['ordonanta', 'plata', 'creanta', 'somatie', 'recuperare', 'procedura speciala'],
  },
  {
    id: 'CF-22',
    name: 'Cerere cu valoare redusa',
    description:
      'Procedura simplificata pentru litigii cu valoare de pana la 50.000 lei. Procedura alternativa la cererea reclamantului.',
    category: 'speciale',
    formCategory: 'C',
    cpcArticles: ['Art. 1026', 'Art. 1027', 'Art. 1028', 'Art. 1029', 'Art. 1030', 'Art. 148'],
    partyLabels: {
      party1: 'Reclamant',
      party2: 'Parat',
    },
    requiredSections: [
      'Instanta (judecatorie)',
      'Identificare Reclamant',
      'Identificare Parat',
      'Obiect (max 50.000 lei)',
      'Situatia de fapt',
      'Dovezi',
      'Mentiune expresa: procedura cererilor cu valoare redusa',
      'Semnatura',
    ],
    keywords: ['valoare redusa', 'procedura simplificata', 'litigii mici'],
  },
  {
    id: 'CF-23',
    name: 'Cerere de ordonanta presedintiala',
    description:
      'Procedura speciala pentru luarea de masuri provizorii in cazuri grabnice. Conditii: aparenta dreptului, urgenta, neprejudecarea fondului.',
    category: 'speciale',
    formCategory: 'C',
    cpcArticles: [
      'Art. 996',
      'Art. 997',
      'Art. 998',
      'Art. 999',
      'Art. 1000',
      'Art. 1001',
      'Art. 148',
    ],
    partyLabels: {
      party1: 'Reclamant',
      party2: 'Parat',
    },
    requiredSections: [
      'Instanta (competenta pe fond in prima instanta)',
      'Identificare Reclamant',
      'Identificare Parat',
      'Aparenta dreptului (fumus boni juris)',
      'Urgenta (cazuri grabnice)',
      'Masurile provizorii solicitate',
      'Prejudiciul iminent / dreptul pagubit',
      'Dovezi',
      'Semnatura',
    ],
    keywords: ['ordonanta', 'presedintiala', 'urgenta', 'masuri provizorii', 'grabnic'],
  },
  {
    id: 'CF-24',
    name: 'Cerere de recuzare',
    description:
      'Cererea prin care o parte solicita indepartarea judecatorului pentru motive de incompatibilitate prevazute de Art. 41-42 CPC.',
    category: 'speciale',
    formCategory: 'C',
    cpcArticles: ['Art. 44', 'Art. 45', 'Art. 46', 'Art. 47', 'Art. 48', 'Art. 148'],
    partyLabels: {
      party1: 'Parte solicitanta',
      party2: 'Judecator recuzat',
    },
    requiredSections: [
      'Instanta si numar dosar',
      'Parte solicitanta',
      'Judecatorul recuzat (pentru fiecare in parte)',
      'Cazul de incompatibilitate (Art. 41 sau 42)',
      'Probele pentru dovedirea cazului',
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
    cpcArticles: [
      'Art. 140',
      'Art. 141',
      'Art. 142',
      'Art. 143',
      'Art. 144',
      'Art. 145',
      'Art. 146',
      'Art. 147',
      'Art. 148',
    ],
    partyLabels: {
      party1: 'Solicitant',
      party2: 'Partea adversa',
    },
    requiredSections: [
      'Instanta competenta (curtea de apel sau ICCJ)',
      'Instanta de la care se cere stramutarea',
      'Dosarul',
      'Parte solicitanta',
      'Temeiul (banuiala legitima sau siguranta publica)',
      'Circumstantele care justifica stramutarea',
      'Dovezi',
      'Cautiune 1.000 lei (daca se cere suspendare)',
      'Semnatura',
    ],
    keywords: ['stramutare', 'banuiala legitima', 'siguranta publica', 'mutare'],
  },
  {
    id: 'CF-26',
    name: 'Cerere de suspendare a judecatii',
    description:
      'Cererea de suspendare a procesului in cazurile prevazute de Art. 411-412 CPC (acord parti, chestiune prejudiciala, deces parte etc.).',
    category: 'speciale',
    formCategory: 'C',
    cpcArticles: ['Art. 411', 'Art. 412', 'Art. 413', 'Art. 414', 'Art. 415', 'Art. 148'],
    partyLabels: {
      party1: 'Parte solicitanta',
      party2: '',
    },
    requiredSections: [
      'Instanta si numar dosar',
      'Parte solicitanta',
      'Temeiul suspendarii (Art. 411 facultativa sau Art. 412 de drept)',
      'Dovezi',
      'Solicitare (suspendarea judecatii)',
      'Semnatura',
    ],
    keywords: ['suspendare', 'judecata', 'chestiune prejudiciala', 'acordul partilor'],
  },
  {
    id: 'CF-27',
    name: 'Cerere de repunere in termen',
    description:
      'Cererea prin care o parte solicita repunerea in termenul procedat pentru motive temeinic justificate. Termen 15 zile de la incetarea impiedicarii.',
    category: 'speciale',
    formCategory: 'C',
    cpcArticles: ['Art. 186', 'Art. 148'],
    partyLabels: {
      party1: 'Parte solicitanta',
      party2: '',
    },
    requiredSections: [
      'Instanta',
      'Parte solicitanta',
      'Actul de procedura neexercitat in termen',
      'Termenul depasit',
      'Motivele temeinic justificate ale intarzierii',
      'Dovezi ale impiedicarii',
      'Actul de procedura (anexat) - obligatoriu',
      'Semnatura',
    ],
    keywords: ['repunere', 'termen', 'impiedicare', 'restabilire'],
  },
  {
    id: 'CF-28',
    name: 'Cerere de asigurare probe',
    description:
      'Cererea de administrare anticipata a probelor cand exista pericolul ca acestea sa dispara sau sa devina greu de administrat.',
    category: 'speciale',
    formCategory: 'C',
    cpcArticles: [
      'Art. 359',
      'Art. 360',
      'Art. 361',
      'Art. 362',
      'Art. 363',
      'Art. 364',
      'Art. 365',
      'Art. 148',
    ],
    partyLabels: {
      party1: 'Solicitant',
      party2: 'Parte adversa',
    },
    requiredSections: [
      'Instanta (judecatoria unde e martorul/obiectul sau instanta pe fond)',
      'Parte solicitanta',
      'Parte adversa (sau viitor adversar)',
      'Probele a caror administrare se cere',
      'Faptele de dovedit',
      'Pericolul ca proba sa dispara / greu de administrat',
      'SAU acordul partii adverse (daca nu e urgenta)',
      'Semnatura',
    ],
    keywords: ['asigurare', 'probe', 'conservare', 'pericol', 'anticipat'],
  },
  {
    id: 'CF-29',
    name: 'Cerere de perimare (constatare)',
    description:
      'Cererea de constatare a perimarii pentru lipsa de activitate procesala timp de 1 an (fond) sau 6 luni (cai de atac).',
    category: 'speciale',
    formCategory: 'C',
    cpcArticles: [
      'Art. 416',
      'Art. 417',
      'Art. 418',
      'Art. 419',
      'Art. 420',
      'Art. 421',
      'Art. 422',
      'Art. 148',
    ],
    partyLabels: {
      party1: 'Parte solicitanta',
      party2: 'Parte adversa',
    },
    requiredSections: [
      'Instanta si numar dosar',
      'Parte solicitanta (de regula paratul)',
      'Data ultimului act de procedura',
      'Perioada de inactivitate (1 an fond, 6 luni cai de atac)',
      'Lipsa actelor de procedura din culpa partii',
      'Solicitare (constatarea perimarii)',
      'Semnatura',
    ],
    keywords: ['perimare', 'inactivitate', 'stingere', 'termen'],
  },
  {
    id: 'CF-30',
    name: 'Cerere de indreptare eroare materiala',
    description:
      'Cererea de corectare a erorilor materiale din hotarare (nume, calcule, alte greseli). Nu are termen limita, nu modifica fondul.',
    category: 'speciale',
    formCategory: 'C',
    cpcArticles: ['Art. 442', 'Art. 148'],
    partyLabels: {
      party1: 'Parte solicitanta',
      party2: '',
    },
    requiredSections: [
      'Instanta (care a pronuntat hotararea)',
      'Hotararea vizata',
      'Parte solicitanta',
      'Erorile materiale identificate (nume, calitate parti, erori de calcul, alte erori)',
      'Cum ar fi corect',
      'Dovezi ale erorii',
      'Semnatura',
    ],
    keywords: ['indreptare', 'eroare', 'materiala', 'corectare', 'hotarare'],
  },
];

// ============================================================================
// Combined Templates Array
// ============================================================================

export const COURT_FILING_TEMPLATES: CourtFilingTemplate[] = [
  ...fazaInitialaTemplates,
  ...interventiiTemplates,
  ...caiAtacTemplates,
  ...executareTemplates,
  ...specialeTemplates,
];

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get a court filing template by its ID (e.g., "CF-01", "CF-15")
 */
export function getTemplateById(id: string): CourtFilingTemplate | undefined {
  return COURT_FILING_TEMPLATES.find((template) => template.id === id);
}

/**
 * Get all court filing templates for a specific category
 */
export function getTemplatesByCategory(category: CourtFilingCategory): CourtFilingTemplate[] {
  return COURT_FILING_TEMPLATES.filter((template) => template.category === category);
}

/**
 * Get all court filing templates for a specific form category
 * - A: Full form (Art. 194) - cerere de chemare in judecata format
 * - B: Response form (Art. 205) - intampinare format
 * - C: Standard form (Art. 148) - basic petition format
 */
export function getTemplatesByFormCategory(formCategory: FormCategory): CourtFilingTemplate[] {
  return COURT_FILING_TEMPLATES.filter((template) => template.formCategory === formCategory);
}

/**
 * Search templates by keyword (searches name, description, and keywords array)
 */
export function searchTemplates(query: string): CourtFilingTemplate[] {
  const normalizedQuery = query.toLowerCase().trim();
  return COURT_FILING_TEMPLATES.filter(
    (template) =>
      template.name.toLowerCase().includes(normalizedQuery) ||
      template.description.toLowerCase().includes(normalizedQuery) ||
      template.keywords.some((keyword) => keyword.toLowerCase().includes(normalizedQuery))
  );
}

/**
 * Get category display name in Romanian
 */
export function getCategoryDisplayName(category: CourtFilingCategory): string {
  const categoryNames: Record<CourtFilingCategory, string> = {
    'faza-initiala': 'Faza Initiala',
    interventii: 'Interventii',
    'cai-atac': 'Cai de Atac',
    executare: 'Executare Silita',
    speciale: 'Proceduri Speciale',
  };
  return categoryNames[category];
}

/**
 * Get form category description
 */
export function getFormCategoryDescription(formCategory: FormCategory): string {
  const descriptions: Record<FormCategory, string> = {
    A: 'Formular complet (Art. 194 CPC) - cerere de chemare in judecata',
    B: 'Formular raspuns (Art. 205 CPC) - intampinare',
    C: 'Formular standard (Art. 148 CPC) - cerere generala',
  };
  return descriptions[formCategory];
}
