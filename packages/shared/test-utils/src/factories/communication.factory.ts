import type {
  CommunicationThread,
  CommunicationMessage,
  CommunicationParticipant,
  Attachment,
  ExtractedItems,
  ExtractedDeadline,
  ExtractedCommitment,
  ExtractedActionItem,
  AIDraftResponse,
  CaseType,
  Task,
  TaskType,
} from '@legal-platform/types';

// Romanian legal names and terminology
const ROMANIAN_NAMES = [
  'Ion Popescu',
  'Maria Ionescu',
  'Andrei Dumitru',
  'Elena Constantinescu',
  'Gheorghe Popa',
  'Ana Stoica',
  'Mihai Radu',
  'Carmen Nedelcu',
  'Cristian Munteanu',
  'Ioana Georgescu',
];

const ROMANIAN_EMAIL_DOMAINS = [
  '@avocat.ro',
  '@justitie.ro',
  '@firma.ro',
  '@tribunal.ro',
  '@curtea.ro',
];

const CASE_TYPES: CaseType[] = ['Litigation', 'Contract', 'Advisory', 'Criminal', 'Other'];

const ROMANIAN_SUBJECTS = [
  'Cerere de amânare a ședinței',
  'Întrebări privind contractul de vânzare-cumpărare',
  'Actualizare privind procedura de executare',
  'Solicitare documente suplimentare',
  'Confirmare termen judecată',
  'Răspuns la interogatoriu',
  'Propunere de tranzacție',
  'Notificare de plată restantă',
  'Clarificări privind expertiza tehnică',
  'Solicitare prelungire termen de depunere',
];

const ROMANIAN_BODIES = [
  'Bună ziua,\n\nVă mulțumesc pentru răspunsul dumneavoastră rapid. Am analizat documentele trimise și am câteva întrebări suplimentare.\n\nVă rog să-mi trimiteți copiile certificate ale contractului până la data de 15 martie 2025.\n\nCu stimă,',
  'Stimată doamnă/Stimate domn,\n\nÎn legătură cu dosarul penal nr. 12345/2024, vă informăm că termenul de judecată a fost amânat pentru data de 28 februarie 2025, ora 10:00.\n\nVă rugăm să confirmați prezența.\n\nCu respect,',
  'Bună ziua,\n\nReferitor la cererea dumneavoastră din data de 10 ianuarie 2025, vă comunicăm că documentația necesară a fost depusă la instanță.\n\nUrmăm să vă ținem la curent cu evoluția cauzei.\n\nCu considerație,',
  'Stimate avocat,\n\nVă transmit în atașament expertiza tehnică solicitată. Termenul pentru depunerea concluziilor scrise este 20 martie 2025.\n\nVă mulțumesc,',
  'Bună ziua,\n\nÎn urma discuției telefonice de azi-dimineață, vă confirm disponibilitatea pentru întâlnirea din data de 5 martie 2025, ora 14:00, la sediul firmei.\n\nCu stimă,',
];

/**
 * Generates a random UUID (mock)
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Selects a random item from an array
 */
function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * Generates a random date within the last N days
 */
function randomDateWithinDays(days: number): Date {
  const now = Date.now();
  const randomTime = Math.random() * days * 24 * 60 * 60 * 1000;
  return new Date(now - randomTime);
}

/**
 * Generates a random date in the future within N days
 */
function randomFutureDateWithinDays(days: number): Date {
  const now = Date.now();
  const randomTime = Math.random() * days * 24 * 60 * 60 * 1000;
  return new Date(now + randomTime);
}

/**
 * Creates a mock attachment
 */
export function createMockAttachment(): Attachment {
  const filenames = [
    'Contract_Vanzare_Cumparare.pdf',
    'Expertiza_Tehnica.docx',
    'Dovada_Plata.pdf',
    'Certificat_Proprietate.pdf',
    'Interogatoriu_Raspunsuri.docx',
  ];

  return {
    id: generateId(),
    filename: randomItem(filenames),
    fileSize: Math.floor(Math.random() * 5000000) + 100000, // 100KB to 5MB
    mimeType: randomItem(['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']),
    downloadUrl: `/api/mock/attachments/${generateId()}`,
  };
}

/**
 * Creates a mock participant
 */
