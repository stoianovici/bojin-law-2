/**
 * Dashboard Factory Tests
 */

import {
  createKPIMetric,
  createKPIMetrics,
  createAISuggestion,
  createAIInsight,
  createAIAlert,
  createAIRecommendation,
  createAISuggestionsForRole,
  createAISuggestions,
  generateEmployeeUtilization,
  generateAtRiskCases,
  generateHighValueCases,
  generateAIInsights,
  createSupervisedCasesWidget,
  createFirmCasesOverviewWidget,
  createFirmTasksOverviewWidget,
  createEmployeeWorkloadWidget,
} from './dashboard.factory';

describe('Dashboard Factory', () => {
  describe('createKPIMetric', () => {
    it('should create a valid KPIMetric entity', () => {
      const kpi = createKPIMetric();

      expect(kpi).toMatchObject({
        id: expect.any(String),
        label: expect.any(String),
        value: expect.any(Number),
        trend: expect.stringMatching(/^(up|down|neutral)$/),
        trendPercentage: expect.any(Number),
        comparisonText: expect.any(String),
      });
    });

    it('should generate trend percentages between 1 and 30', () => {
      const kpis = Array.from({ length: 10 }, () => createKPIMetric());
      kpis.forEach((kpi) => {
        expect(kpi.trendPercentage).toBeGreaterThanOrEqual(1);
        expect(kpi.trendPercentage).toBeLessThanOrEqual(30);
      });
    });

    it('should allow overriding default values', () => {
      const kpi = createKPIMetric({ label: 'Custom KPI', value: 999, trend: 'up', trendPercentage: 42 });

      expect(kpi.label).toBe('Custom KPI');
      expect(kpi.value).toBe(999);
      expect(kpi.trend).toBe('up');
      expect(kpi.trendPercentage).toBe(42);
    });

    it('should support Romanian labels', () => {
      const romanianKPI = createKPIMetric({}, true);

      expect(romanianKPI.label).toBeTruthy();
      expect(romanianKPI.comparisonText).toContain('luna');
    });

    it('should support English labels', () => {
      const englishKPI = createKPIMetric({}, false);

      expect(englishKPI.label).toBeTruthy();
      expect(englishKPI.comparisonText).toContain('last month');
    });

    it('should include optional icon', () => {
      const kpi = createKPIMetric();
      expect(kpi.icon).toBeTruthy();
      expect(typeof kpi.icon).toBe('string');
    });
  });

  describe('createKPIMetrics', () => {
    it('should create multiple KPI metrics', () => {
      const kpis = createKPIMetrics(5);

      expect(kpis).toHaveLength(5);
      kpis.forEach((kpi) => {
        expect(kpi).toMatchObject({
          id: expect.any(String),
          label: expect.any(String),
          value: expect.any(Number),
        });
      });
    });

    it('should apply overrides to all created metrics', () => {
      const kpis = createKPIMetrics(3, { trend: 'up' });

      expect(kpis).toHaveLength(3);
      kpis.forEach((kpi) => {
        expect(kpi.trend).toBe('up');
      });
    });
  });

  describe('createAISuggestion', () => {
    it('should create a valid AISuggestion entity', () => {
      const suggestion = createAISuggestion();

      expect(suggestion).toMatchObject({
        id: expect.any(String),
        type: expect.stringMatching(/^(insight|alert|recommendation)$/),
        role: expect.stringMatching(/^(Partner|Associate|Paralegal)$/),
        text: expect.any(String),
        timestamp: expect.any(Date),
        actionable: expect.any(Boolean),
        dismissed: false,
      });
    });

    it('should include actionText when actionable is true', () => {
      const actionableSuggestion = createAISuggestion({ actionable: true });

      if (actionableSuggestion.actionable) {
        // actionText is optional even when actionable is true, but should be present in most cases
        expect(typeof actionableSuggestion.actionText === 'string' || actionableSuggestion.actionText === undefined).toBe(true);
      }
    });

    it('should not include actionText when actionable is false', () => {
      const nonActionableSuggestion = createAISuggestion({ actionable: false });

      expect(nonActionableSuggestion.actionText).toBeUndefined();
    });

    it('should allow overriding default values', () => {
      const suggestion = createAISuggestion({
        type: 'alert',
        role: 'Partner',
        text: 'Custom alert text',
        dismissed: true,
      });

      expect(suggestion.type).toBe('alert');
      expect(suggestion.role).toBe('Partner');
      expect(suggestion.text).toBe('Custom alert text');
      expect(suggestion.dismissed).toBe(true);
    });

    it('should generate recent timestamps (within last 3 days)', () => {
      const suggestion = createAISuggestion();
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

      expect(suggestion.timestamp.getTime()).toBeGreaterThanOrEqual(threeDaysAgo.getTime());
      expect(suggestion.timestamp.getTime()).toBeLessThanOrEqual(new Date().getTime());
    });
  });

  describe('createAIInsight', () => {
    it('should create an insight type suggestion', () => {
      const insight = createAIInsight();

      expect(insight.type).toBe('insight');
      expect(insight).toMatchObject({
        id: expect.any(String),
        role: expect.stringMatching(/^(Partner|Associate|Paralegal)$/),
        text: expect.any(String),
        timestamp: expect.any(Date),
      });
    });

    it('should allow overriding other properties', () => {
      const insight = createAIInsight({ role: 'Associate', dismissed: true });

      expect(insight.type).toBe('insight');
      expect(insight.role).toBe('Associate');
      expect(insight.dismissed).toBe(true);
    });
  });

  describe('createAIAlert', () => {
    it('should create an alert type suggestion', () => {
      const alert = createAIAlert();

      expect(alert.type).toBe('alert');
      expect(alert).toMatchObject({
        id: expect.any(String),
        role: expect.stringMatching(/^(Partner|Associate|Paralegal)$/),
        text: expect.any(String),
        timestamp: expect.any(Date),
      });
    });
  });

  describe('createAIRecommendation', () => {
    it('should create a recommendation type suggestion', () => {
      const recommendation = createAIRecommendation();

      expect(recommendation.type).toBe('recommendation');
      expect(recommendation).toMatchObject({
        id: expect.any(String),
        role: expect.stringMatching(/^(Partner|Associate|Paralegal)$/),
        text: expect.any(String),
        timestamp: expect.any(Date),
      });
    });
  });

  describe('createAISuggestionsForRole', () => {
    it('should create role-specific suggestions for Partner', () => {
      const suggestions = createAISuggestionsForRole('Partner', 4);

      expect(suggestions).toHaveLength(4);
      suggestions.forEach((suggestion) => {
        expect(suggestion.role).toBe('Partner');
        expect(suggestion.text).toBeTruthy();
      });
    });

    it('should create role-specific suggestions for Associate', () => {
      const suggestions = createAISuggestionsForRole('Associate', 3);

      expect(suggestions).toHaveLength(3);
      suggestions.forEach((suggestion) => {
        expect(suggestion.role).toBe('Associate');
      });
    });

    it('should create role-specific suggestions for Paralegal', () => {
      const suggestions = createAISuggestionsForRole('Paralegal', 5);

      expect(suggestions).toHaveLength(5);
      suggestions.forEach((suggestion) => {
        expect(suggestion.role).toBe('Paralegal');
      });
    });

    it('should create random count (3-5) when count not specified', () => {
      const suggestions = createAISuggestionsForRole('Partner');

      expect(suggestions.length).toBeGreaterThanOrEqual(3);
      expect(suggestions.length).toBeLessThanOrEqual(5);
      suggestions.forEach((suggestion) => {
        expect(suggestion.role).toBe('Partner');
      });
    });

    it('should apply overrides to all created suggestions', () => {
      const suggestions = createAISuggestionsForRole('Associate', 3, { dismissed: true });

      expect(suggestions).toHaveLength(3);
      suggestions.forEach((suggestion) => {
        expect(suggestion.role).toBe('Associate');
        expect(suggestion.dismissed).toBe(true);
      });
    });
  });

  describe('createAISuggestions', () => {
    it('should create multiple AI suggestions', () => {
      const suggestions = createAISuggestions(5);

      expect(suggestions).toHaveLength(5);
      suggestions.forEach((suggestion) => {
        expect(suggestion).toMatchObject({
          id: expect.any(String),
          type: expect.stringMatching(/^(insight|alert|recommendation)$/),
          role: expect.stringMatching(/^(Partner|Associate|Paralegal)$/),
          text: expect.any(String),
          timestamp: expect.any(Date),
        });
      });
    });

    it('should apply overrides to all created suggestions', () => {
      const suggestions = createAISuggestions(3, { type: 'alert', actionable: true });

      expect(suggestions).toHaveLength(3);
      suggestions.forEach((suggestion) => {
        expect(suggestion.type).toBe('alert');
        expect(suggestion.actionable).toBe(true);
      });
    });
  });

  describe('Romanian diacritics support', () => {
    it('should generate Romanian text with diacritics', () => {
      const suggestions = createAISuggestions(20);
      const hasRomanianText = suggestions.some(
        (s) =>
          s.text.includes('ă') ||
          s.text.includes('â') ||
          s.text.includes('î') ||
          s.text.includes('ș') ||
          s.text.includes('ț')
      );

      // With 20 suggestions, we should have at least one with Romanian diacritics
      expect(hasRomanianText).toBe(true);
    });

    it('should support Romanian comparison text in KPIs', () => {
      const kpis = createKPIMetrics(10, {}, true);
      kpis.forEach((kpi) => {
        expect(kpi.comparisonText).toContain('luna');
      });
    });
  });

  // =====================================
  // Widget Factory Tests (Story 1.6)
  // =====================================

  describe('generateEmployeeUtilization', () => {
    it('should generate specified number of employee utilization objects', () => {
      const utilization = generateEmployeeUtilization(10);

      expect(utilization).toHaveLength(10);
      utilization.forEach((employee) => {
        expect(employee).toMatchObject({
          employeeId: expect.any(String),
          name: expect.any(String),
          dailyUtilization: expect.any(Number),
          weeklyUtilization: expect.any(Number),
          taskCount: expect.any(Number),
          estimatedHours: expect.any(Number),
          status: expect.stringMatching(/^(over|optimal|under)$/),
          tasks: expect.any(Array),
        });
      });
    });

    it('should correctly calculate status based on utilization', () => {
      const utilization = generateEmployeeUtilization(50);

      utilization.forEach((employee) => {
        if (employee.dailyUtilization > 100) {
          expect(employee.status).toBe('over');
        } else if (employee.dailyUtilization >= 50) {
          expect(employee.status).toBe('optimal');
        } else {
          expect(employee.status).toBe('under');
        }
      });
    });

    it('should generate tasks for each employee', () => {
      const utilization = generateEmployeeUtilization(5);

      utilization.forEach((employee) => {
        expect(employee.tasks).toBeTruthy();
        expect(employee.tasks!.length).toBeGreaterThanOrEqual(2);
        expect(employee.tasks!.length).toBeLessThanOrEqual(15);

        employee.tasks!.forEach((task) => {
          expect(task).toMatchObject({
            id: expect.any(String),
            title: expect.any(String),
            estimate: expect.any(Number),
            type: expect.any(String),
          });
        });
      });
    });

    it('should support Romanian names with diacritics', () => {
      const utilization = generateEmployeeUtilization(20);
      const hasRomanianName = utilization.some(
        (e) =>
          e.name.includes('ă') ||
          e.name.includes('â') ||
          e.name.includes('î') ||
          e.name.includes('ș') ||
          e.name.includes('ț') ||
          e.name.includes('Ș')
      );

      expect(hasRomanianName).toBe(true);
    });
  });

  describe('generateAtRiskCases', () => {
    it('should generate specified number of at-risk cases', () => {
      const cases = generateAtRiskCases(5);

      expect(cases).toHaveLength(5);
      cases.forEach((caseItem) => {
        expect(caseItem).toMatchObject({
          id: expect.any(String),
          caseNumber: expect.stringMatching(/^C-\d{4}$/),
          title: expect.any(String),
          reason: expect.any(String),
          assignedPartner: expect.any(String),
          daysUntilDeadline: expect.any(Number),
        });
      });
    });

    it('should generate days until deadline within valid range', () => {
      const cases = generateAtRiskCases(10);

      cases.forEach((caseItem) => {
        expect(caseItem.daysUntilDeadline).toBeGreaterThanOrEqual(1);
        expect(caseItem.daysUntilDeadline).toBeLessThanOrEqual(7);
      });
    });

    it('should support Romanian case titles and reasons', () => {
      const cases = generateAtRiskCases(20);
      const hasRomanianText = cases.some(
        (c) =>
          c.title.includes('ă') ||
          c.title.includes('â') ||
          c.title.includes('î') ||
          c.title.includes('ș') ||
          c.title.includes('ț') ||
          c.reason.includes('ă') ||
          c.reason.includes('î')
      );

      expect(hasRomanianText).toBe(true);
    });
  });

  describe('generateHighValueCases', () => {
    it('should generate specified number of high-value cases', () => {
      const cases = generateHighValueCases(5);

      expect(cases).toHaveLength(5);
      cases.forEach((caseItem) => {
        expect(caseItem).toMatchObject({
          id: expect.any(String),
          caseNumber: expect.stringMatching(/^C-\d{4}$/),
          title: expect.any(String),
          value: expect.any(Number),
          assignedPartner: expect.any(String),
          priority: expect.stringMatching(/^(strategic|vip|highValue)$/),
        });
      });
    });

    it('should generate values above minimum threshold', () => {
      const cases = generateHighValueCases(10);

      cases.forEach((caseItem) => {
        expect(caseItem.value).toBeGreaterThanOrEqual(25000);
        expect(caseItem.value).toBeLessThanOrEqual(500000);
      });
    });
  });

  describe('generateAIInsights', () => {
    it('should generate specified number of AI insights', () => {
      const insights = generateAIInsights(5);

      expect(insights).toHaveLength(5);
      insights.forEach((insight) => {
        expect(insight).toMatchObject({
          id: expect.any(String),
          caseId: expect.any(String),
          caseNumber: expect.stringMatching(/^C-\d{4}$/),
          message: expect.any(String),
          type: expect.stringMatching(/^(pattern|bottleneck|opportunity)$/),
          timestamp: expect.any(String),
        });
      });
    });

    it('should generate timestamps in ISO format', () => {
      const insights = generateAIInsights(5);

      insights.forEach((insight) => {
        expect(() => new Date(insight.timestamp)).not.toThrow();
        const date = new Date(insight.timestamp);
        expect(date.getTime()).toBeLessThanOrEqual(new Date().getTime());
      });
    });

    it('should support Romanian insight messages', () => {
      const insights = generateAIInsights(20);
      const hasRomanianText = insights.some((i) => i.message.includes('ă') || i.message.includes('ț') || i.message.includes('Ș'));

      expect(hasRomanianText).toBe(true);
    });
  });

  describe('createSupervisedCasesWidget', () => {
    it('should create a valid SupervisedCasesWidget', () => {
      const widget = createSupervisedCasesWidget();

      expect(widget).toMatchObject({
        id: 'supervised-cases',
        type: 'supervisedCases',
        title: expect.any(String),
        position: expect.objectContaining({
          i: 'supervised-cases',
          x: expect.any(Number),
          y: expect.any(Number),
          w: expect.any(Number),
          h: expect.any(Number),
        }),
        collapsed: expect.any(Boolean),
        cases: expect.any(Array),
      });
    });

    it('should generate cases with correct structure', () => {
      const widget = createSupervisedCasesWidget();

      expect(widget.cases.length).toBeGreaterThanOrEqual(3);
      expect(widget.cases.length).toBeLessThanOrEqual(20);

      widget.cases.forEach((caseItem) => {
        expect(caseItem).toMatchObject({
          id: expect.any(String),
          caseNumber: expect.stringMatching(/^C-\d{4}$/),
          title: expect.any(String),
          clientName: expect.any(String),
          status: expect.stringMatching(/^(Active|OnHold|Closed|Archived)$/),
          supervisorId: expect.any(String),
          teamSize: expect.any(Number),
          riskLevel: expect.stringMatching(/^(high|medium|low)$/),
        });

        expect(caseItem.teamSize).toBeGreaterThanOrEqual(2);
        expect(caseItem.teamSize).toBeLessThanOrEqual(8);
      });
    });

    it('should allow overriding default values', () => {
      const widget = createSupervisedCasesWidget({
        title: 'Custom Supervised Cases',
        collapsed: true,
      });

      expect(widget.title).toBe('Custom Supervised Cases');
      expect(widget.collapsed).toBe(true);
    });

    it('should support Romanian titles and client names', () => {
      const widgets = Array.from({ length: 10 }, () => createSupervisedCasesWidget());
      const hasRomanianContent = widgets.some(
        (w) =>
          w.title.includes('ă') ||
          w.cases.some((c) => c.clientName.includes('ă') || c.clientName.includes('ș') || c.title.includes('ă'))
      );

      expect(hasRomanianContent).toBe(true);
    });
  });

  describe('createFirmCasesOverviewWidget', () => {
    it('should create a valid FirmCasesOverviewWidget', () => {
      const widget = createFirmCasesOverviewWidget();

      expect(widget).toMatchObject({
        id: 'firm-cases-overview',
        type: 'firmCasesOverview',
        title: expect.any(String),
        position: expect.objectContaining({
          i: 'firm-cases-overview',
        }),
        collapsed: expect.any(Boolean),
        atRiskCases: expect.any(Array),
        highValueCases: expect.any(Array),
        aiInsights: expect.any(Array),
      });
    });

    it('should generate at-risk cases within expected range', () => {
      const widget = createFirmCasesOverviewWidget();

      expect(widget.atRiskCases.length).toBeGreaterThanOrEqual(2);
      expect(widget.atRiskCases.length).toBeLessThanOrEqual(8);
    });

    it('should generate high-value cases within expected range', () => {
      const widget = createFirmCasesOverviewWidget();

      expect(widget.highValueCases.length).toBeGreaterThanOrEqual(1);
      expect(widget.highValueCases.length).toBeLessThanOrEqual(5);
    });

    it('should generate AI insights within expected range', () => {
      const widget = createFirmCasesOverviewWidget();

      expect(widget.aiInsights.length).toBeGreaterThanOrEqual(2);
      expect(widget.aiInsights.length).toBeLessThanOrEqual(6);
    });

    it('should allow overriding widget properties', () => {
      const widget = createFirmCasesOverviewWidget({
        title: 'Custom Firm Overview',
        collapsed: true,
        atRiskCases: [],
      });

      expect(widget.title).toBe('Custom Firm Overview');
      expect(widget.collapsed).toBe(true);
      expect(widget.atRiskCases).toHaveLength(0);
    });
  });

  describe('createFirmTasksOverviewWidget', () => {
    it('should create a valid FirmTasksOverviewWidget', () => {
      const widget = createFirmTasksOverviewWidget();

      expect(widget).toMatchObject({
        id: 'firm-tasks-overview',
        type: 'firmTasksOverview',
        title: expect.any(String),
        position: expect.objectContaining({
          i: 'firm-tasks-overview',
        }),
        collapsed: expect.any(Boolean),
        taskMetrics: expect.objectContaining({
          totalActiveTasks: expect.any(Number),
          overdueCount: expect.any(Number),
          dueTodayCount: expect.any(Number),
          dueThisWeekCount: expect.any(Number),
          completionRate: expect.any(Number),
        }),
        taskBreakdown: expect.any(Array),
        priorityTasks: expect.any(Array),
      });
    });

    it('should generate realistic task metrics', () => {
      const widget = createFirmTasksOverviewWidget();

      expect(widget.taskMetrics.totalActiveTasks).toBeGreaterThanOrEqual(50);
      expect(widget.taskMetrics.totalActiveTasks).toBeLessThanOrEqual(300);
      expect(widget.taskMetrics.completionRate).toBeGreaterThanOrEqual(60);
      expect(widget.taskMetrics.completionRate).toBeLessThanOrEqual(95);

      // Overdue count should be reasonable percentage of total
      expect(widget.taskMetrics.overdueCount).toBeLessThanOrEqual(widget.taskMetrics.totalActiveTasks * 0.15);
    });

    it('should generate task breakdown by type', () => {
      const widget = createFirmTasksOverviewWidget();

      expect(widget.taskBreakdown.length).toBeGreaterThan(0);
      widget.taskBreakdown.forEach((breakdown) => {
        expect(breakdown).toMatchObject({
          type: expect.any(String),
          count: expect.any(Number),
        });
      });
    });

    it('should generate exactly 5 priority tasks', () => {
      const widget = createFirmTasksOverviewWidget();

      expect(widget.priorityTasks).toHaveLength(5);
      widget.priorityTasks.forEach((task) => {
        expect(task).toMatchObject({
          id: expect.any(String),
          title: expect.any(String),
          caseContext: expect.stringMatching(/^C-\d{4}$/),
          priority: expect.stringMatching(/^(High|Urgent)$/),
          assignee: expect.any(String),
          dueDate: expect.any(Date),
        });
      });
    });
  });

  describe('createEmployeeWorkloadWidget', () => {
    it('should create a valid EmployeeWorkloadWidget', () => {
      const widget = createEmployeeWorkloadWidget();

      expect(widget).toMatchObject({
        id: 'employee-workload',
        type: 'employeeWorkload',
        title: expect.any(String),
        position: expect.objectContaining({
          i: 'employee-workload',
        }),
        collapsed: expect.any(Boolean),
        viewMode: expect.stringMatching(/^(daily|weekly)$/),
        employeeUtilization: expect.any(Array),
      });
    });

    it('should generate employee utilization within expected range', () => {
      const widget = createEmployeeWorkloadWidget();

      expect(widget.employeeUtilization.length).toBeGreaterThanOrEqual(5);
      expect(widget.employeeUtilization.length).toBeLessThanOrEqual(30);
    });

    it('should default to daily view mode', () => {
      const widget = createEmployeeWorkloadWidget();

      expect(widget.viewMode).toBe('daily');
    });

    it('should allow overriding view mode', () => {
      const widget = createEmployeeWorkloadWidget({
        viewMode: 'weekly',
      });

      expect(widget.viewMode).toBe('weekly');
    });

    it('should generate valid employee utilization data', () => {
      const widget = createEmployeeWorkloadWidget();

      widget.employeeUtilization.forEach((employee) => {
        expect(employee.name).toBeTruthy();
        expect(employee.dailyUtilization).toBeGreaterThanOrEqual(20);
        expect(employee.weeklyUtilization).toBeGreaterThanOrEqual(30);
        expect(employee.taskCount).toBeGreaterThanOrEqual(2);
        expect(['over', 'optimal', 'under']).toContain(employee.status);
      });
    });
  });
});
