-- Create migration_role and runtime_role idempotently
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'migration_role') THEN
    CREATE ROLE migration_role WITH LOGIN PASSWORD 'migration_password' SUPERUSER;
  END IF;

  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'runtime_role') THEN
    CREATE ROLE runtime_role WITH LOGIN PASSWORD 'runtime_password' NOSUPERUSER NOBYPASSRLS;
  END IF;
END
$$;

-- Grant usage on schema to runtime_role
GRANT USAGE ON SCHEMA public TO runtime_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO runtime_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO runtime_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO runtime_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO runtime_role;
