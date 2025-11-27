/**
 * MSW GraphQL Handlers for Integration Tests
 * Story 2.8: Case CRUD Operations UI - Task 20
 *
 * Using MSW v2.x (ESM) with Jest ESM mode
 */

import { graphql, HttpResponse } from 'msw';

// Mock data
// Default rates for firm
const mockDefaultRates = {
  partnerRate: 50000, // $500 in cents
  associateRate: 30000, // $300 in cents
  paralegalRate: 15000, // $150 in cents
};

const mockCases: Array<{
  id: string;
  caseNumber: string;
  title: string;
  description: string;
  status: string;
  type: string;
  openedDate: string;
  closedDate: string | null;
  value: number;
  metadata: Record<string, unknown>;
  billingType?: 'Hourly' | 'Fixed';
  fixedAmount?: number | null;
  customRates?: {
    partnerRate?: number;
    associateRate?: number;
    paralegalRate?: number;
  } | null;
  rateHistory?: Array<{
    id: string;
    changedAt: string;
    changedBy: { id: string; firstName: string; lastName: string };
    rateType: string;
    oldRate: number;
    newRate: number;
  }>;
  client: {
    id: string;
    name: string;
    contactInfo: string;
    address: string;
  };
  teamMembers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    role: string;
  }>;
  actors: Array<{
    id: string;
    role: string;
    name: string;
    organization: string;
    email: string;
    phone: string;
    address: string;
    notes: string;
  }>;
}> = [
  {
    id: 'case-1',
    caseNumber: 'CASE-001',
    title: 'Contract Dispute Case',
    description: 'Client contract dispute over terms',
    status: 'Active',
    type: 'Litigation',
    openedDate: '2025-01-15T10:00:00Z',
    closedDate: null,
    value: 50000,
    metadata: {},
    billingType: 'Hourly',
    fixedAmount: null,
    customRates: null, // Uses default rates
    rateHistory: [],
    client: {
      id: 'client-1',
      name: 'Acme Corporation',
      contactInfo: 'contact@acme.com',
      address: '123 Main St',
    },
    teamMembers: [
      {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Partner',
        role: 'Partner',
      },
      {
        id: 'user-2',
        firstName: 'Jane',
        lastName: 'Associate',
        role: 'Associate',
      },
    ],
    actors: [
      {
        id: 'actor-1',
        role: 'Client',
        name: 'John Doe',
        organization: 'Acme Corporation',
        email: 'john@acme.com',
        phone: '+1-555-0100',
        address: '123 Main St',
        notes: 'Primary contact',
      },
    ],
  },
  {
    id: 'case-2',
    caseNumber: 'CASE-002',
    title: 'Real Estate Transaction',
    description: 'Property acquisition legal support',
    status: 'OnHold',
    type: 'Contract',
    openedDate: '2025-02-01T10:00:00Z',
    closedDate: null,
    value: 100000,
    metadata: {},
    billingType: 'Fixed',
    fixedAmount: 75000, // $750 in cents
    customRates: null,
    rateHistory: [],
    client: {
      id: 'client-2',
      name: 'Smith Holdings',
      contactInfo: 'info@smith.com',
      address: '456 Oak Ave',
    },
    teamMembers: [
      {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Partner',
        role: 'Partner',
      },
    ],
    actors: [],
  },
  // Billing test cases
  {
    id: 'case-billing-1',
    caseNumber: 'CASE-BILLING-001',
    title: 'Billing Test Case - Hourly',
    description: 'Test case for billing workflows',
    status: 'Active',
    type: 'Litigation',
    openedDate: '2025-03-01T10:00:00Z',
    closedDate: null,
    value: 50000,
    metadata: {},
    billingType: 'Hourly',
    fixedAmount: null,
    customRates: null,
    rateHistory: [
      {
        id: 'history-1',
        changedAt: '2025-03-05T14:30:00Z',
        changedBy: { id: 'user-1', firstName: 'John', lastName: 'Partner' },
        rateType: 'partner',
        oldRate: 50000,
        newRate: 55000,
      },
    ],
    client: {
      id: 'client-1',
      name: 'Test Client',
      contactInfo: 'test@client.com',
      address: '123 Test St',
    },
    teamMembers: [
      {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Partner',
        role: 'Partner',
      },
    ],
    actors: [],
  },
  {
    id: 'case-fixed-fee-1',
    caseNumber: 'CASE-FIXED-001',
    title: 'Fixed Fee Test Case',
    description: 'Test case with positive variance',
    status: 'Active',
    type: 'Contract',
    openedDate: '2025-03-01T10:00:00Z',
    closedDate: null,
    value: 30000,
    metadata: {},
    billingType: 'Fixed',
    fixedAmount: 3000000, // $30,000
    customRates: null,
    rateHistory: [],
    client: {
      id: 'client-3',
      name: 'Fixed Fee Client',
      contactInfo: 'fixed@client.com',
      address: '456 Fixed Ave',
    },
    teamMembers: [
      {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Partner',
        role: 'Partner',
      },
    ],
    actors: [],
  },
  {
    id: 'case-hourly-1',
    caseNumber: 'CASE-HOURLY-001',
    title: 'Hourly Test Case',
    description: 'Test case for hourly billing',
    status: 'Active',
    type: 'Litigation',
    openedDate: '2025-03-01T10:00:00Z',
    closedDate: null,
    value: 50000,
    metadata: {},
    billingType: 'Hourly',
    fixedAmount: null,
    customRates: null,
    rateHistory: [],
    client: {
      id: 'client-4',
      name: 'Hourly Client',
      contactInfo: 'hourly@client.com',
      address: '789 Hourly Rd',
    },
    teamMembers: [
      {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Partner',
        role: 'Partner',
      },
    ],
    actors: [],
  },
  {
    id: 'case-billing-custom-rates',
    caseNumber: 'CASE-CUSTOM-001',
    title: 'Custom Rates Test Case',
    description: 'Test case with custom rates',
    status: 'Active',
    type: 'Contract',
    openedDate: '2025-03-01T10:00:00Z',
    closedDate: null,
    value: 40000,
    metadata: {},
    billingType: 'Hourly',
    fixedAmount: null,
    customRates: {
      partnerRate: 60000,
      associateRate: 35000,
      paralegalRate: 17500,
    },
    rateHistory: [],
    client: {
      id: 'client-5',
      name: 'Custom Rates Client',
      contactInfo: 'custom@client.com',
      address: '321 Custom Ln',
    },
    teamMembers: [
      {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Partner',
        role: 'Partner',
      },
    ],
    actors: [],
  },
  {
    id: 'case-fixed-fee-positive-variance',
    caseNumber: 'CASE-FIXED-POSITIVE',
    title: 'Fixed Fee - Positive Variance',
    description: 'Fixed fee case earning more than hourly',
    status: 'Active',
    type: 'Contract',
    openedDate: '2025-03-01T10:00:00Z',
    closedDate: null,
    value: 30000,
    metadata: {},
    billingType: 'Fixed',
    fixedAmount: 3000000, // $30,000
    customRates: null,
    rateHistory: [],
    client: {
      id: 'client-6',
      name: 'Positive Variance Client',
      contactInfo: 'positive@client.com',
      address: '111 Profit St',
    },
    teamMembers: [
      {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Partner',
        role: 'Partner',
      },
    ],
    actors: [],
  },
  {
    id: 'case-fixed-fee-no-time',
    caseNumber: 'CASE-FIXED-NO-TIME',
    title: 'Fixed Fee - No Time Entries',
    description: 'Fixed fee case with no time tracked yet',
    status: 'Active',
    type: 'Contract',
    openedDate: '2025-03-15T10:00:00Z',
    closedDate: null,
    value: 20000,
    metadata: {},
    billingType: 'Fixed',
    fixedAmount: 2000000, // $20,000
    customRates: null,
    rateHistory: [],
    client: {
      id: 'client-7',
      name: 'No Time Client',
      contactInfo: 'notime@client.com',
      address: '222 Empty Ave',
    },
    teamMembers: [
      {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Partner',
        role: 'Partner',
      },
    ],
    actors: [],
  },
  {
    id: 'case-fixed-fee-zero-rates',
    caseNumber: 'CASE-FIXED-ZERO-RATES',
    title: 'Fixed Fee - Zero Rates',
    description: 'Fixed fee case with zero rates (edge case)',
    status: 'Active',
    type: 'Contract',
    openedDate: '2025-03-01T10:00:00Z',
    closedDate: null,
    value: 25000,
    metadata: {},
    billingType: 'Fixed',
    fixedAmount: 2500000, // $25,000
    customRates: {
      partnerRate: 0,
      associateRate: 0,
      paralegalRate: 0,
    },
    rateHistory: [],
    client: {
      id: 'client-8',
      name: 'Zero Rates Client',
      contactInfo: 'zero@client.com',
      address: '333 Zero Rd',
    },
    teamMembers: [
      {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Partner',
        role: 'Partner',
      },
    ],
    actors: [],
  },
];

