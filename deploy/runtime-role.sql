-- Execute as database administrator after migrations, on the target database only.
-- Create a contained runtime user securely through your provisioning tool, then
-- ALTER ROLE fantasy_runtime ADD MEMBER [your_runtime_user]. Do not use db_owner.
CREATE ROLE fantasy_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON SCHEMA::dbo TO fantasy_runtime;
DENY ALTER ON SCHEMA::dbo TO fantasy_runtime;
DENY CREATE TABLE TO fantasy_runtime;
DENY INSERT, UPDATE, DELETE ON dbo.schema_migrations TO fantasy_runtime;
-- The migration principal is separate and has schema DDL permission on this DB.
