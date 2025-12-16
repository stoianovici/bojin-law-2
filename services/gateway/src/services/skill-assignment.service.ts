/**
 * Skill-Based Assignment Service
 * Story 4.5: Team Workload Management
 *
 * Suggests optimal task assignments based on skills and capacity
 * AC: 3 - AI suggests optimal task assignments based on skills and capacity
 *
 * Business Logic:
 * - Map TaskType to required SkillTypes
 * - Calculate weighted match based on proficiency (1-5)
 * - Verified skills get 1.5x weight
 * - Integrate with workload service for capacity calculation
 */

import { PrismaClient as PrismaClientType, TaskTypeEnum } from '@prisma/client';
import type {
  AssignmentSuggestionRequest,
  AssignmentSuggestionResponse,
  AssignmentSuggestion,
  UserSkill,
  SkillType,
  UserBasicInfo,
} from '@legal-platform/types';
import { WorkloadService } from './workload.service';

/**
 * Mapping of task types to required skills
 */
const TASK_TYPE_SKILLS: Record<string, SkillType[]> = {
  Research: ['LegalResearch', 'DocumentReview'],
  DocumentCreation: ['ContractDrafting', 'DocumentReview'],
  DocumentRetrieval: ['DocumentReview'],
  CourtDate: ['CourtProcedures', 'Litigation'],
  Meeting: ['ClientCommunication', 'Negotiation'],
  BusinessTrip: ['ClientCommunication', 'Negotiation'],
};

/**
 * Skill-Based Assignment Service
 * Handles AI-powered assignment suggestions
 */
export class SkillAssignmentService {
  private prisma: PrismaClientType;
  private workloadService: WorkloadService;

  /**
   * Create SkillAssignmentService instance
   *
   * @param prismaClient - Optional Prisma client (for testing)
   * @param workloadSvc - Optional WorkloadService instance (for testing)
   */
  constructor(prismaClient?: PrismaClientType, workloadSvc?: WorkloadService) {
    if (prismaClient) {
      this.prisma = prismaClient;
    } else {
      const { prisma } = require('@legal-platform/database');
      this.prisma = prisma;
    }
    this.workloadService = workloadSvc || new WorkloadService(prismaClient);
  }

  /**
   * Suggest assignees for a task
   * AC: 3 - AI suggests optimal task assignments based on skills and capacity
   *
   * @param request - Assignment suggestion request
   * @param firmId - Firm ID
   * @returns Assignment suggestion response
   */
  async suggestAssignees(
    request: AssignmentSuggestionRequest,
    firmId: string
  ): Promise<AssignmentSuggestionResponse> {
    // Get all active users in the firm
    const users = await this.prisma.user.findMany({
      where: {
        firmId,
        status: 'Active',
        ...(request.excludeUserIds && request.excludeUserIds.length > 0
          ? { id: { notIn: request.excludeUserIds } }
          : {}),
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        role: true,
      },
    });

    if (users.length === 0) {
      return {
        suggestions: [],
        noSuitableCandidates: true,
        allOverloaded: false,
      };
    }

    // Get required skills for this task type
    const requiredSkills =
      request.requiredSkills || this.getRequiredSkillsForTaskType(request.taskType);

    // Calculate suggestions for each user
    const suggestions: AssignmentSuggestion[] = [];
    let allOverloaded = true;

    for (const user of users) {
      const userInfo: UserBasicInfo = {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      };

      // Get user skills
      const userSkills = await this.getUserSkills(user.id);

      // Calculate skill match
      const skillMatch = this.calculateSkillMatch(userSkills, requiredSkills);

      // Get workload metrics
      const currentWorkload = await this.workloadService.getCurrentWorkload(user.id);
      const availableCapacity = await this.workloadService.getAvailableCapacity(
        user.id,
        new Date(request.dueDate)
      );

      // Calculate capacity match (higher available capacity = higher score)
      // Max capacity is assumed to be 8 hours
      const capacityMatch = Math.min(100, (availableCapacity / 8) * 100);

      // Check if user is overloaded
      if (availableCapacity > 0) {
        allOverloaded = false;
      }

      // Calculate overall match score (weighted average)
      // 40% skill, 60% capacity
      const matchScore = Math.round(skillMatch * 0.4 + capacityMatch * 0.6);

      // Generate reasoning
      const reasoning = this.generateReasoning(
        userInfo,
        skillMatch,
        capacityMatch,
        currentWorkload,
        availableCapacity,
        requiredSkills,
        userSkills
      );

      // Add caveats if any
      const caveats: string[] = [];
      if (availableCapacity < request.estimatedHours) {
        caveats.push(
          `Available capacity (${availableCapacity.toFixed(1)}h) is less than estimated task time (${request.estimatedHours}h)`
        );
      }
      if (skillMatch < 50) {
        caveats.push('Limited skill match for this task type');
      }

      suggestions.push({
        userId: user.id,
        user: userInfo,
        matchScore,
        skillMatch,
        capacityMatch: Math.round(capacityMatch),
        currentWorkload,
        availableCapacity,
        reasoning,
        caveats: caveats.length > 0 ? caveats : undefined,
      });
    }

    // Sort by match score descending
    suggestions.sort((a, b) => b.matchScore - a.matchScore);

    // Determine recommended assignee
    const recommendedAssignee =
      suggestions.length > 0 && suggestions[0].matchScore >= 40 ? suggestions[0].userId : undefined;

    return {
      suggestions,
      noSuitableCandidates: suggestions.length === 0,
      allOverloaded,
      recommendedAssignee,
    };
  }

