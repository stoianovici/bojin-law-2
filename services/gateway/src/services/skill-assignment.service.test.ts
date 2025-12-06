/**
 * Skill Assignment Service Unit Tests
 * Story 4.5: Team Workload Management
 *
 * Tests for skill-based task assignment suggestions
 * AC: 3 - AI suggests optimal task assignments based on skills and capacity
 */

import { SkillAssignmentService } from './skill-assignment.service';
import { WorkloadService } from './workload.service';

// Mock Prisma client
const mockPrisma = {
  user: {
    findMany: jest.fn(),
  },
  userSkill: {
    findMany: jest.fn(),
    upsert: jest.fn(),
    update: jest.fn(),
  },
};

// Mock WorkloadService
const mockWorkloadService = {
  getCurrentWorkload: jest.fn(),
  getAvailableCapacity: jest.fn(),
};

jest.mock('@legal-platform/database', () => ({
  prisma: mockPrisma,
}));

describe('SkillAssignmentService', () => {
  let service: SkillAssignmentService;
  const firmId = 'firm-123';

  beforeEach(() => {
    jest.clearAllMocks();
    service = new SkillAssignmentService(
      mockPrisma as any,
      mockWorkloadService as unknown as WorkloadService
    );
  });

  describe('suggestAssignees', () => {
    const request = {
      taskType: 'Research',
      taskTitle: 'Legal research on contract law',
      caseId: 'case-1',
      estimatedHours: 4,
      dueDate: new Date('2025-12-15'),
    };

    it('should return suggestions sorted by match score', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', firstName: 'John', lastName: 'Doe', role: 'Associate' },
        { id: 'user-2', firstName: 'Jane', lastName: 'Smith', role: 'Associate' },
      ]);

      // User 1: Has matching skills
      mockPrisma.userSkill.findMany
        .mockResolvedValueOnce([
          { id: 'skill-1', userId: 'user-1', skillType: 'LegalResearch', proficiency: 4, verified: true },
          { id: 'skill-2', userId: 'user-1', skillType: 'DocumentReview', proficiency: 3, verified: false },
        ])
        // User 2: No matching skills
        .mockResolvedValueOnce([
          { id: 'skill-3', userId: 'user-2', skillType: 'Litigation', proficiency: 5, verified: true },
        ]);

      mockWorkloadService.getCurrentWorkload
        .mockResolvedValueOnce(20) // User 1
        .mockResolvedValueOnce(30); // User 2

      mockWorkloadService.getAvailableCapacity
        .mockResolvedValueOnce(6) // User 1
        .mockResolvedValueOnce(4); // User 2

      const result = await service.suggestAssignees(request, firmId);

      expect(result.suggestions.length).toBe(2);
      expect(result.suggestions[0].userId).toBe('user-1'); // Higher match score
      expect(result.suggestions[0].skillMatch).toBeGreaterThan(result.suggestions[1].skillMatch);
      expect(result.noSuitableCandidates).toBe(false);
      expect(result.recommendedAssignee).toBe('user-1');
    });

    it('should exclude specified users', async () => {
      const requestWithExclusion = {
        ...request,
        excludeUserIds: ['user-1'],
      };

      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-2', firstName: 'Jane', lastName: 'Smith', role: 'Associate' },
      ]);

      mockPrisma.userSkill.findMany.mockResolvedValue([]);
      mockWorkloadService.getCurrentWorkload.mockResolvedValue(20);
      mockWorkloadService.getAvailableCapacity.mockResolvedValue(8);

      const result = await service.suggestAssignees(requestWithExclusion, firmId);

      expect(result.suggestions.length).toBe(1);
      expect(result.suggestions[0].userId).toBe('user-2');
    });

    it('should detect when all users are overloaded', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', firstName: 'John', lastName: 'Doe', role: 'Associate' },
      ]);

      mockPrisma.userSkill.findMany.mockResolvedValue([]);
      mockWorkloadService.getCurrentWorkload.mockResolvedValue(40);
      mockWorkloadService.getAvailableCapacity.mockResolvedValue(0);

      const result = await service.suggestAssignees(request, firmId);

      expect(result.allOverloaded).toBe(true);
    });

    it('should return noSuitableCandidates when no users found', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);

      const result = await service.suggestAssignees(request, firmId);

      expect(result.noSuitableCandidates).toBe(true);
      expect(result.suggestions.length).toBe(0);
    });

    it('should add caveats for capacity warnings', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 'user-1', firstName: 'John', lastName: 'Doe', role: 'Associate' },
      ]);

      mockPrisma.userSkill.findMany.mockResolvedValue([]);
      mockWorkloadService.getCurrentWorkload.mockResolvedValue(30);
      mockWorkloadService.getAvailableCapacity.mockResolvedValue(2); // Less than estimatedHours

      const result = await service.suggestAssignees(request, firmId);

      expect(result.suggestions[0].caveats).toBeDefined();
      expect(result.suggestions[0].caveats?.some((c: string) => c.includes('capacity'))).toBe(true);
    });
  });

  describe('calculateSkillMatch', () => {
    it('should return 100 when no skills required', () => {
      const result = service.calculateSkillMatch([], []);
      expect(result).toBe(100);
    });

    it('should calculate correct match for verified skills', () => {
      const userSkills = [
        { id: 's1', userId: 'u1', skillType: 'LegalResearch' as const, proficiency: 5, verified: true },
      ];
      const requiredSkills = ['LegalResearch' as const];

      const result = service.calculateSkillMatch(userSkills, requiredSkills);

      // Score: 5 * 1.5 = 7.5, Max: 5 * 1.5 = 7.5, Match: 100%
      expect(result).toBe(100);
    });

    it('should calculate correct match for unverified skills', () => {
      const userSkills = [
        { id: 's1', userId: 'u1', skillType: 'LegalResearch' as const, proficiency: 4, verified: false },
      ];
      const requiredSkills = ['LegalResearch' as const];

      const result = service.calculateSkillMatch(userSkills, requiredSkills);

      // Score: 4, Max: 7.5, Match: ~53%
      expect(result).toBe(53);
    });

    it('should return 0 when user has no matching skills', () => {
      const userSkills = [
        { id: 's1', userId: 'u1', skillType: 'Litigation' as const, proficiency: 5, verified: true },
      ];
      const requiredSkills = ['LegalResearch' as const, 'DocumentReview' as const];

      const result = service.calculateSkillMatch(userSkills, requiredSkills);

      expect(result).toBe(0);
    });
  });

  describe('getRequiredSkillsForTaskType', () => {
    it('should return correct skills for Research task', () => {
      const skills = service.getRequiredSkillsForTaskType('Research');
      expect(skills).toContain('LegalResearch');
      expect(skills).toContain('DocumentReview');
    });

    it('should return correct skills for CourtDate task', () => {
      const skills = service.getRequiredSkillsForTaskType('CourtDate');
      expect(skills).toContain('CourtProcedures');
      expect(skills).toContain('Litigation');
    });

    it('should return empty array for unknown task type', () => {
      const skills = service.getRequiredSkillsForTaskType('UnknownType');
      expect(skills).toEqual([]);
    });
  });

  describe('updateUserSkills', () => {
    it('should upsert skills correctly', async () => {
      const skills = [
        { skillType: 'LegalResearch' as const, proficiency: 4 },
        { skillType: 'Litigation' as const, proficiency: 3 },
      ];

      await service.updateUserSkills('user-1', skills, firmId);

      expect(mockPrisma.userSkill.upsert).toHaveBeenCalledTimes(2);
    });
  });

  describe('verifyUserSkill', () => {
    it('should update skill to verified', async () => {
      mockPrisma.userSkill.update.mockResolvedValue({
        id: 'skill-1',
        userId: 'user-1',
        skillType: 'LegalResearch',
        proficiency: 4,
        verified: true,
      });

      const result = await service.verifyUserSkill('skill-1');

      expect(result.verified).toBe(true);
      expect(mockPrisma.userSkill.update).toHaveBeenCalledWith({
        where: { id: 'skill-1' },
        data: { verified: true },
      });
    });
  });
});
