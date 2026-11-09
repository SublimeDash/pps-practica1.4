module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.cjs'],
  testTimeout: 20000,
  collectCoverageFrom: ['src/validation.js']
};