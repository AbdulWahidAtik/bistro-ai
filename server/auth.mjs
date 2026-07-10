import crypto from 'node:crypto';

const tokenTtlMs = Number(process.env.AUTH_TOKEN_TTL_MS || 24 * 60 * 60 * 1000);
const adminUsername = process.env.ADMIN_USERNAME || 'admin';
const adminPassword = process.env.ADMIN_PASSWORD || '';
const authSecret = process.env.AUTH_SECRET || adminPassword || 'bistro-ai-dev-secret';
const isProduction = process.env.NODE_ENV === 'production';
export const userRoles = ['admin', 'manager', 'staff'];

export const isAuthEnabled = Boolean(adminPassword);

if (isProduction && isAuthEnabled) {
  const weakSecrets = new Set([
    '',
    adminPassword,
    'bistro-ai-dev-secret',
    'replace-with-a-long-random-secret-before-enabling-auth',
  ]);

  if (weakSecrets.has(authSecret) || authSecret.length < 32) {
    throw new Error('AUTH_SECRET must be at least 32 characters and distinct from ADMIN_PASSWORD in production.');
  }
}

function base64UrlEncode(input) {
  return Buffer.from(JSON.stringify(input)).toString('base64url');
}

function signPayload(payload) {
  return crypto
    .createHmac('sha256', authSecret)
    .update(payload)
    .digest('base64url');
}

function timingSafeEqualText(a, b) {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const hash = crypto.scryptSync(String(password), salt, 64).toString('base64url');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  if (!storedHash || typeof storedHash !== 'string') return false;

  if (!storedHash.startsWith('scrypt:')) {
    return timingSafeEqualText(String(password), storedHash);
  }

  const [, salt, expectedHash] = storedHash.split(':');
  if (!salt || !expectedHash) return false;

  const hash = crypto.scryptSync(String(password), salt, 64).toString('base64url');
  return timingSafeEqualText(hash, expectedHash);
}

export function createAuthToken(username, role = 'admin') {
  const payload = base64UrlEncode({
    sub: username,
    role: userRoles.includes(role) ? role : 'staff',
    exp: Date.now() + tokenTtlMs,
  });
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export function verifyAuthToken(token) {
  if (!token || !token.includes('.')) return false;
  const [payload, signature] = token.split('.');
  const expectedSignature = signPayload(payload);
  if (!timingSafeEqualText(signature, expectedSignature)) return false;

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (typeof decoded.exp !== 'number' || decoded.exp <= Date.now()) return false;
    if (typeof decoded.sub !== 'string' || !decoded.sub) return false;
    return {
      username: decoded.sub,
      role: userRoles.includes(decoded.role) ? decoded.role : 'staff',
    };
  } catch {
    return false;
  }
}

export async function initializeAuthUsers(store) {
  if (!isAuthEnabled || typeof store.findUserByUsername !== 'function') {
    return;
  }

  const existing = await store.findUserByUsername(adminUsername);
  if (existing) {
    return;
  }

  await store.createUser({
    id: `user-${crypto.randomUUID()}`,
    username: adminUsername,
    displayName: 'Admin',
    role: 'admin',
    passwordHash: hashPassword(adminPassword),
    isActive: true,
    createdAt: new Date().toISOString(),
  });
}

export async function login(body, store) {
  if (!isAuthEnabled) {
    return {
      token: createAuthToken(adminUsername),
      username: adminUsername,
      role: 'admin',
      authEnabled: false,
    };
  }

  const username = String(body.username || '');
  const password = String(body.password || '');
  const user = await store.findUserByUsername(username);

  if (!user || user.isActive === false || !verifyPassword(password, user.passwordHash)) {
    return null;
  }

  return {
    token: createAuthToken(user.username, user.role),
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    authEnabled: true,
  };
}

export function requireAuth(req, res, next) {
  if (!isAuthEnabled) {
    next();
    return;
  }

  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  const user = verifyAuthToken(token);
  if (!user) {
    const error = new Error('Authentication required');
    error.status = 401;
    next(error);
    return;
  }

  req.user = user;
  next();
}

export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    requireAuth(req, res, (error) => {
      if (error) {
        next(error);
        return;
      }

      if (!isAuthEnabled || allowedRoles.includes(req.user?.role)) {
        next();
        return;
      }

      const forbidden = new Error('You do not have permission to perform this action');
      forbidden.status = 403;
      next(forbidden);
    });
  };
}
