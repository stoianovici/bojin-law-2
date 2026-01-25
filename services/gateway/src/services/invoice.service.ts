/**
 * InvoiceService
 *
 * Business logic for invoice management.
 * Handles creation, issuance, payment, and cancellation of invoices.
 */

import { prisma } from '@legal-platform/database';
import { InvoiceStatus, EFacturaStatus, LineItemType } from '@prisma/client';
import {
  OblioService,
  OblioInvoiceData,
  OblioProductData,
  formatOblioDate,
  decimalToNumber,
} from './oblio.service';
import { Decimal } from '@prisma/client/runtime/library';

// ============================================================================
// Types
// ============================================================================

export interface CreatePreparedInvoiceInput {
  clientId: string;
  caseId?: string;
  lineItems: LineItemInput[];
  issueDate?: string;
  dueDate?: string;
  notes?: string;
  internalNote?: string;
  applyVat?: boolean;
}

export interface LineItemInput {
  timeEntryId?: string;
  taskId?: string;
  name: string;
  description?: string;
  lineType: 'TimeEntry' | 'Fixed' | 'Expense' | 'Discount' | 'Manual';
  quantity: number;
  unitPriceEur: number;
  measuringUnit?: string;
  vatRate?: number;
  originalHours?: number;
  originalRateEur?: number;
  wasAdjusted?: boolean;
  adjustmentNote?: string;
}

// ============================================================================
// InvoiceService
// ============================================================================

export class InvoiceService {
  /**
   * Create a prepared (draft) invoice from line items.
   */
  async createPreparedInvoice(input: CreatePreparedInvoiceInput, userId: string, firmId: string) {
    // Get firm's Oblio configuration
    const oblioConfig = await prisma.oblioConfig.findUnique({
      where: { firmId },
    });

    if (!oblioConfig) {
      throw new Error(
        'Configurația Oblio nu este setată. Vă rugăm să configurați integrarea Oblio în Setări.'
      );
    }

    // Get client details
    const client = await prisma.client.findUnique({
      where: { id: input.clientId },
      include: {
        cases: input.caseId ? { where: { id: input.caseId } } : undefined,
      },
    });

    if (!client) {
      throw new Error('Clientul nu a fost găsit');
    }

    // Get exchange rate from Oblio
    const oblioService = new OblioService(firmId);
    const exchangeRateData = await oblioService.getExchangeRate('EUR');
    const exchangeRate = new Decimal(exchangeRateData.rate);
    const exchangeRateDate = new Date(exchangeRateData.date);

    // Calculate VAT rate
    const vatRate = oblioConfig.isVatPayer ? decimalToNumber(oblioConfig.defaultVatRate) : 0;

    // Calculate issue and due dates
    const issueDate = input.issueDate ? new Date(input.issueDate) : new Date();
    const dueDate = input.dueDate
      ? new Date(input.dueDate)
      : new Date(issueDate.getTime() + oblioConfig.defaultDueDays * 24 * 60 * 60 * 1000);

    // Process line items and calculate totals
    let subtotalEur = new Decimal(0);
    const lineItemsData = input.lineItems.map((item, index) => {
      const quantity = new Decimal(item.quantity);
      const unitPriceEur = new Decimal(item.unitPriceEur);
      const amountEur = quantity.mul(unitPriceEur);
      const amountRon = amountEur.mul(exchangeRate);
      const unitPriceRon = unitPriceEur.mul(exchangeRate);
      const itemVatRate = item.vatRate ?? vatRate;
      const vatAmount = amountRon.mul(new Decimal(itemVatRate).div(100));
      const total = amountRon.add(vatAmount);

      subtotalEur = subtotalEur.add(amountEur);

      return {
        name: item.name,
        description: item.description,
        lineType: item.lineType as LineItemType,
        originalHours: item.originalHours ? new Decimal(item.originalHours) : null,
        originalRateEur: item.originalRateEur ? new Decimal(item.originalRateEur) : null,
        quantity,
        measuringUnit: item.measuringUnit || 'ore',
        unitPriceEur,
        unitPriceRon,
        amountEur,
        amountRon,
        vatRate: new Decimal(itemVatRate),
        vatAmount,
        total,
        wasAdjusted: item.wasAdjusted || false,
        adjustmentNote: item.adjustmentNote,
        timeEntryId: item.timeEntryId,
        taskId: item.taskId,
        sortOrder: index,
      };
    });

    // Calculate totals
    const subtotalRon = subtotalEur.mul(exchangeRate);
    const totalVat = lineItemsData.reduce((sum, item) => sum.add(item.vatAmount), new Decimal(0));
    const total = subtotalRon.add(totalVat);

    // Create invoice with line items in a transaction
    const invoice = await prisma.$transaction(async (tx) => {
      // Create the invoice
      const newInvoice = await tx.invoice.create({
        data: {
          firmId,
          clientId: input.clientId,
          caseId: input.caseId,
          oblioSeries: oblioConfig.defaultSeries,
          issueDate,
          dueDate,
          originalCurrency: 'EUR',
          invoiceCurrency: 'RON',
          exchangeRate,
          exchangeRateDate,
          exchangeRateSource: oblioConfig.exchangeRateSource,
          subtotalEur,
          subtotalRon,
          vatAmount: totalVat,
          total,
          status: InvoiceStatus.Draft,
          notes: input.notes,
          internalNote: input.internalNote,
          createdById: userId,
          lineItems: {
            create: lineItemsData,
          },
        },
        include: {
          lineItems: {
            orderBy: { sortOrder: 'asc' },
          },
          client: true,
          case: true,
          createdBy: true,
        },
      });

      // Mark tasks as invoiced if they have time entries included
      const taskIds = new Set<string>();
      for (const item of lineItemsData) {
        if (item.taskId) {
          taskIds.add(item.taskId);
        }
      }

      if (taskIds.size > 0) {
        await tx.task.updateMany({
          where: { id: { in: Array.from(taskIds) } },
          data: {
            invoicedAt: new Date(),
            invoiceId: newInvoice.id,
          },
        });
      }

      return newInvoice;
    });

    return invoice;
  }

