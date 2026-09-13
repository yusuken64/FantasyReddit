// Corrected-behavior replacements for the original vulnerable-behavior probes.
// SQL concurrency probes run separately with npm run test:integration.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const result = spawnSync(process.execPath, ['--test', 'server/test/domain.test.js', 'server/test/http.test.js'], { cwd: path.resolve(__dirname, '..'), stdio: 'inherit' });
process.exitCode = result.status ?? 1;
