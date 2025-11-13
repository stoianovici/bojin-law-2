require('@testing-library/jest-dom');

// Add jest-axe custom matcher for accessibility testing
const { toHaveNoViolations } = require('jest-axe');
expect.extend(toHaveNoViolations);

// Add custom matchers or global test setup here
