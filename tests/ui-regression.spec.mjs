import { expect, test } from '@playwright/test';
import { createServer } from 'vite';

let viteServer;

test.beforeAll(async () => {
  viteServer = await createServer({
    configFile: 'vite.config.ts',
    server: {
      host: '127.0.0.1',
      port: 4173,
      strictPort: true,
    },
  });
  await viteServer.listen();
});

test.afterAll(async () => {
  await viteServer?.close();
});

const workspace = {
  menuItems: [
    {
      id: 'menu-risotto',
      name: 'Wild Mushroom Risotto',
      description: 'Creamy arborio rice with roasted mushrooms and herbs.',
      category: 'Main',
      price: 25,
      isSpecial: true,
      status: 'active',
    },
    {
      id: 'menu-salad',
      name: 'Citrus Garden Salad',
      description: 'Bright greens with citrus vinaigrette.',
      category: 'Starter',
      price: 14,
      isSpecial: false,
      status: 'active',
    },
  ],
  scripts: [
    {
      id: 'script-1',
      title: 'Reservation Follow-up',
      description: 'Reservation confirmation flow.',
      category: 'DYNAMIC',
      text: '[AI]: "Thanks for calling Bistro Prime."',
      avatarText: 'AI',
      lastUpdated: 'Updated just now',
      stats: {
        successRate: '92%',
        avgDuration: '1:10',
        intentAccuracy: '96%',
      },
    },
  ],
  activityLogs: [
    {
      id: 'log-1',
      type: 'reservation',
      title: 'Reservation Confirmed',
      detail: 'Maya Patel confirmed a party of 4',
      time: 'Just now',
      duration: '0:22',
      status: 'SUCCESS',
    },
  ],
  reservations: [
    {
      id: 'reservation-1',
      customerName: 'Maya Patel',
      phone: '+1 (555) 111-2222',
      partySize: 4,
      reservationDate: '2026-07-01',
      reservationTime: '19:30',
      notes: 'Window table',
      status: 'confirmed',
      source: 'staff',
    },
  ],
  orders: [
    {
      id: 'order-1',
      customerName: 'Jordan Lee',
      phone: '+1 (555) 333-4444',
      items: [
        { menuItemId: 'menu-risotto', name: 'Wild Mushroom Risotto', quantity: 1, price: 25 },
      ],
      total: 25,
      status: 'preparing',
      type: 'takeout',
      placedAt: '2026-06-28T12:00:00.000Z',
      notes: 'No utensils',
    },
  ],
  settings: {
    brandName: 'Bistro Prime',
    activeVoice: 'Maya',
    phoneRouting: '+1 (555) 010-2244',
    autoUpsellPercent: 15,
    autoConfirmSms: true,
    serviceHours: {
      weekdays: '11:00 AM - 10:00 PM',
      saturday: '10:00 AM - 11:00 PM',
      sunday: '10:00 AM - 9:00 PM',
    },
  },
};

const analytics = {
  totalCallsHandled: 12,
  successfulCalls: 10,
  successRate: 83,
  activeOffers: 1,
  inactiveSpecials: 0,
  scriptCount: 1,
  reservationCount: 1,
  pendingReservations: 0,
  openOrders: 1,
  orderRevenue: 25,
  averageDurationSeconds: 70,
  volumeTrend7d: [
    { day: 'MON', val: 40, count: 2 },
    { day: 'TUE', val: 65, count: 4 },
    { day: 'WED', val: 55, count: 3 },
    { day: 'THU', val: 72, count: 5 },
    { day: 'FRI', val: 84, count: 7 },
    { day: 'SAT', val: 60, count: 4 },
    { day: 'SUN', val: 48, count: 2 },
  ],
  volumeTrend30d: [
    { day: 'W1', val: 50, count: 8 },
    { day: 'W2', val: 68, count: 12 },
    { day: 'W3', val: 74, count: 14 },
    { day: 'W4', val: 61, count: 10 },
  ],
};

async function mockApi(page) {
  await page.route('**/api/**', (route) => {
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });

  await page.route('**/api/health', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        service: 'bistro-ai-api',
        storage: 'json',
        authEnabled: false,
        aiEnabled: false,
      }),
    });
  });

  await page.route('**/api/bootstrap', (route) => {
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(workspace) });
  });

  await page.route('**/api/analytics/overview', (route) => {
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(analytics) });
  });
}

