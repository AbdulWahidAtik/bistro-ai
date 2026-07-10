import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';
import test from 'node:test';

async function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, () => {
      const address = server.address();
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForHealth(baseUrl) {
  const deadline = Date.now() + 8000;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        return response.json();
      }
    } catch {
      // Server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error('API server did not become healthy in time');
}

async function startApiServer(envOverrides = {}) {
  const port = await getFreePort();
  const dataFile = `data/test-bistro-ai-${process.pid}-${Date.now()}.json`;
  const child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      API_PORT: String(port),
      DATA_FILE: dataFile,
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: 'test-password',
      AUTH_SECRET: 'test-secret-for-backend-api-tests',
      GEMINI_API_KEY: '',
      MONGODB_URI: '',
      REQUEST_LOGGING: 'false',
      ...envOverrides,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    await waitForHealth(baseUrl);
  } catch (error) {
    child.kill();
    throw new Error(`${error.message}\n${stderr}`);
  }

  return {
    baseUrl,
    dataFile: path.resolve(process.cwd(), dataFile),
    stop: async () => {
      child.kill();
      await new Promise((resolve) => child.once('exit', resolve));
      await fs.rm(path.resolve(process.cwd(), dataFile), { force: true });
    },
  };
}

async function startFailingApiServer(envOverrides = {}) {
  const port = await getFreePort();
  const child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      API_PORT: String(port),
      DATA_FILE: `data/test-fail-${process.pid}-${Date.now()}.json`,
      REQUEST_LOGGING: 'false',
      ...envOverrides,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const exitCode = await new Promise((resolve) => child.once('exit', resolve));
  return { exitCode, stderr };
}