export function createMockParticipant(role: 'sender' | 'recipient' | 'cc' | 'bcc' = 'recipient'): CommunicationParticipant {
  const name = randomItem(ROMANIAN_NAMES);
  const domain = randomItem(ROMANIAN_EMAIL_DOMAINS);
  const email = `${name.toLowerCase().replace(' ', '.')}${domain}`;

  return {
    userId: generateId(),
    name,
    email,
    role,
  };
}

/**
 * Creates a mock communication message
 */
export function createMockMessage(threadId: string, options?: { isFromUser?: boolean; daysAgo?: number }): CommunicationMessage {
  const sender = createMockParticipant('sender');
  const recipients = Array.from({ length: Math.floor(Math.random() * 2) + 1 }, () => createMockParticipant('recipient'));
  const hasAttachments = Math.random() > 0.7;

  return {
    id: generateId(),
    threadId,
    senderId: sender.userId,
    senderName: sender.name,
    senderEmail: sender.email,
    recipientIds: recipients.map(r => r.userId),
    subject: randomItem(ROMANIAN_SUBJECTS),
    body: randomItem(ROMANIAN_BODIES),
    htmlBody: `<p>${randomItem(ROMANIAN_BODIES).replace(/\n/g, '<br />')}</p>`,
    sentDate: randomDateWithinDays(options?.daysAgo || 30),
    attachments: hasAttachments ? [createMockAttachment()] : [],
    isFromUser: options?.isFromUser ?? Math.random() > 0.5,
    isRead: Math.random() > 0.3,
  };
}

/**
 * Creates mock extracted deadlines
 */
export function createMockExtractedDeadlines(messageIds: string[], options?: { withConversions?: boolean; withDismissals?: boolean }): ExtractedDeadline[] {
  if (Math.random() > 0.6) return []; // 40% chance of having deadlines

  const count = Math.floor(Math.random() * 2) + 1;
  return Array.from({ length: count }, () => {
    const isConverted = options?.withConversions && Math.random() > 0.5;
    const isDismissed = !isConverted && options?.withDismissals && Math.random() > 0.7;

    return {
      id: generateId(),
      description: `Termen depunere: ${randomItem(['concluzii scrise', 'probe suplimentare', 'documente certificate', 'răspuns la interogatoriu'])}`,
      dueDate: randomFutureDateWithinDays(60),
      sourceMessageId: randomItem(messageIds),
      confidence: randomItem(['Low', 'Medium', 'High'] as const),
      convertedToTaskId: isConverted ? generateId() : undefined,
      isDismissed: isDismissed || undefined,
      dismissedAt: isDismissed ? randomDateWithinDays(3) : undefined,
      dismissReason: isDismissed ? randomItem(['Nu este relevant', 'Deja gestionat', 'Informație incorectă', 'Altul']) : undefined,
    };
  });
}

/**
 * Creates mock extracted commitments
 */
export function createMockExtractedCommitments(messageIds: string[], options?: { withConversions?: boolean; withDismissals?: boolean }): ExtractedCommitment[] {
  if (Math.random() > 0.5) return []; // 50% chance of having commitments

  const count = Math.floor(Math.random() * 2) + 1;
  return Array.from({ length: count }, () => {
    const isConverted = options?.withConversions && Math.random() > 0.5;
    const isDismissed = !isConverted && options?.withDismissals && Math.random() > 0.7;

    return {
      id: generateId(),
      party: randomItem(ROMANIAN_NAMES),
      commitmentText: randomItem([
        'Va trimite documentele certificate până la termen',
        'Va confirma disponibilitatea pentru întâlnire',
        'Va depune expertiza la instanță',
        'Va achita suma restantă',
      ]),
      date: randomDateWithinDays(7),
      sourceMessageId: randomItem(messageIds),
      confidence: randomItem(['Low', 'Medium', 'High'] as const),
      convertedToTaskId: isConverted ? generateId() : undefined,
      isDismissed: isDismissed || undefined,
      dismissedAt: isDismissed ? randomDateWithinDays(3) : undefined,
      dismissReason: isDismissed ? randomItem(['Nu este relevant', 'Deja gestionat', 'Informație incorectă', 'Altul']) : undefined,
    };
  });
}

