/**
 * OblioService
 *
 * Wrapper service for the Oblio.eu invoicing API.
 * Handles authentication, invoice creation, and e-Factura submission.
 */

import OblioApi from '@obliosoftware/oblioapi';
import { prisma } from '@legal-platform/database';
import { decrypt } from '../utils/encryption.util';
import { Decimal } from '@prisma/client/runtime/library';

// ============================================================================
// Types
// ============================================================================

export interface OblioInvoiceData {
  cif: string;
  client: OblioClientData;
  issueDate: string;
  dueDate: string;
  seriesName: string;
  workStation?: string;
  collect?: {
    type: string;
    documentDate: string;
  };
  products: OblioProductData[];
  mentions?: string;
  currency?: string;
  exchangeRate?: number;
  language?: string;
}

export interface OblioClientData {
  cif: string;
  name: string;
  rc?: string;
  code?: string;
  address?: string;
  state?: string;
  city?: string;
  country?: string;
  phone?: string;
  email?: string;
  contact?: string;
  iban?: string;
  bank?: string;
  vatPayer?: boolean;
}

export interface OblioProductData {
  name: string;
  code?: string;
  description?: string;
  measuringUnit: string;
  currency: string;
  vatName?: string;
  vatPercentage: number;
  vatIncluded: boolean;
  quantity: number;
  price: number;
  discount?: number;
  discountType?: 'percent' | 'value';
  productType?: string;
}

export interface OblioInvoiceResult {
  seriesName: string;
  number: number;
  link?: string;
  eFacturaLink?: string;
  data?: Record<string, unknown>;
}

export interface OblioProformaResult {
  seriesName: string;
  number: number;
  link?: string;
  data?: Record<string, unknown>;
}

export interface OblioExchangeRate {
  rate: number;
  date: string;
}

export interface OblioConnectionTest {
  success: boolean;
  message: string;
  companyName?: string;
}

// ============================================================================
// OblioService
// ============================================================================

export class OblioService {
  private api: OblioApi | null = null;
  private firmId: string;

  constructor(firmId: string) {
    this.firmId = firmId;
  }

  /**
   * Initialize the Oblio API client with credentials from the database.
   */
  private async initApi(): Promise<OblioApi> {
    if (this.api) {
      return this.api;
    }

    const config = await prisma.oblioConfig.findUnique({
      where: { firmId: this.firmId },
    });

    if (!config) {
      throw new Error('Oblio configuration not found for this firm');
    }

    const secret = decrypt(config.secretEncrypted);

    this.api = new OblioApi(config.email, secret);
    this.api.setCif(config.companyCif);

    return this.api;
  }