async function mockRoleBasedAuthApi(page) {
  const users = [
    {
      id: 'user-admin',
      username: 'admin',
      displayName: 'Admin User',
      role: 'admin',
      isActive: true,
      createdAt: '2026-06-29T00:00:00.000Z',
    },
    {
      id: 'user-staff',
      username: 'staff',
      displayName: 'Floor Staff',
      role: 'staff',
      isActive: true,
      createdAt: '2026-06-29T00:00:00.000Z',
    },
  ];

  await page.route('**/api/health', (route) => {
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        ok: true,
        service: 'bistro-ai-api',
        storage: 'json',
        authEnabled: true,
        aiEnabled: false,
      }),
    });
  });

  await page.route('**/api/auth/login', async (route) => {
    const requestBody = route.request().postDataJSON();
    if (requestBody.username !== 'admin' || requestBody.password !== 'admin-pass-123') {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ error: { message: 'Invalid username or password', status: 401 } }),
      });
      return;
    }

    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'mock-admin-token',
        username: 'admin',
        displayName: 'Admin User',
        role: 'admin',
        authEnabled: true,
      }),
    });
  });

  await page.route('**/api/users', (route) => {
    if (route.request().method() === 'POST') {
      route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'user-manager',
          username: 'manager',
          displayName: 'Manager User',
          role: 'manager',
          isActive: true,
          createdAt: '2026-06-29T00:00:00.000Z',
        }),
      });
      return;
    }

    route.fulfill({ contentType: 'application/json', body: JSON.stringify(users) });
  });
}

test.beforeEach(async ({ page }) => {
  await mockApi(page);
});

test('dashboard renders core panels without layout fallback text', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: 'Operations Dashboard' })).toBeVisible();
  await expect(page.getByText(/Total Calls Handled/i)).toBeVisible();
  await expect(page.getByText('12')).toBeVisible();
  await expect(page.getByText('83% success')).toBeVisible();
  await expect(page.getByText('Recent Activity')).toBeVisible();
  await expect(page.getByText('Reservation Confirmed')).toBeVisible();
  await expect(page.getByTitle('Refresh Analytics')).toBeVisible();
});

test('operations screen opens order modal and calculates item totals', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await page.getByRole('button', { name: /Operations/ }).click();

  await expect(page.getByRole('heading', { name: 'Operations' })).toBeVisible();
  await expect(page.getByText('Maya Patel')).toBeVisible();
  await page.getByRole('button', { name: 'Orders' }).click();
  await expect(page.getByText('order-1')).toBeVisible();

  await page.getByRole('button', { name: 'New Order' }).click();

  const modal = page.getByRole('heading', { name: 'New Order' }).locator('..').locator('..');
  await expect(page.getByRole('heading', { name: 'New Order' })).toBeVisible();
  await modal.locator('input[type="text"]').fill('Avery Stone');
  await modal.locator('input[type="tel"]').fill('+1 (555) 555-7777');
  await modal.locator('select').nth(2).selectOption('menu-risotto');
  await page.getByRole('button', { name: 'Add Item' }).click();

  await expect(modal.getByText('1x Wild Mushroom Risotto')).toBeVisible();
  await expect(modal.locator('p').filter({ hasText: '$25.00' }).last()).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();
  await expect(page.getByRole('heading', { name: 'New Order' })).toBeHidden();
});

test('admin login opens role-based access management', async ({ page }) => {
  await mockRoleBasedAuthApi(page);
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  await expect(page.getByRole('heading', { name: 'Bistro AI' })).toBeVisible();
  await page.locator('input[type="password"]').fill('admin-pass-123');
  await page.getByRole('button', { name: 'Sign In' }).click();

  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Access' }).click();

  const main = page.getByRole('main');
  await expect(main.getByText('Role-Based Access')).toBeVisible();
  await expect(main.getByText('Admin User')).toBeVisible();
  await expect(main.getByText('Floor Staff')).toBeVisible();

  await page.getByPlaceholder('username').fill('manager');
  await page.getByPlaceholder('display name').fill('Manager User');
  await page.getByPlaceholder('password').fill('manager-pass-123');
  await main.locator('select').first().selectOption('manager');
  await page.getByRole('button', { name: 'Add User' }).click();

  await expect(main.getByText('Access account created.')).toBeVisible();
  await expect(main.getByText('Manager User')).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByRole('heading', { name: 'Bistro AI' })).toBeVisible();
  await expect(page.getByText('You have been signed out.')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();

  const storedAuth = await page.evaluate(() => ({
    token: window.localStorage.getItem('bistro-ai:auth-token'),
    session: window.localStorage.getItem('bistro-ai:auth-session'),
  }));
  expect(storedAuth).toEqual({ token: null, session: null });
});
