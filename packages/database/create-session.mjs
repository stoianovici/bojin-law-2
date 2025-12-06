import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://bojin_law_user:4p8aeC8EcMmJcEi1KwM0LwXWqSLCXhMv@dpg-d3jcjf5ds78s73cmj4ug-a.oregon-postgres.render.com/bojin_law?connect_timeout=30"
    }
  }
});

async function main() {
  try {
    const session = await prisma.legacyImportSession.upsert({
      where: { id: 'local-valentin-pst-001' },
      update: { status: 'InProgress' },
      create: {
        id: 'local-valentin-pst-001',
        firmId: 'firm-bojin-001',
        pstFileName: 'backup email valentin.pst',
        pstFileSize: BigInt(50465865728),
        uploadedBy: 'local-extraction',
        status: 'InProgress',
      }
    });
    console.log('Session ID:', session.id);
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await prisma.$disconnect();
  }
}
main();
