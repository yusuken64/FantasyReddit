const sql = require('mssql');

const nodeEnv = process.env.NODE_ENV || 'development';
console.log(`Running in ${nodeEnv} mode`);

const connectionString = process.env.DB_CONNECTION_STRING;
console.log(connectionString);

if (!connectionString) {
  console.error("❌ DB_CONNECTION_STRING not set in environment variables!");
  process.exit(1);
}

const config = new sql.ConnectionPool(connectionString).config;

let _pool;
let _poolConnect;

async function createTables(pool) {
  const transaction = new sql.Transaction(pool);
  await transaction.begin();

  try {
    const txRequest = transaction.request();

    // USERS
    await txRequest.query(`
        IF OBJECT_ID('users', 'U') IS NULL
        CREATE TABLE users (
          id BIGINT IDENTITY(1,1) PRIMARY KEY,
          username NVARCHAR(255) UNIQUE NOT NULL,
          reddit_id NVARCHAR(50) UNIQUE NULL,
          access_token NVARCHAR(MAX) NULL,
          refresh_token NVARCHAR(MAX) NULL,
          token_expiry DATETIME2 NULL,
          credits BIGINT DEFAULT 10000,
          totalScore BIGINT DEFAULT 0,
          created_at DATETIME2 DEFAULT SYSUTCDATETIME()
        )
      `);

    // HOLDINGS
    await txRequest.query(`
        IF OBJECT_ID('holdings', 'U') IS NULL
        CREATE TABLE holdings (
          id BIGINT IDENTITY(1,1) PRIMARY KEY,
          user_id BIGINT NOT NULL,
          stock_symbol NVARCHAR(10) NOT NULL,
          shares BIGINT NOT NULL DEFAULT 0,
          total_spent BIGINT NOT NULL DEFAULT 0,
          created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
          CONSTRAINT UQ_user_stock UNIQUE(user_id, stock_symbol),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

    // TRANSACTIONS
    await txRequest.query(`
        IF OBJECT_ID('transactions', 'U') IS NULL
        CREATE TABLE transactions (
          id BIGINT IDENTITY(1,1) PRIMARY KEY,
          user_id BIGINT NOT NULL,
          stock_symbol NVARCHAR(10) NOT NULL,
          action NVARCHAR(4) NOT NULL CHECK (action IN ('BUY', 'SELL')),
          shares BIGINT NOT NULL,
          price_per_share BIGINT NOT NULL,
          total_cost BIGINT NOT NULL,
          timestamp DATETIME2 DEFAULT SYSUTCDATETIME(),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

    // STOCK PRICE HISTORY
    await txRequest.query(`
        IF OBJECT_ID('stock_price_history', 'U') IS NULL
        CREATE TABLE stock_price_history (
          id BIGINT IDENTITY(1,1) PRIMARY KEY,
          stock_symbol NVARCHAR(10) NOT NULL,
          score BIGINT NOT NULL,
          price BIGINT NOT NULL,
          timestamp DATETIME2 DEFAULT SYSUTCDATETIME()
        )
      `);

    // PORTFOLIO VALUE HISTORY
    await txRequest.query(`
        IF OBJECT_ID('portfolio_value_history', 'U') IS NULL
        CREATE TABLE portfolio_value_history (
          id BIGINT IDENTITY(1,1) PRIMARY KEY,
          user_id BIGINT NOT NULL,
          portfolio_value BIGINT NOT NULL, -- total value of holdings
          credits BIGINT NOT NULL,         -- user’s available credits at snapshot time
          timestamp DATETIME2 DEFAULT SYSUTCDATETIME(),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

    //Options
    await txRequest.query(`
        IF OBJECT_ID('options', 'U') IS NULL
        CREATE TABLE options (
          id BIGINT IDENTITY(1,1) PRIMARY KEY,
          user_id BIGINT NOT NULL,
          stock_symbol NVARCHAR(10) NOT NULL,
          option_type NVARCHAR(4) NOT NULL CHECK (option_type IN ('CALL','PUT')),
          strike_price BIGINT NOT NULL,
          premium_paid BIGINT NOT NULL,
          quantity BIGINT NOT NULL DEFAULT 1,
          expires_at DATETIME2 NOT NULL,
          created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);

    // OPTION TRANSACTIONS / HISTORY
    await txRequest.query(`
        IF OBJECT_ID('option_transactions', 'U') IS NULL
        CREATE TABLE option_transactions (
          id BIGINT IDENTITY(1,1) PRIMARY KEY,
          user_id BIGINT NOT NULL,
          stock_symbol NVARCHAR(10) NOT NULL,
          option_type NVARCHAR(4) NOT NULL CHECK (option_type IN ('CALL','PUT')),
          strike_price BIGINT NOT NULL,
          premium_paid BIGINT NOT NULL,
          quantity BIGINT NOT NULL DEFAULT 1,
          payout BIGINT NOT NULL DEFAULT 0,       -- 0 if expired worthless
          action NVARCHAR(10) NOT NULL CHECK (action IN ('BUY','EXERCISE','EXPIRE')),
          timestamp DATETIME2 DEFAULT SYSUTCDATETIME(),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
      `);


    await transaction.commit();
  } catch (err) {
    await transaction.rollback();
    throw err;
  }

  const idxReq = pool.request();

  await idxReq.query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_holdings_user')
      CREATE INDEX IX_holdings_user ON holdings(user_id)
    `);

  await idxReq.query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_transactions_user')
      CREATE INDEX IX_transactions_user ON transactions(user_id)
    `);

  await idxReq.query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_transactions_symbol_time')
      CREATE INDEX IX_transactions_symbol_time ON transactions(stock_symbol, timestamp)
    `);

  await idxReq.query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_stock_price_history_symbol_time')
      CREATE INDEX IX_stock_price_history_symbol_time ON stock_price_history(stock_symbol, timestamp DESC)
    `);

  await idxReq.query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_portfolio_value_history_user_time')
      CREATE INDEX IX_portfolio_value_history_user_time ON portfolio_value_history(user_id, timestamp DESC);
    `);
    
  await idxReq.query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_options_expires')
      CREATE INDEX IX_options_expires ON options(expires_at);
    `);

  await idxReq.query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_options_user')
      CREATE INDEX IX_options_user ON options(user_id);
    `);

  await idxReq.query(`
      IF NOT EXISTS (SELECT * FROM sys.indexes WHERE name = 'IX_option_transactions_user_time')
      CREATE INDEX IX_option_transactions_user_time ON option_transactions(user_id, timestamp DESC);
    `);

}

async function init() {
  // Connect to master DB to create target DB if needed
  const masterConfig = { ...config, database: 'master' };
  const masterPool = new sql.ConnectionPool(masterConfig);
  await masterPool.connect();

  const createDbQuery = `
    IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'${config.database}')
    BEGIN
      CREATE DATABASE [${config.database}];
    END
  `;

  await masterPool.request().query(createDbQuery);
  await masterPool.close();

  // Now connect to the target DB and create tables/indexes
  _pool = new sql.ConnectionPool(config);
  _poolConnect = _pool.connect();

  console.log("before pool connect")
  await _poolConnect;
  console.log("after pool connect")
  await createTables(_pool);
}

module.exports = {
  sql,
  get pool() {
    if (!_pool) throw new Error('Database pool not initialized. Call init() first.');
    return _pool;
  },
  get poolConnect() {
    if (!_poolConnect) throw new Error('Database poolConnect not initialized. Call init() first.');
    return _poolConnect;
  },
  init
};