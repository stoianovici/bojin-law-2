/**
 * Tests for Legal Assistant System Prompt
 * OPS-083: Verify context injection and prompt building
 */

import {
  LEGAL_ASSISTANT_SYSTEM_PROMPT,
  buildSystemPrompt,
  getCurrentDateDisplay,
  getCurrentDateISO,
  SystemPromptContext,
} from './ai-system-prompt';

describe('ai-system-prompt', () => {
  describe('LEGAL_ASSISTANT_SYSTEM_PROMPT', () => {
    it('should contain Romanian language instructions', () => {
      expect(LEGAL_ASSISTANT_SYSTEM_PROMPT).toContain('Ești un asistent AI');
      expect(LEGAL_ASSISTANT_SYSTEM_PROMPT).toContain('firmă de avocatură din România');
    });

    it('should have placeholders for context injection', () => {
      expect(LEGAL_ASSISTANT_SYSTEM_PROMPT).toContain('{currentDate}');
      expect(LEGAL_ASSISTANT_SYSTEM_PROMPT).toContain('{userName}');
      expect(LEGAL_ASSISTANT_SYSTEM_PROMPT).toContain('{userRole}');
      expect(LEGAL_ASSISTANT_SYSTEM_PROMPT).toContain('{caseContext}');
    });

    it('should document Romanian date expressions', () => {
      expect(LEGAL_ASSISTANT_SYSTEM_PROMPT).toContain('"azi", "astăzi"');
      expect(LEGAL_ASSISTANT_SYSTEM_PROMPT).toContain('"mâine"');
      expect(LEGAL_ASSISTANT_SYSTEM_PROMPT).toContain('"poimâine"');
      expect(LEGAL_ASSISTANT_SYSTEM_PROMPT).toContain('"vinerea viitoare"');
      expect(LEGAL_ASSISTANT_SYSTEM_PROMPT).toContain('"săptămâna viitoare"');
      expect(LEGAL_ASSISTANT_SYSTEM_PROMPT).toContain('"luna viitoare"');
    });

    it('should document complex sentence parsing', () => {
      expect(LEGAL_ASSISTANT_SYSTEM_PROMPT).toContain(
        'adaugă un task de finalizat până vinerea viitoare'
      );
      expect(LEGAL_ASSISTANT_SYSTEM_PROMPT).toContain('create_task');
      expect(LEGAL_ASSISTANT_SYSTEM_PROMPT).toContain('Separatorii comuni');
    });

    it('should include confirmation flow guidance', () => {
      expect(LEGAL_ASSISTANT_SYSTEM_PROMPT).toContain('Confirmări');
      expect(LEGAL_ASSISTANT_SYSTEM_PROMPT).toContain('Așteaptă confirmarea utilizatorului');
    });

    it('should document error handling', () => {
      expect(LEGAL_ASSISTANT_SYSTEM_PROMPT).toContain('Erori și Clarificări');
      expect(LEGAL_ASSISTANT_SYSTEM_PROMPT).toContain('Explică clar ce lipsește');
    });

    it('should establish limits', () => {
      expect(LEGAL_ASSISTANT_SYSTEM_PROMPT).toContain('Limite');
      expect(LEGAL_ASSISTANT_SYSTEM_PROMPT).toContain('Nu inventez informații');
      expect(LEGAL_ASSISTANT_SYSTEM_PROMPT).toContain('Nu execut acțiuni fără confirmare');
    });
  });

  describe('buildSystemPrompt', () => {
    const baseContext: SystemPromptContext = {
      currentDate: '2025-12-21',
      userName: 'Avocat Test',
      userRole: 'Partner',
    };

    it('should replace all placeholders', () => {
      const result = buildSystemPrompt(baseContext);

      expect(result).not.toContain('{currentDate}');
      expect(result).not.toContain('{userName}');
      expect(result).not.toContain('{userRole}');
      expect(result).not.toContain('{caseContext}');
    });

    it('should inject current date in multiple locations', () => {
      const result = buildSystemPrompt(baseContext);

      // Should appear in "Data de azi:" line
      expect(result).toContain('Data de azi: 2025-12-21');
      // Should appear in date interpretation section
      expect(result).toContain('relativ la data de azi (2025-12-21)');
    });

    it('should inject user name and role', () => {
      const result = buildSystemPrompt(baseContext);

      expect(result).toContain('Utilizator: Avocat Test (Partner)');
    });

    it('should handle context without case', () => {
      const result = buildSystemPrompt(baseContext);

      // caseContext should be replaced with empty string
      expect(result).not.toContain('Dosar curent:');
    });

    it('should inject case context when provided', () => {
      const contextWithCase: SystemPromptContext = {
        ...baseContext,
        caseId: 'case-123',
        caseName: 'Ionescu vs. Popescu',
      };

      const result = buildSystemPrompt(contextWithCase);

      expect(result).toContain('Dosar curent: Ionescu vs. Popescu (ID: case-123)');
    });

    it('should require both caseId and caseName for case context', () => {
      const contextWithOnlyId: SystemPromptContext = {
        ...baseContext,
        caseId: 'case-123',
        // caseName not provided
      };

      const result = buildSystemPrompt(contextWithOnlyId);

      expect(result).not.toContain('Dosar curent:');
    });
  });

  describe('getCurrentDateISO', () => {
    it('should return date in ISO format', () => {
      const result = getCurrentDateISO();

      // Should match YYYY-MM-DD format
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });
  });

  describe('getCurrentDateDisplay', () => {
    it('should return date in Romanian locale format', () => {
      const result = getCurrentDateDisplay();

      // Should contain Romanian month name
      const romanianMonths = [
        'ianuarie',
        'februarie',
        'martie',
        'aprilie',
        'mai',
        'iunie',
        'iulie',
        'august',
        'septembrie',
        'octombrie',
        'noiembrie',
        'decembrie',
      ];

      const hasRomanianMonth = romanianMonths.some((month) => result.toLowerCase().includes(month));

      expect(hasRomanianMonth).toBe(true);
    });

    it('should include year', () => {
      const result = getCurrentDateDisplay();
      const currentYear = new Date().getFullYear().toString();

      expect(result).toContain(currentYear);
    });
  });
});
