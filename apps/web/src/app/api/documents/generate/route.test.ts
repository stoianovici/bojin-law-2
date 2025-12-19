/**
 * Document Generation API Endpoint Tests
 * Story 2.12.1 - Task 6: Template Integration
 * @jest-environment node
 */

import { describe, it, expect, jest } from '@jest/globals';

// Mock the romanian document generator service
const mockGenerateDocument = jest.fn<any, any>();
const mockGetAvailableTemplates = jest.fn<any, any>().mockReturnValue([
  { slug: 'notificare-avocateasca', nameRo: 'Notificare Avocateasca' },
  { slug: 'contract-vanzare-cumparare', nameRo: 'Contract Vanzare-Cumparare' },
  { slug: 'intampinare', nameRo: 'Intampinare' },
  { slug: 'cerere-chemare-judecata', nameRo: 'Cerere Chemare Judecata' },
  { slug: 'plangere-contraventionala', nameRo: 'Plangere Contraventionala' },
]);

jest.mock('@/lib/services/romanian-document-generator.service', () => ({
  romanianDocumentGenerator: {
    get generateDocument() {
      return mockGenerateDocument;
    },
    get getAvailableTemplates() {
      return mockGetAvailableTemplates;
    },
  },
}));

import { POST, GET } from './route';
import { NextRequest } from 'next/server';
import { romanianDocumentGenerator } from '@/lib/services/romanian-document-generator.service';

describe('/api/documents/generate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST', () => {
    it('should generate document with valid request', async () => {
      const requestBody = {
        templateSlug: 'notificare-avocateasca',
        variables: {
          DESTINATAR_NUME: 'SC Test SRL',
          DESTINATAR_ADRESA: 'Str. Test 123, București',
          FIRMA_NUME: 'Cabinet Avocat Popescu',
          AVOCAT_NUME: 'Av. Ion Popescu',
          BAROU: 'București',
          FIRMA_ADRESA: 'Str. Avocaților 45, București',
          OBIECT_NOTIFICARE: 'Recuperare creanță',
          DATA_NOTIFICARE: '2025-11-19',
          DESCRIERE_FAPT: 'Contractul nr. 123/2024 nu a fost onorat.',
          ACTIUNE_SOLICITATA: 'Plata sumei de 10,000 RON',
          TERMEN_CONFORMARE: '15 zile',
          TERMEN_ZILE: '15',
        },
        format: 'markdown',
      };

      mockGenerateDocument.mockResolvedValue({
        success: true,
        document: '# Notificare Avocateasca\n\nContent here...',
        metadata: { nameRo: 'Notificare Avocateasca' },
        warnings: [],
      });

      const request = new NextRequest('http://localhost:3000/api/documents/generate', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.document).toBeDefined();
      expect(data.metadata).toBeDefined();
      expect(data.warnings).toBeDefined();
    });

    it('should return 400 when template slug is missing', async () => {
      const requestBody = {
        variables: { test: 'value' },
      };

      const request = new NextRequest('http://localhost:3000/api/documents/generate', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Template slug is required');
    });

    it('should return 400 when variables are missing', async () => {
      const requestBody = {
        templateSlug: 'notificare-avocateasca',
      };

      const request = new NextRequest('http://localhost:3000/api/documents/generate', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Variables object is required');
    });

    it('should return 400 when required variables are missing', async () => {
      const requestBody = {
        templateSlug: 'notificare-avocateasca',
        variables: {
          DESTINATAR_NUME: 'Test',
          // Missing many required variables
        },
      };

      const request = new NextRequest('http://localhost:3000/api/documents/generate', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Document generation failed');
      expect(data.details).toBeDefined();
    });

    it('should support different output formats', async () => {
      const requestBody = {
        templateSlug: 'notificare-avocateasca',
        variables: {
          DESTINATAR_NUME: 'SC Test SRL',
          DESTINATAR_ADRESA: 'Str. Test 123',
          FIRMA_NUME: 'Cabinet Avocat',
          AVOCAT_NUME: 'Av. Test',
          BAROU: 'București',
          FIRMA_ADRESA: 'Str. Test',
          OBIECT_NOTIFICARE: 'Test',
          DATA_NOTIFICARE: '2025-11-19',
          DESCRIERE_FAPT: 'Test',
          ACTIUNE_SOLICITATA: 'Test',
          TERMEN_CONFORMARE: '15 zile',
          TERMEN_ZILE: '15',
        },
        format: 'plain',
      };

      (romanianDocumentGenerator.generateDocument as jest.MockedFunction<any>).mockResolvedValue({
        success: true,
        document: 'NOTIFICARE AVOCATEASCA\n\nContent here...',
        metadata: { nameRo: 'Notificare Avocateasca' },
        warnings: [],
      });

      const request = new NextRequest('http://localhost:3000/api/documents/generate', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.document).toBeDefined();
      // Plain format should not have markdown headers
      expect(data.document).not.toContain('##');
    });
  });

  describe('GET', () => {
    it('should return available templates and usage info', async () => {
      const request = new NextRequest('http://localhost:3000/api/documents/generate', {
        method: 'GET',
      });

      const response = await GET();
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.message).toBeDefined();
      expect(data.availableTemplates).toBeDefined();
      expect(Array.isArray(data.availableTemplates)).toBe(true);
      expect(data.availableTemplates.length).toBeGreaterThan(0);
    });
  });
});
