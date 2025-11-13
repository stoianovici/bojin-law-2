/**
 * Document Factory Tests
 */

import {
  createDocument,
  createContract,
  createMotion,
  createLetter,
  createMemo,
  createPleading,
  createAIDocument,
  createDocuments,
} from './document.factory';

describe('Document Factory', () => {
  describe('createDocument', () => {
    it('should create a valid Document entity', () => {
      const document = createDocument();

      expect(document).toMatchObject({
        id: expect.any(String),
        caseId: expect.any(String),
        title: expect.any(String),
        type: expect.stringMatching(/^(Contract|Motion|Letter|Memo|Pleading|Other)$/),
        currentVersion: expect.any(Number),
        status: expect.stringMatching(/^(Draft|Review|Approved|Filed)$/),
        blobStorageUrl: expect.any(String),
        aiGenerated: expect.any(Boolean),
        createdBy: expect.any(String),
        createdAt: expect.any(Date),
        updatedAt: expect.any(Date),
      });
    });

    it('should generate valid Azure Blob Storage URLs', () => {
      const document = createDocument();
      expect(document.blobStorageUrl).toMatch(
        /^https:\/\/[a-z0-9]+\.blob\.core\.windows\.net\/documents\/.+\..+$/
      );
    });

    it('should set currentVersion to positive number', () => {
      const document = createDocument();
      expect(document.currentVersion).toBeGreaterThan(0);
    });

    it('should accept overrides', () => {
      const customTitle = 'Custom Document Title';
      const document = createDocument({
        title: customTitle,
        type: 'Contract',
        aiGenerated: true,
      });

      expect(document.title).toBe(customTitle);
      expect(document.type).toBe('Contract');
      expect(document.aiGenerated).toBe(true);
    });

    it('should generate titles appropriate for document type', () => {
      const contract = createDocument({ type: 'Contract' });
      const motion = createDocument({ type: 'Motion' });

      expect(contract.title).toBeTruthy();
      expect(motion.title).toBeTruthy();
    });

    it('should include Romanian document titles', () => {
      // Run multiple times to increase chance of getting Romanian titles
      const documents = Array.from({ length: 50 }, () => createDocument());
      const hasRomanianTitle = documents.some((d) => /[ăâîșț]/i.test(d.title));

      expect(hasRomanianTitle).toBe(true);
    });
  });

  describe('createContract', () => {
    it('should create a Document with Contract type', () => {
      const contract = createContract();
      expect(contract.type).toBe('Contract');
    });

    it('should accept overrides while maintaining Contract type', () => {
      const contract = createContract({ title: 'Employment Contract' });
      expect(contract.type).toBe('Contract');
      expect(contract.title).toBe('Employment Contract');
    });
  });

  describe('createMotion', () => {
    it('should create a Document with Motion type', () => {
      const motion = createMotion();
      expect(motion.type).toBe('Motion');
    });

    it('should accept overrides while maintaining Motion type', () => {
      const motion = createMotion({ title: 'Motion to Dismiss' });
      expect(motion.type).toBe('Motion');
      expect(motion.title).toBe('Motion to Dismiss');
    });
  });

  describe('createLetter', () => {
    it('should create a Document with Letter type', () => {
      const letter = createLetter();
      expect(letter.type).toBe('Letter');
    });

    it('should accept overrides while maintaining Letter type', () => {
      const letter = createLetter({ title: 'Demand Letter' });
      expect(letter.type).toBe('Letter');
      expect(letter.title).toBe('Demand Letter');
    });
  });

  describe('createMemo', () => {
    it('should create a Document with Memo type', () => {
      const memo = createMemo();
      expect(memo.type).toBe('Memo');
    });

    it('should accept overrides while maintaining Memo type', () => {
      const memo = createMemo({ title: 'Legal Memorandum' });
      expect(memo.type).toBe('Memo');
      expect(memo.title).toBe('Legal Memorandum');
    });
  });

  describe('createPleading', () => {
    it('should create a Document with Pleading type', () => {
      const pleading = createPleading();
      expect(pleading.type).toBe('Pleading');
    });

    it('should accept overrides while maintaining Pleading type', () => {
      const pleading = createPleading({ title: 'Complaint' });
      expect(pleading.type).toBe('Pleading');
      expect(pleading.title).toBe('Complaint');
    });
  });

  describe('createAIDocument', () => {
    it('should create a Document with aiGenerated=true', () => {
      const aiDocument = createAIDocument();
      expect(aiDocument.aiGenerated).toBe(true);
    });

    it('should accept overrides while maintaining aiGenerated=true', () => {
      const aiDocument = createAIDocument({ type: 'Contract' });
      expect(aiDocument.aiGenerated).toBe(true);
      expect(aiDocument.type).toBe('Contract');
    });
  });

  describe('createDocuments', () => {
    it('should create specified number of documents', () => {
      const documents = createDocuments(5);
      expect(documents).toHaveLength(5);
    });

    it('should create documents with different IDs', () => {
      const documents = createDocuments(10);
      const ids = documents.map((d) => d.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);
    });

    it('should apply overrides to all documents', () => {
      const documents = createDocuments(3, { type: 'Contract' });
      documents.forEach((document) => {
        expect(document.type).toBe('Contract');
      });
    });
  });
});
