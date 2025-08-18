// jest.config.ts
export default {
  testEnvironment: "jsdom",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
    // Map CSS imports to a manual mock to avoid errors when importing styles in tests
    "\\.(css|scss|sass)$": "<rootDir>/__mocks__/styleMock.js",
  },
  transform: {
    "^.+\\.tsx?$": "ts-jest",
  },
  testPathIgnorePatterns: ["/node_modules/", "/.next/"],
};
