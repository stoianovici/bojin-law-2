/**
 * Bulk Data Generation Script for Legal Platform
 *
 * This script adds additional mock data on top of the base seed data.
 * Run AFTER the main seed: pnpm db:seed && pnpm db:seed:bulk
 *
 * Adds:
 * - 50+ additional clients
 * - 100+ additional cases
 * - 200+ additional tasks
 * - 500+ additional time entries
 * - 100+ additional documents
 * - 200+ additional emails
 */

import { PrismaClient } from '@prisma/client';
import { createHash } from 'crypto';

const prisma = new PrismaClient();

// ============================================================================
// DETERMINISTIC UUID GENERATOR (same as main seed)
// ============================================================================
const SEED_NAMESPACE = 'legal-platform-bulk-seed-2024';

function seedUUID(entityType: string, identifier: string | number): string {
  const input = `${SEED_NAMESPACE}:${entityType}:${identifier}`;
  const hash = createHash('sha256').update(input).digest('hex');
  return [
    hash.substring(0, 8),
    hash.substring(8, 12),
    '4' + hash.substring(13, 16),
    ((parseInt(hash.substring(16, 18), 16) & 0x3f) | 0x80).toString(16).padStart(2, '0') +
      hash.substring(18, 20),
    hash.substring(20, 32),
  ].join('-');
}

// ============================================================================
// DATA GENERATION HELPERS
// ============================================================================

function pastDate(daysAgo: number): Date {
  return new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
}

function futureDate(daysAhead: number): Date {
  return new Date(Date.now() + daysAhead * 24 * 60 * 60 * 1000);
}

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomElement<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Romanian names for realistic data
const firstNames = [
  'Ion',
  'Maria',
  'Andrei',
  'Elena',
  'George',
  'Ana',
  'Mihai',
  'Ioana',
  'Alexandru',
  'Cristina',
  'Stefan',
  'Daniela',
  'Nicolae',
  'Alina',
  'Vasile',
  'Monica',
  'Petru',
  'Roxana',
  'Constantin',
  'Laura',
  'Florin',
  'Diana',
  'Dumitru',
  'Simona',
  'Adrian',
  'Gabriela',
  'Marius',
  'Carmen',
  'Gheorghe',
  'Adriana',
  'Bogdan',
  'Mihaela',
  'Catalin',
  'Oana',
  'Razvan',
  'Andreea',
  'Sorin',
  'Raluca',
  'Dan',
  'Alexandra',
  'Vlad',
  'Irina',
  'Cosmin',
  'Denisa',
  'Tudor',
  'Bianca',
  'Robert',
  'Paula',
  'Victor',
  'Teodora',
];

const lastNames = [
  'Popescu',
  'Ionescu',
  'Popa',
  'Stoica',
  'Dumitru',
  'Stan',
  'Gheorghe',
  'Rusu',
  'Munteanu',
  'Serban',
  'Lazar',
  'Matei',
  'Ciobanu',
  'Moldovan',
  'Constantin',
  'Radu',
  'Florea',
  'Nicolae',
  'Voicu',
  'Preda',
  'Barbu',
  'Cristea',
  'Tudor',
  'Nistor',
  'Neagu',
  'Dobre',
  'Manea',
  'Mihai',
  'Lungu',
  'Ilie',
  'Ungureanu',
  'Dragomir',
  'Pavel',
  'Cojocaru',
  'Chiriac',
  'Sandu',
  'Iordache',
  'Maxim',
  'Dinu',
  'Badea',
  'Tomescu',
  'Bogdan',
  'Pascaru',
  'Enache',
  'Tanase',
  'Marinescu',
  'Niculescu',
  'Vasilescu',
  'Georgescu',
];

const companyTypes = ['SRL', 'SA', 'SCS', 'SNC', 'PFA'];
const industries = [
  'Industries',
  'Solutions',
  'Group',
  'Holding',
  'Trading',
  'Services',
  'Tech',
  'Consulting',
  'Logistics',
  'Development',
  'Manufacturing',
  'Construction',
  'Import-Export',
  'Distribution',
  'Investments',
];

