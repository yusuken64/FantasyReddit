CREATE TABLE accounts (
 id uniqueidentifier NOT NULL PRIMARY KEY, reddit_id nvarchar(50) NOT NULL UNIQUE, username nvarchar(255) NOT NULL,
 credits bigint NOT NULL DEFAULT 10000 CHECK(credits BETWEEN 0 AND 9007199254740991),
 generation bigint NOT NULL DEFAULT 0 CHECK(generation BETWEEN 0 AND 9007199254740991), created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE TABLE sessions (
 token_hash char(64) NOT NULL PRIMARY KEY, user_id uniqueidentifier NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 csrf_token varchar(64) NOT NULL, created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), last_seen datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_sessions_user ON sessions(user_id);
CREATE TABLE oauth_flows (state_hash char(64) NOT NULL PRIMARY KEY, browser_hash char(64) NOT NULL, expires_at datetime2 NOT NULL);
CREATE TABLE instruments (symbol varchar(10) NOT NULL PRIMARY KEY, title nvarchar(300) NOT NULL, terminal bit NOT NULL DEFAULT 0);
CREATE TABLE observations (
 id uniqueidentifier NOT NULL PRIMARY KEY, symbol varchar(10) NOT NULL REFERENCES instruments(symbol),
 price bigint NOT NULL CHECK(price BETWEEN 0 AND 9007199254740991), score bigint NOT NULL,
 created_utc datetime2 NOT NULL, observed_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), terminal bit NOT NULL,
 CHECK(terminal = 0 OR price = 0)
);
CREATE INDEX IX_observations_symbol_time ON observations(symbol, observed_at, id) INCLUDE(price, terminal);
CREATE TABLE holdings (
 user_id uniqueidentifier NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, symbol varchar(10) NOT NULL REFERENCES instruments(symbol),
 shares bigint NOT NULL CHECK(shares BETWEEN 0 AND 9007199254740991), total_spent bigint NOT NULL CHECK(total_spent BETWEEN 0 AND 9007199254740991), PRIMARY KEY(user_id,symbol)
);
CREATE TABLE quotes (
 id uniqueidentifier NOT NULL PRIMARY KEY, user_id uniqueidentifier NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 generation bigint NOT NULL CHECK(generation BETWEEN 0 AND 9007199254740991), symbol varchar(10) NOT NULL REFERENCES instruments(symbol), observation_id uniqueidentifier NOT NULL REFERENCES observations(id),
 action varchar(12) NOT NULL CHECK(action IN ('BUY','SELL','SELL_REMOVE','OPTION')),
 quantity bigint NOT NULL CHECK(quantity BETWEEN 1 AND 1000000), price bigint NOT NULL CHECK(price BETWEEN 0 AND 9007199254740991),
 cost bigint NOT NULL CHECK(cost BETWEEN 0 AND 9007199254740991), option_type varchar(4) NULL CHECK(option_type IN ('CALL','PUT')),
 strike bigint NULL CHECK(strike BETWEEN 0 AND 9007199254740991), premium bigint NULL CHECK(premium BETWEEN 0 AND 9007199254740991),
 option_expiry datetime2 NULL, expires_at datetime2 NOT NULL, consumed bit NOT NULL DEFAULT 0
);
CREATE INDEX IX_holdings_symbol ON holdings(symbol) INCLUDE(user_id,shares);
CREATE INDEX IX_quotes_user ON quotes(user_id);
CREATE INDEX IX_quotes_observation ON quotes(observation_id);
CREATE TABLE options (
 id uniqueidentifier NOT NULL PRIMARY KEY, user_id uniqueidentifier NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 symbol varchar(10) NOT NULL REFERENCES instruments(symbol), option_type varchar(4) NOT NULL CHECK(option_type IN ('CALL','PUT')),
 strike bigint NOT NULL CHECK(strike BETWEEN 0 AND 9007199254740991), premium bigint NOT NULL CHECK(premium BETWEEN 0 AND 9007199254740991),
 total_premium bigint NOT NULL CHECK(total_premium BETWEEN 0 AND 9007199254740991), quantity bigint NOT NULL CHECK(quantity BETWEEN 1 AND 1000000),
 expires_at datetime2 NOT NULL, created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 status varchar(10) NOT NULL DEFAULT 'OPEN' CHECK(status IN ('OPEN','SETTLED')), observation_id uniqueidentifier NULL REFERENCES observations(id)
);
CREATE INDEX IX_options_due ON options(status,expires_at) INCLUDE(user_id,symbol,observation_id);
CREATE INDEX IX_options_user ON options(user_id);
CREATE INDEX IX_options_symbol ON options(symbol,status,expires_at);
CREATE TABLE settlements (
 option_id uniqueidentifier NOT NULL PRIMARY KEY REFERENCES options(id), user_id uniqueidentifier NOT NULL REFERENCES accounts(id),
 observation_id uniqueidentifier NOT NULL REFERENCES observations(id), payout bigint NOT NULL CHECK(payout BETWEEN 0 AND 9007199254740991)
);
CREATE TABLE ledger (
 id uniqueidentifier NOT NULL PRIMARY KEY, user_id uniqueidentifier NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
 symbol varchar(10) NOT NULL, instrument varchar(6) NOT NULL CHECK(instrument IN ('STOCK','OPTION')),
 action varchar(12) NOT NULL CHECK(action IN ('BUY','SELL','EXERCISE','EXPIRE','DELIST','REMOVE')),
 quantity bigint NOT NULL CHECK(quantity BETWEEN 1 AND 9007199254740991), price bigint NOT NULL CHECK(price BETWEEN 0 AND 9007199254740991),
 cost bigint NOT NULL CHECK(cost BETWEEN 0 AND 9007199254740991), payout bigint NOT NULL CHECK(payout BETWEEN 0 AND 9007199254740991),
 quote_id uniqueidentifier NULL, option_id uniqueidentifier NULL, observation_id uniqueidentifier NOT NULL REFERENCES observations(id), created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_ledger_user_time ON ledger(user_id,created_at DESC,id);
CREATE INDEX IX_ledger_observation ON ledger(observation_id);
CREATE UNIQUE INDEX UQ_stock_delisting ON ledger(user_id,symbol) WHERE instrument='STOCK' AND action='DELIST';
CREATE TABLE snapshots (
 user_id uniqueidentifier NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, bucket datetime2 NOT NULL,
 credits bigint NOT NULL CHECK(credits BETWEEN 0 AND 9007199254740991), holdings_value bigint NOT NULL CHECK(holdings_value BETWEEN 0 AND 9007199254740991), PRIMARY KEY(user_id,bucket)
);
CREATE TABLE idempotency (
 user_id uniqueidentifier NOT NULL REFERENCES accounts(id) ON DELETE CASCADE, request_key uniqueidentifier NOT NULL,
 fingerprint char(64) NOT NULL, result nvarchar(max) NOT NULL, created_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(), PRIMARY KEY(user_id,request_key)
);
CREATE TABLE job_leases (name varchar(50) NOT NULL PRIMARY KEY, owner uniqueidentifier NOT NULL, expires_at datetime2 NOT NULL);
CREATE TABLE rate_limits (bucket_key char(64) NOT NULL PRIMARY KEY, window_start datetime2 NOT NULL, hits int NOT NULL);
