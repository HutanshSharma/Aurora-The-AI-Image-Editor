import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist', 'env', 'venv', '.venv']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs['recommended-latest'],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // Unused catch bindings (e.g. `catch (error) {}`) are idiomatic and not
      // bugs; don't flag them. Still flag genuinely unused vars/imports.
      // Capitalized names (vars AND args, e.g. a polymorphic `as: Tag` prop or
      // a `<motion.div>` import) are treated as used: this flat config has no
      // eslint-plugin-react, so JSX member/component usage isn't detected.
      'no-unused-vars': [
        'error',
        {
          varsIgnorePattern: '^[A-Z_]',
          argsIgnorePattern: '^[A-Z_]',
          caughtErrors: 'none',
        },
      ],
    },
  },
])
