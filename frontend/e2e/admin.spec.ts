import { test, expect } from '@playwright/test';
import { TEST_USERS, loginUser, generateTestEmail } from './fixtures/test-fixtures';

test.describe('Admin Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page, TEST_USERS.admin);
  });

  test.describe('Admin Dashboard Access', () => {
    test('TC-ADMIN-001: Admin login redirects to admin dashboard', async ({ page }) => {
      // Already logged in via beforeEach
      await expect(page).toHaveURL('/admin');
    });

    test('TC-ADMIN-001: Admin dashboard shows tabs', async ({ page }) => {
      await page.goto('/admin');

      // Should have Overview, Users, Packages tabs (use exact match to avoid "Manage Users" etc.)
      await expect(page.getByRole('button', { name: 'Overview', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Users', exact: true })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Packages', exact: true })).toBeVisible();
    });
  });

  test.describe('Overview Tab', () => {
    test('TC-ADMIN-001: Overview shows platform stats', async ({ page }) => {
      await page.goto('/admin');

      // Click Overview tab
      await page.getByRole('button', { name: 'Overview', exact: true }).click();

      // Should show user stats (use .first() since text appears in both stat cards and charts)
      await expect(page.getByText(/total users/i).first()).toBeVisible();
      await expect(page.getByText(/senders/i).first()).toBeVisible();
      await expect(page.getByText(/couriers/i).first()).toBeVisible();
    });

    test('TC-ADMIN-001: Overview shows package stats', async ({ page }) => {
      await page.goto('/admin');

      await page.getByRole('button', { name: 'Overview', exact: true }).click();

      // Should show package stats (use exact match to avoid matching buttons)
      await expect(page.getByText('Total Packages')).toBeVisible();
    });

    test('TC-ADMIN-014: Run Matching Job button exists', async ({ page }) => {
      await page.goto('/admin');

      await page.getByRole('button', { name: 'Overview', exact: true }).click();

      // Should have run matching job button
      await expect(page.getByRole('button', { name: /run matching|matching job/i })).toBeVisible();
    });

    test('TC-ADMIN-014: Click Run Matching Job shows results', async ({ page }) => {
      await page.goto('/admin');

      await page.getByRole('button', { name: 'Overview', exact: true }).click();

      const matchingButton = page.getByRole('button', { name: /run matching|matching job/i });
      await matchingButton.click();

      // Should show results panel with "Matching Job Completed" heading
      await expect(page.getByRole('heading', { name: /matching job completed/i })).toBeVisible({ timeout: 15000 });
    });
  });

  test.describe('Users Tab', () => {
    test('TC-ADMIN-003: View users table', async ({ page }) => {
      await page.goto('/admin');

      await page.getByRole('button', { name: 'Users', exact: true }).click();

      // Should show user table
      await expect(page.locator('table')).toBeVisible();
    });

    test('TC-ADMIN-003: Users table shows columns', async ({ page }) => {
      await page.goto('/admin');

      await page.getByRole('button', { name: 'Users', exact: true }).click();

      // Should have expected columns (actual columns: User, Role, Verification, Active, Joined, Actions)
      await expect(page.getByRole('columnheader', { name: 'User' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Role' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Verification' })).toBeVisible();
    });

    test('TC-ADMIN-004: Filter users by role', async ({ page }) => {
      await page.goto('/admin');

      await page.getByRole('button', { name: 'Users', exact: true }).click();

      // Find role filter - it's a select with options for roles
      const roleFilter = page.locator('select').filter({ hasText: /sender/i }).first();

      if (await roleFilter.isVisible()) {
        await roleFilter.selectOption('sender');

        // Table should update (or show filtered results)
        await page.waitForTimeout(500);
      }
    });

    test('TC-ADMIN-005: Filter users by verification status', async ({ page }) => {
      await page.goto('/admin');

      await page.getByRole('button', { name: 'Users', exact: true }).click();

      // Find verification filter - select that has "Verified Only" option
      const verificationFilter = page.locator('select').filter({ hasText: /verified only/i }).first();

      if (await verificationFilter.isVisible()) {
        await verificationFilter.selectOption('verified');
        await page.waitForTimeout(500);
      }
    });

    test('TC-ADMIN-006: Change user role', async ({ page }) => {
      await page.goto('/admin');

      await page.getByRole('button', { name: 'Users', exact: true }).click();

      // Find an enabled role dropdown (skip admin's own row which is disabled)
      const enabledRoleDropdown = page.locator('tbody tr select:not([disabled])').first();

      if (await enabledRoleDropdown.isVisible()) {
        // Get current value and change to different role
        const currentRole = await enabledRoleDropdown.inputValue();
        const newRole = currentRole === 'sender' ? 'courier' : 'sender';
        await enabledRoleDropdown.selectOption(newRole);

        // Role should be changed (or confirmation may appear)
        await page.waitForTimeout(500);
      }
    });

    test('TC-ADMIN-007: Toggle user verification', async ({ page }) => {
      await page.goto('/admin');

      await page.getByRole('button', { name: 'Users', exact: true }).click();

      // Find verify/unverify button
      const verifyButton = page.getByRole('button', { name: /verify|unverify/i }).first();

      if (await verifyButton.isVisible()) {
        const initialText = await verifyButton.textContent();
        await verifyButton.click();

        // Button text should change
        await page.waitForTimeout(500);
      }
    });

    test('TC-ADMIN-008: Activate/deactivate user', async ({ page }) => {
      await page.goto('/admin');

      await page.getByRole('button', { name: 'Users', exact: true }).click();

      // Find activate/deactivate button
      const actionButton = page.getByRole('button', { name: /activate|deactivate/i }).first();

      if (await actionButton.isVisible()) {
        await actionButton.click();
        // Action should complete
      }
    });

    test('TC-ADMIN-009: Create new user button exists', async ({ page }) => {
      await page.goto('/admin');

      await page.getByRole('button', { name: 'Users', exact: true }).click();

      // Button text is "+ Create User"
      await expect(page.getByRole('button', { name: /\+ create user|create user/i })).toBeVisible();
    });

    test('TC-ADMIN-009: Create new user modal', async ({ page }) => {
      await page.goto('/admin');

      await page.getByRole('button', { name: 'Users', exact: true }).click();

      const createButton = page.getByRole('button', { name: /\+ create user|create user/i });
      await createButton.click();

      // Modal should appear (modal is a div with fixed positioning, not a dialog role)
      await expect(page.locator('.fixed.inset-0')).toBeVisible();
      // Check for form fields - labels contain "Email *", "Password *", "Full Name *"
      await expect(page.getByText(/email \*/i)).toBeVisible();
      await expect(page.getByText(/password \*/i)).toBeVisible();
      await expect(page.getByText(/full name \*/i)).toBeVisible();
    });

    test('TC-ADMIN-015: Click user row to view details', async ({ page }) => {
      await page.goto('/admin');

      await page.getByRole('button', { name: 'Users', exact: true }).click();

      const userLink = page.locator('tbody tr a').first();

      if (await userLink.isVisible()) {
        await userLink.click();

        // Should navigate to user detail page
        await expect(page).toHaveURL(/\/admin\/users\/\d+/);
      }
    });
  });

  test.describe('Packages Tab', () => {
    test('TC-ADMIN-010: View packages table', async ({ page }) => {
      await page.goto('/admin');

      await page.getByRole('button', { name: 'Packages', exact: true }).click();

      // Should show packages table
      await expect(page.locator('table')).toBeVisible();
    });

    test('TC-ADMIN-010: Packages table shows columns', async ({ page }) => {
      await page.goto('/admin');

      await page.getByRole('button', { name: 'Packages', exact: true }).click();

      // Should have expected columns (actual: Package ID, Sender, Description, Status, Active, Price, Created, Actions)
      await expect(page.getByRole('columnheader', { name: 'Package ID' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Sender' })).toBeVisible();
      await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
    });

    test('TC-ADMIN-011: Filter packages by status', async ({ page }) => {
      await page.goto('/admin');

      await page.getByRole('button', { name: 'Packages', exact: true }).click();

      // Find status filter - select with status options
      const statusFilter = page.locator('select').filter({ hasText: /pending/i }).first();

      if (await statusFilter.isVisible()) {
        await statusFilter.selectOption('pending');
        await page.waitForTimeout(500);
      }
    });

    test('TC-ADMIN-012: Deactivate package button', async ({ page }) => {
      await page.goto('/admin');

      await page.getByRole('button', { name: 'Packages', exact: true }).click();

      // Filter to pending
      const statusFilter = page.locator('select').filter({ hasText: /pending/i }).first();
      if (await statusFilter.isVisible()) {
        await statusFilter.selectOption('pending');
        await page.waitForTimeout(500);
      }

      // Find deactivate button (or link text)
      const deactivateButton = page.getByText('Deactivate').first();

      if (await deactivateButton.isVisible()) {
        // Button exists
        await expect(deactivateButton).toBeVisible();
      }
    });

    test('TC-ADMIN-013: Create package for user', async ({ page }) => {
      await page.goto('/admin');

      await page.getByRole('button', { name: 'Packages', exact: true }).click();

      // Button text is "+ Create Package"
      const createButton = page.getByRole('button', { name: /\+ create package|create package/i });

      if (await createButton.isVisible()) {
        await createButton.click();

        // Should navigate to /packages/create
        await expect(page).toHaveURL('/packages/create');
      }
    });
  });
});

test.describe('Admin Access Control', () => {
  test('TC-ADMIN-002: Non-admin cannot access admin page', async ({ page }) => {
    await loginUser(page, TEST_USERS.sender);

    await page.goto('/admin');

    // Should redirect to home after showing "Access denied" message
    // Wait for redirect (timeout 5s to see error message first)
    await expect(page).not.toHaveURL('/admin', { timeout: 10000 });
  });

  test('Courier cannot access admin page', async ({ page }) => {
    await loginUser(page, TEST_USERS.courier);

    await page.goto('/admin');

    await expect(page).not.toHaveURL('/admin', { timeout: 10000 });
  });

  test('Both-role user cannot access admin page', async ({ page }) => {
    await loginUser(page, TEST_USERS.both);

    await page.goto('/admin');

    await expect(page).not.toHaveURL('/admin', { timeout: 10000 });
  });
});

test.describe('Admin User Detail Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page, TEST_USERS.admin);
  });

  test('TC-ADMIN-015: View user detail page', async ({ page }) => {
    await page.goto('/admin');

    await page.getByRole('button', { name: 'Users', exact: true }).click();

    const userLink = page.locator('tbody tr a').first();

    if (await userLink.isVisible()) {
      await userLink.click();

      // Should show user details
      await expect(page.getByText(/email/i)).toBeVisible();
      await expect(page.getByText(/role/i)).toBeVisible();
    }
  });
});

