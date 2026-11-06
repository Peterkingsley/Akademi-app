#!/usr/bin/env node
'use strict';

// One-time P3005 repair. Verifies the existing schema, then records migration
// history through Prisma. Never resets, pushes, or changes application tables.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { spawnSync } = require('node:child_process');
const { validateTarget } = require('./rebuild-empty-database.cjs');
const backendRoot = path.resolve(__dirname, '..');
const literal = (value) => "'" + value.replaceAll("'", "''") + "'";

function validateBaselineTarget(databaseUrl, args) {
  return validateTarget(databaseUrl, args.map((arg) => arg.startsWith('--confirm-database=')
    ? arg.replace('--confirm-database=', '--confirm-empty-database=') : arg));
}

function historyGuard(database, migrations) {
  const expected = migrations.map(({ name, checksum }) => `(${literal(name)}, ${literal(checksum)})`).join(',\n');
  return `DO $akademi_baseline$
BEGIN
  IF current_database() <> ${literal(database)} THEN
    RAISE EXCEPTION 'Baseline refused: connected database does not match the confirmed target';
  END IF;
  IF to_regclass('public._prisma_migrations') IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM public._prisma_migrations
      WHERE finished_at IS NULL AND rolled_back_at IS NULL
    ) THEN
      RAISE EXCEPTION 'Baseline refused: an unresolved failed migration requires separate recovery';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public._prisma_migrations recorded
      LEFT JOIN (VALUES ${expected}) AS expected(name, checksum)
        ON expected.name = recorded.migration_name
      WHERE recorded.finished_at IS NOT NULL AND recorded.rolled_back_at IS NULL
        AND (expected.name IS NULL OR expected.checksum <> recorded.checksum)
    ) THEN
      RAISE EXCEPTION 'Baseline refused: recorded migrations do not match the checked-out migration files';
    END IF;
  END IF;
END
$akademi_baseline$;`;
}

function baseline({ databaseUrl, args, migrations, run, log = console.log }) {
  const target = validateBaselineTarget(databaseUrl, args);
  if (!migrations.length) throw new Error('No migration files found; no history was changed.');
  log(`Baseline target: ${target.host}/${target.database}. Application records will be preserved.`);
  run(['db', 'execute', '--schema', 'prisma/schema.prisma', '--stdin'], historyGuard(target.database, migrations));
  log('Verifying that existing tables, columns, enums, indexes, and relations match the current Prisma schema...');
  // --exit-code fails with status 2 if ANY supported schema differences exist.
  // No migration can be marked as applied before this read-only check passes.
  run(['migrate', 'diff', '--from-schema-datasource', 'prisma/schema.prisma',
    '--to-schema-datamodel', 'prisma/schema.prisma', '--exit-code']);
  for (const [index, migration] of migrations.entries()) {
    log(`Recording baseline ${index + 1}/${migrations.length}: ${migration.name}`);
    try {
      run(['migrate', 'resolve', '--schema', 'prisma/schema.prisma', '--applied', migration.name]);
    } catch (error) {
      // A rerun can safely resume a partially recorded baseline. The history
      // guard above verifies checksums before accepting already-applied entries.
      if (error.prismaCode !== 'P3008') throw error;
    }
  }
  run(['migrate', 'status', '--schema', 'prisma/schema.prisma']);
  log('Baseline complete. Existing data was preserved. Normal Render builds can now run.');
  log('Restore the Render Build Command to ./render-build.sh after this deployment.');
}

function executePrisma(cliPath, args, input) {
  const result = spawnSync(process.execPath, [cliPath, ...args], {
    cwd: backendRoot, env: process.env, encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'], input, maxBuffer: 16 * 1024 * 1024,
  });
  if (result.error || result.status !== 0) {
    const details = `${result.stdout || ''}\n${result.stderr || ''}`;
    const refusal = details.match(/Baseline refused:[^\r\n]*/);
    const code = details.match(/\bP\d{4}\b/)?.[0];
    const isDifferentSchema = args[0] === 'migrate' && args[1] === 'diff' && result.status === 2;
    const message = refusal?.[0] || (isDifferentSchema
      ? 'Baseline refused: the database does not match prisma/schema.prisma. No migration history was changed. Send this message for a schema-specific repair.'
      : `Prisma ${args.slice(0, 2).join(' ')} failed${code ? ` (${code})` : ''}. Baseline stopped; application data was not reset.`);
    const error = new Error(message);
    error.prismaCode = code;
    throw error;
  }
}

function main() {
  const migrationRoot = path.join(backendRoot, 'prisma', 'migrations');
  const migrations = fs.readdirSync(migrationRoot, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && fs.existsSync(path.join(migrationRoot, entry.name, 'migration.sql')))
    .map((entry) => ({
      name: entry.name,
      checksum: crypto.createHash('sha256').update(fs.readFileSync(path.join(migrationRoot, entry.name, 'migration.sql'))).digest('hex'),
    })).sort((a, b) => a.name.localeCompare(b.name));
  const cliPath = require.resolve('prisma/build/index.js', { paths: [backendRoot] });
  baseline({ databaseUrl: process.env.DATABASE_URL, args: process.argv.slice(2), migrations,
    run: (args, input) => executePrisma(cliPath, args, input) });
}

module.exports = { validateBaselineTarget, historyGuard, baseline };
if (require.main === module) {
  try { main(); } catch (error) {
    console.error(error instanceof Error ? error.message : 'Database baseline failed.');
    process.exitCode = 1;
  }
}
