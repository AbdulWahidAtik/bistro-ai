import mongoose from 'mongoose';
import { seedData } from './seed-data.mjs';

const menuItemSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    price: { type: Number, required: true },
    isSpecial: { type: Boolean, default: false },
    status: { type: String, enum: ['active', 'inactive'], default: 'active' },
  },
  { timestamps: true, versionKey: false }
);

const scriptSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    category: { type: String, required: true },
    text: { type: String, required: true },
    avatarText: { type: String, default: 'AI' },
    lastUpdated: { type: String, default: 'Updated just now' },
    stats: {
      successRate: { type: String, default: 'Pending' },
      avgDuration: { type: String, default: 'Pending' },
      intentAccuracy: { type: String, default: 'Pending' },
    },
  },
  { timestamps: true, versionKey: false }
);

const activityLogSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    detail: { type: String, required: true },
    time: { type: String, required: true },
    duration: { type: String, required: true },
    status: { type: String, enum: ['SUCCESS', 'HANDLED'], default: 'HANDLED' },
  },
  { timestamps: true, versionKey: false }
);

const reservationSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    customerName: { type: String, required: true },
    phone: { type: String, required: true },
    partySize: { type: Number, required: true },
    reservationDate: { type: String, required: true },
    reservationTime: { type: String, required: true },
    notes: { type: String, default: '' },
    status: { type: String, enum: ['pending', 'confirmed', 'seated', 'cancelled'], default: 'pending' },
    source: { type: String, enum: ['ai-call', 'web', 'staff'], default: 'staff' },
  },
  { timestamps: true, versionKey: false }
);

const orderItemSchema = new mongoose.Schema(
  {
    menuItemId: { type: String, default: '' },
    name: { type: String, required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true },
  },
  { _id: false }
);

const orderSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    customerName: { type: String, required: true },
    phone: { type: String, required: true },
    items: { type: [orderItemSchema], default: [] },
    total: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'preparing', 'ready', 'completed', 'cancelled'], default: 'pending' },
    type: { type: String, enum: ['dine-in', 'takeout', 'delivery'], default: 'takeout' },
    placedAt: { type: String, required: true },
    notes: { type: String, default: '' },
  },
  { timestamps: true, versionKey: false }
);

const settingsSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'workspace' },
    brandName: { type: String, required: true },
    activeVoice: { type: String, required: true },
    phoneRouting: { type: String, required: true },
    autoUpsellPercent: { type: Number, required: true },
    autoConfirmSms: { type: Boolean, required: true },
    serviceHours: {
      weekdays: { type: String, required: true },
      saturday: { type: String, required: true },
      sunday: { type: String, required: true },
    },
  },
  { timestamps: true, versionKey: false }
);

const userSchema = new mongoose.Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    username: { type: String, required: true, unique: true, index: true },
    displayName: { type: String, default: '' },
    role: { type: String, enum: ['admin', 'manager', 'staff'], default: 'staff' },
    passwordHash: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    createdAt: { type: String, required: true },
  },
  { timestamps: true, versionKey: false }
);

const MenuItem = mongoose.model('MenuItem', menuItemSchema);
const Script = mongoose.model('Script', scriptSchema);
const ActivityLog = mongoose.model('ActivityLog', activityLogSchema);
const Reservation = mongoose.model('Reservation', reservationSchema);
const Order = mongoose.model('Order', orderSchema);
const Settings = mongoose.model('Settings', settingsSchema);
const User = mongoose.model('User', userSchema);

function cleanDocument(document) {
  if (!document) return null;
  const { _id, createdAt, updatedAt, ...rest } = document.toObject();
  return rest;
}

function cleanUser(document, { includePasswordHash = false } = {}) {
  const user = cleanDocument(document);
  if (!user || includePasswordHash) return user;
  const { passwordHash, ...safeUser } = user;
  return safeUser;
}

