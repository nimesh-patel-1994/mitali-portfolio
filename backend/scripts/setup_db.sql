-- backend/scripts/setup_db.sql - run ONLY through setup_db.ps1 by the user (TS-018, SD-005, SEC-004).
--
-- Idempotent: creates the app role (or updates its password), both databases (if missing) owned by the role,
-- revokes CONNECT from PUBLIC and makes the role own schema public in each database.
--
-- Inputs:
--   psql variable app_role   (-v app_role=mitali_app)       role name, validated by setup_db.ps1
--   environment MP_APP_PASSWORD                             app-role password, set by setup_db.ps1 for this
--                                                           process only (never on the command line)
-- The superuser password is prompted for by psql itself and never stored anywhere.

\set ON_ERROR_STOP on
\set QUIET on

\if :{?app_role}
\else
  \set app_role mitali_app
\endif

\getenv app_password MP_APP_PASSWORD
\if :{?app_password}
\else
  \echo 'MP_APP_PASSWORD is not set. Run this file through scripts\\setup_db.ps1.'
  DO $$ BEGIN RAISE EXCEPTION 'MP_APP_PASSWORD missing'; END $$;
\endif

-- Store the password as a SCRAM verifier.
SET password_encryption = 'scram-sha-256';

-- 1. App role: create if missing, otherwise reset its password and privileges (least privilege).
SELECT format(
         'CREATE ROLE %I LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',
         :'app_role', :'app_password')
 WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_role')
\gexec

SELECT format(
         'ALTER ROLE %I WITH LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD %L',
         :'app_role', :'app_password')
 WHERE EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'app_role')
\gexec

\unset app_password

-- 2. Databases: create if missing (UTF8, template0, owned by the app role).
SELECT format('CREATE DATABASE %I OWNER %I ENCODING %L TEMPLATE template0', db, :'app_role', 'UTF8')
  FROM (VALUES ('mitali_portfolio'), ('mitali_portfolio_test')) AS wanted(db)
 WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = wanted.db)
\gexec

-- Existing databases: make sure the owner and CONNECT rights are right.
SELECT format('ALTER DATABASE %I OWNER TO %I', db, :'app_role'),
       format('REVOKE CONNECT, TEMPORARY ON DATABASE %I FROM PUBLIC', db),
       format('GRANT CONNECT, TEMPORARY ON DATABASE %I TO %I', db, :'app_role')
  FROM (VALUES ('mitali_portfolio'), ('mitali_portfolio_test')) AS wanted(db)
\gexec

-- 3. Schema public owned by the app role in each database (psql reuses the superuser password for \connect).
\connect mitali_portfolio
ALTER SCHEMA public OWNER TO :"app_role";

\connect mitali_portfolio_test
ALTER SCHEMA public OWNER TO :"app_role";

\unset QUIET
\echo 'Database setup complete: role' :"app_role" 'owns mitali_portfolio and mitali_portfolio_test.'