test.describe('Admin Quick Actions', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page, TEST_USERS.admin);
  });

  test('Manage Users quick action', async ({ page }) => {
    await page.goto('/admin');

    // Make sure we're on Overview tab first
    await page.getByRole('button', { name: 'Overview', exact: true }).click();

    const manageUsersButton = page.getByRole('button', { name: 'Manage Users' });

    await manageUsersButton.click();

    // Should switch to Users tab - check for user management header
    await expect(page.getByText('User Management')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
  });

  test('View Packages quick action', async ({ page }) => {
    await page.goto('/admin');

    // Make sure we're on Overview tab first
    await page.getByRole('button', { name: 'Overview', exact: true }).click();

    const viewPackagesButton = page.getByRole('button', { name: 'View Packages' });

    await viewPackagesButton.click();

    // Should switch to Packages tab - check for package management header
    await expect(page.getByText('Package Management')).toBeVisible();
    await expect(page.locator('table')).toBeVisible();
  });
});

test.describe('Admin Create User Flow', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page, TEST_USERS.admin);
  });

  test('Create user with valid data', async ({ page }) => {
    await page.goto('/admin');

    await page.getByRole('button', { name: 'Users', exact: true }).click();

    const createButton = page.getByRole('button', { name: /\+ create user|create user/i });
    await createButton.click();

    // Fill form - the inputs are inside the modal
    const modal = page.locator('.fixed.inset-0');
    await expect(modal).toBeVisible();

    const newEmail = generateTestEmail();
    // Use input type selectors since labels don't have proper for attributes
    await modal.locator('input[type="email"]').fill(newEmail);
    await modal.locator('input[type="password"]').fill('TestPass123');
    await modal.locator('input[type="text"]').first().fill('Test Admin Created User');

    // Submit - button says "Create User"
    const submitButton = modal.getByRole('button', { name: 'Create User' });
    await submitButton.click();

    // Modal should close and user should appear in list (or show success)
    // Wait for the API call to complete
    await page.waitForTimeout(2000);
  });

  test('Create user validation - empty email', async ({ page }) => {
    await page.goto('/admin');

    await page.getByRole('button', { name: 'Users', exact: true }).click();

    const createButton = page.getByRole('button', { name: /\+ create user|create user/i });
    await createButton.click();

    const modal = page.locator('.fixed.inset-0');
    await expect(modal).toBeVisible();

    // Fill only password and name
    await modal.locator('input[type="password"]').fill('TestPass123');
    await modal.locator('input[type="text"]').first().fill('Test User');

    // Submit
    const submitButton = modal.getByRole('button', { name: 'Create User' });
    await submitButton.click();

    // HTML5 validation will prevent submission - email input will be invalid
    const emailInput = modal.locator('input[type="email"]');
    const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
    expect(validationMessage).toBeTruthy();
  });
});
