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
  },
});
