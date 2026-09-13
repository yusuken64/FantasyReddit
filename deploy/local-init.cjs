// Local Compose bootstrap only; not included in the production image.
const { createDatabase } = require('./server/database');
const { migrate } = require('./server/migrate');
const literal = value => String(value).replaceAll("'", "''");
async function main() {
  const connection = `Server=sql,1433;User Id=sa;Password=${process.env.LOCAL_SQL_PASSWORD};Encrypt=true;TrustServerCertificate=true`;
  const master = createDatabase(`${connection};Database=master`, { allowSystemDatabase: true });
  try {
    await master.connect();
    await master.query("IF DB_ID('FantasyRedditLocal') IS NULL CREATE DATABASE FantasyRedditLocal");
    await master.query(`IF SUSER_ID('fantasy_local_runtime') IS NULL CREATE LOGIN fantasy_local_runtime WITH PASSWORD='${literal(process.env.LOCAL_RUNTIME_PASSWORD)}'`);
  } finally { await master.close(); }
  const db = createDatabase(`${connection};Database=FantasyRedditLocal`);
  try {
    await db.connect();
    await migrate(db);
    await db.query(`IF USER_ID('fantasy_local_runtime') IS NULL CREATE USER fantasy_local_runtime FOR LOGIN fantasy_local_runtime;
      IF DATABASE_PRINCIPAL_ID('fantasy_runtime') IS NULL CREATE ROLE fantasy_runtime;
      GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dbo TO fantasy_runtime;
      DENY ALTER ON SCHEMA::dbo TO fantasy_runtime;
      DENY CREATE TABLE TO fantasy_runtime;
      DENY INSERT, UPDATE, DELETE ON dbo.schema_migrations TO fantasy_runtime;
      ALTER ROLE fantasy_runtime ADD MEMBER fantasy_local_runtime;`);
    console.log('Local database provisioned; migrations complete.');
  } finally { await db.close(); }
}
main().catch(() => { console.error('Local database initialization failed.'); process.exitCode = 1; });
