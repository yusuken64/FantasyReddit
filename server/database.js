const sql = require('mssql');

console.log(`Running in ${process.env.NODE_ENV || 'unknown'} mode`);
const isLocal = process.env.NODE_ENV !== 'production';

const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: !isLocal,
    trustServerCertificate: isLocal
  }
};

console.log(config.options);

// Create a connection pool
const pool = new sql.ConnectionPool(config);
const poolConnect = pool.connect();

// Function to create tables if they don't exist
async function createTables() {
  await poolConnect; // ensure connection is established

  // USERS
  await pool.request().query(`
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
  await pool.request().query(`
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
  await pool.request().query(`
    IF OBJECT_ID('transactions', 'U') IS NULL
    CREATE TABLE transactions (
      id BIGINT IDENTITY(1,1) PRIMARY KEY,
      user_id BIGINT NOT NULL,
      stock_symbol NVARCHAR(10) NOT NULL,
      action NVARCHAR(4) NOT NULL CHECK (action IN ('BUY', 'SELL')),
      shares BIGINT NOT NULL,
      price_per_share DECIMAL(18,2) NOT NULL,
      total_cost DECIMAL(18,2) NOT NULL,
      timestamp DATETIME2 DEFAULT SYSUTCDATETIME(),

      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `);

  // STOCK PRICE HISTORY
  await pool.request().query(`
    IF OBJECT_ID('stock_price_history', 'U') IS NULL
    CREATE TABLE stock_price_history (
      id BIGINT IDENTITY(1,1) PRIMARY KEY,
      stock_symbol NVARCHAR(10) NOT NULL,
      score BIGINT NOT NULL,
      price BIGINT NULL,
      timestamp DATETIME2 DEFAULT SYSUTCDATETIME()
    )
  `);

  // INDEXES
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT * FROM sys.indexes WHERE name = 'IX_holdings_user'
    )
    CREATE INDEX IX_holdings_user ON holdings(user_id);

    IF NOT EXISTS (
      SELECT * FROM sys.indexes WHERE name = 'IX_transactions_user'
    )
    CREATE INDEX IX_transactions_user ON transactions(user_id);

    IF NOT EXISTS (
      SELECT * FROM sys.indexes WHERE name = 'IX_transactions_symbol_time'
    )
    CREATE INDEX IX_transactions_symbol_time ON transactions(stock_symbol, timestamp);

    IF NOT EXISTS (
      SELECT * FROM sys.indexes WHERE name = 'IX_stock_price_history_symbol_time'
    )
    CREATE INDEX IX_stock_price_history_symbol_time ON stock_price_history(stock_symbol, timestamp);
  `);
}

// Immediately create tables on module load
createTables().catch(err => {
  console.error('Error creating tables:', err);
});

module.exports = {
  sql,
  pool,
  poolConnect
};
