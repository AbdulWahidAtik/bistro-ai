import { AccessUser, ActivityLog, DashboardAnalytics, MenuItem, Order, Reservation, Script, UserRole, WorkspaceSettings } from './types';

export interface BackendWorkspace {
  menuItems: MenuItem[];
  scripts: Script[];
  activityLogs: ActivityLog[];
  reservations: Reservation[];
  orders: Order[];
  settings: WorkspaceSettings;
}

const authTokenKey = 'bistro-ai:auth-token';
const authSessionKey = 'bistro-ai:auth-session';
const authExpiredEvent = 'bistro-ai:auth-expired';

export interface BackendHealth {
  ok: boolean;
  service: string;
  storage: string;
  authEnabled: boolean;
  aiEnabled: boolean;
  dataFile?: string;
}

export interface AuthSession {
  token: string;
  username: string;
  displayName?: string;
  role: UserRole;
  authEnabled: boolean;
}

function getAuthToken() {
  try {
    return window.localStorage.getItem(authTokenKey);
  } catch {
    return null;
  }
}

export function saveAuthToken(token: string) {
  window.localStorage.setItem(authTokenKey, token);
}

export function saveAuthSession(session: AuthSession) {
  window.localStorage.setItem(authTokenKey, session.token);
  window.localStorage.setItem(authSessionKey, JSON.stringify(session));
}

export function clearAuthToken() {
  window.localStorage.removeItem(authTokenKey);
  window.localStorage.removeItem(authSessionKey);
}

export function hasAuthToken() {
  return Boolean(getAuthToken());
}

export function getAuthSession(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(authSessionKey);
    return raw ? JSON.parse(raw) as AuthSession : null;
  } catch {
    return null;
  }
}

function handleUnauthorized(path: string, status: number) {
  if (status !== 401 || path === '/api/auth/login') {
    return;
  }

  clearAuthToken();
  window.dispatchEvent(new CustomEvent(authExpiredEvent));
}

async function apiRequest<T>(path: string): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, { headers });

  if (!response.ok) {
    handleUnauthorized(path, response.status);
    throw new Error(`API request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

async function apiBlobRequest(path: string): Promise<{ blob: Blob; filename: string }> {
  const token = getAuthToken();
  const headers: Record<string, string> = {};

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, { headers });

  if (!response.ok) {
    handleUnauthorized(path, response.status);
    throw new Error(`API request failed with ${response.status}`);
  }

  const disposition = response.headers.get('Content-Disposition') || '';
  const filenameMatch = disposition.match(/filename="([^"]+)"/);
  return {
    blob: await response.blob(),
    filename: filenameMatch?.[1] || 'bistro-ai-operations-report.txt',
  };
}

export function loadBackendWorkspace() {
  return apiRequest<BackendWorkspace>('/api/bootstrap');
}

export function loadBackendHealth() {
  return apiRequest<BackendHealth>('/api/health');
}

export function loadDashboardAnalytics() {
  return apiRequest<DashboardAnalytics>('/api/analytics/overview');
}

export function downloadOperationsReport() {
  return apiBlobRequest('/api/reports/operations');
}

async function apiJsonRequest<T>(path: string, method: string, body?: unknown): Promise<T> {
  const token = getAuthToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (!response.ok) {
    handleUnauthorized(path, response.status);
    throw new Error(`API request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function createBackendMenuItem(item: MenuItem) {
  return apiJsonRequest<MenuItem>('/api/menu-items', 'POST', item);
}

export function updateBackendMenuItem(item: MenuItem) {
  return apiJsonRequest<MenuItem>(`/api/menu-items/${encodeURIComponent(item.id)}`, 'PUT', item);
}

export function deleteBackendMenuItem(id: string) {
  return apiJsonRequest<{ ok: boolean }>(`/api/menu-items/${encodeURIComponent(id)}`, 'DELETE');
}

export function createBackendScript(script: Script) {
  return apiJsonRequest<Script>('/api/scripts', 'POST', script);
}

export function updateBackendScript(script: Script) {
  return apiJsonRequest<Script>(`/api/scripts/${encodeURIComponent(script.id)}`, 'PUT', script);
}

export function deleteBackendScript(id: string) {
  return apiJsonRequest<{ ok: boolean }>(`/api/scripts/${encodeURIComponent(id)}`, 'DELETE');
}

export function createBackendActivityLog(log: ActivityLog) {
  return apiJsonRequest<ActivityLog>('/api/activity-logs', 'POST', log);
}

export function loadBackendReservations() {
  return apiRequest<Reservation[]>('/api/reservations');
}

export function createBackendReservation(reservation: Reservation) {
  return apiJsonRequest<Reservation>('/api/reservations', 'POST', reservation);
}

export function updateBackendReservation(reservation: Reservation) {
  return apiJsonRequest<Reservation>(`/api/reservations/${encodeURIComponent(reservation.id)}`, 'PUT', reservation);
}

export function deleteBackendReservation(id: string) {
  return apiJsonRequest<{ ok: boolean }>(`/api/reservations/${encodeURIComponent(id)}`, 'DELETE');
}

export function loadBackendOrders() {
  return apiRequest<Order[]>('/api/orders');
}

export function createBackendOrder(order: Order) {
  return apiJsonRequest<Order>('/api/orders', 'POST', order);
}

export function updateBackendOrder(order: Order) {
  return apiJsonRequest<Order>(`/api/orders/${encodeURIComponent(order.id)}`, 'PUT', order);
}

export function deleteBackendOrder(id: string) {
  return apiJsonRequest<{ ok: boolean }>(`/api/orders/${encodeURIComponent(id)}`, 'DELETE');
}

export function loadBackendSettings() {
  return apiRequest<WorkspaceSettings>('/api/settings');
}

export function updateBackendSettings(settings: WorkspaceSettings) {
  return apiJsonRequest<WorkspaceSettings>('/api/settings', 'PUT', settings);
}

export function loadBackendUsers() {
  return apiRequest<AccessUser[]>('/api/users');
}

export function createBackendUser(input: {
  username: string;
  displayName: string;
  role: UserRole;
  password: string;
  isActive: boolean;
}) {
  return apiJsonRequest<AccessUser>('/api/users', 'POST', input);
}

export function updateBackendUser(id: string, input: {
  username: string;
  displayName: string;
  role: UserRole;
  password?: string;
  isActive: boolean;
}) {
  return apiJsonRequest<AccessUser>(`/api/users/${encodeURIComponent(id)}`, 'PUT', input);
}

export function deleteBackendUser(id: string) {
  return apiJsonRequest<{ ok: boolean }>(`/api/users/${encodeURIComponent(id)}`, 'DELETE');
}

export function resetBackendWorkspace() {
  return apiJsonRequest<{ ok: boolean }>('/api/reset', 'POST');
}

export async function loginAdmin(username: string, password: string) {
  const session = await apiJsonRequest<AuthSession>('/api/auth/login', 'POST', { username, password });
  saveAuthSession(session);
  return session;
}

export function generateBackendMenuDescription(input: {
  name: string;
  category: string;
  price?: string;
  isSpecial?: boolean;
}) {
  return apiJsonRequest<{ description: string; source: 'gemini' | 'fallback' }>(
    '/api/ai/menu-description',
    'POST',
    input
  );
}

export function generateBackendScript(input: {
  brandName?: string;
  purpose?: string;
  menuItems?: MenuItem[];
}) {
  return apiJsonRequest<{
    script: Omit<Script, 'id'>;
    source: 'gemini' | 'fallback';
  }>('/api/ai/script', 'POST', input);
}
