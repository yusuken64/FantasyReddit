const js = require('@eslint/js');
const globals = require('globals');
module.exports = [{ ignores: ['**/node_modules/**', 'client/**', 'audit/**'] }, js.configs.recommended, { languageOptions: { globals: globals.node, sourceType: 'commonjs', ecmaVersion: 'latest' } }];
