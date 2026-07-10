import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateMenuDescription, generateScript, isAiEnabled } from './ai-service.mjs';
import { getOverviewAnalytics } from './analytics-service.mjs';
import { hashPassword, initializeAuthUsers, isAuthEnabled, login, requireAuth, requireRole, userRoles } from './auth.mjs';
import { jsonStore } from './json-store.mjs';
import { connectMongoStore, mongoStore } from './mongo-store.mjs';
import { buildOperationsReport } from './report-service.mjs';
import { seedData } from './seed-data.mjs';

const port = Number(process.env.API_PORT || 3001);
const mongoUri = process.env.MONGODB_URI || '';
const serveStatic = process.env.SERVE_STATIC === 'true';
const requestLogging = process.env.REQUEST_LOGGING !== 'false';
const rateLimitEnabled = process.env.RATE_LIMIT_ENABLED !== 'false';
const rateLimitWindowMs = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const rateLimitMax = Number(process.env.RATE_LIMIT_MAX || 300);
const authRateLimitMax = Number(process.env.AUTH_RATE_LIMIT_MAX || 10);
const aiRateLimitMax = Number(process.env.AI_RATE_LIMIT_MAX || 30);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.resolve(__dirname, '..', 'dist');
const configuredOrigins = (process.env.CORS_ORIGINS || process.env.APP_URL || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const allowedOrigins = new Set([
  ...configuredOrigins,
  ...(process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000', 'http://127.0.0.1:3000']),
]);
let store = jsonStore;
let storageDriver = 'json';

async function initializeStore() {
  if (!mongoUri) {
    await initializeAuthUsers(store);
    return;
  }

  await connectMongoStore(mongoUri);
  store = mongoStore;
  storageDriver = 'mongodb';
  await initializeAuthUsers(store);
}

function asyncRoute(handler) {
  return async (req, res, next) => {
    try {
      await handler(req, res);
    } catch (error) {
      next(error);
    }
  };
}

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

function clientKey(req) {
  const forwardedFor = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
  return forwardedFor || req.socket.remoteAddress || 'unknown';
}

function createRateLimiter({ windowMs, max, name }) {
  const buckets = new Map();

  return (req, res, next) => {
    if (!rateLimitEnabled || req.method === 'OPTIONS') {
      next();
      return;
    }

    const now = Date.now();
    const key = `${name}:${clientKey(req)}`;
    const bucket = buckets.get(key);
    const current = bucket && bucket.resetAt > now
      ? bucket
      : { count: 0, resetAt: now + windowMs };

    current.count += 1;
    buckets.set(key, current);

    const remaining = Math.max(0, max - current.count);
    const retryAfterSeconds = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(remaining));
    res.setHeader('RateLimit-Reset', String(Math.ceil(current.resetAt / 1000)));

    if (current.count > max) {
      res.setHeader('Retry-After', String(retryAfterSeconds));
      next(createHttpError(429, 'Too many requests. Please try again shortly.'));
      return;
    }

    next();
  };
}

const generalLimiter = createRateLimiter({ windowMs: rateLimitWindowMs, max: rateLimitMax, name: 'general' });
const authLimiter = createRateLimiter({ windowMs: rateLimitWindowMs, max: authRateLimitMax, name: 'auth' });
const aiLimiter = createRateLimiter({ windowMs: rateLimitWindowMs, max: aiRateLimitMax, name: 'ai' });

function requireFields(body, fields) {
  const missing = fields.filter((field) => body[field] === undefined || body[field] === '');
  if (missing.length > 0) {
    throw createHttpError(400, `Missing required fields: ${missing.join(', ')}`);
  }
}

function sanitizeMenuItem(body, id = body.id) {
  requireFields({ ...body, id }, ['id', 'name', 'category', 'price', 'description']);

  const price = Number(body.price);
  if (!Number.isFinite(price) || price <= 0) {
    throw createHttpError(400, 'Price must be a positive number');
  }

  return {
    id,
    name: String(body.name).trim(),
    description: String(body.description).trim(),
    category: body.category,
    price,
    isSpecial: Boolean(body.isSpecial),
    status: body.status === 'inactive' ? 'inactive' : 'active',
  };
}

function sanitizeScript(body, id = body.id) {
  requireFields({ ...body, id }, ['id', 'title', 'description', 'category', 'text']);

  return {
    id,
    title: String(body.title).trim(),
    description: String(body.description).trim(),
    category: body.category,
    text: String(body.text).trim(),
    avatarText: body.avatarText || 'AI',
    lastUpdated: body.lastUpdated || 'Updated just now',
    stats: body.stats || {
      successRate: 'Pending',
      avgDuration: 'Pending',
      intentAccuracy: 'Pending',
    },
  };
}

function sanitizeActivityLog(body, id = body.id) {
  requireFields({ ...body, id }, ['id', 'type', 'title', 'detail', 'time', 'duration', 'status']);

  return {
    id,
    type: body.type,
    title: String(body.title).trim(),
    detail: String(body.detail).trim(),
    time: String(body.time).trim(),
    duration: String(body.duration).trim(),
    status: body.status === 'SUCCESS' ? 'SUCCESS' : 'HANDLED',
  };
}

function sanitizeReservation(body, id = body.id) {
  requireFields({ ...body, id }, ['id', 'customerName', 'phone', 'partySize', 'reservationDate', 'reservationTime']);

  const partySize = Number(body.partySize);
  if (!Number.isInteger(partySize) || partySize <= 0) {
    throw createHttpError(400, 'Party size must be a positive integer');
  }

  const allowedStatuses = ['pending', 'confirmed', 'seated', 'cancelled'];
  const allowedSources = ['ai-call', 'web', 'staff'];

  return {
    id,
    customerName: String(body.customerName).trim(),
    phone: String(body.phone).trim(),
    partySize,
    reservationDate: String(body.reservationDate).trim(),
    reservationTime: String(body.reservationTime).trim(),
    notes: String(body.notes || '').trim(),
    status: allowedStatuses.includes(body.status) ? body.status : 'pending',
    source: allowedSources.includes(body.source) ? body.source : 'staff',
  };
}

function sanitizeOrder(body, id = body.id) {
  requireFields({ ...body, id }, ['id', 'customerName', 'phone', 'items', 'type']);

  if (!Array.isArray(body.items) || body.items.length === 0) {
    throw createHttpError(400, 'Order requires at least one item');
  }

  const items = body.items.map((item) => {
    requireFields(item, ['name', 'quantity', 'price']);
    const quantity = Number(item.quantity);
    const price = Number(item.price);
    if (!Number.isInteger(quantity) || quantity <= 0) {
      throw createHttpError(400, 'Order item quantity must be a positive integer');
    }
    if (!Number.isFinite(price) || price < 0) {
      throw createHttpError(400, 'Order item price must be a non-negative number');
    }
    return {
      menuItemId: String(item.menuItemId || '').trim(),
      name: String(item.name).trim(),
      quantity,
      price,
    };
  });

  const total = Number(body.total ?? items.reduce((sum, item) => sum + item.quantity * item.price, 0));
  if (!Number.isFinite(total) || total < 0) {
    throw createHttpError(400, 'Order total must be a non-negative number');
  }

  const allowedStatuses = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];
  const allowedTypes = ['dine-in', 'takeout', 'delivery'];

  return {
    id,
    customerName: String(body.customerName).trim(),
    phone: String(body.phone).trim(),
    items,
    total,
    status: allowedStatuses.includes(body.status) ? body.status : 'pending',
    type: allowedTypes.includes(body.type) ? body.type : 'takeout',
    placedAt: body.placedAt || new Date().toISOString(),
    notes: String(body.notes || '').trim(),
  };
}

