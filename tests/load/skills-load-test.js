/**
 * Skills Load Test Configuration
 * Story 2.14 - Task 1: Load Testing
 * AC#4: <5s response time at p95
 * AC#6: <2% error rate
 *
 * Tests system performance under load:
 * - 100 concurrent users
 * - 1000 requests/minute sustained
 * - Mixed skill types (contract analysis, drafting, research, compliance)
 *
 * Usage:
 *   npm run test:load -- tests/load/skills-load-test.js
 */

module.exports = {
  config: {
    target: process.env.TARGET_URL || 'http://localhost:3000',
    phases: [
      // Warm-up phase: Start with low load
      {
        duration: 60,
        arrivalRate: 10,
        name: 'Warm-up',
      },

      // Ramp-up to target load
      {
        duration: 300,
        arrivalRate: 10,
        rampTo: 100,
        name: 'Ramp-up',
      },

      // Sustained load (AC#4: 1000 requests/minute = ~16.7 req/sec)
      {
        duration: 600,
        arrivalRate: 100,
        name: 'Sustained load',
      },

      // Spike test: Test resilience under sudden load
      {
        duration: 60,
        arrivalRate: 200,
        name: 'Spike test',
      },

      // Cool-down: Monitor recovery
      {
        duration: 120,
        arrivalRate: 10,
        name: 'Cool-down',
      },
    ],
    processor: './tests/load/processors/skills-processor.js',
    http: {
      timeout: 30000, // 30 seconds timeout
    },
    // Enable detailed metrics
    plugins: {
      metrics: {
        enabled: true,
      },
    },
  },

  scenarios: [
    {
      name: 'Contract Analysis with Skills',
      weight: 40,
      flow: [
        {
          post: {
            url: '/api/ai/analyze',
            headers: {
              'Content-Type': 'application/json',
            },
            json: {
              type: 'contract_analysis',
              document: {
                content: 'Contract pentru prestări servicii profesionale între...',
                language: 'ro',
              },
              options: {
                enableSkills: true,
              },
            },
            capture: [
              {
                json: '$.executionTime',
                as: 'executionTime',
              },
              {
                json: '$.tokenUsage.total',
                as: 'tokensUsed',
              },
              {
                json: '$.cost',
                as: 'requestCost',
              },
            ],
          },
        },
        {
          think: 2, // 2 seconds between requests
        },
      ],
    },

    {
      name: 'Document Drafting with Skills',
      weight: 30,
      flow: [
        {
          post: {
            url: '/api/ai/draft',
            headers: {
              'Content-Type': 'application/json',
            },
            json: {
              type: 'document_drafting',
              template: 'contract_servicii_ro',
              variables: {
                NUME_CLIENT: 'SC Test SRL',
                NUME_FURNIZOR: 'SC Legal SRL',
                DATA: '2025-01-15',
              },
              options: {
                enableSkills: true,
              },
            },
            capture: [
              {
                json: '$.executionTime',
                as: 'executionTime',
              },
              {
                json: '$.tokenUsage.total',
                as: 'tokensUsed',
              },
              {
                json: '$.cost',
                as: 'requestCost',
              },
            ],
          },
        },
        {
          think: 2,
        },
      ],
    },

    {
      name: 'Legal Research with Skills',
      weight: 20,
      flow: [
        {
          post: {
            url: '/api/ai/research',
            headers: {
              'Content-Type': 'application/json',
            },
            json: {
              type: 'legal_research',
              query: 'Legislație română privind contractele de prestări servicii',
              jurisdiction: 'RO',
              options: {
                enableSkills: true,
              },
            },
            capture: [
              {
                json: '$.executionTime',
                as: 'executionTime',
              },
              {
                json: '$.tokenUsage.total',
                as: 'tokensUsed',
              },
              {
                json: '$.cost',
                as: 'requestCost',
              },
            ],
          },
        },
        {
          think: 3,
        },
      ],
    },

    {
      name: 'Compliance Check with Skills',
      weight: 10,
      flow: [
        {
          post: {
            url: '/api/ai/compliance',
            headers: {
              'Content-Type': 'application/json',
            },
            json: {
              type: 'compliance_check',
              document: {
                content: 'Contract de muncă pentru...',
                type: 'employment_contract',
              },
              regulations: ['Codul Muncii', 'GDPR'],
              options: {
                enableSkills: true,
              },
            },
            capture: [
              {
                json: '$.executionTime',
                as: 'executionTime',
              },
              {
                json: '$.tokenUsage.total',
                as: 'tokensUsed',
              },
              {
                json: '$.cost',
                as: 'requestCost',
              },
            ],
          },
        },
        {
          think: 2,
        },
      ],
    },
  ],

  // Performance assertions (AC#4, AC#6)
  expectations: {
    // AC#4: <5s response time at p95
    'http.response_time.p95': {
      max: 5000,
    },
    'http.response_time.p99': {
      max: 10000,
    },
    // AC#6: <2% error rate
    'http.request_rate': {
      min: 50, // Minimum requests per second
    },
    'http.codes.200': {
      min: 98, // At least 98% success rate
    },
  },
};
