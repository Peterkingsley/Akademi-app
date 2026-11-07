'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { baseline, validateBaselineTarget } = require('../scripts/baseline-existing-database.cjs');
const databaseUrl = 'postgresql://example:example@dpg-example-a/akademidatabase';
const args = ['--confirm-database=akademidatabase', '--confirm-host=dpg-example-a'];
const migrations = [{ name: '001_init', checksum: 'a'.repeat(64) }, { name: '002_sync', checksum: 'b'.repeat(64) }];

test('requires the confirmed database and host before any database operation', () => {
  assert.throws(() => validateBaselineTarget(databaseUrl, []));
  assert.throws(() => validateBaselineTarget(databaseUrl.replace('akademidatabase', 'other'), args));
  assert.throws(() => validateBaselineTarget(databaseUrl.replace('dpg-example-a', 'dpg-other-a'), args));
});

test('stops on a history conflict or schema difference before recording anything', () => {
  for (const stopAt of [1, 2]) {
    const calls = [];
    assert.throws(() => baseline({ databaseUrl, args, migrations, log() {},
      run(command) { calls.push(command); if (calls.length === stopAt) throw new Error('mismatch'); },
    }), /mismatch/);
    assert.equal(calls.some((command) => command[1] === 'resolve'), false);
  }
});

test('checks schema equality before baselining and never resets or applies DDL', () => {
  const calls = [];
  baseline({ databaseUrl, args, migrations, log() {}, run(command) { calls.push(command); } });
  assert.deepEqual(calls.map((command) => command.slice(0, 2).join(' ')),
    ['db execute', 'migrate diff', 'migrate resolve', 'migrate resolve', 'migrate status']);
  assert.equal(calls.flat().some((arg) => ['push', 'reset', 'deploy', '--force-reset', '--accept-data-loss'].includes(arg)), false);
});

test('resumes an already partially recorded baseline but stops on other errors', () => {
  for (const code of ['P3008', 'P1001']) {
    let finished = false;
    const task = () => baseline({ databaseUrl, args, migrations, log() {}, run(command) {
      if (command[1] === 'resolve') { const error = new Error(code); error.prismaCode = code; throw error; }
      if (command[1] === 'status') finished = true;
    } });
    if (code === 'P3008') { task(); assert.equal(finished, true); }
    else { assert.throws(task, /P1001/); assert.equal(finished, false); }
  }
});

test('an empty migration list cannot change the database', () => {
  assert.throws(() => baseline({ databaseUrl, args, migrations: [], run() { assert.fail(); } }), /No migration files/);
});

test('repairs only expected foreign keys in a transaction and verifies before recording history', () => {
  const fk = 'ALTER TABLE "child" ADD CONSTRAINT "child_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;';
  for (const unexpected of ['', '\nALTER TABLE "child" DROP COLUMN "parent_id";']) {
    const calls = [];
    const task = () => baseline({ databaseUrl, args: [...args, '--repair-missing-foreign-keys'], migrations, log() {},
      run(command, input) {
        calls.push({ command, input });
        if (command.includes('--from-empty')) return `CREATE TABLE "parent" ("id" TEXT);\n-- AddForeignKey\n${fk}`;
        if (command.includes('--script')) return `-- AddForeignKey\n${fk}${unexpected}`;
      },
    });
    if (unexpected) {
      assert.throws(task, /changes other than missing foreign keys/);
      assert.equal(calls.length, 4);
      assert.equal(calls[3].command[1], 'diff');
      assert.equal(calls[3].input, undefined);
    } else {
      task();
      assert.match(calls[3].input, /^BEGIN;[\s\S]*COMMIT;$/);
      assert.ok(calls[3].input.includes(fk));
      assert.ok(calls[4].command.includes('--exit-code'));
      assert.equal(calls[5].command[1], 'resolve');
    }
  }
});
