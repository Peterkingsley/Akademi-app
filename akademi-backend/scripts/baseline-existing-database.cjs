#!/usr/bin/env node
'use strict';

// One-time P3005 repair. Optionally restores missing foreign keys, then
// verifies the schema before recording migration history through Prisma.
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

const schemaPath = 'prisma/schema.prisma';
const compareSchema = ['migrate', 'diff', '--from-schema-datasource', schemaPath,
  '--to-schema-datamodel', schemaPath];

function sqlStatements(sql) {
  return sql.split(/\r?\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith('--'));
}

function repairMissingForeignKeys(run, log) {
  const pending = sqlStatements(run([...compareSchema, '--script']));
  if (!pending.length) return;

  // Compare with Prisma's own SQL for the target schema. Only complete ADD
  // FOREIGN KEY statements already present in that schema can be executed.
  const normalize = (statement) => statement.replaceAll('"public".', '');
  const expected = new Set(sqlStatements(run([
    'migrate', 'diff', '--from-empty', '--to-schema-datamodel', schemaPath, '--script',
  ])).filter((statement) => statement.startsWith('ALTER TABLE ')
    && statement.includes(' ADD CONSTRAINT ') && statement.includes(' FOREIGN KEY ('))
    .map(normalize));
  if (pending.some((statement) => !expected.has(normalize(statement)))) {
    log(run(compareSchema));
    throw new Error('Baseline refused: the diff contains changes other than missing foreign keys. No schema changes were made.');
  }

  log(`Restoring ${pending.length} missing foreign keys in one transaction...`);
  run(['db', 'execute', '--schema', schemaPath, '--stdin'], [
    'BEGIN;', 'SET LOCAL lock_timeout = \'5s\';', 'SET LOCAL statement_timeout = \'30s\';',
    ...pending, 'COMMIT;',
  ].join('\n'));
}

function baseline({ databaseUrl, args, migrations, run, log = console.log }) {
  const target = validateBaselineTarget(databaseUrl, args);
  if (!migrations.length) throw new Error('No migration files found; no history was changed.');
  log(`Baseline target: ${target.host}/${target.database}. Application records will be preserved.`);
  run(['db', 'execute', '--schema', 'prisma/schema.prisma', '--stdin'], historyGuard(target.database, migrations));
  if (args.includes('--repair-missing-foreign-keys')) repairMissingForeignKeys(run, log);
  log('Verifying that existing tables, columns, enums, indexes, and relations match the current Prisma schema...');
  // --exit-code fails with status 2 if ANY supported schema differences exist.
  // No migration can be marked as applied before this read-only check passes.
  run([...compareSchema, '--exit-code']);
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
    const foreignKey = details.match(/violates foreign key constraint "([a-zA-Z0-9_]+)"/);
    const code = details.match(/\bP\d{4}\b/)?.[0];
    const isDifferentSchema = args[0] === 'migrate' && args[1] === 'diff' && result.status === 2;
    const message = refusal?.[0] || (foreignKey && `Baseline refused: existing rows violate ${foreignKey[1]}. The foreign key repair was rolled back.`) || (isDifferentSchema
      ? 'Baseline refused: the database does not match prisma/schema.prisma. No migration history was changed. Send this message for a schema-specific repair.'
      : `Prisma ${args.slice(0, 2).join(' ')} failed${code ? ` (${code})` : ''}. Baseline stopped; application data was not reset.`);
    const error = new Error(message);
    error.prismaCode = code;
    throw error;
  }
  return result.stdout;
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
