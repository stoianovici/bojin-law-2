/**
 * Document Generation API Endpoint Tests
 * Story 2.12.1 - Task 6: Template Integration
 */

import { describe, it, expect, jest } from '@jest/globals';
import { POST, GET } from './route';
import { NextRequest } from 'next/server';

describe('/api/documents/generate', () => {
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

      const request = new NextRequest('http://localhost:3000/api/documents/generate', {
        method: 'POST',
        body: JSON.stringify(requestBody),
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

      const request = new NextRequest('http://localhost:3000/api/documents/generate', {
        method: 'POST',
        body: JSON.stringify(requestBody),
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
      expect(data.availableTemplates.length).toBe(3);
    });
  });
});
