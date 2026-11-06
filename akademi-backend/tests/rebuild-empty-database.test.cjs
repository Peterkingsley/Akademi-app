'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateTarget, recover } = require('../scripts/rebuild-empty-database.cjs');

const databaseUrl = 'postgresql://example:example@dpg-example-a/akademidatabase';
const args = ['--confirm-empty-database=akademidatabase', '--confirm-host=dpg-example-a'];

test('requires confirmation of the exact database and Render host', () => {
  assert.throws(() => validateTarget(databaseUrl, []), /confirm-empty-database/);
  assert.throws(() => validateTarget(databaseUrl, [args[0]]), /confirm-host/);
  assert.throws(() => validateTarget(databaseUrl.replace('dpg-example-a', 'dpg-other-a'), args), /confirm-host/);
  assert.throws(() => validateTarget(databaseUrl.replace('akademidatabase', 'live_database'), args), /confirm-empty-database/);
  assert.throws(() => validateTarget(databaseUrl + '?schema=other', args), /public schema/);
  assert.equal(validateTarget(databaseUrl.replace('dpg-example-a', 'dpg-example-a.oregon-postgres.render.com'), args).database, 'akademidatabase');
});

test('a failed emptiness guard prevents reset and migration baselining', () => {
  const calls = [];
  assert.throws(() => recover({ databaseUrl, args, migrationNames: ['001_init'], log() {},
    run(command) { calls.push(command); throw new Error('Recovery refused: table users contains data'); },
  }), /contains data/);
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0].slice(0, 2), ['db', 'execute']);
});

test('a failed schema rebuild or verification never marks migrations applied', () => {
  for (const stopAt of [2, 3]) {
    const calls = [];
    assert.throws(() => recover({ databaseUrl, args, migrationNames: ['001_init'], log() {},
      run(command) { calls.push(command); if (calls.length === stopAt) throw new Error('failed'); },
    }), /failed/);
    assert.equal(calls.some((command) => command[1] === 'resolve'), false);
  }
});

test('rebuilds and verifies before baselining, then checks ordinary deploys', () => {
  const calls = [];
  recover({ databaseUrl, args, migrationNames: ['001_init', '002_sync'], log() {},
    run(command) { calls.push(command); },
  });
  assert.deepEqual(calls.map((command) => command.slice(0, 2).join(' ')),
    ['db execute', 'db push', 'migrate diff', 'migrate resolve', 'migrate resolve', 'migrate deploy', 'migrate status']);
});

test('an absent migration directory prevents any database operations', () => {
  assert.throws(() => recover({ databaseUrl, args, migrationNames: [], run() { assert.fail(); } }), /No migration/);
});
