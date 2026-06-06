import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

// Vitest config for the web app's unit tests. The react plugin lets us
// render client components/hooks via @testing-library/react; jsdom gives
// them a DOM. `globals: true` exposes describe/it/expect without imports.
// The `@/*` alias mirrors tsconfig so test files resolve app modules the
// same way the Next build does.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
});
