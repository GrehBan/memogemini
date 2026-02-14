/** @type {import('ts-jest').JestConfigWithTsJest} */
export default {
  preset: 'ts-jest/presets/default-esm', // Use ESM preset
  testEnvironment: 'node',
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1', // Still needed for local relative imports
  },
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        useESM: true,
        isolatedModules: true, // Fix warning
      },
    ],
  },
  transformIgnorePatterns: [
    "node_modules/(?!(zod)/)" // Ensure zod is transformed if needed (unlikely for CJS build but safe)
  ]
};
