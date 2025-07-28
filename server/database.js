const Database = require('better-sqlite3')
const path = require('path')

// Open or create the SQLite database file
const db = new Database(path.resolve(__dirname, 'app.db'))

// Create Users table
db.prepare(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    credits INTEGER DEFAULT 1000
  )
`).run()

// Create Portfolios table: stores user’s stock holdings
db.prepare(`
  CREATE TABLE IF NOT EXISTS portfolios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    stock_symbol TEXT NOT NULL,
    shares INTEGER NOT NULL DEFAULT 0,
    total_spent INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(user_id, stock_symbol)
  );
`).run()

module.exports = db
