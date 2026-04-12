/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '\\.(css|less|scss|sass)$': '<rootDir>/src/__tests__/components/__mocks__/styleMock.js',
    '^react-leaflet$': '<rootDir>/src/__tests__/components/__mocks__/react-leaflet.tsx',
    '^leaflet$': '<rootDir>/src/__tests__/components/__mocks__/leaflet.ts',
    '^recharts$': '<rootDir>/src/__tests__/components/__mocks__/recharts.tsx',
  },
  testMatch: [
    '<rootDir>/src/__tests__/**/*.test.ts',
    '<rootDir>/src/__tests__/**/*.test.tsx',
  ],
  setupFilesAfterEnv: [
    '<rootDir>/src/__tests__/components/setupComponentTests.ts',
  ],
  globals: {
    'ts-jest': {
      tsconfig: {
        jsx: 'react-jsx',
      },
    },
  },
};
