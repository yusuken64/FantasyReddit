const sql = require('mssql')

const isLocal = process.env.NODE_ENV !== 'production';
const config = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER,
  database: process.env.DB_NAME,
  options: {
    encrypt: !isLocal,                 // true for Azure, false for local
    trustServerCertificate: isLocal    // allow self-signed certs locally
  }
}

// Create a connection pool
const pool = new sql.ConnectionPool(config)
const poolConnect = pool.connect()

// Function to create tables if they don't exist
async function createTables() {
  await poolConnect // ensure connection established

  // Create Users table
  await pool.request().query(`
    IF NOT EXISTS (
      SELECT * FROM sysobjects WHERE name='users' AND xtype='U'
    )
    CREATE TABLE users (
      id INT IDENTITY(1,1) PRIMARY KEY,
      username NVARCHAR(255) UNIQUE NOT NULL,
      reddit_id NVARCHAR(50) UNIQUE NULL,
      access_token NVARCHAR(MAX) NULL,
      refresh_token NVARCHAR(MAX) NULL,
      token_expiry DATETIME2 NULL,
      credits INT DEFAULT 10000,
      totalScore INT DEFAULT 0
    )
  `)

  // Create Portfolios table
  await pool.request().query(`
    IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='portfolios' AND xtype='U')
    CREATE TABLE portfolios (
      id INT IDENTITY(1,1) PRIMARY KEY,
      user_id INT NOT NULL FOREIGN KEY REFERENCES users(id),
      stock_symbol NVARCHAR(10) NOT NULL,
      shares INT NOT NULL DEFAULT 0,
      total_spent INT NOT NULL DEFAULT 0,
      CONSTRAINT UQ_user_stock UNIQUE(user_id, stock_symbol)
    )
  `)
}

// Immediately create tables on module load
createTables().catch(err => {
  console.error('Error creating tables:', err)
})

module.exports = {
  sql,
  pool,
  poolConnect
}
