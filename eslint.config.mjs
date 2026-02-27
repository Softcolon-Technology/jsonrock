import { config as baseConfig } from "@repo/eslint-config/base";
import { nextJsOnlyConfig } from "@repo/eslint-config/next";

// Explicitly include server, web, and packages so base config applies when ESLint runs from any cwd
const sourceFiles = [
  "apps/server/**/*.{js,ts,mjs,cjs}",
  "apps/web/**/*.{js,jsx,ts,tsx,mjs,cjs}",
  "packages/**/*.{js,jsx,ts,tsx,mjs,cjs}",
];

/** @type {import("eslint").Linter.FlatConfig[]} */
export default [
  // Base rules for server + web + packages (explicit files so server is always included)
  ...baseConfig.map((cfg) =>
    cfg.ignores ? cfg : { ...cfg, files: sourceFiles }
  ),
  // Next.js/React rules only for web app
  ...nextJsOnlyConfig.map((cfg) => ({
    ...cfg,
    files: ["apps/web/**/*.{js,jsx,ts,tsx,mdx}"],
  })),
  {
    ignores: ["**/dist/**", "**/.next/**", "**/node_modules/**"],
  },
];
