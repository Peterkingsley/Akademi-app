#!/usr/bin/env node
'use strict';

// One-time recovery for a NEW database whose historical migrations cannot replay.
// Stop all writers first. Never add this command to the regular build script.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const backendRoot = path.resolve(__dirname, '..');

function sqlLiteral(value) {
  return "'" + value.replaceAll("'", "''") + "'";
}

function validateTarget(databaseUrl, args) {
  if (!databaseUrl) throw new Error('DATABASE_URL must be set in the environment.');
  const target = new URL(databaseUrl);
  const database = decodeURIComponent(target.pathname.slice(1));
  const schema = target.searchParams.get('schema') || 'public';
  const databaseFlag = args.find((arg) => arg.startsWith('--confirm-empty-database='));
  const hostFlag = args.find((arg) => arg.startsWith('--confirm-host='));
  const expectedDatabase = databaseFlag?.slice('--confirm-empty-database='.length);
  const expectedHost = hostFlag?.slice('--confirm-host='.length);
  if (!['postgres:', 'postgresql:'].includes(target.protocol)) {
    throw new Error('Only direct PostgreSQL connection URLs are supported.');
  }
  if (!expectedDatabase || database !== expectedDatabase) {
    throw new Error('Provide --confirm-empty-database=<exact database name> matching DATABASE_URL.');
  }
  // Render internal and external URLs share the first hostname component.
  if (!expectedHost || target.hostname.split('.')[0] !== expectedHost) {
    throw new Error('Provide --confirm-host=<Render database hostname before the first dot>.');
  }
  if (schema !== 'public') throw new Error('This recovery supports only the public schema.');
  return { database, host: target.hostname, schema };
}

function emptyDatabaseGuard(database) {
  return `DO $akademi_recovery$
DECLARE
  target_table record;
  contains_data boolean;
BEGIN
  IF current_database() <> ${sqlLiteral(database)} THEN
    RAISE EXCEPTION 'Connected database does not match the confirmed recovery target';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind IN ('v', 'm', 'f')
  ) THEN
    RAISE EXCEPTION 'Recovery refused: public schema contains views or foreign tables';
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_catalog.pg_class c
    JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname NOT IN ('public', 'information_schema')
      AND n.nspname NOT LIKE 'pg_%'
      AND c.relkind IN ('r', 'p', 'v', 'm', 'f')
  ) THEN
    RAISE EXCEPTION 'Recovery refused: database contains objects in another user schema';
  END IF;
  FOR target_table IN
    SELECT schemaname, tablename FROM pg_catalog.pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'
    ORDER BY tablename
  LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I.%I LIMIT 1)',
      target_table.schemaname, target_table.tablename) INTO contains_data;
    IF contains_data THEN
      RAISE EXCEPTION 'Recovery refused: table % contains data', target_table.tablename;
    END IF;
  END LOOP;
END
$akademi_recovery$;`;
}

function executePrisma(cliPath, args, input) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: backendRoot,
    env: process.env,
    encoding: 'utf8',
    // Keep connection strings and database details out of error output.
    stdio: ['pipe', 'pipe', 'pipe'],
    input,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    const details = `${result.stdout || ''}\n${result.stderr || ''}`;
    const refusal = details.match(/Recovery refused:[^\r\n]*/);
    if (refusal) throw new Error(refusal[0]);
    const code = details.match(/\bP\d{4}\b/)?.[0];
    throw new Error(`Prisma ${args.slice(0, 2).join(' ')} failed${code ? ` (${code})` : ''}. Recovery stopped. Check the database status and network access; credentials were not printed.`);
  }
}

function recover({ databaseUrl, args, migrationNames, run, log = console.log }) {
  const target = validateTarget(databaseUrl, args);
  if (migrationNames.length === 0) throw new Error('No migration files found; refusing to reset.');
  log(`Recovery target: ${target.host}/${target.database}. All writers must be stopped.`);
  log('Checking that application tables contain no records...');
  run(['db', 'execute', '--schema', 'prisma/schema.prisma', '--stdin'], emptyDatabaseGuard(target.database));
  log('Rebuilding the empty public schema from prisma/schema.prisma...');
  run(['db', 'push', '--schema', 'prisma/schema.prisma', '--force-reset', '--skip-generate']);
  // Never mark history as applied before verifying that the current schema exists.
  run(['migrate', 'diff', '--from-schema-datasource', 'prisma/schema.prisma',
    '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code']);
  for (const [index, name] of migrationNames.entries()) {
    log(`Recording migration baseline ${index + 1}/${migrationNames.length}: ${name}`);
    run(['migrate', 'resolve', '--schema', 'prisma/schema.prisma', '--applied', name]);
  }
  run(['migrate', 'deploy', '--schema', 'prisma/schema.prisma']);
  run(['migrate', 'status', '--schema', 'prisma/schema.prisma']);
  log('Recovery complete. Schema and migration history are ready for normal deploys.');
  log('Remove this one-time recovery command from the Render Build Command.');
  log('Existing user data was not restored. Admin and institution seeds are separate steps.');
}

function main() {
  const migrationRoot = path.join(backendRoot, 'prisma', 'migrations');
  const migrationNames = fs.readdirSync(migrationRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(migrationRoot, entry.name, 'migration.sql')))
    .map((entry) => entry.name).sort();
  const cliPath = require.resolve('prisma/build/index.js', { paths: [backendRoot] });
  recover({
    databaseUrl: process.env.DATABASE_URL,
    args: process.argv.slice(2),
    migrationNames,
    run: (args, input) => executePrisma(cliPath, args, input),
  });
}

module.exports = { validateTarget, emptyDatabaseGuard, recover };
if (require.main === module) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Database recovery failed.');
    process.exitCode = 1;
  }
}
