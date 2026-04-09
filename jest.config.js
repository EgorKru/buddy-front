/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  setupFiles: ['<rootDir>/jest.polyfills.js'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  moduleNameMapper: {
    '^@/shared/(.*)$': '<rootDir>/src/shared/$1',
    '^@/entities/(.*)$': '<rootDir>/src/entities/$1',
    '^@/features/(.*)$': '<rootDir>/src/features/$1',
    '^@/widgets/(.*)$': '<rootDir>/src/widgets/$1',
    '^@/(.*)$': '<rootDir>/$1',
    '\\.module\\.css$': 'identity-obj-proxy',
  },
  testMatch: ['**/__tests__/**/*.test.js', '**/__tests__/**/*.test.jsx'],
  collectCoverageFrom: [
    'components/**/*.{js,jsx}',
    'hooks/**/*.js',
    'src/**/*.{js,jsx}',
    '!**/node_modules/**',
    '!**/.next/**',
  ],
  testPathIgnorePatterns: ['/node_modules/', '/.next/'],
  transform: {
    '^.+\\.(js|jsx)$': ['babel-jest', { configFile: './jest.babel.config.js' }],
  },
  transformIgnorePatterns: ['/node_modules/(?!(@testing-library)/)'],
};

module.exports = config;