  /**
   * Test the Oblio API connection with current credentials.
   */
  async testConnection(): Promise<OblioConnectionTest> {
    try {
      const api = await this.initApi();

      // Try to get company nomenclature to verify connection
      const response = await api.nomenclature('companies', '');

      if (response && response.data && Array.isArray(response.data) && response.data.length > 0) {
        return {
          success: true,
          message: 'Conexiunea la Oblio a fost realizată cu succes',
          companyName: response.data[0].companyName || response.data[0].name,
        };
      }

      return {
        success: true,
        message: 'Conexiunea la Oblio a fost realizată cu succes',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Eroare la conectarea la Oblio';
      return {
        success: false,
        message,
      };
    }
  }

  /**
   * Create an invoice in Oblio.
   */
  async createInvoice(data: OblioInvoiceData): Promise<OblioInvoiceResult> {
    const api = await this.initApi();

    const response = await api.createDoc('invoice', data);

    if (!response || !response.data) {
      throw new Error('Failed to create invoice in Oblio');
    }

    return {
      seriesName: response.data.seriesName || data.seriesName,
      number: response.data.number,
      link: response.data.link,
      eFacturaLink: response.data.eFacturaLink,
      data: response.data,
    };
  }

  // ==========================================================================
  // Proforma Methods (for testing without creating real invoices)
  // ==========================================================================

  /**
   * Create a proforma in Oblio.
   * Proformas are like draft invoices - they can be deleted and don't go to e-Factura.
   */
  async createProforma(data: OblioInvoiceData): Promise<OblioProformaResult> {
    const api = await this.initApi();

    const response = await api.createDoc('proforma', data);

    if (!response || !response.data) {
      throw new Error('Failed to create proforma in Oblio');
    }

    return {
      seriesName: response.data.seriesName || data.seriesName,
      number: response.data.number,
      link: response.data.link,
      data: response.data,
    };
  }

  /**
   * Get proforma details from Oblio.
   */
  async getProforma(series: string, number: number): Promise<Record<string, unknown> | null> {
    const api = await this.initApi();

    const response = await api.get('proforma', series, number);

    if (!response || !response.data) {
      return null;
    }

    return response.data;
  }

  /**
   * Delete a proforma in Oblio.
   */
  async deleteProforma(series: string, number: number): Promise<void> {
    const api = await this.initApi();

    await api.delete('proforma', series, number);
  }

  /**
   * Cancel a proforma in Oblio.
   */
  async cancelProforma(series: string, number: number): Promise<void> {
    const api = await this.initApi();

    await api.cancel('proforma', series, number);
  }

  /**
   * Convert a proforma to an invoice in Oblio.
   * This creates a new invoice based on the proforma data.
   */
  async convertProformaToInvoice(
    proformaSeries: string,
    proformaNumber: number,
    invoiceSeriesName?: string
  ): Promise<OblioInvoiceResult> {
    const api = await this.initApi();

    // Get the proforma data
    const proforma = await this.getProforma(proformaSeries, proformaNumber);
    if (!proforma) {
      throw new Error('Proforma not found');
    }

    // Create invoice with reference to proforma
    // The proforma contains all the invoice data, we just need to add the reference
    const invoiceData = {
      cif: proforma.cif as string,
      client: proforma.client as OblioClientData,
      issueDate: proforma.issueDate as string,
      dueDate: proforma.dueDate as string,
      seriesName: (invoiceSeriesName || proforma.seriesName) as string,
      products: proforma.products as OblioProductData[],
      mentions: proforma.mentions as string | undefined,
      currency: proforma.currency as string | undefined,
      language: proforma.language as string | undefined,
      workStation: proforma.workStation as string | undefined,
      referenceDocument: {
        type: 'proforma',
        seriesName: proformaSeries,
        number: proformaNumber,
      },
    };

    const response = await api.createDoc('invoice', invoiceData);

    if (!response || !response.data) {
      throw new Error('Failed to convert proforma to invoice');
    }

    return {
      seriesName: response.data.seriesName,
      number: response.data.number,
      link: response.data.link,
      eFacturaLink: response.data.eFacturaLink,
      data: response.data,
    };
  }

  /**
   * Download PDF for a proforma.
   */
  async downloadProformaPdf(series: string, number: number): Promise<Buffer> {
    const api = await this.initApi();

    const response = await api.get('proforma', series, number);

    if (!response || !response.data || !response.data.link) {
      throw new Error('Proforma PDF link not found');
    }

    const pdfResponse = await fetch(response.data.link);
    if (!pdfResponse.ok) {
      throw new Error('Failed to download proforma PDF');
    }

    const arrayBuffer = await pdfResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Cancel (storno) an invoice in Oblio.
   */
  async cancelInvoice(series: string, number: number): Promise<void> {
    const api = await this.initApi();

    await api.cancel('invoice', series, number);
  }

  /**
   * Delete an invoice in Oblio.
   * Only works for draft invoices that haven't been sent to clients.
   */
  async deleteInvoice(series: string, number: number): Promise<void> {
    const api = await this.initApi();

    await api.delete('invoice', series, number);
  }

  /**
   * Get exchange rate from BNR via Oblio.
   */
  async getExchangeRate(currency: string = 'EUR'): Promise<OblioExchangeRate> {
    const api = await this.initApi();

    const response = await api.nomenclature('exchange', '', {
      currency,
    });

    if (!response || !response.data) {
      throw new Error('Failed to get exchange rate from Oblio');
    }

    return {
      rate: parseFloat(response.data.exchange || response.data.rate),
      date: response.data.date || new Date().toISOString().split('T')[0],
    };
  }

  /**
   * Get available series for invoices.
   */
  async getSeries(): Promise<Array<{ name: string; nextNumber: number }>> {
    const api = await this.initApi();

    const response = await api.nomenclature('series', '', {
      docType: 'invoice',
    });

    if (!response || !response.data) {
      return [];
    }

    return response.data.map((series: { name: string; next?: number }) => ({
      name: series.name,
      nextNumber: series.next || 1,
    }));
  }

  /**
   * Get VAT rates from Oblio nomenclature.
   */
  async getVatRates(): Promise<Array<{ name: string; percentage: number }>> {
    const api = await this.initApi();

    const response = await api.nomenclature('vat_rates', '');

    if (!response || !response.data) {
      return [{ name: 'Normala', percentage: 19 }];
    }

    return response.data.map((rate: { name: string; percentage: number }) => ({
      name: rate.name,
      percentage: rate.percentage,
    }));
  }

  /**
   * Get or create client in Oblio.
   */
  async getOrCreateClient(clientData: OblioClientData): Promise<OblioClientData> {
    const api = await this.initApi();

    // Try to find existing client by CIF
    const searchResponse = await api.nomenclature('clients', clientData.cif);

    if (searchResponse && searchResponse.data && searchResponse.data.length > 0) {
      return searchResponse.data[0];
    }

    // Client doesn't exist, create new one
    await api.createDoc('client', clientData);

    return clientData;
  }

  /**
   * Download PDF for an invoice.
   * Returns the PDF as a Buffer.
   */
  async downloadPdf(series: string, number: number): Promise<Buffer> {
    const api = await this.initApi();

    const response = await api.get('invoice', series, number);

    if (!response || !response.data || !response.data.link) {
      throw new Error('Invoice PDF link not found');
    }

    // Fetch the PDF from the link
    const pdfResponse = await fetch(response.data.link);
    if (!pdfResponse.ok) {
      throw new Error('Failed to download PDF');
    }

    const arrayBuffer = await pdfResponse.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  /**
   * Submit invoice to e-Factura (ANAF).
   * Note: e-Factura submission is handled automatically by Oblio when
   * the invoice is created with the appropriate settings. This method
   * checks the status of a previously submitted invoice.
   */
  async submitToEFactura(
    series: string,
    number: number
  ): Promise<{ success: boolean; eFacturaId?: string; error?: string }> {
    try {
      const api = await this.initApi();

      // Get invoice to check e-Factura status
      const response = await api.get('invoice', series, number);

      if (!response || !response.data) {
        throw new Error('No response from Oblio');
      }

      // Check if e-Factura was submitted
      if (response.data.eFactura?.indexIncarcare) {
        return {
          success: true,
          eFacturaId: response.data.eFactura.indexIncarcare,
        };
      }

      return {
        success: false,
        error: 'Factura nu a fost trimisă la e-Factura. Verificați configurația în Oblio.',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get e-Factura status for an invoice.
   */
  async getEFacturaStatus(
    series: string,
    number: number
  ): Promise<{ status: string; message?: string }> {
    try {
      const api = await this.initApi();

      const response = await api.get('invoice', series, number);

      if (!response || !response.data || !response.data.eFactura) {
        return { status: 'unknown' };
      }

      return {
        status: response.data.eFactura.status || 'unknown',
        message: response.data.eFactura.message,
      };
    } catch {
      return { status: 'unknown' };
    }
  }

  /**
   * Collect (mark as paid) an invoice in Oblio.
   */
  async collectInvoice(
    series: string,
    number: number,
    paidAt: Date = new Date(),
    paymentType: string = 'Ordin de plata'
  ): Promise<void> {
    const api = await this.initApi();

    await api.collect(series, number, {
      type: paymentType,
      documentDate: paidAt.toISOString().split('T')[0],
    });
  }

  /**
   * Get invoice details from Oblio.
   */
  async getInvoice(series: string, number: number): Promise<Record<string, unknown> | null> {
    const api = await this.initApi();

    const response = await api.get('invoice', series, number);

    if (!response || !response.data) {
      return null;
    }

    return response.data;
  }
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Convert a Decimal to number for API use.
 */
export function decimalToNumber(value: Decimal | null | undefined): number {
  if (value == null) return 0;
  return parseFloat(value.toString());
}

/**
 * Format a date for Oblio API (YYYY-MM-DD).
 */
export function formatOblioDate(date: Date): string {
  return date.toISOString().split('T')[0];
}
