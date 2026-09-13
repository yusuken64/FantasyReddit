const sql = require('mssql');
function createDatabase(connectionString, { allowSystemDatabase = false } = {}) {
  const pool = new sql.ConnectionPool(connectionString);
  if (!allowSystemDatabase && (!pool.config.database || ['master','model','msdb','tempdb'].includes(pool.config.database.toLowerCase()))) throw new Error('A separately provisioned application database is required.');
  let errors = 0;
  pool.on('error', () => { errors++; });
  async function query(text, params = {}, target = pool) {
    const request = target.request();
    for (const [key, value] of Object.entries(params)) {
      if (typeof value === 'bigint') request.input(key, sql.BigInt, value.toString());
      else if (value instanceof Date) request.input(key, sql.DateTime2, value);
      else request.input(key, value);
    }
    try { return (await request.query(text)).recordset || []; }
    catch (error) { errors++; throw error; }
  }
  async function transaction(work, attempt = 0) {
    const tx = new sql.Transaction(pool);
    await tx.begin(sql.ISOLATION_LEVEL.READ_COMMITTED);
    try { const result = await work((text, params) => query(text, params, tx)); await tx.commit(); return result; }
    catch (error) {
      try { await tx.rollback(); } catch { /* Preserve original failure. */ }
      // SQL has rolled back a deadlock victim in full; retry only that known rollback.
      if (error.number === 1205 && attempt < 3) {
        await new Promise(resolve => setTimeout(resolve, 25 * 2 ** attempt + Math.random() * 25));
        return transaction(work, attempt + 1);
      }
      throw error;
    }
  }
  return { pool, query, transaction, connect: () => pool.connect(), close: () => pool.close(), get errors() { return errors; },
    async ready() { return (await query('SELECT version FROM schema_migrations WHERE version = 1')).length === 1; } };
}
module.exports = { createDatabase };