  /**
   * Get user skills
   *
   * @param userId - User ID
   * @returns Array of user skills
   */
  async getUserSkills(userId: string): Promise<UserSkill[]> {
    const skills = await this.prisma.userSkill.findMany({
      where: { userId },
      select: {
        id: true,
        userId: true,
        skillType: true,
        proficiency: true,
        verified: true,
      },
    });

    return skills.map((s) => ({
      id: s.id,
      userId: s.userId,
      skillType: s.skillType as SkillType,
      proficiency: s.proficiency,
      verified: s.verified,
    }));
  }

  /**
   * Update user skills
   *
   * @param userId - User ID
   * @param skills - Array of skill updates
   * @param firmId - Firm ID for new skills
   */
  async updateUserSkills(
    userId: string,
    skills: Array<{ skillType: SkillType; proficiency: number }>,
    firmId: string
  ): Promise<void> {
    for (const skill of skills) {
      await this.prisma.userSkill.upsert({
        where: {
          userId_skillType: {
            userId,
            skillType: skill.skillType,
          },
        },
        update: {
          proficiency: skill.proficiency,
        },
        create: {
          userId,
          firmId,
          skillType: skill.skillType,
          proficiency: skill.proficiency,
          verified: false,
        },
      });
    }
  }

  /**
   * Verify a user skill (Partner only)
   *
   * @param skillId - Skill ID to verify
   * @returns Updated skill
   */
  async verifyUserSkill(skillId: string): Promise<UserSkill> {
    const updated = await this.prisma.userSkill.update({
      where: { id: skillId },
      data: { verified: true },
    });

    return {
      id: updated.id,
      userId: updated.userId,
      skillType: updated.skillType as SkillType,
      proficiency: updated.proficiency,
      verified: updated.verified,
    };
  }

  /**
   * Get required skills for a task type
   *
   * @param taskType - Task type
   * @returns Array of required skills
   */
  getRequiredSkillsForTaskType(taskType: string): SkillType[] {
    return TASK_TYPE_SKILLS[taskType] || [];
  }

  /**
   * Calculate skill match score
   * Verified skills get 1.5x weight
   *
   * @param userSkills - User's skills
   * @param requiredSkills - Required skills for task
   * @returns Match score 0-100
   */
  calculateSkillMatch(userSkills: UserSkill[], requiredSkills: SkillType[]): number {
    if (requiredSkills.length === 0) {
      return 100; // No specific skills required
    }

    let totalScore = 0;
    let maxPossibleScore = requiredSkills.length * 5 * 1.5; // Max proficiency * verification bonus

    for (const required of requiredSkills) {
      const userSkill = userSkills.find((s) => s.skillType === required);

      if (userSkill) {
        // Base score from proficiency (1-5)
        let score = userSkill.proficiency;

        // Verified skills get 1.5x weight
        if (userSkill.verified) {
          score *= 1.5;
        }

        totalScore += score;
      }
    }

    return Math.round((totalScore / maxPossibleScore) * 100);
  }

  /**
   * Generate reasoning text for suggestion
   */
  private generateReasoning(
    user: UserBasicInfo,
    skillMatch: number,
    capacityMatch: number,
    currentWorkload: number,
    availableCapacity: number,
    requiredSkills: SkillType[],
    userSkills: UserSkill[]
  ): string {
    const parts: string[] = [];

    // Skill assessment
    if (requiredSkills.length > 0) {
      const matchedSkills = userSkills.filter((s) => requiredSkills.includes(s.skillType));
      if (matchedSkills.length > 0) {
        const verifiedCount = matchedSkills.filter((s) => s.verified).length;
        parts.push(
          `Has ${matchedSkills.length}/${requiredSkills.length} required skills${verifiedCount > 0 ? ` (${verifiedCount} verified)` : ''}`
        );
      } else {
        parts.push('No matching skills for this task type');
      }
    }

    // Capacity assessment
    if (availableCapacity > 4) {
      parts.push(`Good availability (${availableCapacity.toFixed(1)}h capacity)`);
    } else if (availableCapacity > 0) {
      parts.push(`Limited availability (${availableCapacity.toFixed(1)}h capacity)`);
    } else {
      parts.push(`No available capacity on due date`);
    }

    // Workload assessment
    if (currentWorkload < 20) {
      parts.push('Light current workload');
    } else if (currentWorkload < 40) {
      parts.push('Moderate current workload');
    } else {
      parts.push(`Heavy current workload (${currentWorkload.toFixed(1)}h)`);
    }

    return parts.join('. ') + '.';
  }
}

// Export singleton instance
export const skillAssignmentService = new SkillAssignmentService();