const cities = [
  'București',
  'Cluj-Napoca',
  'Timișoara',
  'Iași',
  'Constanța',
  'Craiova',
  'Brașov',
  'Galați',
  'Ploiești',
  'Oradea',
  'Brăila',
  'Arad',
  'Sibiu',
  'Bacău',
  'Târgu Mureș',
  'Baia Mare',
  'Buzău',
  'Botoșani',
  'Satu Mare',
];

const streets = [
  'Strada Victoriei',
  'Bulevardul Unirii',
  'Calea Dorobanților',
  'Strada Florilor',
  'Bulevardul Independenței',
  'Strada Mihai Eminescu',
  'Calea Moșilor',
  'Strada Nicolae Bălcescu',
  'Bulevardul Regina Maria',
  'Strada Lipscani',
];

const caseTypes = [
  'Litigation',
  'Contract',
  'Advisory',
  'Corporate',
  'RealEstate',
  'Family',
  'Criminal',
  'IP',
];
const caseStatuses = [
  'Active',
  'Active',
  'Active',
  'PendingApproval',
  'OnHold',
  'Closed',
  'Archived',
]; // Weighted
const billingTypes = ['Hourly', 'Hourly', 'Fixed', 'Retainer']; // Weighted towards hourly
const taskTypes = [
  'Research',
  'DocumentCreation',
  'DocumentRetrieval',
  'CourtDate',
  'Meeting',
  'BusinessTrip',
];
const taskStatuses = ['Pending', 'Pending', 'InProgress', 'Completed', 'Completed', 'Cancelled']; // Weighted
const taskPriorities = ['Low', 'Medium', 'Medium', 'High', 'Urgent']; // Weighted
const documentStatuses = ['DRAFT', 'DRAFT', 'IN_REVIEW', 'FINAL', 'FINAL', 'ARCHIVED'];

const caseTitles = [
  'Litigiu comercial',
  'Recuperare creanță',
  'Contract furnizare',
  'Consultanță fiscală',
  'Fuziune societăți',
  'Achiziție imobiliară',
  'Litigiu de muncă',
  'Înființare SRL',
  'Cesiune părți sociale',
  'Litigiu proprietate',
  'Contract de leasing',
  'Mediere comercială',
  'Executare silită',
  'Insolvență',
  'Protecția datelor GDPR',
  'Proprietate intelectuală',
  'Contract de franciză',
  'Due diligence',
  'Restructurare societate',
  'Litigiu administrativ',
  'Partaj succesoral',
  'Divorț',
  'Custodie',
  'Contract de muncă',
  'Concurență neloială',
  'Daune morale',
  'Contracte internaționale',
  'Arbitraj comercial',
  'Dreptul familiei',
  'Drept penal economic',
  'Licențiere brand',
  'M&A Transaction',
  'Joint Venture',
];