function sanitizeSettings(body = {}) {
  return {
    brandName: String(body.brandName || seedData.settings.brandName).trim(),
    activeVoice: String(body.activeVoice || seedData.settings.activeVoice).trim(),
    phoneRouting: String(body.phoneRouting || seedData.settings.phoneRouting).trim(),
    autoUpsellPercent: Number.isFinite(Number(body.autoUpsellPercent))
      ? Number(body.autoUpsellPercent)
      : seedData.settings.autoUpsellPercent,
    autoConfirmSms: body.autoConfirmSms === undefined
      ? seedData.settings.autoConfirmSms
      : Boolean(body.autoConfirmSms),
    serviceHours: {
      weekdays: String(body.serviceHours?.weekdays || seedData.settings.serviceHours.weekdays).trim(),
      saturday: String(body.serviceHours?.saturday || seedData.settings.serviceHours.saturday).trim(),
      sunday: String(body.serviceHours?.sunday || seedData.settings.serviceHours.sunday).trim(),
    },
  };
}

function sanitizeWorkspaceBackup(body) {
  const workspace = body?.workspace || body;
  if (!workspace || typeof workspace !== 'object') {
    throw createHttpError(400, 'Workspace backup payload is required');
  }

  return {
    menuItems: Array.isArray(workspace.menuItems)
      ? workspace.menuItems.map((item) => sanitizeMenuItem(item))
      : [],
    scripts: Array.isArray(workspace.scripts)
      ? workspace.scripts.map((script) => sanitizeScript(script))
      : [],
    activityLogs: Array.isArray(workspace.activityLogs)
      ? workspace.activityLogs.map((log) => sanitizeActivityLog(log))
      : [],
    reservations: Array.isArray(workspace.reservations)
      ? workspace.reservations.map((reservation) => sanitizeReservation(reservation))
      : [],
    orders: Array.isArray(workspace.orders)
      ? workspace.orders.map((order) => sanitizeOrder(order))
      : [],
    settings: sanitizeSettings(workspace.settings),
  };
}

