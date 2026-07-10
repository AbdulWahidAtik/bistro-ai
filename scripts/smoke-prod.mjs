import { spawn } from 'node:child_process';
import fs from 'node:fs/promises';
import net from 'node:net';
import path from 'node:path';

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

async function requestJson(baseUrl, pathName, options = {}) {
  const response = await fetch(`${baseUrl}${pathName}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  });
  const text = await response.text();
  return {
    response,
    body: text ? JSON.parse(text) : null,
  };
}

async function waitForHealth(baseUrl) {
  const deadline = Date.now() + 10_000;

  while (Date.now() < deadline) {
    try {
      const { response, body } = await requestJson(baseUrl, '/api/health');
      if (response.ok && body?.ok) return body;
    } catch {
      // The production server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }

  throw new Error('Production server did not become healthy in time.');
}

async function main() {
  const distIndex = path.resolve(process.cwd(), 'dist', 'index.html');
  try {
    await fs.access(distIndex);
  } catch {
    throw new Error('dist/index.html is missing. Run npm run build before npm run smoke:prod.');
  }

  const port = await getFreePort();
  const dataFile = `data/smoke-prod-${process.pid}-${Date.now()}.json`;
  const absoluteDataFile = path.resolve(process.cwd(), dataFile);
  const adminPassword = 'SmokeAdminPass123!';
  const authSecret = 'smoke-prod-secret-at-least-32-characters';

  const child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      API_PORT: String(port),
      NODE_ENV: 'production',
      DATA_FILE: dataFile,
      MONGODB_URI: '',
      SERVE_STATIC: 'true',
      REQUEST_LOGGING: 'false',
      RATE_LIMIT_ENABLED: 'false',
      ADMIN_USERNAME: 'admin',
      ADMIN_PASSWORD: adminPassword,
      AUTH_SECRET: authSecret,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  let stderr = '';
  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const health = await waitForHealth(baseUrl);
    if (!health.authEnabled || !health.serveStatic) {
      throw new Error('Production health check did not report authEnabled and serveStatic.');
    }

    const html = await fetch(baseUrl);
    if (!html.ok || !(await html.text()).includes('Bistro AI')) {
      throw new Error('Built frontend was not served from the production server.');
    }
    if (html.headers.get('x-powered-by')) {
      throw new Error('Production server leaked X-Powered-By header.');
    }
    if (html.headers.get('x-content-type-options') !== 'nosniff') {
      throw new Error('Production server is missing X-Content-Type-Options header.');
    }
    if (!html.headers.get('content-security-policy')?.includes("default-src 'self'")) {
      throw new Error('Production server is missing Content-Security-Policy header.');
    }

    const login = await requestJson(baseUrl, '/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ username: 'admin', password: adminPassword }),
    });
    if (!login.response.ok || login.body?.role !== 'admin' || !login.body?.token) {
      throw new Error('Admin login failed in production smoke test.');
    }

    const users = await requestJson(baseUrl, '/api/users', {
      headers: { Authorization: `Bearer ${login.body.token}` },
    });
    if (!users.response.ok || !Array.isArray(users.body) || users.body.length < 1) {
      throw new Error('Admin users endpoint failed in production smoke test.');
    }

    console.log(JSON.stringify({
      ok: true,
      baseUrl,
      storage: health.storage,
      users: users.body.map((user) => ({ username: user.username, role: user.role })),
    }, null, 2));
  } catch (error) {
    throw new Error(`${error.message}\n${stderr}`);
  } finally {
    child.kill();
    await new Promise((resolve) => child.once('exit', resolve));
    await fs.rm(absoluteDataFile, { force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
