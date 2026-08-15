/** @type {import('eslint').Linter.Config} */
module.exports = {
    root: true,
    parser: '@typescript-eslint/parser',
    plugins: ['@typescript-eslint'],
    extends: ['eslint:recommended', 'plugin:@typescript-eslint/recommended'],
    env: { node: true, es2022: true },
    parserOptions: { ecmaVersion: 'latest', sourceType: 'module' },
    ignorePatterns: ['node_modules', 'dist', 'coverage', '.eslintrc.cjs'],
    rules: {
        '@typescript-eslint/no-explicit-any': 'off',
        '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
        '@typescript-eslint/no-require-imports': 'off',
        'no-empty': 'off',
        'no-constant-condition': 'off',
        'no-useless-escape': 'off',
        'no-control-regex': 'off',
        'no-case-declarations': 'off',
    },
};