import { test as base, expect, Page, BrowserContext } from '@playwright/test';

/**
 * Test users matching the database test data (see backend/test_data/users.json)
 */
export const TEST_USERS = {
  sender: {
    email: 'john.sender@example.com',
    password: 'sender123',
    name: 'John Sender',
    role: 'sender',
  },
  courier: {
    email: 'mike.courier@example.com',
    password: 'courier123',
    name: 'Mike Courier',
    role: 'courier',
  },
  both: {
    email: 'alex.both@example.com',
    password: 'both123',
    name: 'Alex Both',
    role: 'both',
  },
  admin: {
    email: 'admin@chaski.com',
    password: 'admin123',
    name: 'Admin User',
    role: 'admin',
  },
} as const;

export type UserRole = keyof typeof TEST_USERS;

/**
 * Test data for creating packages
 */
export const TEST_PACKAGE = {
  description: 'Test Package for E2E',
  size: 'medium',
  weight: '5',
  price: '25.00',
  pickupAddress: '123 Main St, San Francisco, CA',
  dropoffAddress: '456 Market St, San Francisco, CA',
  pickupContactName: 'John Pickup',
  pickupContactPhone: '555-1111',
  dropoffContactName: 'Jane Dropoff',
  dropoffContactPhone: '555-2222',
};

/**
 * Test data for creating routes
 */
export const TEST_ROUTE = {
  startAddress: '100 Montgomery St, San Francisco, CA',
  endAddress: '500 Terry A Francois Blvd, San Francisco, CA',
  maxDeviation: '10',
};

/**
 * Helper to login a user
 */
export async function loginUser(page: Page, user: typeof TEST_USERS[UserRole]) {
  await page.goto('/login');
  await page.getByLabel('Email Address').fill(user.email);
  await page.getByLabel('Password').fill(user.password);
  await page.getByRole('button', { name: /sign in/i }).click();

  // Wait for redirect based on role
  if (user.role === 'admin') {
    await page.waitForURL('/admin', { timeout: 15000 });
  } else {
    await page.waitForURL('/dashboard', { timeout: 15000 });
  }
}

/**
 * Helper to logout a user
 */
export async function logoutUser(page: Page) {
  // Click user dropdown
  await page.locator('[data-testid="user-menu-button"]').click();
  await page.getByRole('button', { name: /logout/i }).click();
  await page.waitForURL('/login');
}

/**
 * Extended test fixture with authentication helpers
 */
type TestFixtures = {
  authenticatedPage: Page;
  senderPage: Page;
  courierPage: Page;
  adminPage: Page;
  bothPage: Page;
};

/**
 * Create authenticated page for a specific user
 */
async function createAuthenticatedPage(
  context: BrowserContext,
  user: typeof TEST_USERS[UserRole]
): Promise<Page> {
  const page = await context.newPage();
  await loginUser(page, user);
  return page;
}

/**
 * Extended test with authentication fixtures
 */
export const test = base.extend<TestFixtures>({
  authenticatedPage: async ({ page }, use) => {
    await loginUser(page, TEST_USERS.sender);
    await use(page);
  },

  senderPage: async ({ context }, use) => {
    const page = await createAuthenticatedPage(context, TEST_USERS.sender);
    await use(page);
    await page.close();
  },

  courierPage: async ({ context }, use) => {
    const page = await createAuthenticatedPage(context, TEST_USERS.courier);
    await use(page);
    await page.close();
  },

  adminPage: async ({ context }, use) => {
    const page = await createAuthenticatedPage(context, TEST_USERS.admin);
    await use(page);
    await page.close();
  },

  bothPage: async ({ context }, use) => {
    const page = await createAuthenticatedPage(context, TEST_USERS.both);
    await use(page);
    await page.close();
  },
});

export { expect };

/**
 * Page Object helpers
 */
export class NavbarHelper {
  constructor(private page: Page) {}