async function requestJson(baseUrl, pathName, options = {}) {
  const response = await fetch(`${baseUrl}${pathName}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const text = await response.text();
  const body = text ? JSON.parse(text) : null;
  return { response, body };
}

test('backend protects writes, supports CRUD, analytics, and AI fallback', async () => {
  const api = await startApiServer();

  try {
    const health = await requestJson(api.baseUrl, '/api/health');
    assert.equal(health.response.status, 200);
    assert.equal(health.body.authEnabled, true);
    assert.equal(health.body.storage, 'json');
    assert.equal(health.body.rateLimitEnabled, true);
    assert.ok(health.body.allowedOrigins.includes('http://localhost:3000'));

    const blockedOrigin = await requestJson(api.baseUrl, '/api/health', {
      headers: { Origin: 'https://not-allowed.example' },
    });
    assert.equal(blockedOrigin.response.status, 403);
    assert.equal(blockedOrigin.body.error.message, 'Origin is not allowed.');

    const blocked = await requestJson(api.baseUrl, '/api/menu-items', {
      method: 'POST',
      body: JSON.stringify({
        id: 'test-soup',
        name: 'Test Soup',
        description: 'A test soup.',
        category: 'Starter',
        price: 9,
        isSpecial: false,
        status: 'active',
      }),
    });
    assert.equal(blocked.response.status, 401);
    assert.ok(blocked.response.headers.get('x-request-id'));
    assert.equal(blocked.body.error.message, 'Authentication required');
    assert.equal(blocked.body.error.status, 401);
    assert.equal(blocked.body.error.requestId, blocked.response.headers.get('x-request-id'));

    const badLogin = await requestJson(api.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'wrong' }),
    });
    assert.equal(badLogin.response.status, 401);
    assert.equal(badLogin.body.error.message, 'Invalid username or password');

    const login = await requestJson(api.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'test-password' }),
    });
    assert.equal(login.response.status, 200);
    assert.equal(login.body.authEnabled, true);
    assert.equal(login.body.role, 'admin');
    assert.ok(login.body.token);

    const authHeaders = { Authorization: `Bearer ${login.body.token}` };

    const createdStaff = await requestJson(api.baseUrl, '/api/users', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        username: 'staff-user',
        displayName: 'Staff User',
        password: 'staff-pass-123',
        role: 'staff',
        isActive: true,
      }),
    });
    assert.equal(createdStaff.response.status, 201);
    assert.equal(createdStaff.body.role, 'staff');
    assert.equal(createdStaff.body.passwordHash, undefined);

    const staffLogin = await requestJson(api.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'staff-user', password: 'staff-pass-123' }),
    });
    assert.equal(staffLogin.response.status, 200);
    assert.equal(staffLogin.body.role, 'staff');
    const staffHeaders = { Authorization: `Bearer ${staffLogin.body.token}` };

    const blockedStaffUsers = await requestJson(api.baseUrl, '/api/users', {
      headers: staffHeaders,
    });
    assert.equal(blockedStaffUsers.response.status, 403);

    const blockedStaffMenu = await requestJson(api.baseUrl, '/api/menu-items', {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({
        id: 'staff-soup',
        name: 'Staff Soup',
        description: 'Should not be created.',
        category: 'Starter',
        price: 8,
        isSpecial: false,
        status: 'active',
      }),
    });
    assert.equal(blockedStaffMenu.response.status, 403);

    const createdMenuItem = await requestJson(api.baseUrl, '/api/menu-items', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        id: 'test-soup',
        name: 'Test Soup',
        description: 'A velvety seasonal soup.',
        category: 'Starter',
        price: 9.5,
        isSpecial: true,
        status: 'active',
      }),
    });
    assert.equal(createdMenuItem.response.status, 201);
    assert.equal(createdMenuItem.body.id, 'test-soup');

    const reservation = await requestJson(api.baseUrl, '/api/reservations', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        id: 'test-reservation',
        customerName: 'Sam Taylor',
        phone: '+15550001111',
        partySize: 4,
        reservationDate: '2026-07-01',
        reservationTime: '19:30',
        notes: 'Window table',
        status: 'confirmed',
        source: 'staff',
      }),
    });
    assert.equal(reservation.response.status, 201);
    assert.equal(reservation.body.status, 'confirmed');

    const order = await requestJson(api.baseUrl, '/api/orders', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({
        id: 'test-order',
        customerName: 'Sam Taylor',
        phone: '+15550001111',
        type: 'takeout',
        status: 'pending',
        notes: 'No utensils',
        items: [
          { menuItemId: 'test-soup', name: 'Test Soup', quantity: 2, price: 9.5 },
        ],
      }),
    });
    assert.equal(order.response.status, 201);
    assert.equal(order.body.total, 19);

    const staffOrder = await requestJson(api.baseUrl, '/api/orders', {
      method: 'POST',
      headers: staffHeaders,
      body: JSON.stringify({
        id: 'staff-order',
        customerName: 'Staff Guest',
        phone: '+15550002222',
        type: 'takeout',
        status: 'pending',
        items: [
          { menuItemId: 'test-soup', name: 'Test Soup', quantity: 1, price: 9.5 },
        ],
      }),
    });
    assert.equal(staffOrder.response.status, 201);

    const analytics = await requestJson(api.baseUrl, '/api/analytics/overview');
    assert.equal(analytics.response.status, 200);
    assert.ok(analytics.body.reservationCount >= 1);
    assert.ok(analytics.body.orderRevenue >= 19);

    const aiDescription = await requestJson(api.baseUrl, '/api/ai/menu-description', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ name: 'Test Soup', category: 'Starter' }),
    });
    assert.equal(aiDescription.response.status, 200);
    assert.equal(aiDescription.body.source, 'fallback');
    assert.match(aiDescription.body.description, /Test Soup/);

    const exported = await requestJson(api.baseUrl, '/api/workspace/export', {
      headers: authHeaders,
    });
    assert.equal(exported.response.status, 200);
    assert.equal(exported.body.version, 1);
    assert.ok(exported.body.workspace.menuItems.some((item) => item.id === 'test-soup'));

    const importedWorkspace = {
      ...exported.body.workspace,
      menuItems: [
        {
          id: 'imported-menu-item',
          name: 'Imported Tart',
          description: 'A restored dessert item.',
          category: 'Dessert',
          price: 11,
          isSpecial: false,
          status: 'active',
        },
      ],
      settings: {
        ...exported.body.workspace.settings,
        brandName: 'Imported Bistro',
      },
    };
    const imported = await requestJson(api.baseUrl, '/api/workspace/import', {
      method: 'POST',
      headers: authHeaders,
      body: JSON.stringify({ workspace: importedWorkspace }),
    });
    assert.equal(imported.response.status, 200);
    assert.equal(imported.body.settings.brandName, 'Imported Bistro');
    assert.deepEqual(imported.body.menuItems.map((item) => item.id), ['imported-menu-item']);
  } finally {
    await api.stop();
  }
});

test('backend rejects weak production auth secret', async () => {
  const result = await startFailingApiServer({
    NODE_ENV: 'production',
    ADMIN_PASSWORD: 'production-password',
    AUTH_SECRET: 'production-password',
  });

  assert.notEqual(result.exitCode, 0);
  assert.match(result.stderr, /AUTH_SECRET must be at least 32 characters/);
});

test('backend rate limits repeated auth requests', async () => {
  const api = await startApiServer({
    RATE_LIMIT_WINDOW_MS: '60000',
    RATE_LIMIT_MAX: '50',
    AUTH_RATE_LIMIT_MAX: '1',
  });

  try {
    const first = await requestJson(api.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'wrong' }),
    });
    assert.equal(first.response.status, 401);
    assert.equal(first.response.headers.get('ratelimit-limit'), '1');
    assert.equal(first.response.headers.get('ratelimit-remaining'), '0');

    const second = await requestJson(api.baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: 'wrong' }),
    });
    assert.equal(second.response.status, 429);
    assert.equal(second.body.error.status, 429);
    assert.equal(second.body.error.message, 'Too many requests. Please try again shortly.');
    assert.ok(second.response.headers.get('retry-after'));
  } finally {
    await api.stop();
  }
});
