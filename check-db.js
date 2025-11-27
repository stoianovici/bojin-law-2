const { PrismaClient } = require('@legal-platform/database');

async function checkData() {
  const prisma = new PrismaClient();

  try {
    const caseCount = await prisma.case.count();
    const timeEntryCount = await prisma.timeEntry.count();
    const firmCount = await prisma.firm.count();
    const userCount = await prisma.user.count();

    const firms = await prisma.firm.findMany({ select: { id: true, name: true } });
    const cases = await prisma.case.findMany({
      select: { id: true, title: true, firmId: true },
      take: 3
    });

    console.log('Database Contents:');
    console.log('- Firms:', firmCount);
    console.log('- Users:', userCount);
    console.log('- Cases:', caseCount);
    console.log('- Time Entries:', timeEntryCount);
    console.log('');
    console.log('Firm IDs:');
    firms.forEach(f => console.log('  -', f.id, f.name));
    console.log('');
    console.log('Sample Cases:');
    cases.forEach(c => console.log('  -', c.title, '(firm:', c.firmId + ')'));

    await prisma.$disconnect();
  } catch (error) {
    console.error('Error:', error);
    await prisma.$disconnect();
    process.exit(1);
  }
}

checkData();
