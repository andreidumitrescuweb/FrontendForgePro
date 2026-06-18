/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  moduleNameMapper: {
    '^@forge/shared$': '<rootDir>/../../packages/shared/src',
  },
  setupFiles: ['<rootDir>/tests/setup-env.ts'],
  forceExit: true,
  detectOpenHandles: false,
};
