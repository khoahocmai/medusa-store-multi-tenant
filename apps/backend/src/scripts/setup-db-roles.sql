-- setup-db-roles.sql
-- Usage:
-- psql -U postgres -d postgres -v runtime_password="'<YOUR_SECURE_PASSWORD>'" < setup-db-roles.sql

-- 1. Create a dedicated role for runtime operations
-- NOSUPERUSER and NOBYPASSRLS ensure that this role MUST respect PostgreSQL Row-Level Security
SELECT count(*) = 0 AS need_runtime FROM pg_catalog.pg_roles WHERE rolname = 'runtime_role' \gset
\if :need_runtime
  CREATE ROLE runtime_role WITH LOGIN PASSWORD :runtime_password NOSUPERUSER NOBYPASSRLS;
\endif

-- 2. Grant permissions on the 'public' schema
GRANT USAGE ON SCHEMA public TO runtime_role;

-- 3. Grant privileges on all existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO runtime_role;

-- 4. Grant privileges on all existing sequences
GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA public TO runtime_role;

-- 5. Ensure that the role automatically gets privileges on future tables and sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO runtime_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO runtime_role;
