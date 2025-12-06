/**
 * Bulk Import Documents API Route
 * Receives documents extracted locally and creates database records
 * Part of Story 3.2.5 - Legacy Document Import (Large PST support)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/generated/prisma';

interface ImportedDocument {
  id: string;
  fileName: string;
  fileExtension: string;
  fileSizeBytes: number;
  storagePath: string;
  folderPath: string;
  isSent: boolean;
  emailSubject: string;
  emailSender: string;
  emailReceiver: string;
  emailDate: string;
  monthYear: string;
}

/**
 * POST - Bulk import documents from local extraction
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, documents } = body as {
      sessionId: string;
      documents: ImportedDocument[];
    };

    if (!sessionId) {
      return NextResponse.json({ error: 'Session ID required' }, { status: 400 });
    }

    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return NextResponse.json({ error: 'Documents array required' }, { status: 400 });
    }

    // Get or create session
    let session = await prisma.legacyImportSession.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    // Group documents by month for batch creation
    const byMonth = new Map<string, ImportedDocument[]>();
    for (const doc of documents) {
      const existing = byMonth.get(doc.monthYear) || [];
      existing.push(doc);
      byMonth.set(doc.monthYear, existing);
    }

    // Create database records in a transaction
    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const createdDocs = [];

        for (const [monthYear, monthDocs] of byMonth) {
          // Get or create batch for this month
          let batch = await tx.documentBatch.findFirst({
            where: { sessionId, monthYear },
          });

          if (!batch) {
            batch = await tx.documentBatch.create({
              data: {
                sessionId,
                monthYear,
                documentCount: 0,
              },
            });
          }

          // Create document records
          for (const doc of monthDocs) {
            const created = await tx.extractedDocument.upsert({
              where: { id: doc.id },
              create: {
                id: doc.id,
                sessionId,
                batchId: batch.id,
                fileName: doc.fileName,
                fileExtension: doc.fileExtension,
                fileSizeBytes: doc.fileSizeBytes,
                storagePath: doc.storagePath,
                folderPath: doc.folderPath,
                isSent: doc.isSent,
                emailSubject: doc.emailSubject,
                emailSender: doc.emailSender,
                emailReceiver: doc.emailReceiver,
                emailDate: new Date(doc.emailDate),
                status: 'Uncategorized',
              },
              update: {
                // If already exists, just update storage path
                storagePath: doc.storagePath,
              },
            });
            createdDocs.push(created);
          }

          // Update batch document count
          await tx.documentBatch.update({
            where: { id: batch.id },
            data: {
              documentCount: {
                increment: monthDocs.length,
              },
            },
          });
        }

        // Update session totals
        await tx.legacyImportSession.update({
          where: { id: sessionId },
          data: {
            status: 'InProgress',
            totalDocuments: {
              increment: documents.length,
            },
          },
        });

        return createdDocs;
      },
      {
        maxWait: 30000,
        timeout: 60000,
      }
    );

    return NextResponse.json({
      success: true,
      imported: result.length,
      sessionId,
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    return NextResponse.json(
      {
        error: 'Failed to import documents',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