  async openUserMenu() {
    await this.page.locator('[data-testid="user-menu-button"]').click();
  }

  async clickNotifications() {
    await this.page.locator('[data-testid="notification-dropdown"]').click();
  }

  async clickMessages() {
    await this.page.locator('a[href="/messages"]').first().click();
  }

  async getUnreadMessageCount(): Promise<number> {
    const badge = this.page.locator('[data-testid="message-unread-count"]');
    if (await badge.isVisible()) {
      const text = await badge.textContent();
      return parseInt(text || '0', 10);
    }
    return 0;
  }

  async getUnreadNotificationCount(): Promise<number> {
    const badge = this.page.locator('[data-testid="notification-unread-count"]');
    if (await badge.isVisible()) {
      const text = await badge.textContent();
      return parseInt(text || '0', 10);
    }
    return 0;
  }
}

export class PackageHelper {
  constructor(private page: Page) {}

  async createPackage(data: Partial<typeof TEST_PACKAGE> = {}) {
    const packageData = { ...TEST_PACKAGE, ...data };

    await this.page.goto('/packages/create');

    // Fill form
    await this.page.getByLabel(/description/i).fill(packageData.description);
    await this.page.getByLabel(/size/i).selectOption(packageData.size);
    await this.page.getByLabel(/weight/i).fill(packageData.weight);

    if (packageData.price) {
      await this.page.getByLabel(/price/i).fill(packageData.price);
    }

    // Handle address autocomplete - type and select first suggestion
    const pickupInput = this.page.locator('input[placeholder*="pickup"]').first();
    await pickupInput.fill(packageData.pickupAddress);
    await this.page.waitForTimeout(500); // Wait for autocomplete
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('Enter');

    const dropoffInput = this.page.locator('input[placeholder*="dropoff"]').first();
    await dropoffInput.fill(packageData.dropoffAddress);
    await this.page.waitForTimeout(500);
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('Enter');

    // Contact info (optional)
    if (packageData.pickupContactName) {
      await this.page.getByLabel(/pickup contact name/i).fill(packageData.pickupContactName);
    }
    if (packageData.pickupContactPhone) {
      await this.page.getByLabel(/pickup contact phone/i).fill(packageData.pickupContactPhone);
    }

    // Submit
    await this.page.getByRole('button', { name: /create package/i }).click();
  }

  async getPackageStatus(): Promise<string> {
    const statusBadge = this.page.locator('[data-testid="package-status"]');
    return (await statusBadge.textContent()) || '';
  }
}

export class RouteHelper {
  constructor(private page: Page) {}

  async createRoute(data: Partial<typeof TEST_ROUTE> = {}) {
    const routeData = { ...TEST_ROUTE, ...data };

    await this.page.goto('/courier/routes/create');

    // Handle address autocomplete
    const startInput = this.page.locator('input[placeholder*="start"]').first();
    await startInput.fill(routeData.startAddress);
    await this.page.waitForTimeout(500);
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('Enter');

    const endInput = this.page.locator('input[placeholder*="end"]').first();
    await endInput.fill(routeData.endAddress);
    await this.page.waitForTimeout(500);
    await this.page.keyboard.press('ArrowDown');
    await this.page.keyboard.press('Enter');

    await this.page.getByLabel(/max deviation/i).fill(routeData.maxDeviation);

    await this.page.getByRole('button', { name: /create route/i }).click();
  }
}

/**
 * Wait for API response
 */
export async function waitForApiResponse(page: Page, urlPattern: string | RegExp) {
  return page.waitForResponse((response) => {
    const url = response.url();
    if (typeof urlPattern === 'string') {
      return url.includes(urlPattern);
    }
    return urlPattern.test(url);
  });
}

/**
 * Generate unique email for testing registration
 */
export function generateTestEmail(): string {
  const timestamp = Date.now();
  return `test.user.${timestamp}@example.com`;
}
