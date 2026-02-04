/** @type {import('jest').Config} */
const config = {
  clearMocks: true, // resets mocks
  collectCoverage: true, // coverage tracking
  coverageDirectory: "coverage", // coverage directory
  transform: {}, 
  extensionsToTreatAsEsm: ['.ts'], // to test extensions, not that we use ts
  verbose: true, // detailed test output
};

export default config;