  /**
   * Issue an invoice to Oblio (get official number).
   */
  async issueInvoice(invoiceId: string, firmId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, firmId },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
        client: true,
        case: true,
      },
    });

    if (!invoice) {
      throw new Error('Factura nu a fost găsită');
    }

    if (invoice.status !== InvoiceStatus.Draft) {
      throw new Error('Doar facturile în stare de ciornă pot fi emise');
    }

    const oblioConfig = await prisma.oblioConfig.findUnique({
      where: { firmId },
    });

    if (!oblioConfig) {
      throw new Error('Configurația Oblio nu este setată');
    }

    // Build client data for Oblio
    const clientContact = (invoice.client.contactInfo as Record<string, string>) || {};
    const oblioClient = {
      cif: invoice.client.cui || '',
      name: invoice.client.name,
      rc: invoice.client.registrationNumber || undefined,
      address: invoice.client.address || undefined,
      email: clientContact.email || undefined,
      phone: clientContact.phone || undefined,
      vatPayer: invoice.client.clientType === 'company',
    };

    // Build products for Oblio
    const products: OblioProductData[] = invoice.lineItems.map((item) => ({
      name: item.name,
      description: item.description || undefined,
      measuringUnit: item.measuringUnit,
      currency: 'RON',
      vatPercentage: decimalToNumber(item.vatRate),
      vatIncluded: false,
      quantity: decimalToNumber(item.quantity),
      price:
        decimalToNumber(item.unitPriceRon) ||
        decimalToNumber(item.unitPriceEur) * decimalToNumber(invoice.exchangeRate),
      productType: 'Serviciu',
    }));

    // Build invoice data for Oblio
    const oblioData: OblioInvoiceData = {
      cif: oblioConfig.companyCif,
      client: oblioClient,
      issueDate: formatOblioDate(invoice.issueDate),
      dueDate: formatOblioDate(invoice.dueDate),
      seriesName: invoice.oblioSeries || oblioConfig.defaultSeries,
      workStation: oblioConfig.workStation || undefined,
      products,
      mentions: invoice.notes || undefined,
      currency: 'RON',
      language: 'RO',
    };

    // Send to Oblio
    const oblioService = new OblioService(firmId);
    const result = await oblioService.createInvoice(oblioData);

    // Update invoice with Oblio response
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        oblioNumber: result.number,
        oblioDocumentId: result.link,
        pdfUrl: result.link,
        status: InvoiceStatus.Issued,
        issuedAt: new Date(),
      },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
        client: true,
        case: true,
        createdBy: true,
      },
    });

    // Auto-submit to e-Factura if configured
    if (oblioConfig.autoSubmitEFactura && invoice.client.clientType === 'company') {
      try {
        await this.submitToEFactura(invoiceId, firmId);
      } catch (error) {
        console.error('Failed to auto-submit to e-Factura:', error);
        // Don't throw - invoice was issued successfully
      }
    }

    return updatedInvoice;
  }

  /**
   * Mark an invoice as paid.
   */
  async markInvoicePaid(invoiceId: string, firmId: string, paidAt?: Date) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, firmId },
    });

    if (!invoice) {
      throw new Error('Factura nu a fost găsită');
    }

    if (invoice.status === InvoiceStatus.Draft) {
      throw new Error('Nu puteți marca o ciornă ca plătită');
    }

    if (invoice.status === InvoiceStatus.Cancelled) {
      throw new Error('Nu puteți marca o factură anulată ca plătită');
    }

    // Mark as collected in Oblio if issued
    if (invoice.oblioNumber && invoice.oblioSeries) {
      const oblioService = new OblioService(firmId);
      await oblioService.collectInvoice(
        invoice.oblioSeries,
        invoice.oblioNumber,
        paidAt || new Date()
      );
    }

    return prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        status: InvoiceStatus.Paid,
        paidAt: paidAt || new Date(),
      },
      include: {
        lineItems: true,
        client: true,
        case: true,
        createdBy: true,
      },
    });
  }

  /**
   * Cancel an issued invoice.
   */
  async cancelInvoice(invoiceId: string, firmId: string, reason?: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, firmId },
      include: {
        lineItems: true,
        tasks: true,
      },
    });

    if (!invoice) {
      throw new Error('Factura nu a fost găsită');
    }

    if (invoice.status === InvoiceStatus.Draft) {
      throw new Error('Ciornele nu pot fi anulate, folosiți ștergerea');
    }

    if (invoice.status === InvoiceStatus.Cancelled) {
      throw new Error('Factura este deja anulată');
    }

    // Cancel in Oblio if issued
    if (invoice.oblioNumber && invoice.oblioSeries) {
      const oblioService = new OblioService(firmId);
      await oblioService.cancelInvoice(invoice.oblioSeries, invoice.oblioNumber);
    }

    // Restore tasks to un-invoiced state
    return prisma.$transaction(async (tx) => {
      // Clear invoice reference from tasks
      if (invoice.tasks.length > 0) {
        await tx.task.updateMany({
          where: { invoiceId },
          data: {
            invoicedAt: null,
            invoiceId: null,
          },
        });
      }

      // Update invoice status
      return tx.invoice.update({
        where: { id: invoiceId },
        data: {
          status: InvoiceStatus.Cancelled,
          cancelledAt: new Date(),
          cancellationReason: reason,
        },
        include: {
          lineItems: true,
          client: true,
          case: true,
          createdBy: true,
        },
      });
    });
  }

  /**
   * Delete a draft invoice.
   */
  async deleteInvoice(invoiceId: string, firmId: string): Promise<boolean> {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, firmId },
      include: {
        tasks: true,
      },
    });

    if (!invoice) {
      throw new Error('Factura nu a fost găsită');
    }

    if (invoice.status !== InvoiceStatus.Draft) {
      throw new Error('Doar ciornele pot fi șterse. Facturile emise trebuie anulate.');
    }

    return prisma.$transaction(async (tx) => {
      // Clear invoice reference from tasks
      if (invoice.tasks.length > 0) {
        await tx.task.updateMany({
          where: { invoiceId },
          data: {
            invoicedAt: null,
            invoiceId: null,
          },
        });
      }

      // Delete line items and invoice
      await tx.invoiceLineItem.deleteMany({
        where: { invoiceId },
      });

      await tx.invoice.delete({
        where: { id: invoiceId },
      });

      return true;
    });
  }

  /**
   * Submit invoice to e-Factura (ANAF).
   */
  async submitToEFactura(invoiceId: string, firmId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, firmId },
    });

    if (!invoice) {
      throw new Error('Factura nu a fost găsită');
    }

    if (!invoice.oblioNumber || !invoice.oblioSeries) {
      throw new Error('Factura trebuie emisă în Oblio înainte de a fi trimisă la e-Factura');
    }

    const oblioService = new OblioService(firmId);
    const result = await oblioService.submitToEFactura(invoice.oblioSeries, invoice.oblioNumber);

    if (!result.success) {
      return prisma.invoice.update({
        where: { id: invoiceId },
        data: {
          eFacturaStatus: EFacturaStatus.Error,
          eFacturaError: result.error,
        },
      });
    }

    return prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        eFacturaStatus: EFacturaStatus.Submitted,
        eFacturaId: result.eFacturaId,
        eFacturaSubmittedAt: new Date(),
        eFacturaError: null,
      },
    });
  }

  /**
   * Get invoice by ID.
   */
  async getInvoice(invoiceId: string, firmId: string) {
    return prisma.invoice.findFirst({
      where: { id: invoiceId, firmId },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
        client: true,
        case: true,
        createdBy: true,
      },
    });
  }

  /**
   * Get invoices with filters.
   */
  async getInvoices(
    firmId: string,
    filters?: {
      clientId?: string;
      caseId?: string;
      status?: InvoiceStatus;
      dateFrom?: Date;
      dateTo?: Date;
    },
    limit: number = 50,
    offset: number = 0
  ) {
    const where: any = { firmId };

    if (filters?.clientId) {
      where.clientId = filters.clientId;
    }

    if (filters?.caseId) {
      where.caseId = filters.caseId;
    }

    if (filters?.status) {
      where.status = filters.status;
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.issueDate = {};
      if (filters.dateFrom) {
        where.issueDate.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.issueDate.lte = filters.dateTo;
      }
    }

    return prisma.invoice.findMany({
      where,
      include: {
        client: {
          select: { id: true, name: true },
        },
        case: {
          select: { id: true, title: true, caseNumber: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });
  }

  /**
   * Get IDs of tasks that have been invoiced on a specific invoice.
   */
  async getInvoicedTaskIds(invoiceId: string): Promise<string[]> {
    const tasks = await prisma.task.findMany({
      where: { invoiceId },
      select: { id: true },
    });

    return tasks.map((t) => t.id);
  }

  /**
   * Check if time entries have already been invoiced.
   */
  async checkTimeEntriesInvoiced(timeEntryIds: string[]): Promise<string[]> {
    const lineItems = await prisma.invoiceLineItem.findMany({
      where: {
        timeEntryId: { in: timeEntryIds },
        invoice: {
          status: { not: InvoiceStatus.Cancelled },
        },
      },
      select: { timeEntryId: true },
    });

    return lineItems
      .filter((item) => item.timeEntryId !== null)
      .map((item) => item.timeEntryId as string);
  }

  // ==========================================================================
  // Proforma Methods (for testing without creating real invoices)
  // ==========================================================================

  /**
   * Issue a draft invoice as a proforma in Oblio.
   * Proformas can be deleted and don't affect real invoice numbering.
   * Great for testing the integration without creating real invoices.
   */
  async issueAsProforma(invoiceId: string, firmId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, firmId },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
        client: true,
        case: true,
      },
    });

    if (!invoice) {
      throw new Error('Factura nu a fost găsită');
    }

    if (invoice.status !== InvoiceStatus.Draft) {
      throw new Error('Doar facturile în stare de ciornă pot fi trimise ca proformă');
    }

    const oblioConfig = await prisma.oblioConfig.findUnique({
      where: { firmId },
    });

    if (!oblioConfig) {
      throw new Error('Configurația Oblio nu este setată');
    }

    // Build client data for Oblio
    const clientContact = (invoice.client.contactInfo as Record<string, string>) || {};
    const oblioClient = {
      cif: invoice.client.cui || '',
      name: invoice.client.name,
      rc: invoice.client.registrationNumber || undefined,
      address: invoice.client.address || undefined,
      email: clientContact.email || undefined,
      phone: clientContact.phone || undefined,
      vatPayer: invoice.client.clientType === 'company',
    };

    // Build products for Oblio
    const products: OblioProductData[] = invoice.lineItems.map((item) => ({
      name: item.name,
      description: item.description || undefined,
      measuringUnit: item.measuringUnit,
      currency: 'RON',
      vatPercentage: decimalToNumber(item.vatRate),
      vatIncluded: false,
      quantity: decimalToNumber(item.quantity),
      price:
        decimalToNumber(item.unitPriceRon) ||
        decimalToNumber(item.unitPriceEur) * decimalToNumber(invoice.exchangeRate),
      productType: 'Serviciu',
    }));

    // Build proforma data for Oblio
    const oblioData: OblioInvoiceData = {
      cif: oblioConfig.companyCif,
      client: oblioClient,
      issueDate: formatOblioDate(invoice.issueDate),
      dueDate: formatOblioDate(invoice.dueDate),
      seriesName: invoice.oblioSeries || oblioConfig.defaultSeries,
      workStation: oblioConfig.workStation || undefined,
      products,
      mentions: invoice.notes ? `[PROFORMA TEST] ${invoice.notes}` : '[PROFORMA TEST]',
      currency: 'RON',
      language: 'RO',
    };

    // Send to Oblio as proforma
    const oblioService = new OblioService(firmId);
    const result = await oblioService.createProforma(oblioData);

    // Update invoice with proforma details
    // Note: We use oblioNumber/oblioSeries to store proforma info,
    // but keep status as Draft since it's not a real invoice
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        oblioNumber: result.number,
        oblioDocumentId: `proforma:${result.seriesName}:${result.number}`,
        pdfUrl: result.link,
        internalNote: invoice.internalNote
          ? `${invoice.internalNote}\n[Proforma: ${result.seriesName} #${result.number}]`
          : `[Proforma: ${result.seriesName} #${result.number}]`,
      },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
        client: true,
        case: true,
        createdBy: true,
      },
    });

    return {
      invoice: updatedInvoice,
      proforma: {
        seriesName: result.seriesName,
        number: result.number,
        link: result.link,
      },
    };
  }

  /**
   * Delete a proforma from Oblio.
   * Only works if the invoice was issued as proforma (oblioDocumentId starts with 'proforma:')
   */
  async deleteProforma(invoiceId: string, firmId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, firmId },
    });

    if (!invoice) {
      throw new Error('Factura nu a fost găsită');
    }

    if (!invoice.oblioDocumentId?.startsWith('proforma:')) {
      throw new Error('Această factură nu este o proformă');
    }

    // Parse proforma details from oblioDocumentId: "proforma:SERIES:NUMBER"
    const [, series, numberStr] = invoice.oblioDocumentId.split(':');
    const number = parseInt(numberStr, 10);

    if (!series || isNaN(number)) {
      throw new Error('Date proformă invalide');
    }

    // Delete from Oblio
    const oblioService = new OblioService(firmId);
    await oblioService.deleteProforma(series, number);

    // Clear proforma data from invoice (keeps it as draft)
    return prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        oblioNumber: null,
        oblioDocumentId: null,
        pdfUrl: null,
        internalNote: invoice.internalNote?.replace(/\n?\[Proforma:.*?\]/g, '') || null,
      },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
        client: true,
        case: true,
        createdBy: true,
      },
    });
  }

  /**
   * Convert a proforma to a real invoice.
   * This issues the invoice in Oblio based on the existing proforma data.
   */
  async convertProformaToInvoice(invoiceId: string, firmId: string) {
    const invoice = await prisma.invoice.findFirst({
      where: { id: invoiceId, firmId },
    });

    if (!invoice) {
      throw new Error('Factura nu a fost găsită');
    }

    if (!invoice.oblioDocumentId?.startsWith('proforma:')) {
      throw new Error('Această factură nu este o proformă');
    }

    // Parse proforma details
    const [, proformaSeries, proformaNumberStr] = invoice.oblioDocumentId.split(':');
    const proformaNumber = parseInt(proformaNumberStr, 10);

    if (!proformaSeries || isNaN(proformaNumber)) {
      throw new Error('Date proformă invalide');
    }

    const oblioConfig = await prisma.oblioConfig.findUnique({
      where: { firmId },
    });

    if (!oblioConfig) {
      throw new Error('Configurația Oblio nu este setată');
    }

    // Convert proforma to invoice in Oblio
    const oblioService = new OblioService(firmId);
    const result = await oblioService.convertProformaToInvoice(
      proformaSeries,
      proformaNumber,
      oblioConfig.defaultSeries
    );

    // Update invoice with real invoice data
    const updatedInvoice = await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        oblioSeries: result.seriesName,
        oblioNumber: result.number,
        oblioDocumentId: result.link,
        pdfUrl: result.link,
        status: InvoiceStatus.Issued,
        issuedAt: new Date(),
        internalNote: invoice.internalNote?.replace(/\n?\[Proforma:.*?\]/g, '') || null,
      },
      include: {
        lineItems: { orderBy: { sortOrder: 'asc' } },
        client: true,
        case: true,
        createdBy: true,
      },
    });

    return updatedInvoice;
  }
}
