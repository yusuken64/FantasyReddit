const fs = require('node:fs/promises');
const path = require('node:path');
const { createDatabase } = require('./database');
async function migrate(db) {
  await db.transaction(async q => {
    await q("DECLARE @r int; EXEC @r = sp_getapplock @Resource='fantasy-migrations', @LockMode='Exclusive', @LockOwner='Transaction', @LockTimeout=30000; IF @r < 0 THROW 50000, 'Migration lock unavailable', 1;");
    await q("IF OBJECT_ID('schema_migrations') IS NULL CREATE TABLE schema_migrations(version int NOT NULL PRIMARY KEY, applied_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME())");
    for (const [version, file] of [[1, '001_foundation.sql'], [2, '002_momentum.sql']]) {
      if (!(await q('SELECT version FROM schema_migrations WHERE version=@version', { version })).length) {
        await q(await fs.readFile(path.join(__dirname, 'migrations', file), 'utf8'));
        await q('INSERT INTO schema_migrations(version) VALUES(@version)', { version });
      }
    }
  });
}
if (require.main === module) {
  let db;
  Promise.resolve().then(async () => { db = createDatabase(process.env.DB_CONNECTION_STRING); await db.connect(); await migrate(db); console.log('Migrations applied'); })
    .catch(() => { console.error('Migration failed; inspect database configuration and schema using an authorized console.'); process.exitCode = 1; }).finally(() => db?.close());
}
module.exports = { migrate };
