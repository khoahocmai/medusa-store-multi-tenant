-- setup-db-roles.sql
-- Run this script using psql with variables:
-- psql -d <database> -v migration_password="'secure_pass_1'" -v runtime_password="'secure_pass_2'" -f setup-db-roles.sql
-- DO NOT COMMIT PASSWORDS IN CODE!

-- Create migration_role if not exists
SELECT count(*) = 0 AS need_migration FROM pg_catalog.pg_roles WHERE rolname = 'migration_role' \gset
\if :need_migration
  CREATE ROLE migration_role WITH LOGIN PASSWORD :migration_password NOSUPERUSER NOBYPASSRLS;
\endif
GRANT CREATE, USAGE ON SCHEMA public TO migration_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO migration_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO migration_role;

-- Create runtime_role if not exists
SELECT count(*) = 0 AS need_runtime FROM pg_catalog.pg_roles WHERE rolname = 'runtime_role' \gset
\if :need_runtime
  CREATE ROLE runtime_role WITH LOGIN PASSWORD :runtime_password NOSUPERUSER NOBYPASSRLS;
\endif

-- Grant permissions to runtime_role
GRANT USAGE ON SCHEMA public TO runtime_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO runtime_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO runtime_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO runtime_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO runtime_role;