/**
 * Creates mock extracted action items
 */
export function createMockExtractedActionItems(messageIds: string[], options?: { withConversions?: boolean; withDismissals?: boolean }): ExtractedActionItem[] {
  if (Math.random() > 0.6) return []; // 40% chance of having action items

  const count = Math.floor(Math.random() * 3) + 1;
  return Array.from({ length: count }, () => {
    const isConverted = options?.withConversions && Math.random() > 0.5;
    const isDismissed = !isConverted && options?.withDismissals && Math.random() > 0.7;

    return {
      id: generateId(),
      description: randomItem([
        'Verificare documente client',
        'Pregătire concluzii scrise',
        'Contactare experți tehnici',
        'Actualizare dosar instanță',
        'Solicitare date suplimentare',
      ]),
      suggestedAssignee: Math.random() > 0.5 ? randomItem(ROMANIAN_NAMES) : undefined,
      priority: randomItem(['Low', 'Medium', 'High', 'Urgent'] as const),
      sourceMessageId: randomItem(messageIds),
      confidence: randomItem(['Low', 'Medium', 'High'] as const),
      convertedToTaskId: isConverted ? generateId() : undefined,
      isDismissed: isDismissed || undefined,
      dismissedAt: isDismissed ? randomDateWithinDays(3) : undefined,
      dismissReason: isDismissed ? randomItem(['Nu este relevant', 'Deja gestionat', 'Informație incorectă', 'Altul']) : undefined,
    };
  });
}

/**
 * Creates mock extracted items
 */
export function createMockExtractedItems(messageIds: string[], options?: { withConversions?: boolean; withDismissals?: boolean }): ExtractedItems {
  return {
    deadlines: createMockExtractedDeadlines(messageIds, options),
    commitments: createMockExtractedCommitments(messageIds, options),
    actionItems: createMockExtractedActionItems(messageIds, options),
  };
}

/**
 * Creates a single mock communication thread
 */
export function createMockCommunicationThread(options?: {
  caseType?: CaseType;
  isUnread?: boolean;
  messageCount?: number;
  isProcessed?: boolean;
  withConversions?: boolean;
  withDismissals?: boolean;
}): CommunicationThread {
  const threadId = generateId();
  const caseType = options?.caseType || randomItem(CASE_TYPES);
  const messageCount = options?.messageCount || Math.floor(Math.random() * 3) + 3; // 3-5 messages

  // Create messages
  const messages = Array.from({ length: messageCount }, (_, i) =>
    createMockMessage(threadId, { daysAgo: (messageCount - i) * 2 })
  );

  const messageIds = messages.map(m => m.id);
  const participants: CommunicationParticipant[] = [];

  messages.forEach(msg => {
    if (!participants.some(p => p.userId === msg.senderId)) {
      participants.push({
        userId: msg.senderId,
        name: msg.senderName,
        email: msg.senderEmail,
        role: 'sender',
      });
    }
  });

  const lastMessage = messages[messages.length - 1]!;
  const hasAttachments = messages.some(m => m.attachments.length > 0);
  const isProcessed = options?.isProcessed ?? Math.random() > 0.7; // 30% chance of being processed

  return {
    id: threadId,
    subject: lastMessage.subject,
    caseId: generateId(),
    caseName: `Dosar ${caseType} #${Math.floor(Math.random() * 9000) + 1000}`,
    caseType,
    participants,
    messages,
    hasAttachments,
    isUnread: options?.isUnread ?? Math.random() > 0.6,
    lastMessageDate: lastMessage.sentDate,
    extractedItems: createMockExtractedItems(messageIds, {
      withConversions: options?.withConversions,
      withDismissals: options?.withDismissals,
    }),
    isProcessed: isProcessed || undefined,
    processedAt: isProcessed ? randomDateWithinDays(5) : undefined,
    createdAt: messages[0]!.sentDate,
    updatedAt: lastMessage.sentDate,
  };
}

/**
 * Creates multiple mock communication threads
 */
export function createMockCommunicationThreads(count: number = 25): CommunicationThread[] {
  return Array.from({ length: count }, () => createMockCommunicationThread());
}

/**
 * Creates a mock AI draft response
 */
