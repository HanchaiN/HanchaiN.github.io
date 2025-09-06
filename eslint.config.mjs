import { includeIgnoreFile } from "@eslint/compat";
import { FlatCompat } from "@eslint/eslintrc";
import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const gitignorePath = path.resolve(__dirname, ".gitignore");
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

export default [
  includeIgnoreFile(gitignorePath),
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",

      parserOptions: {
        lib: ["esnext"],
      },
    },
  },
  ...compat
    .extends("eslint:recommended", "plugin:@typescript-eslint/recommended")
    .map((config) => ({
      ...config,
      files: ["**/*.ts", "**/*.tsx"],
    })),
  {
    files: ["**/*.ts", "**/*.tsx"],

    languageOptions: {
      parser: tsParser,
    },

    rules: {
      "@typescript-eslint/no-loss-of-precision": "warn",
      "@typescript-eslint/ban-ts-comment": "warn",
    },
  },
];
