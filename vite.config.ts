/// <reference types="vitest/config" />
import react from "@vitejs/plugin-react";
import { viteSingleFile } from "vite-plugin-singlefile";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), viteSingleFile()],
  build: { target: "es2022" },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      // Test support, fixtures for local development and the browser entry point are not logic under test.
      exclude: ["src/**/*.test.{ts,tsx}", "src/test/**", "src/main.tsx", "src/data/factories.ts", "src/data/scenarios.ts", "src/**/*.d.ts"],
      reporter: ["text-summary", "text"],
      // Testing Decisions of the spec: >= 90 % in data and config modules, >= 80 % in the other logic.
      thresholds: {
        lines: 80,
        branches: 80,
        "src/data/**": { lines: 90, branches: 90 },
        "src/config/**": { lines: 90, branches: 90 },
      },
    },
  },
});
