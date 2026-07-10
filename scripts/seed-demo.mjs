import 'dotenv/config';
import mongoose from 'mongoose';
import { hashPassword } from '../server/auth.mjs';
import { jsonStore } from '../server/json-store.mjs';
import { connectMongoStore, mongoStore } from '../server/mongo-store.mjs';

const mongoUri = process.env.MONGODB_URI || '';
const store = mongoUri ? mongoStore : jsonStore;

const demoUsers = [
  {
    id: 'demo-admin',
    username: process.env.DEMO_ADMIN_USERNAME || 'admin',
    displayName: 'Alex Rivera',
    role: 'admin',
    password: process.env.DEMO_ADMIN_PASSWORD || 'AdminPass123!',
  },
  {
    id: 'demo-manager',
    username: process.env.DEMO_MANAGER_USERNAME || 'manager',
    displayName: 'Maya Chen',
    role: 'manager',
    password: process.env.DEMO_MANAGER_PASSWORD || 'ManagerPass123!',
  },
  {
    id: 'demo-staff',
    username: process.env.DEMO_STAFF_USERNAME || 'staff',
    displayName: 'Jordan Lee',
    role: 'staff',
    password: process.env.DEMO_STAFF_PASSWORD || 'StaffPass123!',
  },
];

async function upsertDemoUser(user) {
  const existing = await store.findUserByUsername(user.username);
  const updates = {
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    passwordHash: hashPassword(user.password),
    isActive: true,
  };

  if (existing) {
    return store.updateUser(existing.id, updates);
  }

  return store.createUser({
    id: user.id,
    ...updates,
    createdAt: new Date().toISOString(),
  });
}

async function main() {
  if (mongoUri) {
    await connectMongoStore(mongoUri);
  }

  await store.resetWorkspace();
  const users = [];
  for (const user of demoUsers) {
    users.push(await upsertDemoUser(user));
  }

  console.log(JSON.stringify({
    ok: true,
    storage: mongoUri ? 'mongodb' : 'json',
    users: users.map((user) => ({
      username: user.username,
      role: user.role,
      password: demoUsers.find((demoUser) => demoUser.username === user.username)?.password,
    })),
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoUri) {
      await mongoose.disconnect();
    }
  });
