import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';

async function runSeed(dataFile) {
  const child = spawn(process.execPath, ['scripts/seed-demo.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      DATA_FILE: dataFile,
      MONGODB_URI: '',
      ADMIN_PASSWORD: '',
      DEMO_ADMIN_PASSWORD: 'AdminPass123!',
      DEMO_MANAGER_PASSWORD: 'ManagerPass123!',
      DEMO_STAFF_PASSWORD: 'StaffPass123!',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
  });
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const exitCode = await new Promise((resolve) => child.once('exit', resolve));
  return { exitCode, stdout, stderr };
}

test('demo seed creates role-based demo users without plain-text password storage', async () => {
  const dataFile = `data/test-seed-demo-${process.pid}-${Date.now()}.json`;
  const absoluteDataFile = path.resolve(process.cwd(), dataFile);

  try {
    const result = await runSeed(dataFile);
    assert.equal(result.exitCode, 0, result.stderr);

    const output = JSON.parse(result.stdout);
    assert.equal(output.ok, true);
    assert.deepEqual(output.users.map((user) => user.role), ['admin', 'manager', 'staff']);

    const rawStore = JSON.parse(await fs.readFile(absoluteDataFile, 'utf8'));
    assert.equal(rawStore.users.length, 3);
    assert.ok(rawStore.users.every((user) => user.passwordHash.startsWith('scrypt:')));
    assert.ok(rawStore.users.every((user) => !Object.hasOwn(user, 'password')));
    assert.ok(rawStore.menuItems.length > 0);
    assert.ok(rawStore.scripts.length > 0);
  } finally {
    await fs.rm(absoluteDataFile, { force: true });
  }
});
