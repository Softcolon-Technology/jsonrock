import customRules from "./commitlint-custom-rules.mjs";

export default {
  extends: ["@commitlint/config-conventional"],
  plugins: [
    {
      rules: customRules,
    },
  ],
  rules: {
    "type-enum": [
      2,
      "always",
      [
        "feat",
        "fix",
        "docs",
        "style",
        "refactor",
        "perf",
        "test",
        "build",
        "ci",
        "chore",
        "revert",
      ],
    ],
    "subject-case": [2, "always", "sentence-case"],
    "header-pattern": [
      2,
      "always",
      /^(?:(?:feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert): JSONROCK-\d+ .+|Merge branch.+)$/,
    ],
  },
};


