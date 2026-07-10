import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedData } from './seed-data.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const dataDir = path.join(rootDir, 'data');
const dataFile = process.env.DATA_FILE
  ? path.resolve(rootDir, process.env.DATA_FILE)
  : path.join(dataDir, 'bistro-ai.json');

function normalizeStore(store) {
  return {
    menuItems: Array.isArray(store.menuItems) ? store.menuItems : seedData.menuItems,
    scripts: Array.isArray(store.scripts) ? store.scripts : seedData.scripts,
    activityLogs: Array.isArray(store.activityLogs) ? store.activityLogs : seedData.activityLogs,
    reservations: Array.isArray(store.reservations) ? store.reservations : seedData.reservations,
    orders: Array.isArray(store.orders) ? store.orders : seedData.orders,
    users: Array.isArray(store.users) ? store.users : [],
    settings: store.settings && typeof store.settings === 'object'
      ? { ...seedData.settings, ...store.settings }
      : seedData.settings,
  };
}

function publicWorkspace(store) {
  const { users, ...workspace } = store;
  return workspace;
}

function publicUser(user) {
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

async function ensureStore() {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });

  try {
    await fs.access(dataFile);
  } catch {
    await writeStore(seedData);
  }
}

async function readStore() {
  await ensureStore();
  const raw = await fs.readFile(dataFile, 'utf8');
  return normalizeStore(JSON.parse(raw));
}

async function writeStore(nextData) {
  await fs.mkdir(path.dirname(dataFile), { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(normalizeStore(nextData), null, 2));
}

export const jsonStore = {
  dataFile,

  async getWorkspace() {
    return publicWorkspace(await readStore());
  },

  async getBackupWorkspace() {
    return readStore();
  },

  async listMenuItems() {
    const store = await readStore();
    return store.menuItems;
  },

  async createMenuItem(item) {
    const store = await readStore();
    store.menuItems = [item, ...store.menuItems.filter((existing) => existing.id !== item.id)];
    await writeStore(store);
    return item;
  },

  async updateMenuItem(id, item) {
    const store = await readStore();
    const index = store.menuItems.findIndex((existing) => existing.id === id);
    if (index === -1) return null;
    store.menuItems[index] = item;
    await writeStore(store);
    return item;
  },

  async deleteMenuItem(id) {
    const store = await readStore();
    const beforeCount = store.menuItems.length;
    store.menuItems = store.menuItems.filter((item) => item.id !== id);
    await writeStore(store);
    return store.menuItems.length < beforeCount;
  },

  async listScripts() {
    const store = await readStore();
    return store.scripts;
  },

  async createScript(script) {
    const store = await readStore();
    store.scripts = [script, ...store.scripts.filter((existing) => existing.id !== script.id)];
    await writeStore(store);
    return script;
  },

  async updateScript(id, script) {
    const store = await readStore();
    const index = store.scripts.findIndex((existing) => existing.id === id);
    if (index === -1) return null;
    store.scripts[index] = script;
    await writeStore(store);
    return script;
  },

  async deleteScript(id) {
    const store = await readStore();
    const beforeCount = store.scripts.length;
    store.scripts = store.scripts.filter((script) => script.id !== id);
    await writeStore(store);
    return store.scripts.length < beforeCount;
  },

  async listActivityLogs() {
    const store = await readStore();
    return store.activityLogs;
  },

  async listReservations() {
    const store = await readStore();
    return store.reservations;
  },

  async createReservation(reservation) {
    const store = await readStore();
    store.reservations = [reservation, ...store.reservations.filter((existing) => existing.id !== reservation.id)];
    await writeStore(store);
    return reservation;
  },

  async updateReservation(id, reservation) {
    const store = await readStore();
    const index = store.reservations.findIndex((existing) => existing.id === id);
    if (index === -1) return null;
    store.reservations[index] = reservation;
    await writeStore(store);
    return reservation;
  },

  async deleteReservation(id) {
    const store = await readStore();
    const beforeCount = store.reservations.length;
    store.reservations = store.reservations.filter((reservation) => reservation.id !== id);
    await writeStore(store);
    return store.reservations.length < beforeCount;
  },

  async listOrders() {
    const store = await readStore();
    return store.orders;
  },

  async createOrder(order) {
    const store = await readStore();
    store.orders = [order, ...store.orders.filter((existing) => existing.id !== order.id)];
    await writeStore(store);
    return order;
  },

  async updateOrder(id, order) {
    const store = await readStore();
    const index = store.orders.findIndex((existing) => existing.id === id);
    if (index === -1) return null;
    store.orders[index] = order;
    await writeStore(store);
    return order;
  },

  async deleteOrder(id) {
    const store = await readStore();
    const beforeCount = store.orders.length;
    store.orders = store.orders.filter((order) => order.id !== id);
    await writeStore(store);
    return store.orders.length < beforeCount;
  },

  async createActivityLog(log) {
    const store = await readStore();
    store.activityLogs = [log, ...store.activityLogs.filter((existing) => existing.id !== log.id)].slice(0, 100);
    await writeStore(store);
    return log;
  },

  async getSettings() {
    const store = await readStore();
    return store.settings;
  },

  async updateSettings(settings) {
    const store = await readStore();
    store.settings = { ...store.settings, ...settings };
    await writeStore(store);
    return store.settings;
  },

  async replaceWorkspace(workspace) {
    const current = await readStore();
    await writeStore({ ...workspace, users: current.users });
    return publicWorkspace(await readStore());
  },

  async resetWorkspace() {
    const current = await readStore();
    await writeStore({ ...seedData, users: current.users });
  },

  async listUsers({ includePasswordHash = false } = {}) {
    const store = await readStore();
    return includePasswordHash ? store.users : store.users.map(publicUser);
  },

  async findUserByUsername(username) {
    const store = await readStore();
    const normalizedUsername = String(username || '').trim().toLowerCase();
    return store.users.find((user) => user.username.toLowerCase() === normalizedUsername) || null;
  },

  async createUser(user) {
    const store = await readStore();
    const usernameExists = store.users.some(
      (existing) => existing.username.toLowerCase() === user.username.toLowerCase()
    );
    if (usernameExists) {
      return null;
    }

    store.users = [user, ...store.users];
    await writeStore(store);
    return publicUser(user);
  },

  async updateUser(id, updates) {
    const store = await readStore();
    const index = store.users.findIndex((user) => user.id === id);
    if (index === -1) return null;

    const nextUser = { ...store.users[index], ...updates, id: store.users[index].id };
    store.users[index] = nextUser;
    await writeStore(store);
    return publicUser(nextUser);
  },

  async deleteUser(id) {
    const store = await readStore();
    const beforeCount = store.users.length;
    store.users = store.users.filter((user) => user.id !== id);
    await writeStore(store);
    return store.users.length < beforeCount;
  },
};