async function seedIfEmpty() {
  const [menuCount, scriptCount, logCount, reservationCount, orderCount, settingsCount] = await Promise.all([
    MenuItem.countDocuments(),
    Script.countDocuments(),
    ActivityLog.countDocuments(),
    Reservation.countDocuments(),
    Order.countDocuments(),
    Settings.countDocuments({ key: 'workspace' }),
  ]);

  if (menuCount === 0) {
    await MenuItem.insertMany(seedData.menuItems);
  }
  if (scriptCount === 0) {
    await Script.insertMany(seedData.scripts);
  }
  if (logCount === 0) {
    await ActivityLog.insertMany(seedData.activityLogs);
  }
  if (reservationCount === 0) {
    await Reservation.insertMany(seedData.reservations);
  }
  if (orderCount === 0) {
    await Order.insertMany(seedData.orders);
  }
  if (settingsCount === 0) {
    await Settings.create({ key: 'workspace', ...seedData.settings });
  }
}

export async function connectMongoStore(uri) {
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
  });
  await seedIfEmpty();
}

export async function getMongoWorkspace() {
  const [menuItems, scripts, activityLogs, reservations, orders, settings] = await Promise.all([
    MenuItem.find().sort({ createdAt: -1 }).lean({ virtuals: false }),
    Script.find().sort({ createdAt: -1 }).lean({ virtuals: false }),
    ActivityLog.find().sort({ createdAt: -1 }).limit(100).lean({ virtuals: false }),
    Reservation.find().sort({ reservationDate: 1, reservationTime: 1 }).lean({ virtuals: false }),
    Order.find().sort({ createdAt: -1 }).lean({ virtuals: false }),
    Settings.findOne({ key: 'workspace' }).lean({ virtuals: false }),
  ]);

  return {
    menuItems: menuItems.map(({ _id, createdAt, updatedAt, ...item }) => item),
    scripts: scripts.map(({ _id, createdAt, updatedAt, ...script }) => script),
    activityLogs: activityLogs.map(({ _id, createdAt, updatedAt, ...log }) => log),
    reservations: reservations.map(({ _id, createdAt, updatedAt, ...reservation }) => reservation),
    orders: orders.map(({ _id, createdAt, updatedAt, ...order }) => order),
    settings: settings
      ? cleanDocument({ toObject: () => settings })
      : seedData.settings,
  };
}

