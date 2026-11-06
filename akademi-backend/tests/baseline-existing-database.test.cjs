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