async function main() {
  console.log('🌱 Starting bulk data generation...\n');

  // Get existing firm and users
  const firm = await prisma.firm.findFirst();
  if (!firm) {
    console.error('❌ No firm found. Run the main seed first: pnpm db:seed');
    process.exit(1);
  }

  const users = await prisma.user.findMany({ where: { status: 'Active' } });
  if (users.length === 0) {
    console.error('❌ No users found. Run the main seed first: pnpm db:seed');
    process.exit(1);
  }

  console.log(`Found firm: ${firm.name}`);
  console.log(`Found ${users.length} active users\n`);

  // ============================================================================
  // GENERATE CLIENTS (50 additional)
  // ============================================================================
  console.log('Creating additional clients...');
  const newClients = [];

  for (let i = 0; i < 50; i++) {
    const isCompany = Math.random() > 0.3; // 70% companies
    const firstName = randomElement(firstNames);
    const lastName = randomElement(lastNames);

    const name = isCompany
      ? `SC ${firstName} ${randomElement(industries)} ${randomElement(companyTypes)}`
      : `${firstName} ${lastName}`;

    const email = isCompany
      ? `contact@${firstName.toLowerCase()}-${randomElement(industries).toLowerCase()}.ro`
      : `${firstName.toLowerCase()}.${lastName.toLowerCase()}@email.ro`;

    const client = await prisma.client.create({
      data: {
        id: seedUUID('bulk-client', i),
        firmId: firm.id,
        name,
        contactInfo: {
          email,
          phone: `+40-7${randomInt(20, 89)}-${randomInt(100, 999)}-${randomInt(100, 999)}`,
          primaryContact: isCompany
            ? `${randomElement(firstNames)} ${randomElement(lastNames)}`
            : name,
        },
        address: `${randomElement(streets)} ${randomInt(1, 200)}, ${randomElement(cities)}, România`,
        createdAt: pastDate(randomInt(30, 365)),
        updatedAt: new Date(),
      },
    });
    newClients.push(client);
  }
  console.log(`✓ Created ${newClients.length} additional clients\n`);

  // Get all clients (including existing)
  const allClients = await prisma.client.findMany();

  // ============================================================================
  // GENERATE CASES (100 additional)
  // ============================================================================
  console.log('Creating additional cases...');
  const newCases = [];

  for (let i = 0; i < 100; i++) {
    const client = randomElement(allClients);
    const caseType = randomElement(caseTypes);
    const status = randomElement(caseStatuses);
    const billingType = randomElement(billingTypes);

    const caseData = await prisma.case.create({
      data: {
        id: seedUUID('bulk-case', i),
        firmId: firm.id,
        caseNumber: `${firm.id.substring(0, 8)}-2025-B${(i + 100).toString().padStart(3, '0')}`,
        title: `${randomElement(caseTitles)} - ${client.name.substring(0, 30)}`,
        clientId: client.id,
        status: status as any,
        type: caseType as any,
        description: `Generated case for testing - ${caseType} matter`,
        openedDate: pastDate(randomInt(1, 180)),
        closedDate:
          status === 'Closed' || status === 'Archived' ? pastDate(randomInt(1, 30)) : null,
        value: randomInt(5000, 500000),
        billingType: billingType as any,
        fixedAmount: billingType === 'Fixed' ? randomInt(50000, 2000000) : null,
        retainerAmount: billingType === 'Retainer' ? randomInt(100000, 500000) : null,
        customRates:
          Math.random() > 0.7
            ? {
                partnerRate: randomInt(400, 600),
                associateRate: randomInt(250, 400),
                paralegalRate: randomInt(100, 200),
              }
            : undefined,
        metadata: { generated: true, batchId: 'bulk-seed' },
        createdAt: pastDate(randomInt(30, 365)),
        updatedAt: new Date(),
      },
    });
    newCases.push(caseData);

    // Add case team
    const teamSize = randomInt(1, 3);
    const teamMembers = [...users].sort(() => Math.random() - 0.5).slice(0, teamSize);
    for (let j = 0; j < teamMembers.length; j++) {
      await prisma.caseTeam.create({
        data: {
          id: seedUUID('bulk-case-team', `${i}-${j}`),
          caseId: caseData.id,
          userId: teamMembers[j].id,
          role: j === 0 ? 'Lead' : 'Member',
          assignedAt: pastDate(randomInt(1, 30)),
        },
      });
    }
  }
  console.log(`✓ Created ${newCases.length} additional cases\n`);

  // Get all cases
  const allCases = await prisma.case.findMany();

  // ============================================================================
  // GENERATE TASKS (200 additional)
  // ============================================================================
  console.log('Creating additional tasks...');
  const newTasks = [];

  const taskTitles = [
    'Pregătire dosar pentru instanță',
    'Revizuire contract',
    'Consultație client',
    'Depunere cerere',
    'Obținere certificate',
    'Redactare memoriu',
    'Analiză documente',
    'Negociere contract',
    'Pregătire întâmpinare',
    'Verificare acte',
    'Întocmire proces-verbal',
    'Pregătire pledoarie',
    'Research jurisprudență',
    'Comunicare cu opusă parte',
    'Pregătire apel',
    'Verificare termen',
    'Actualizare dosar',
    'Calcul despăgubiri',
    'Pregătire documentație',
    'Follow-up client',
    'Arhivare dosar',
    'Due diligence check',
  ];

  for (let i = 0; i < 200; i++) {
    const caseData = randomElement(allCases);
    const assignee = randomElement(users);
    const daysOffset = randomInt(-10, 30); // Some overdue, some future

    const task = await prisma.task.create({
      data: {
        id: seedUUID('bulk-task', i),
        firmId: firm.id,
        caseId: caseData.id,
        type: randomElement(taskTypes) as any,
        title: randomElement(taskTitles),
        description: `Task generat pentru testare - ${caseData.caseNumber}`,
        assignedTo: assignee.id,
        dueDate: daysOffset >= 0 ? futureDate(daysOffset) : pastDate(Math.abs(daysOffset)),
        dueTime: Math.random() > 0.5 ? `${randomInt(8, 17)}:00` : null,
        status: randomElement(taskStatuses) as any,
        priority: randomElement(taskPriorities) as any,
        createdBy: randomElement(users).id,
        createdAt: pastDate(randomInt(1, 60)),
      },
    });
    newTasks.push(task);
  }
  console.log(`✓ Created ${newTasks.length} additional tasks\n`);

  // ============================================================================
  // GENERATE TIME ENTRIES (500 additional)
  // ============================================================================
  console.log('Creating additional time entries...');
  const newTimeEntries = [];

  const workDescriptions = [
    'Consultație telefonică cu clientul',
    'Redactare contract',
    'Revizuire documente',
    'Pregătire pentru instanță',
    'Research legislație',
    'Analiză jurisprudență',
    'Corespondență cu partea adversă',
    'Participare ședință',
    'Negocieri contract',
    'Întocmire cerere',
    'Verificare acte',
    'Consultanță juridică',
    'Redactare memoriu',
    'Pregătire pledoarie',
    'Deplasare tribunal',
    'Studiu dosar',
    'Întâlnire client',
    'Coordonare echipă',
    'Review documente primite',
    'Pregătire raport',
  ];

  for (let i = 0; i < 500; i++) {
    const caseData = randomElement(allCases);
    const user = randomElement(users);
    const hours = randomInt(1, 8) + randomInt(0, 3) * 0.25; // 1-8 hours in 15min increments

    // Determine rate based on user role
    let rate = 300; // default
    if (user.role === 'Partner' || user.role === 'BusinessOwner') rate = randomInt(400, 550);
    else if (user.role === 'Associate') rate = randomInt(250, 350);
    else if (user.role === 'Paralegal') rate = randomInt(100, 175);

    const timeEntry = await prisma.timeEntry.create({
      data: {
        id: seedUUID('bulk-time-entry', i),
        caseId: caseData.id,
        userId: user.id,
        date: pastDate(randomInt(1, 90)),
        hours,
        hourlyRate: rate,
        description: randomElement(workDescriptions),
        billable: Math.random() > 0.1, // 90% billable
        firmId: firm.id,
        createdAt: pastDate(randomInt(1, 90)),
      },
    });
    newTimeEntries.push(timeEntry);
  }
  console.log(`✓ Created ${newTimeEntries.length} additional time entries\n`);

  // ============================================================================
  // GENERATE DOCUMENTS (100 additional)
  // ============================================================================
  console.log('Creating additional documents...');
  const newDocuments = [];

  const documentNames = [
    'Contract de prestări servicii',
    'Cerere de chemare în judecată',
    'Întâmpinare',
    'Memoriu de apărare',
    'Contract de vânzare-cumpărare',
    'Procură specială',
    'Act adițional',
    'Hotărâre AGA',
    'Certificat constatator',
    'Extras CF',
    'Raport de expertiză',
    'Contract de închiriere',
    'Acord de confidențialitate',
    'Contract de cesiune',
    'Statut societate',
    'Contract cadru',
    'Protocol de predare',
    'Notificare reziliere',
    'Somație de plată',
    'Bilanț contabil',
  ];

  const fileTypes = [
    { ext: 'pdf', mime: 'application/pdf' },
    {
      ext: 'docx',
      mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    },
    { ext: 'xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' },
  ];

  for (let i = 0; i < 100; i++) {
    const client = randomElement(allClients);
    const uploader = randomElement(users);
    const docName = randomElement(documentNames);
    const fileType = randomElement(fileTypes);
    const status = randomElement(documentStatuses);

    const doc = await prisma.document.create({
      data: {
        id: seedUUID('bulk-document', i),
        clientId: client.id,
        firmId: firm.id,
        fileName: `${docName.replace(/\s+/g, '_')}_${i}.${fileType.ext}`,
        fileType: fileType.mime,
        fileSize: randomInt(10000, 5000000),
        storagePath: `/${firm.id}/clients/${client.id}/documents/${seedUUID('bulk-document', i)}`,
        uploadedBy: uploader.id,
        uploadedAt: pastDate(randomInt(1, 180)),
        metadata: { description: docName, tags: [], generated: true },
        status: status as any,
        createdAt: pastDate(randomInt(1, 180)),
        updatedAt: new Date(),
      },
    });
    newDocuments.push(doc);

    // Link to a case
    const clientCases = allCases.filter((c) => c.clientId === client.id);
    if (clientCases.length > 0) {
      await prisma.caseDocument.create({
        data: {
          id: seedUUID('bulk-case-document', i),
          caseId: randomElement(clientCases).id,
          documentId: doc.id,
          linkedBy: uploader.id,
          linkedAt: pastDate(randomInt(1, 30)),
          isOriginal: true,
          firmId: firm.id,
        },
      });
    }
  }
  console.log(`✓ Created ${newDocuments.length} additional documents\n`);

  // ============================================================================
  // GENERATE EMAILS (200 additional)
  // ============================================================================
  console.log('Creating additional emails...');
  const newEmails = [];

  const emailSubjects = [
    'RE: Dosar',
    'FW: Documente solicitate',
    'Confirmare primire',
    'Urgent: Termen procedural',
    'Programare întâlnire',
    'Solicitare informații',
    'Actualizare status dosar',
    'Propunere de tranzacție',
    'RE: Contract - modificări',
    'Factura servicii juridice',
    'Întrebare privind procedura',
    'Confirmare disponibilitate',
    'Documente anexate',
    'RE: Consultație juridică',
    'Reminder: Termen apropiat',
    'Status negocieri',
    'Răspuns la notificare',
    'Programare ședință',
    'Update caz',
    'Solicitare acte',
  ];

  for (let i = 0; i < 200; i++) {
    const user = randomElement(users);
    const isReceived = Math.random() > 0.4; // 60% received
    const hoursAgo = randomInt(1, 168); // Last 7 days

    const senderName = isReceived
      ? `${randomElement(firstNames)} ${randomElement(lastNames)}`
      : `${user.firstName} ${user.lastName}`;
    const senderEmail = isReceived
      ? `${randomElement(firstNames).toLowerCase()}.${randomElement(lastNames).toLowerCase()}@${randomElement(['email', 'gmail', 'yahoo', 'outlook'])}.ro`
      : user.email;

    const emailDate = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    const email = await prisma.email.create({
      data: {
        id: seedUUID('bulk-email', i),
        graphMessageId: `bulk-graph-${i}-${Date.now()}`,
        userId: user.id,
        conversationId: `bulk-conv-${Math.floor(i / 3)}`, // Group some in conversations
        subject: `${randomElement(emailSubjects)} ${randomInt(1000, 9999)}`,
        bodyPreview: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit...',
        bodyContent: `<html><body><p>Stimate domn/doamnă,</p><p>Vă contactăm în legătură cu dosarul dumneavoastră.</p><p>Cu stimă,<br/>${senderName}</p></body></html>`,
        bodyContentType: 'html',
        from: { name: senderName, address: senderEmail },
        toRecipients: isReceived
          ? [{ name: `${user.firstName} ${user.lastName}`, address: user.email }]
          : [
              {
                name: `${randomElement(firstNames)} ${randomElement(lastNames)}`,
                address: `contact@${randomElement(['company', 'client', 'partner'])}.ro`,
              },
            ],
        ccRecipients: [],
        bccRecipients: [],
        importance: randomElement(['low', 'normal', 'normal', 'normal', 'high']),
        isRead: Math.random() > 0.3,
        hasAttachments: Math.random() > 0.7,
        receivedDateTime: emailDate,
        sentDateTime: emailDate,
        firmId: firm.id,
        createdAt: emailDate,
      },
    });
    newEmails.push(email);

    // Link some emails to cases
    if (Math.random() > 0.3) {
      const caseData = randomElement(allCases);
      await prisma.emailCaseLink.create({
        data: {
          id: seedUUID('bulk-email-case-link', i),
          emailId: email.id,
          caseId: caseData.id,
          linkedBy: user.id,
          linkedAt: emailDate,
          confidence: randomInt(70, 100) / 100,
          matchType: 'Manual',
        },
      });
    }
  }
  console.log(`✓ Created ${newEmails.length} additional emails\n`);

  // ============================================================================
  // GENERATE NOTIFICATIONS (100 additional)
  // ============================================================================
  console.log('Creating additional notifications...');

  const notificationData = [
    { title: 'Sarcină nouă atribuită', icon: 'task' },
    { title: 'Termen aproape', icon: 'calendar' },
    { title: 'Actualizare dosar', icon: 'court' },
    { title: 'Document nou încărcat', icon: 'document' },
    { title: 'Email nou primit', icon: 'email' },
    { title: 'Termen limită aproape', icon: 'warning' },
  ];

  for (let i = 0; i < 100; i++) {
    const user = randomElement(users);
    const notifInfo = randomElement(notificationData);
    const caseData = randomElement(allCases);

    await prisma.inAppNotification.create({
      data: {
        id: seedUUID('bulk-notification', i),
        userId: user.id,
        title: notifInfo.title,
        body: `Notificare pentru ${caseData.caseNumber}`,
        icon: notifInfo.icon,
        actionType: 'open_case',
        actionData: { entityId: caseData.id, caseId: caseData.id },
        read: Math.random() > 0.5,
        createdAt: pastDate(randomInt(0, 14)),
      },
    });
  }
  console.log(`✓ Created 100 additional notifications\n`);

  // ============================================================================
  // SUMMARY
  // ============================================================================
  const totalClients = await prisma.client.count();
  const totalCases = await prisma.case.count();
  const totalTasks = await prisma.task.count();
  const totalTimeEntries = await prisma.timeEntry.count();
  const totalDocuments = await prisma.document.count();
  const totalEmails = await prisma.email.count();
  const totalNotifications = await prisma.inAppNotification.count();

  console.log('✅ Bulk data generation completed!\n');
  console.log('Database totals:');
  console.log(`  - Clients: ${totalClients}`);
  console.log(`  - Cases: ${totalCases}`);
  console.log(`  - Tasks: ${totalTasks}`);
  console.log(`  - Time Entries: ${totalTimeEntries}`);
  console.log(`  - Documents: ${totalDocuments}`);
  console.log(`  - Emails: ${totalEmails}`);
  console.log(`  - Notifications: ${totalNotifications}`);
  console.log('\nTo view data: npx prisma studio');
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error('❌ Error during bulk seed:', e);
    await prisma.$disconnect();
    process.exit(1);
  });
