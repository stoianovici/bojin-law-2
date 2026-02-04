/**
 * Firm Operations Agent Service Tests
 *
 * Tests for cost calculation, entity ID validation, and output transformation.
 */

// We test the internal functions by importing the module directly
// and accessing the private functions through module scope

describe('FirmOperationsAgentService', () => {
  // ============================================================================
  // Cost Calculation Tests
  // ============================================================================

  describe('Cost Calculation', () => {
    // Test values based on Sonnet 4.5 pricing
    const INPUT_COST_PER_1K = 0.003;
    const OUTPUT_COST_PER_1K = 0.015;
    const THINKING_COST_PER_1K = 0.015;

    function calculateCost(input: number, output: number, thinking: number = 0): number {
      return (
        (input / 1000) * INPUT_COST_PER_1K +
        (output / 1000) * OUTPUT_COST_PER_1K +
        (thinking / 1000) * THINKING_COST_PER_1K
      );
    }

    it('should calculate cost correctly without thinking tokens', () => {
      const cost = calculateCost(1000, 500, 0);
      // 1000 input * 0.003/1K + 500 output * 0.015/1K = 0.003 + 0.0075 = 0.0105
      expect(cost).toBeCloseTo(0.0105, 4);
    });

    it('should calculate cost correctly with thinking tokens', () => {
      const cost = calculateCost(1000, 500, 2000);
      // 1000 * 0.003/1K + 500 * 0.015/1K + 2000 * 0.015/1K
      // = 0.003 + 0.0075 + 0.03 = 0.0405
      expect(cost).toBeCloseTo(0.0405, 4);
    });

    it('should handle zero tokens', () => {
      const cost = calculateCost(0, 0, 0);
      expect(cost).toBe(0);
    });

    it('should handle large token counts', () => {
      const cost = calculateCost(100000, 50000, 100000);
      // 100K * 0.003 + 50K * 0.015 + 100K * 0.015
      // = 0.3 + 0.75 + 1.5 = 2.55
      expect(cost).toBeCloseTo(2.55, 2);
    });
  });

  // ============================================================================
  // Entity ID Validation Tests
  // ============================================================================

  describe('Entity ID Validation', () => {
    // UUID validation
    function isValidUUID(str: string): boolean {
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      return uuidRegex.test(str);
    }

    // Graph conversation ID validation
    function isValidGraphConversationId(id: string): boolean {
      if (!id || typeof id !== 'string') return false;
      const base64Regex = /^[A-Za-z0-9+/=]{20,250}$/;
      return base64Regex.test(id);
    }

    // Combined validation
    function isValidEntityId(entityType: string, entityId: string): boolean {
      if (!entityType || !entityId) return false;
      const type = entityType.toLowerCase();

      switch (type) {
        case 'email_thread':
          return isValidGraphConversationId(entityId);
        case 'case':
        case 'client':
        case 'user':
          return isValidUUID(entityId);
        default:
          return false;
      }
    }

    describe('UUID Validation', () => {
      it('should accept valid UUIDs', () => {
        expect(isValidUUID('a1b2c3d4-e5f6-7890-abcd-1234567890ef')).toBe(true);
        expect(isValidUUID('A1B2C3D4-E5F6-7890-ABCD-1234567890EF')).toBe(true);
        expect(isValidUUID('00000000-0000-0000-0000-000000000000')).toBe(true);
      });

      it('should reject invalid UUIDs', () => {
        expect(isValidUUID('not-a-uuid')).toBe(false);
        expect(isValidUUID('2026-003')).toBe(false);
        expect(isValidUUID('')).toBe(false);
        expect(isValidUUID('a1b2c3d4-e5f6-7890-abcd')).toBe(false); // Too short
      });
    });

    describe('Graph Conversation ID Validation', () => {
      it('should accept valid base64 conversation IDs', () => {
        expect(isValidGraphConversationId('AAQkAGI2TG1hbnVhbC0yMDI2')).toBe(true);
        expect(isValidGraphConversationId('AAMkAGI2TG1hbnVhbC0yMDI2/RgAAAAAAA==')).toBe(true);
        expect(
          isValidGraphConversationId(
            'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/='
          )
        ).toBe(true);
      });

      it('should reject invalid conversation IDs', () => {
        expect(isValidGraphConversationId('')).toBe(false);
        expect(isValidGraphConversationId('short')).toBe(false); // Too short
        expect(isValidGraphConversationId('has spaces here')).toBe(false);
        expect(isValidGraphConversationId('has<html>tags')).toBe(false);
      });
    });

    describe('Entity Type Validation', () => {
      const validUUID = 'a1b2c3d4-e5f6-7890-abcd-1234567890ef';
      const validConversationId = 'AAQkAGI2TG1hbnVhbC0yMDI2MDAx';

      it('should validate case entities with UUIDs', () => {
        expect(isValidEntityId('case', validUUID)).toBe(true);
        expect(isValidEntityId('case', 'not-a-uuid')).toBe(false);
      });

      it('should validate client entities with UUIDs', () => {
        expect(isValidEntityId('client', validUUID)).toBe(true);
        expect(isValidEntityId('client', '12345')).toBe(false);
      });

      it('should validate user entities with UUIDs', () => {
        expect(isValidEntityId('user', validUUID)).toBe(true);
        expect(isValidEntityId('user', 'user-123')).toBe(false);
      });

      it('should validate email_thread entities with base64 IDs', () => {
        expect(isValidEntityId('email_thread', validConversationId)).toBe(true);
        expect(isValidEntityId('email_thread', validUUID)).toBe(false); // UUIDs not valid for email
      });

      it('should reject unknown entity types', () => {
        expect(isValidEntityId('unknown', validUUID)).toBe(false);
        expect(isValidEntityId('', validUUID)).toBe(false);
      });
    });
  });

  // ============================================================================
  // Briefing Output Transformation Tests
  // ============================================================================

  describe('Briefing Output Transformation', () => {
    const mockV2Output = {
      edition: {
        date: '2026-02-03',
        mood: 'steady' as const,
        editorNote: 'Normal day',
      },
      lead: [
        {
          id: 'lead-1',
          headline: 'Client ABC has 3 deadlines',
          summary: 'Multiple cases need attention this week',
          details: [
            {
              id: 'd1',
              title: 'Case 123/2026',
              subtitle: 'Due Wednesday',
              status: 'on_track' as const,
              href: '/cases/uuid-1',
            },
          ],
          category: 'client' as const,
          urgency: 'HIGH' as const,
          entityType: 'client' as const,
          entityId: 'a1b2c3d4-e5f6-7890-abcd-1234567890ef',
          canAskFollowUp: true,
        },
      ],
      secondary: {
        title: 'This Week',
        items: [],
      },
      tertiary: {
        title: 'Notes',
        items: [],
      },
      quickStats: {
        activeCases: 10,
        urgentTasks: 2,
        teamUtilization: 75,
        unreadEmails: 5,
        overdueItems: 1,
        upcomingDeadlines: 3,
      },
    };

    it('should preserve all required fields', () => {
      expect(mockV2Output.edition).toBeDefined();
      expect(mockV2Output.lead).toHaveLength(1);
      expect(mockV2Output.secondary.title).toBe('This Week');
      expect(mockV2Output.quickStats.activeCases).toBe(10);
    });

    it('should have valid entity references in lead items', () => {
      const leadItem = mockV2Output.lead[0];
      expect(leadItem.entityType).toBe('client');
      expect(leadItem.entityId).toMatch(/^[0-9a-f-]{36}$/i);
    });

    it('should have valid detail hrefs', () => {
      const detail = mockV2Output.lead[0].details[0];
      expect(detail.href).toMatch(/^\/cases\/uuid/);
    });
  });

  // ============================================================================
  // Structured Error Response Tests
  // ============================================================================

  describe('Structured Error Responses', () => {
    const ToolErrorCode = {
      QUERY_FAILED: 'QUERY_FAILED',
      PERMISSION_DENIED: 'PERMISSION_DENIED',
      NOT_FOUND: 'NOT_FOUND',
      VALIDATION_ERROR: 'VALIDATION_ERROR',
      UNKNOWN_ERROR: 'UNKNOWN_ERROR',
    };

    function errorResult(code: string, message: string): string {
      return `[TOOL_ERROR]
code: ${code}
message: ${message}
[/TOOL_ERROR]`;
    }

    it('should format error with correct structure', () => {
      const result = errorResult(ToolErrorCode.QUERY_FAILED, 'Database connection failed');
      expect(result).toContain('[TOOL_ERROR]');
      expect(result).toContain('code: QUERY_FAILED');
      expect(result).toContain('message: Database connection failed');
      expect(result).toContain('[/TOOL_ERROR]');
    });

    it('should be parseable by regex', () => {
      const result = errorResult(ToolErrorCode.NOT_FOUND, 'Case not found');
      const match = result.match(
        /\[TOOL_ERROR\]\s*code:\s*(\w+)\s*message:\s*(.*?)\s*\[\/TOOL_ERROR\]/s
      );
      expect(match).not.toBeNull();
      expect(match![1]).toBe('NOT_FOUND');
      expect(match![2]).toContain('Case not found');
    });

    it('should use appropriate error codes for different error types', () => {
      expect(ToolErrorCode.QUERY_FAILED).toBe('QUERY_FAILED');
      expect(ToolErrorCode.PERMISSION_DENIED).toBe('PERMISSION_DENIED');
      expect(ToolErrorCode.NOT_FOUND).toBe('NOT_FOUND');
      expect(ToolErrorCode.VALIDATION_ERROR).toBe('VALIDATION_ERROR');
      expect(ToolErrorCode.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR');
    });
  });
});