export const mongoStore = {
  async getWorkspace() {
    return getMongoWorkspace();
  },

  async getBackupWorkspace() {
    const workspace = await getMongoWorkspace();
    const users = await User.find().sort({ createdAt: -1 });
    return {
      ...workspace,
      users: users.map((user) => cleanUser(user, { includePasswordHash: true })),
    };
  },

  async listMenuItems() {
    const items = await MenuItem.find().sort({ createdAt: -1 });
    return items.map(cleanDocument);
  },

  async createMenuItem(item) {
    const document = await MenuItem.findOneAndUpdate(
      { id: item.id },
      item,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return cleanDocument(document);
  },

  async updateMenuItem(id, item) {
    const document = await MenuItem.findOneAndUpdate({ id }, item, { new: true });
    return cleanDocument(document);
  },

  async deleteMenuItem(id) {
    const result = await MenuItem.deleteOne({ id });
    return result.deletedCount > 0;
  },

  async listScripts() {
    const scripts = await Script.find().sort({ createdAt: -1 });
    return scripts.map(cleanDocument);
  },

  async createScript(script) {
    const document = await Script.findOneAndUpdate(
      { id: script.id },
      script,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return cleanDocument(document);
  },

  async updateScript(id, script) {
    const document = await Script.findOneAndUpdate({ id }, script, { new: true });
    return cleanDocument(document);
  },

  async deleteScript(id) {
    const result = await Script.deleteOne({ id });
    return result.deletedCount > 0;
  },

  async listActivityLogs() {
    const logs = await ActivityLog.find().sort({ createdAt: -1 }).limit(100);
    return logs.map(cleanDocument);
  },

  async createActivityLog(log) {
    const document = await ActivityLog.findOneAndUpdate(
      { id: log.id },
      log,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return cleanDocument(document);
  },

  async listReservations() {
    const reservations = await Reservation.find().sort({ reservationDate: 1, reservationTime: 1 });
    return reservations.map(cleanDocument);
  },

  async createReservation(reservation) {
    const document = await Reservation.findOneAndUpdate(
      { id: reservation.id },
      reservation,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return cleanDocument(document);
  },

  async updateReservation(id, reservation) {
    const document = await Reservation.findOneAndUpdate({ id }, reservation, { new: true });
    return cleanDocument(document);
  },

  async deleteReservation(id) {
    const result = await Reservation.deleteOne({ id });
    return result.deletedCount > 0;
  },

  async listOrders() {
    const orders = await Order.find().sort({ createdAt: -1 });
    return orders.map(cleanDocument);
  },

  async createOrder(order) {
    const document = await Order.findOneAndUpdate(
      { id: order.id },
      order,
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return cleanDocument(document);
  },

  async updateOrder(id, order) {
    const document = await Order.findOneAndUpdate({ id }, order, { new: true });
    return cleanDocument(document);
  },

  async deleteOrder(id) {
    const result = await Order.deleteOne({ id });
    return result.deletedCount > 0;
  },

  async getSettings() {
    const settings = await Settings.findOne({ key: 'workspace' });
    return settings ? cleanDocument(settings) : seedData.settings;
  },

  async updateSettings(settings) {
    const document = await Settings.findOneAndUpdate(
      { key: 'workspace' },
      { key: 'workspace', ...settings },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
    return cleanDocument(document);
  },

  async replaceWorkspace(workspace) {
    await Promise.all([
      MenuItem.deleteMany({}),
      Script.deleteMany({}),
      ActivityLog.deleteMany({}),
      Reservation.deleteMany({}),
      Order.deleteMany({}),
      Settings.deleteMany({}),
    ]);

    await Promise.all([
      workspace.menuItems.length > 0 ? MenuItem.insertMany(workspace.menuItems) : Promise.resolve(),
      workspace.scripts.length > 0 ? Script.insertMany(workspace.scripts) : Promise.resolve(),
      workspace.activityLogs.length > 0 ? ActivityLog.insertMany(workspace.activityLogs) : Promise.resolve(),
      workspace.reservations.length > 0 ? Reservation.insertMany(workspace.reservations) : Promise.resolve(),
      workspace.orders.length > 0 ? Order.insertMany(workspace.orders) : Promise.resolve(),
      Settings.create({ key: 'workspace', ...workspace.settings }),
    ]);

    return getMongoWorkspace();
  },

  async resetWorkspace() {
    await Promise.all([
      MenuItem.deleteMany({}),
      Script.deleteMany({}),
      ActivityLog.deleteMany({}),
      Reservation.deleteMany({}),
      Order.deleteMany({}),
      Settings.deleteMany({}),
    ]);
    await seedIfEmpty();
  },

  async listUsers({ includePasswordHash = false } = {}) {
    const users = await User.find().sort({ createdAt: -1 });
    return users.map((user) => cleanUser(user, { includePasswordHash }));
  },

  async findUserByUsername(username) {
    const user = await User.findOne({ username: String(username || '').trim() });
    return cleanUser(user, { includePasswordHash: true });
  },

  async createUser(user) {
    const existing = await User.findOne({ username: user.username });
    if (existing) return null;

    const document = await User.create(user);
    return cleanUser(document);
  },

  async updateUser(id, updates) {
    const document = await User.findOneAndUpdate({ id }, updates, { new: true });
    return cleanUser(document);
  },

  async deleteUser(id) {
    const result = await User.deleteOne({ id });
    return result.deletedCount > 0;
  },
};
