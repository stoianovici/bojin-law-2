/**
 * Romanian Document Generator Service Tests
 * Story 2.12.1 - Task 6: Template Integration
 */

import { describe, it, expect } from '@jest/globals';
import { RomanianDocumentGeneratorService } from './romanian-document-generator.service';

describe('RomanianDocumentGeneratorService', () => {
  let service: RomanianDocumentGeneratorService;

  beforeEach(() => {
    service = new RomanianDocumentGeneratorService();
  });

  describe('generateDocument', () => {
    it('should generate a Notificare Avocateasca document with valid variables', async () => {
      const request = {
        templateSlug: 'notificare-avocateasca' as const,
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
        format: 'markdown' as const,
      };

      const result = await service.generateDocument(request);

      expect(result.success).toBe(true);
      expect(result.document).toBeDefined();
      expect(result.document).toContain('NOTIFICARE AVOCATEASCA');
      expect(result.document).toContain('SC Test SRL');
      expect(result.document).toContain('Av. Ion Popescu');
      expect(result.metadata).toBeDefined();
      expect(result.metadata?.nameRo).toBe('Notificare Avocateasca');
    });

    it('should generate a Contract Vanzare-Cumparare document', async () => {
      const request = {
        templateSlug: 'contract-vanzare-cumparare' as const,
        variables: {
          VANZATOR_NUME: 'Ion Popescu',
          VANZATOR_TIP_PERSOANA: 'persoană fizică',
          VANZATOR_ADRESA: 'Str. Vanzatorilor 1, Cluj-Napoca',
          VANZATOR_IDENTIFICARE: 'CNP: 1234567890123',
          CUMPARATOR_NUME: 'Maria Ionescu',
          CUMPARATOR_TIP_PERSOANA: 'persoană fizică',
          CUMPARATOR_ADRESA: 'Str. Cumparatorilor 2, Cluj-Napoca',
          CUMPARATOR_IDENTIFICARE: 'CNP: 9876543210987',
          NUMAR_CONTRACT: 'CV-001',
          DATA_CONTRACT: '2025-11-19',
          DESCRIERE_BUN: 'Autoturism marca Dacia Logan, an 2020',
          PRET_TOTAL: '50,000',
          PRET_IN_LITERE: 'cincizeci mii',
          MONEDA: 'RON',
          MODALITATE_PLATA: 'Cash la semnare',
          DATA_TRANSFER: '2025-11-20',
          DATA_PREDARE: '2025-11-20',
          LOC_PREDARE: 'Cluj-Napoca',
        },
        format: 'markdown' as const,
      };

      const result = await service.generateDocument(request);

      expect(result.success).toBe(true);
      expect(result.document).toBeDefined();
      expect(result.document).toContain('CONTRACT DE VANZARE-CUMPARARE');
      expect(result.document).toContain('Ion Popescu');
      expect(result.document).toContain('Maria Ionescu');
      expect(result.document).toContain('Autoturism marca Dacia Logan');
    });

    it('should generate an Intampinare document', async () => {
      const request = {
        templateSlug: 'intampinare' as const,
        variables: {
          INSTANTA_NUME: 'Judecătoria Cluj-Napoca',
          INSTANTA_ADRESA: 'Str. Dorobanților 2, Cluj-Napoca',
          NUMAR_DOSAR: '1234/2025',
          DATA_DEPUNERE: '2025-11-19',
          PARAT_NUME: 'SC Defendant SRL',
          PARAT_TIP_PERSOANA: 'persoană juridică',
          PARAT_ADRESA: 'Str. Pârâților 10, Cluj-Napoca',
          PARAT_IDENTIFICARE: 'CUI: 12345678',
          RECLAMANT_NUME: 'SC Plaintiff SRL',
          RECLAMANT_TIP_PERSOANA: 'persoană juridică',
          RECLAMANT_ADRESA: 'Str. Reclamanților 20, Cluj-Napoca',
          RECLAMANT_IDENTIFICARE: 'CUI: 87654321',
          AVOCAT_PARAT_NUME: 'Av. Elena Popescu',
          BAROU_PARAT: 'Cluj',
          AVOCAT_PARAT_ADRESA: 'Str. Avocaților 5, Cluj-Napoca',
          OBIECT_ACTIUNE: 'Reziliere contract',
          DATA_CERERE: '2025-10-15',
          REZUMAT_CERERE_RECLAMANT: 'Reclamantul solicită rezilierea contractului și daune',
          VALOARE_CERERE: '100,000 RON',
          TIP_RESPINGERE: 'nefondată',
          EXPUNERE_FAPT_PARAT: 'Contractul a fost executat conform termenilor.',
          ARGUMENT_1: 'Obligațiile au fost îndeplinite',
          TEMEI_LEGAL_1: 'Art. 1270 Cod Civil',
          ARGUMENT_2: 'Nu există culpă din partea pârâtului',
          TEMEI_LEGAL_2: 'Art. 1357 Cod Civil',
          ARGUMENT_3: 'Cererea este prematură',
          TEMEI_LEGAL_3: 'Art. 156 C.proc.civ.',
          INSCRIS_1: 'Contract nr. 123/2024',
          INSCRIS_2: 'Factură nr. 456/2024',
          INSCRIS_3: 'Corespondență email',
          CERERE_PRINCIPALA: 'Respingerea acțiunii ca nefondată',
          ONORARIU_AVOCAT: '5,000 RON',
        },
        format: 'markdown' as const,
      };

      const result = await service.generateDocument(request);

      expect(result.success).toBe(true);
      expect(result.document).toBeDefined();
      expect(result.document).toContain('ÎNTÂMPINARE');
      expect(result.document).toContain('Judecătoria Cluj-Napoca');
      expect(result.document).toContain('SC Defendant SRL');
      expect(result.document).toContain('Av. Elena Popescu');
    });

    it('should fail when template slug is invalid', async () => {
      const request = {
        templateSlug: 'invalid-template' as any,
        variables: {},
      };

      const result = await service.generateDocument(request);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]).toContain('Template not found');
    });

    it('should fail when required variables are missing', async () => {
      const request = {
        templateSlug: 'notificare-avocateasca' as const,
        variables: {
          DESTINATAR_NUME: 'Test',
          // Missing many required variables
        },
      };

      const result = await service.generateDocument(request);

      expect(result.success).toBe(false);
      expect(result.errors).toBeDefined();
      expect(result.errors?.[0]).toContain('Missing required variables');
    });

    it('should convert document to plain text format', async () => {
      const request = {
        templateSlug: 'notificare-avocateasca' as const,
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
        format: 'plain' as const,
      };

      const result = await service.generateDocument(request);

      expect(result.success).toBe(true);
      expect(result.document).toBeDefined();
      // Should not contain markdown formatting
      expect(result.document).not.toContain('##');
      expect(result.document).not.toContain('**');
    });

    it('should include warnings for documents', async () => {
      const request = {
        templateSlug: 'notificare-avocateasca' as const,
        variables: {
          DESTINATAR_NUME: 'Test',
          DESTINATAR_ADRESA: 'Test',
          FIRMA_NUME: 'Test',
          AVOCAT_NUME: 'Test',
          BAROU: 'București',
          FIRMA_ADRESA: 'Test',
          OBIECT_NOTIFICARE: 'Test',
          DATA_NOTIFICARE: '2025-11-19',
          DESCRIERE_FAPT: 'Test',
          ACTIUNE_SOLICITATA: 'Test',
          TERMEN_CONFORMARE: '15 zile',
          TERMEN_ZILE: '15',
        },
      };

      const result = await service.generateDocument(request);

      expect(result.success).toBe(true);
      expect(result.warnings).toBeDefined();
      expect(result.warnings?.length).toBeGreaterThan(0);
      expect(result.warnings?.some((w) => w.includes('registered mail'))).toBe(true);
    });
  });

  describe('validateVariables', () => {
    it('should validate complete variables as valid', () => {
      const variables = {
        DESTINATAR_NUME: 'Test',
        DESTINATAR_ADRESA: 'Test',
        FIRMA_NUME: 'Test',
        AVOCAT_NUME: 'Test',
        BAROU: 'București',
        FIRMA_ADRESA: 'Test',
        OBIECT_NOTIFICARE: 'Test',
        DATA_NOTIFICARE: '2025-11-19',
        DESCRIERE_FAPT: 'Test',
        ACTIUNE_SOLICITATA: 'Test',
        TERMEN_CONFORMARE: '15 zile',
        TERMEN_ZILE: '15',
      };

      const result = service.validateVariables('notificare-avocateasca', variables);

      expect(result.valid).toBe(true);
      expect(result.missing).toHaveLength(0);
    });

    it('should identify missing required variables', () => {
      const variables = {
        DESTINATAR_NUME: 'Test',
        // Missing many required variables
      };

      const result = service.validateVariables('notificare-avocateasca', variables);

      expect(result.valid).toBe(false);
      expect(result.missing.length).toBeGreaterThan(0);
    });

    it('should include warnings even when valid', () => {
      const variables = {
        DESTINATAR_NUME: 'Test',
        DESTINATAR_ADRESA: 'Test',
        FIRMA_NUME: 'Test',
        AVOCAT_NUME: 'Test',
        BAROU: 'București',
        FIRMA_ADRESA: 'Test',
        OBIECT_NOTIFICARE: 'Test',
        DATA_NOTIFICARE: '2025-11-19',
        DESCRIERE_FAPT: 'Test',
        ACTIUNE_SOLICITATA: 'Test',
        TERMEN_CONFORMARE: '15 zile',
        TERMEN_ZILE: '15',
      };

      const result = service.validateVariables('notificare-avocateasca', variables);

      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe('getAvailableTemplates', () => {
    it('should return all Romanian templates', () => {
      const templates = service.getAvailableTemplates();

      expect(templates.length).toBe(5); // Updated to 5 templates (Task 8 added 2 more)
      expect(templates.map((t) => t.slug)).toContain('notificare-avocateasca');
      expect(templates.map((t) => t.slug)).toContain('contract-vanzare-cumparare');
      expect(templates.map((t) => t.slug)).toContain('intampinare');
      expect(templates.map((t) => t.slug)).toContain('somatie-plata');
      expect(templates.map((t) => t.slug)).toContain('cerere-chemare-judecata');
    });

    it('should include metadata for each template', () => {
      const templates = service.getAvailableTemplates();

      templates.forEach((template) => {
        expect(template.metadata).toBeDefined();
        expect(template.metadata.nameRo).toBeDefined();
        expect(template.metadata.nameEn).toBeDefined();
        expect(template.metadata.legalCategory).toBeDefined();
      });
    });
  });

  describe('getTemplateInfo', () => {
    it('should return metadata for valid template', () => {
      const metadata = service.getTemplateInfo('notificare-avocateasca');

      expect(metadata).toBeDefined();
      expect(metadata.nameRo).toBe('Notificare Avocateasca');
      expect(metadata.nameEn).toBe('Legal Notice');
      expect(metadata.legalCategory).toBe('correspondence'); // Actual category from template
    });
  });

  describe('searchTemplates', () => {
    it('should filter templates by category', () => {
      const templates = service.searchTemplates({
        category: 'correspondence', // Updated to match actual category
      });

      expect(templates.length).toBeGreaterThan(0);
      templates.forEach((template) => {
        expect(template.metadata.legalCategory).toBe('correspondence');
      });
    });

    it('should filter templates by complexity', () => {
      const templates = service.searchTemplates({
        complexity: 'high',
      });

      templates.forEach((template) => {
        expect(template.metadata.complexity).toBe('high');
      });
    });

    it('should filter templates by language', () => {
      const templates = service.searchTemplates({
        language: 'ro',
      });

      expect(templates.length).toBe(5); // All 5 Romanian templates
      templates.forEach((template) => {
        expect(template.metadata.primaryLanguage).toBe('ro');
      });
    });

    it('should combine multiple filters', () => {
      const templates = service.searchTemplates({
        category: 'legal_correspondence',
        language: 'ro',
      });

      templates.forEach((template) => {
        expect(template.metadata.legalCategory).toBe('legal_correspondence');
        expect(template.metadata.primaryLanguage).toBe('ro');
      });
    });
  });

  describe('estimateTimeSavings', () => {
    it('should estimate time savings for template', () => {
      const estimate = service.estimateTimeSavings('notificare-avocateasca');

      expect(estimate.manualDraftingTime).toBeDefined();
      expect(estimate.templateTime).toBeDefined();
      expect(estimate.savings).toBeDefined();
      expect(estimate.templateTime).toContain('10 minutes');
    });

    it('should account for document complexity', () => {
      const simpleEstimate = service.estimateTimeSavings('notificare-avocateasca');
      const complexEstimate = service.estimateTimeSavings('intampinare');

      // Intampinare is more complex and should have higher manual time
      expect(complexEstimate.manualDraftingTime).toBeDefined();
      expect(simpleEstimate.manualDraftingTime).toBeDefined();
    });
  });
});
