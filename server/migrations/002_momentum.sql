CREATE TABLE market_state (
 symbol varchar(10) NOT NULL PRIMARY KEY REFERENCES instruments(symbol),
 samples nvarchar(max) NOT NULL CHECK(ISJSON(samples)=1),
 sampled_at datetime2 NOT NULL,
 registered_at datetime2 NOT NULL DEFAULT SYSUTCDATETIME(),
 quote_at datetime2 NULL,
 momentum float NULL,
 weight float NOT NULL CHECK(weight>0)
);
CREATE INDEX IX_market_state_due ON market_state(sampled_at) INCLUDE(registered_at);
ALTER TABLE observations ADD pricing_model varchar(32) NOT NULL DEFAULT 'legacy-age-v1', momentum float NULL;