function sanitizeUser(body, existing = {}) {
  const role = userRoles.includes(body.role) ? body.role : existing.role || 'staff';
  const username = String(body.username ?? existing.username ?? '').trim();
  const displayName = String(body.displayName ?? existing.displayName ?? username).trim();

  if (!username) {
    throw createHttpError(400, 'Username is required');
  }

  if (!/^[a-zA-Z0-9._-]{3,32}$/.test(username)) {
    throw createHttpError(400, 'Username must be 3-32 letters, numbers, dots, underscores, or hyphens');
  }

  return {
    username,
    displayName,
    role,
    isActive: body.isActive === undefined ? existing.isActive !== false : Boolean(body.isActive),
  };
}

async function assertAdminWillRemain(targetUserId, nextRole, nextActive) {
  const users = await store.listUsers({ includePasswordHash: true });
  const activeAdmins = users.filter((user) => {
    if (user.id === targetUserId) {
      return nextRole === 'admin' && nextActive !== false;
    }
    return user.role === 'admin' && user.isActive !== false;
  });

  if (activeAdmins.length === 0) {
    throw createHttpError(400, 'At least one active admin account is required');
  }
}

const app = express();

app.disable('x-powered-by');

app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()'
  );

  if (process.env.NODE_ENV === 'production') {
    res.setHeader(
      'Content-Security-Policy',
      [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
        "font-src 'self' https://fonts.gstatic.com",
        "img-src 'self' data: https:",
        "connect-src 'self'",
        "frame-ancestors 'none'",
        "base-uri 'self'",
        "form-action 'self'",
      ].join('; ')
    );
  }

  next();
});

app.use(express.json({ limit: '1mb' }));

app.use((req, res, next) => {
  const requestId = req.headers['x-request-id'] || crypto.randomUUID();
  const startedAt = process.hrtime.bigint();

  req.requestId = String(requestId);
  res.setHeader('X-Request-Id', req.requestId);

  if (requestLogging) {
    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
      const log = {
        level: res.statusCode >= 500 ? 'error' : 'info',
        event: 'http_request',
        requestId: req.requestId,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Math.round(durationMs),
      };
      console.log(JSON.stringify(log));
    });
  }

  next();
});

app.use((req, res, next) => {
  const origin = req.headers.origin;
  const isAllowedOrigin = !origin || allowedOrigins.has(origin);

  if (origin && isAllowedOrigin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.sendStatus(isAllowedOrigin ? 204 : 403);
    return;
  }

  if (!isAllowedOrigin) {
    next(createHttpError(403, 'Origin is not allowed.'));
    return;
  }

  next();
});

app.use('/api', generalLimiter);

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'bistro-ai-api',
    storage: storageDriver,
    authEnabled: isAuthEnabled,
    aiEnabled: isAiEnabled,
    serveStatic,
    requestLogging,
    rateLimitEnabled,
    allowedOrigins: Array.from(allowedOrigins),
    dataFile: storageDriver === 'json' ? jsonStore.dataFile : undefined,
  });
});

app.post('/api/auth/login', authLimiter, asyncRoute(async (req, res) => {
  const session = await login(req.body || {}, store);
  if (!session) {
    throw createHttpError(401, 'Invalid username or password');
  }

  res.json(session);
}));

app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    username: req.user?.username || 'admin',
    role: req.user?.role || 'admin',
    authEnabled: isAuthEnabled,
  });
});

app.post('/api/ai/menu-description', aiLimiter, requireRole('admin', 'manager'), asyncRoute(async (req, res) => {
  requireFields(req.body || {}, ['name', 'category']);
  res.json(await generateMenuDescription(req.body));
}));

app.post('/api/ai/script', aiLimiter, requireRole('admin', 'manager'), asyncRoute(async (req, res) => {
  res.json(await generateScript(req.body || {}));
}));

