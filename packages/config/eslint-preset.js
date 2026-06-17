/**
 * Shared ESLint flat-config preset. Consume from a workspace's eslint.config.js:
 *   import preset from '@contractor-bidder/config/eslint';
 *   export default preset;
 */
const tseslint = require('typescript-eslint');

module.exports = tseslint.config(
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    ignores: ['dist/**', '.next/**', 'node_modules/**', 'build/**'],
  },
);
