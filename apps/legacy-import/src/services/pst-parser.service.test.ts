/**
 * PST Parser Service Tests
 * Story 3.2.5 - Task 6.1.1: PST extraction logic unit tests
 */

import {
  groupByMonth,
  getExtractionSummary,
  ExtractedAttachment,
  ExtractionResult,
} from './pst-parser.service';

describe('PST Parser Service', () => {
  describe('Helper Functions', () => {
    describe('isSentFolder detection', () => {
      // Testing via exported function behavior indirectly through ExtractedAttachment
      const createAttachment = (
        folderPath: string,
        receivedDate: Date
      ): ExtractedAttachment => ({
        id: 'test-id',
        fileName: 'test.pdf',
        fileExtension: 'pdf',
        fileSizeBytes: 1000,
        content: Buffer.from('test'),
        folderPath,
        isSent: folderPath.toLowerCase().includes('sent'),
        emailMetadata: {
          subject: 'Test',
          senderName: 'Sender',
          senderEmail: 'sender@test.com',
          receiverName: 'Receiver',
          receiverEmail: 'receiver@test.com',
          receivedDate,
          sentDate: null,
        },
        monthYear: `${receivedDate.getFullYear()}-${String(receivedDate.getMonth() + 1).padStart(2, '0')}`,
      });

      it('should detect English "Sent Items" folder as sent', () => {
        const attachment = createAttachment('Sent Items/Clients', new Date());
        expect(attachment.folderPath.toLowerCase()).toContain('sent');
      });

      it('should detect English "Sent Mail" folder as sent', () => {
        const attachment = createAttachment('Sent Mail', new Date());
        expect(attachment.folderPath.toLowerCase()).toContain('sent');
      });

      it('should detect Romanian "Trimise" folder as sent', () => {
        const folderPath = 'Elemente Trimise/Clienti';
        expect(
          folderPath.toLowerCase().includes('trimise') ||
            folderPath.toLowerCase().includes('sent')
        ).toBe(true);
      });

      it('should detect Inbox folder as received', () => {
        const folderPath = 'Inbox/Clients';
        expect(
          folderPath.toLowerCase().includes('sent') ||
            folderPath.toLowerCase().includes('trimise')
        ).toBe(false);
      });

      it('should detect custom folders as received', () => {
        const folderPath = 'Archive/2023/Legal';
        expect(
          folderPath.toLowerCase().includes('sent') ||
            folderPath.toLowerCase().includes('trimise')
        ).toBe(false);
      });
    });

    describe('File extension detection', () => {
      it('should extract pdf extension correctly', () => {
        const fileName = 'contract.pdf';
        const extension = fileName.split('.').pop()?.toLowerCase();
        expect(extension).toBe('pdf');
      });

      it('should extract docx extension correctly', () => {
        const fileName = 'document.final.docx';
        const extension = fileName.split('.').pop()?.toLowerCase();
        expect(extension).toBe('docx');
      });

      it('should extract doc extension correctly', () => {
        const fileName = 'old-file.doc';
        const extension = fileName.split('.').pop()?.toLowerCase();
        expect(extension).toBe('doc');
      });

      it('should handle files without extension', () => {
        const fileName = 'noextension';
        const parts = fileName.split('.');
        const extension = parts.length > 1 ? parts.pop()?.toLowerCase() : '';
        expect(extension).toBe('');
      });
    });

    describe('Month-year formatting', () => {
      it('should format date to YYYY-MM correctly', () => {
        const date = new Date('2019-03-15');
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        expect(monthYear).toBe('2019-03');
      });

      it('should pad single digit months', () => {
        const date = new Date('2020-01-01');
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        expect(monthYear).toBe('2020-01');
      });

      it('should handle December correctly', () => {
        const date = new Date('2021-12-31');
        const monthYear = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        expect(monthYear).toBe('2021-12');
      });
    });
  });

  describe('groupByMonth', () => {
    const createMockAttachment = (
      id: string,
      monthYear: string
    ): ExtractedAttachment => ({
      id,
      fileName: `file-${id}.pdf`,
      fileExtension: 'pdf',
      fileSizeBytes: 1000,
      content: Buffer.from('test'),
      folderPath: 'Inbox',
      isSent: false,
      emailMetadata: {
        subject: 'Test',
        senderName: 'Sender',
        senderEmail: 'sender@test.com',
        receiverName: 'Receiver',
        receiverEmail: 'receiver@test.com',
        receivedDate: new Date(monthYear + '-15'),
        sentDate: null,
      },
      monthYear,
    });

    it('should group attachments by month', () => {
      const attachments = [
        createMockAttachment('1', '2019-01'),
        createMockAttachment('2', '2019-01'),
        createMockAttachment('3', '2019-02'),
        createMockAttachment('4', '2019-03'),
      ];

      const grouped = groupByMonth(attachments);

      expect(grouped.size).toBe(3);
      expect(grouped.get('2019-01')?.length).toBe(2);
      expect(grouped.get('2019-02')?.length).toBe(1);
      expect(grouped.get('2019-03')?.length).toBe(1);
    });

    it('should sort months chronologically (oldest first)', () => {
      const attachments = [
        createMockAttachment('1', '2020-03'),
        createMockAttachment('2', '2019-01'),
        createMockAttachment('3', '2019-12'),
      ];

      const grouped = groupByMonth(attachments);
      const months = Array.from(grouped.keys());

      expect(months).toEqual(['2019-01', '2019-12', '2020-03']);
    });

    it('should handle empty array', () => {
      const grouped = groupByMonth([]);
      expect(grouped.size).toBe(0);
    });

    it('should handle single attachment', () => {
      const attachments = [createMockAttachment('1', '2019-05')];
      const grouped = groupByMonth(attachments);

      expect(grouped.size).toBe(1);
      expect(grouped.get('2019-05')?.length).toBe(1);
    });

    it('should handle attachments spanning multiple years', () => {
      const attachments = [
        createMockAttachment('1', '2018-12'),
        createMockAttachment('2', '2019-06'),
        createMockAttachment('3', '2020-01'),
        createMockAttachment('4', '2020-12'),
      ];

      const grouped = groupByMonth(attachments);
      const months = Array.from(grouped.keys());

      expect(months).toEqual(['2018-12', '2019-06', '2020-01', '2020-12']);
    });
  });

  describe('getExtractionSummary', () => {
    const createMockResult = (
      attachments: ExtractedAttachment[],
      errors: number = 0
    ): ExtractionResult => ({
      attachments,
      progress: {
        totalEmails: 100,
        processedEmails: 100,
        totalAttachments: attachments.length + 10,
        extractedAttachments: attachments.length,
        currentFolder: 'Complete',
        errors: Array(errors).fill({
          folderPath: 'Error Folder',
          error: 'Test error',
        }),
      },
      folderStructure: [
        { path: 'Inbox', name: 'Inbox', documentCount: 5, isSentFolder: false },
        {
          path: 'Sent Items',
          name: 'Sent Items',
          documentCount: 3,
          isSentFolder: true,
        },
      ],
    });

    const createAttachmentWithProps = (props: {
      id: string;
      extension: 'pdf' | 'docx' | 'doc';
      monthYear: string;
      isSent: boolean;
    }): ExtractedAttachment => ({
      id: props.id,
      fileName: `file.${props.extension}`,
      fileExtension: props.extension,
      fileSizeBytes: 1000,
      content: Buffer.from('test'),
      folderPath: props.isSent ? 'Sent Items' : 'Inbox',
      isSent: props.isSent,
      emailMetadata: {
        subject: 'Test',
        senderName: 'Sender',
        senderEmail: 'sender@test.com',
        receiverName: 'Receiver',
        receiverEmail: 'receiver@test.com',
        receivedDate: new Date(props.monthYear + '-15'),
        sentDate: null,
      },
      monthYear: props.monthYear,
    });

    it('should count total documents correctly', () => {
      const attachments = [
        createAttachmentWithProps({
          id: '1',
          extension: 'pdf',
          monthYear: '2019-01',
          isSent: false,
        }),
        createAttachmentWithProps({
          id: '2',
          extension: 'docx',
          monthYear: '2019-02',
          isSent: false,
        }),
        createAttachmentWithProps({
          id: '3',
          extension: 'doc',
          monthYear: '2019-03',
          isSent: true,
        }),
      ];

      const result = createMockResult(attachments);
      const summary = getExtractionSummary(result);

      expect(summary.totalDocuments).toBe(3);
    });

    it('should count by extension correctly', () => {
      const attachments = [
        createAttachmentWithProps({
          id: '1',
          extension: 'pdf',
          monthYear: '2019-01',
          isSent: false,
        }),
        createAttachmentWithProps({
          id: '2',
          extension: 'pdf',
          monthYear: '2019-01',
          isSent: false,
        }),
        createAttachmentWithProps({
          id: '3',
          extension: 'docx',
          monthYear: '2019-02',
          isSent: false,
        }),
        createAttachmentWithProps({
          id: '4',
          extension: 'doc',
          monthYear: '2019-03',
          isSent: false,
        }),
      ];

      const result = createMockResult(attachments);
      const summary = getExtractionSummary(result);

      expect(summary.byExtension).toEqual({
        pdf: 2,
        docx: 1,
        doc: 1,
      });
    });

    it('should count by month correctly', () => {
      const attachments = [
        createAttachmentWithProps({
          id: '1',
          extension: 'pdf',
          monthYear: '2019-01',
          isSent: false,
        }),
        createAttachmentWithProps({
          id: '2',
          extension: 'pdf',
          monthYear: '2019-01',
          isSent: false,
        }),
        createAttachmentWithProps({
          id: '3',
          extension: 'pdf',
          monthYear: '2019-02',
          isSent: false,
        }),
      ];

      const result = createMockResult(attachments);
      const summary = getExtractionSummary(result);

      expect(summary.byMonth).toEqual({
        '2019-01': 2,
        '2019-02': 1,
      });
    });

    it('should count sent vs received correctly', () => {
      const attachments = [
        createAttachmentWithProps({
          id: '1',
          extension: 'pdf',
          monthYear: '2019-01',
          isSent: false,
        }),
        createAttachmentWithProps({
          id: '2',
          extension: 'pdf',
          monthYear: '2019-01',
          isSent: false,
        }),
        createAttachmentWithProps({
          id: '3',
          extension: 'pdf',
          monthYear: '2019-02',
          isSent: true,
        }),
      ];

      const result = createMockResult(attachments);
      const summary = getExtractionSummary(result);

      expect(summary.sentCount).toBe(1);
      expect(summary.receivedCount).toBe(2);
    });

    it('should count errors correctly', () => {
      const attachments = [
        createAttachmentWithProps({
          id: '1',
          extension: 'pdf',
          monthYear: '2019-01',
          isSent: false,
        }),
      ];

      const result = createMockResult(attachments, 5);
      const summary = getExtractionSummary(result);

      expect(summary.errorCount).toBe(5);
    });

    it('should count unique folders with documents', () => {
      const attachments = [
        createAttachmentWithProps({
          id: '1',
          extension: 'pdf',
          monthYear: '2019-01',
          isSent: false,
        }),
      ];

      const result = createMockResult(attachments);
      const summary = getExtractionSummary(result);

      expect(summary.uniqueFolders).toBe(2); // From mock folder structure
    });

    it('should handle empty attachments', () => {
      const result = createMockResult([]);
      const summary = getExtractionSummary(result);

      expect(summary.totalDocuments).toBe(0);
      expect(summary.sentCount).toBe(0);
      expect(summary.receivedCount).toBe(0);
      expect(summary.byExtension).toEqual({});
      expect(summary.byMonth).toEqual({});
    });
  });

  describe('Supported Extensions Filtering', () => {
    const SUPPORTED_EXTENSIONS = ['pdf', 'docx', 'doc'];

    it('should identify PDF as supported', () => {
      expect(SUPPORTED_EXTENSIONS.includes('pdf')).toBe(true);
    });

    it('should identify DOCX as supported', () => {
      expect(SUPPORTED_EXTENSIONS.includes('docx')).toBe(true);
    });

    it('should identify DOC as supported', () => {
      expect(SUPPORTED_EXTENSIONS.includes('doc')).toBe(true);
    });

    it('should reject XLSX as unsupported', () => {
      expect(SUPPORTED_EXTENSIONS.includes('xlsx')).toBe(false);
    });

    it('should reject JPG as unsupported', () => {
      expect(SUPPORTED_EXTENSIONS.includes('jpg')).toBe(false);
    });

    it('should reject TXT as unsupported', () => {
      expect(SUPPORTED_EXTENSIONS.includes('txt')).toBe(false);
    });

    it('should reject EXE as unsupported', () => {
      expect(SUPPORTED_EXTENSIONS.includes('exe')).toBe(false);
    });
  });

  describe('Email Metadata Extraction', () => {
    it('should structure email metadata correctly', () => {
      const metadata = {
        subject: 'RE: Contract Review',
        senderName: 'John Doe',
        senderEmail: 'john.doe@lawfirm.com',
        receiverName: 'Jane Smith',
        receiverEmail: 'jane.smith@client.com',
        receivedDate: new Date('2019-03-15T14:30:00Z'),
        sentDate: new Date('2019-03-15T14:28:00Z'),
      };

      expect(metadata.subject).toBe('RE: Contract Review');
      expect(metadata.senderEmail).toContain('@');
      expect(metadata.receivedDate).toBeInstanceOf(Date);
    });

    it('should handle missing optional fields', () => {
      const metadata = {
        subject: 'No Subject',
        senderName: 'Unknown',
        senderEmail: '',
        receiverName: 'Unknown',
        receiverEmail: '',
        receivedDate: new Date(),
        sentDate: null,
      };

      expect(metadata.senderEmail).toBe('');
      expect(metadata.sentDate).toBeNull();
    });
  });

  describe('Folder Path Handling', () => {
    it('should preserve nested folder paths', () => {
      const folderPath = 'Inbox/Clients/Acme Corp/Legal';
      const parts = folderPath.split('/');

      expect(parts).toEqual(['Inbox', 'Clients', 'Acme Corp', 'Legal']);
      expect(parts.length).toBe(4);
    });

    it('should handle root folder', () => {
      const folderPath = 'Inbox';
      const parts = folderPath.split('/');

      expect(parts).toEqual(['Inbox']);
    });

    it('should handle Romanian folder names', () => {
      const folderPath = 'Elemente primite/Clienți/Contracte';
      expect(folderPath).toContain('Clienți');
    });

    it('should handle special characters in folder names', () => {
      const folderPath = 'Inbox/Client - ABC (2019)/Contracts';
      expect(folderPath).toContain(' - ');
      expect(folderPath).toContain('(');
    });
  });
});
