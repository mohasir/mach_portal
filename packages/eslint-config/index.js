import js from '@eslint/js';
import tseslint from 'typescript-eslint';

/** @type {import('typescript-eslint').Config} */
export const base = tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],
    },
  },
  {
    ignores: ['dist/**', '.next/**', 'node_modules/**'],
  },
);