app.get('/api/bootstrap', asyncRoute(async (_req, res) => {
  res.json(await store.getWorkspace());
}));

app.get('/api/analytics/overview', asyncRoute(async (_req, res) => {
  res.json(await getOverviewAnalytics(store));
}));

app.get('/api/reports/operations', requireRole('admin', 'manager'), asyncRoute(async (_req, res) => {
  const report = await buildOperationsReport(store);
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${report.filename}"`);
  res.send(report.content);
}));

app.get('/api/workspace/export', requireRole('admin'), asyncRoute(async (_req, res) => {
  const exportedAt = new Date().toISOString();
  const backup = {
    exportedAt,
    version: 1,
    storage: storageDriver,
    workspace: typeof store.getBackupWorkspace === 'function' ? await store.getBackupWorkspace() : await store.getWorkspace(),
  };

  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="bistro-ai-workspace-${exportedAt.slice(0, 10)}.json"`);
  res.json(backup);
}));

app.post('/api/workspace/import', requireRole('admin'), asyncRoute(async (req, res) => {
  if (typeof store.replaceWorkspace !== 'function') {
    throw createHttpError(501, 'Workspace import is not supported by the active storage driver');
  }

  const workspace = sanitizeWorkspaceBackup(req.body || {});
  res.json(await store.replaceWorkspace(workspace));
}));

app.get('/api/users', requireRole('admin'), asyncRoute(async (_req, res) => {
  res.json(await store.listUsers());
}));

app.post('/api/users', requireRole('admin'), asyncRoute(async (req, res) => {
  requireFields(req.body || {}, ['username', 'password']);
  const user = sanitizeUser(req.body || {});
  const password = String(req.body.password || '');
  if (password.length < 8) {
    throw createHttpError(400, 'Password must be at least 8 characters');
  }

  const created = await store.createUser({
    id: `user-${crypto.randomUUID()}`,
    ...user,
    passwordHash: hashPassword(password),
    createdAt: new Date().toISOString(),
  });

  if (!created) {
    throw createHttpError(409, 'Username already exists');
  }

  res.status(201).json(created);
}));

app.put('/api/users/:id', requireRole('admin'), asyncRoute(async (req, res) => {
  const users = await store.listUsers({ includePasswordHash: true });
  const existing = users.find((user) => user.id === req.params.id);
  if (!existing) {
    throw createHttpError(404, 'User not found');
  }

  const user = sanitizeUser(req.body || {}, existing);
  await assertAdminWillRemain(req.params.id, user.role, user.isActive);
  const updates = { ...user };
  if (req.body.password) {
    const password = String(req.body.password);
    if (password.length < 8) {
      throw createHttpError(400, 'Password must be at least 8 characters');
    }
    updates.passwordHash = hashPassword(password);
  }

  res.json(await store.updateUser(req.params.id, updates));
}));

app.delete('/api/users/:id', requireRole('admin'), asyncRoute(async (req, res) => {
  await assertAdminWillRemain(req.params.id, 'staff', false);
  const deleted = await store.deleteUser(req.params.id);
  if (!deleted) {
    throw createHttpError(404, 'User not found');
  }
  res.json({ ok: true });
}));

app.get('/api/menu-items', asyncRoute(async (_req, res) => {
  res.json(await store.listMenuItems());
}));

app.post('/api/menu-items', requireRole('admin', 'manager'), asyncRoute(async (req, res) => {
  const item = sanitizeMenuItem(req.body);
  res.status(201).json(await store.createMenuItem(item));
}));

app.put('/api/menu-items/:id', requireRole('admin', 'manager'), asyncRoute(async (req, res) => {
  const existing = (await store.listMenuItems()).find((item) => item.id === req.params.id);
  if (!existing) {
    throw createHttpError(404, 'Menu item not found');
  }

  const item = sanitizeMenuItem({ ...existing, ...req.body }, req.params.id);
  res.json(await store.updateMenuItem(req.params.id, item));
}));

app.delete('/api/menu-items/:id', requireRole('admin', 'manager'), asyncRoute(async (req, res) => {
  const deleted = await store.deleteMenuItem(req.params.id);
  if (!deleted) {
    throw createHttpError(404, 'Menu item not found');
  }
  res.json({ ok: true });
}));

app.get('/api/scripts', asyncRoute(async (_req, res) => {
  res.json(await store.listScripts());
}));

app.post('/api/scripts', requireRole('admin', 'manager'), asyncRoute(async (req, res) => {
  const script = sanitizeScript(req.body);
  res.status(201).json(await store.createScript(script));
}));

app.put('/api/scripts/:id', requireRole('admin', 'manager'), asyncRoute(async (req, res) => {
  const existing = (await store.listScripts()).find((script) => script.id === req.params.id);
  if (!existing) {
    throw createHttpError(404, 'Script not found');
  }

  const script = sanitizeScript({ ...existing, ...req.body }, req.params.id);
  res.json(await store.updateScript(req.params.id, script));
}));

app.delete('/api/scripts/:id', requireRole('admin', 'manager'), asyncRoute(async (req, res) => {
  const deleted = await store.deleteScript(req.params.id);
  if (!deleted) {
    throw createHttpError(404, 'Script not found');
  }
  res.json({ ok: true });
}));

app.get('/api/activity-logs', asyncRoute(async (_req, res) => {
  res.json(await store.listActivityLogs());
}));

app.post('/api/activity-logs', requireRole('admin', 'manager', 'staff'), asyncRoute(async (req, res) => {
  const log = sanitizeActivityLog(req.body);
  res.status(201).json(await store.createActivityLog(log));
}));

app.get('/api/reservations', asyncRoute(async (_req, res) => {
  res.json(await store.listReservations());
}));

app.post('/api/reservations', requireRole('admin', 'manager', 'staff'), asyncRoute(async (req, res) => {
  const reservation = sanitizeReservation(req.body);
  res.status(201).json(await store.createReservation(reservation));
}));

app.put('/api/reservations/:id', requireRole('admin', 'manager', 'staff'), asyncRoute(async (req, res) => {
  const existing = (await store.listReservations()).find((reservation) => reservation.id === req.params.id);
  if (!existing) {
    throw createHttpError(404, 'Reservation not found');
  }

  const reservation = sanitizeReservation({ ...existing, ...req.body }, req.params.id);
  res.json(await store.updateReservation(req.params.id, reservation));
}));

app.delete('/api/reservations/:id', requireRole('admin', 'manager', 'staff'), asyncRoute(async (req, res) => {
  const deleted = await store.deleteReservation(req.params.id);
  if (!deleted) {
    throw createHttpError(404, 'Reservation not found');
  }
  res.json({ ok: true });
}));

app.get('/api/orders', asyncRoute(async (_req, res) => {
  res.json(await store.listOrders());
}));

app.post('/api/orders', requireRole('admin', 'manager', 'staff'), asyncRoute(async (req, res) => {
  const order = sanitizeOrder(req.body);
  res.status(201).json(await store.createOrder(order));
}));

app.put('/api/orders/:id', requireRole('admin', 'manager', 'staff'), asyncRoute(async (req, res) => {
  const existing = (await store.listOrders()).find((order) => order.id === req.params.id);
  if (!existing) {
    throw createHttpError(404, 'Order not found');
  }

  const order = sanitizeOrder({ ...existing, ...req.body }, req.params.id);
  res.json(await store.updateOrder(req.params.id, order));
}));

app.delete('/api/orders/:id', requireRole('admin', 'manager', 'staff'), asyncRoute(async (req, res) => {
  const deleted = await store.deleteOrder(req.params.id);
  if (!deleted) {
    throw createHttpError(404, 'Order not found');
  }
  res.json({ ok: true });
}));

app.get('/api/settings', asyncRoute(async (_req, res) => {
  res.json(await store.getSettings());
}));

app.put('/api/settings', requireRole('admin'), asyncRoute(async (req, res) => {
  const settings = await store.getSettings();
  res.json(await store.updateSettings({ ...settings, ...req.body }));
}));

app.post('/api/reset', requireRole('admin'), asyncRoute(async (_req, res) => {
  await store.resetWorkspace();
  res.json({ ok: true });
}));

if (serveStatic) {
  app.use(express.static(distDir));

  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) {
      next();
      return;
    }

    res.sendFile(path.join(distDir, 'index.html'));
  });
}

app.use((error, req, res, _next) => {
  const status = error.status || 500;
  const message = error.message || 'Internal server error';

  if (status >= 500) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'http_error',
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status,
      message,
    }));
  }

  res.status(status).json({
    error: {
      message,
      status,
      requestId: req.requestId,
    },
  });
});

initializeStore()
  .then(() => {
    app.listen(port, () => {
      console.log(`Bistro AI API listening on http://localhost:${port} (${storageDriver})`);
    });
  })
  .catch((error) => {
    console.error('Failed to initialize Bistro AI API storage:', error);
    process.exit(1);
  });