export function createMockAIDraftResponse(
  threadId: string,
  tone: 'formal' | 'professional' | 'brief' = 'professional'
): AIDraftResponse {
  const draftBodies = {
    formal: 'Stimate domn/Stimată doamnă,\n\nCu referire la comunicarea dumneavoastră din data de [data], vă mulțumim pentru solicitarea transmisă.\n\nÎn conformitate cu dispozițiile legale aplicabile și jurisprudența în materie, apreciem că situația prezentată necesită următoarele măsuri:\n\n1. Verificarea documentației existente\n2. Solicitarea de clarificări suplimentare\n3. Stabilirea unui termen de finalizare\n\nVă rugăm să ne transmiteți confirmare cu privire la aspectele menționate mai sus.\n\nCu deosebită considerație,\n[Numele dumneavoastră]',
    professional: 'Bună ziua,\n\nVă mulțumesc pentru mesajul transmis.\n\nAm analizat situația prezentată și consider că cea mai bună abordare ar fi următoarea:\n\n- Să ne întâlnim pentru o discuție detaliată\n- Să pregătim documentația necesară\n- Să stabilim pașii următori\n\nAș aprecia dacă îmi puteți confirma disponibilitatea pentru săptămâna viitoare.\n\nCu stimă,\n[Numele dumneavoastră]',
    brief: 'Bună ziua,\n\nAm primit mesajul dumneavoastră. Voi reveni cu un răspuns detaliat până la sfârșitul săptămânii.\n\nÎntre timp, vă rog să-mi transmiteți documentele menționate.\n\nMulțumesc,\n[Numele dumneavoastră]',
  };

  return {
    id: generateId(),
    threadId,
    tone,
    draftBody: draftBodies[tone],
    suggestedAttachments: Math.random() > 0.5 ? ['Contract actualizat', 'Rezumat jurisprudență'] : [],
    confidence: randomItem(['Low', 'Medium', 'High'] as const),
    generatedAt: new Date(),
  };
}

/**
 * Creates a mock task from a communication extracted item
 * This demonstrates how tasks are created from deadlines, commitments, or action items
 */
export function createMockTaskFromCommunication(
  extractedItem: ExtractedDeadline | ExtractedCommitment | ExtractedActionItem,
  extractedItemType: 'deadline' | 'commitment' | 'actionItem',
  options?: {
    caseId?: string;
    threadId?: string;
    messageId?: string;
    assignedTo?: string;
  }
): Task {
  const taskId = generateId();

  // Map extracted item type to task type
  const taskTypeMap: Record<string, TaskType> = {
    deadline: 'CourtDate',
    commitment: 'Meeting',
    actionItem: 'Research',
  };

  // Extract relevant data based on item type
  let title = '';
  let dueDate = new Date();
  let priority: 'Low' | 'Medium' | 'High' | 'Urgent' = 'Medium';

  if ('description' in extractedItem && 'dueDate' in extractedItem) {
    // ExtractedDeadline
    title = extractedItem.description;
    dueDate = extractedItem.dueDate;
    priority = 'High';
  } else if ('commitmentText' in extractedItem) {
    // ExtractedCommitment
    title = extractedItem.commitmentText;
    dueDate = 'date' in extractedItem ? extractedItem.date as Date : randomFutureDateWithinDays(14);
    priority = 'Medium';
  } else if ('description' in extractedItem && 'priority' in extractedItem) {
    // ExtractedActionItem
    title = extractedItem.description;
    dueDate = randomFutureDateWithinDays(30);
    priority = extractedItem.priority;
  }

  return {
    id: taskId,
    caseId: options?.caseId || generateId(),
    type: taskTypeMap[extractedItemType] || 'Research',
    title,
    description: `Task creat automat din comunicare.\n\nExtrăgere: ${extractedItemType}\nConfidență AI: ${extractedItem.confidence}\n\nMesaj sursă: ${extractedItem.sourceMessageId}`,
    assignedTo: options?.assignedTo || generateId(),
    dueDate,
    status: 'Pending',
    priority,
    metadata: {
      sourceMessageId: options?.messageId || extractedItem.sourceMessageId,
      sourceThreadId: options?.threadId || generateId(),
      extractedItemId: extractedItem.id,
      extractedItemType,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}