export const graphqlHandlers = [
  // Query: cases
  graphql.query('GetCases', ({ variables }) => {
    let filteredCases = [...mockCases];

    // Apply status filter
    if (variables.status) {
      filteredCases = filteredCases.filter(c => c.status === variables.status);
    }

    // Apply assignedToMe filter
    if (variables.assignedToMe) {
      // For testing, return all cases when assignedToMe is true
      // In real implementation, filter by user context
    }

    return HttpResponse.json({
      data: {
        cases: filteredCases,
      },
    });
  }),

  // Query: case
  graphql.query('GetCase', ({ variables }) => {
    const caseData = mockCases.find(c => c.id === variables.id);

    if (!caseData) {
      return HttpResponse.json({
        errors: [
          {
            message: 'Case not found',
            extensions: {
              code: 'NOT_FOUND',
            },
          },
        ],
      });
    }

    return HttpResponse.json({
      data: {
        case: caseData,
      },
    });
  }),

  // Query: searchCases
  graphql.query('SearchCases', ({ variables }) => {
    const query = variables.query.toLowerCase();
    const results = mockCases.filter(
      c =>
        c.title.toLowerCase().includes(query) ||
        c.caseNumber.toLowerCase().includes(query) ||
        c.description.toLowerCase().includes(query) ||
        c.client.name.toLowerCase().includes(query)
    );

    return HttpResponse.json({
      data: {
        searchCases: results.slice(0, variables.limit || 10),
      },
    });
  }),

  // Mutation: createCase
  graphql.mutation('CreateCase', ({ variables }) => {
    const newCase = {
      id: `case-${Date.now()}`,
      caseNumber: `CASE-${String(mockCases.length + 1).padStart(3, '0')}`,
      title: variables.input.title,
      description: variables.input.description,
      status: 'Active',
      type: variables.input.type,
      openedDate: new Date().toISOString(),
      closedDate: null,
      value: variables.input.value || null,
      metadata: variables.input.metadata || {},
      client: {
        id: variables.input.clientId,
        name: 'Mock Client',
        contactInfo: 'mock@client.com',
        address: 'Mock Address',
      },
      teamMembers: [
        {
          id: 'user-1',
          firstName: 'John',
          lastName: 'Partner',
          role: 'Partner',
        },
      ],
      actors: [],
    };

    mockCases.push(newCase);

    return HttpResponse.json({
      data: {
        createCase: newCase,
      },
    });
  }),

  // Mutation: updateCase
  graphql.mutation('UpdateCase', ({ variables }) => {
    const caseIndex = mockCases.findIndex(c => c.id === variables.id);

    if (caseIndex === -1) {
      return HttpResponse.json({
        errors: [
          {
            message: 'Case not found',
            extensions: {
              code: 'NOT_FOUND',
            },
          },
        ],
      });
    }

    const updatedCase = {
      ...mockCases[caseIndex],
      ...variables.input,
    };

    mockCases[caseIndex] = updatedCase;

    return HttpResponse.json({
      data: {
        updateCase: updatedCase,
      },
    });
  }),

  // Mutation: archiveCase
  graphql.mutation('ArchiveCase', ({ variables }) => {
    const caseIndex = mockCases.findIndex(c => c.id === variables.id);

    if (caseIndex === -1) {
      return HttpResponse.json({
        errors: [
          {
            message: 'Case not found',
            extensions: {
              code: 'NOT_FOUND',
            },
          },
        ],
      });
    }

    const caseData = mockCases[caseIndex];

    // Check if case is closed
    if (caseData.status !== 'Closed') {
      return HttpResponse.json({
        errors: [
          {
            message: 'Only closed cases can be archived',
            extensions: {
              code: 'BAD_USER_INPUT',
            },
          },
        ],
      });
    }

    const archivedCase = {
      ...caseData,
      status: 'Archived',
      closedDate: caseData.closedDate || new Date().toISOString(),
    };

    mockCases[caseIndex] = archivedCase;

    return HttpResponse.json({
      data: {
        archiveCase: archivedCase,
      },
    });
  }),

  // Mutation: assignTeam
  graphql.mutation('AssignTeam', ({ variables }) => {
    const caseTeam = {
      id: `team-${Date.now()}`,
      caseId: variables.input.caseId,
      userId: variables.input.userId,
      role: variables.input.role,
      assignedAt: new Date().toISOString(),
    };

    return HttpResponse.json({
      data: {
        assignTeam: caseTeam,
      },
    });
  }),

  // Mutation: removeTeamMember
  graphql.mutation('RemoveTeamMember', () => {
    return HttpResponse.json({
      data: {
        removeTeamMember: true,
      },
    });
  }),

  // Mutation: addCaseActor
  graphql.mutation('AddCaseActor', ({ variables }) => {
    const newActor = {
      id: `actor-${Date.now()}`,
      ...variables.input,
    };

    return HttpResponse.json({
      data: {
        addCaseActor: newActor,
      },
    });
  }),

  // Mutation: updateCaseActor
  graphql.mutation('UpdateCaseActor', ({ variables }) => {
    const updatedActor = {
      id: variables.id,
      ...variables.input,
    };

    return HttpResponse.json({
      data: {
        updateCaseActor: updatedActor,
      },
    });
  }),

  // Mutation: removeCaseActor
  graphql.mutation('RemoveCaseActor', () => {
    return HttpResponse.json({
      data: {
        removeCaseActor: true,
      },
    });
  }),

  // Billing & Rate Management Queries and Mutations

  // Query: defaultRates
  graphql.query('GetDefaultRates', () => {
    return HttpResponse.json({
      data: {
        defaultRates: mockDefaultRates,
      },
    });
  }),

  // Mutation: updateDefaultRates
  graphql.mutation('UpdateDefaultRates', ({ variables }) => {
    const { partnerRate, associateRate, paralegalRate } = variables.input;

    // Validate positive rates
    if (partnerRate <= 0 || associateRate <= 0 || paralegalRate <= 0) {
      return HttpResponse.json({
        errors: [
          {
            message: 'Rates must be greater than 0',
            extensions: {
              code: 'BAD_USER_INPUT',
            },
          },
        ],
      });
    }

    // Update mock default rates
    mockDefaultRates.partnerRate = partnerRate;
    mockDefaultRates.associateRate = associateRate;
    mockDefaultRates.paralegalRate = paralegalRate;

    return HttpResponse.json({
      data: {
        updateDefaultRates: mockDefaultRates,
      },
    });
  }),

  // Query: caseRateHistory
  graphql.query('GetCaseRateHistory', ({ variables }) => {
    const caseData = mockCases.find(c => c.id === variables.caseId);

    if (!caseData) {
      return HttpResponse.json({
        errors: [
          {
            message: 'Case not found',
            extensions: {
              code: 'NOT_FOUND',
            },
          },
        ],
      });
    }

    return HttpResponse.json({
      data: {
        case: {
          id: caseData.id,
          rateHistory: caseData.rateHistory || [],
        },
      },
    });
  }),

  // Query: caseRevenueKPI
  graphql.query('GetCaseRevenueKPI', ({ variables }) => {
    const caseData = mockCases.find(c => c.id === variables.caseId);

    if (!caseData) {
      return HttpResponse.json({
        errors: [
          {
            message: 'Case not found',
            extensions: {
              code: 'NOT_FOUND',
            },
          },
        ],
      });
    }

    // Only return KPI for Fixed Fee cases
    if (caseData.billingType !== 'Fixed' || !caseData.fixedAmount) {
      return HttpResponse.json({
        data: {
          caseRevenueKPI: null,
        },
      });
    }

    // Mock KPI calculation
    let kpiData: any = {
      caseId: caseData.id,
      billingType: 'FIXED',
      actualRevenue: caseData.fixedAmount / 100, // Convert cents to dollars
      projectedRevenue: 0,
      variance: 0,
      variancePercent: 0,
    };

    // Different scenarios based on case ID
    if (caseData.id === 'case-fixed-fee-1' || caseData.id === 'case-fixed-fee-positive-variance') {
      // Positive variance: Fixed $30k, Projected $25k hourly
      kpiData.projectedRevenue = 25000;
      kpiData.variance = 5000;
      kpiData.variancePercent = 20;
    } else if (caseData.id === 'case-fixed-fee-no-time') {
      // No time entries
      kpiData = null; // Return null to indicate cannot calculate
    } else if (caseData.id === 'case-fixed-fee-zero-rates') {
      // Zero rates
      kpiData = null; // Cannot calculate with zero rates
    }

    return HttpResponse.json({
      data: {
        caseRevenueKPI: kpiData,
      },
    });
  }),

  // Query: firmRevenueKPIs
  graphql.query('GetFirmRevenueKPIs', () => {
    // Mock firm-wide KPI data
    const kpis = [
      {
        caseId: 'case-fixed-fee-1',
        caseNumber: 'CASE-FIXED-001',
        billingType: 'FIXED',
        actualRevenue: 30000,
        projectedRevenue: 25000,
        variance: 5000,
        variancePercent: 20,
      },
      {
        caseId: 'case-fixed-fee-negative',
        caseNumber: 'CASE-FIXED-NEG',
        billingType: 'FIXED',
        actualRevenue: 20000,
        projectedRevenue: 23000,
        variance: -3000,
        variancePercent: -13.04,
      },
    ];

    return HttpResponse.json({
      data: {
        firmRevenueKPIs: {
          totalFixedFeeCases: 5,
          totalHourlyCases: 3,
          averageVariance: 1000,
          topPerformingCases: [kpis[0]],
          underperformingCases: [kpis[1]],
        },
      },
    });
  }),
];
