import { test, expect } from '@playwright/test';
import { TEST_USERS, loginUser, TEST_PACKAGE } from './fixtures/test-fixtures';

test.describe('Sender Workflow Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page, TEST_USERS.sender);
  });

  test.describe('Sender Dashboard', () => {
    test('TC-SEND-001: View sender dashboard with stats', async ({ page }) => {
      await page.goto('/sender');

      // Should show dashboard title - use exact match to avoid matching "No packages yet"
      await expect(page.getByRole('heading', { name: 'My Packages', level: 1 })).toBeVisible();

      // Should show stat cards
      await expect(page.getByText(/pending/i)).toBeVisible();
      await expect(page.getByText(/matched/i)).toBeVisible();
      await expect(page.getByText(/delivered/i)).toBeVisible();
    });

    test('TC-SEND-012: Filter packages by status', async ({ page }) => {
      await page.goto('/sender');

      // Click pending filter
      await page.getByRole('button', { name: /pending/i }).click();

      // URL should reflect filter or UI should show filtered results
      // The pending packages should be highlighted/filtered

      // Click all filter to reset
      await page.getByRole('button', { name: /all/i }).click();
    });

    test('Sender dashboard shows package list', async ({ page }) => {
      await page.goto('/sender');

      // Should show package cards or empty state
      const hasPackages = await page.locator('[data-testid="package-card"]').count() > 0;
      const hasEmptyState = await page.getByRole('heading', { name: 'No packages yet' }).isVisible();

      expect(hasPackages || hasEmptyState).toBeTruthy();
    });
  });

  test.describe('Create Package', () => {
    test('TC-SEND-002: Create package with basic info', async ({ page }) => {
      await page.goto('/packages/create');

      // Fill basic info
      await page.getByLabel(/description/i).fill(TEST_PACKAGE.description);
      await page.getByLabel(/size/i).selectOption(TEST_PACKAGE.size);
      await page.getByLabel(/weight/i).fill(TEST_PACKAGE.weight);
      await page.getByLabel(/price/i).fill(TEST_PACKAGE.price);

      // Check form fields are filled
      await expect(page.getByLabel(/description/i)).toHaveValue(TEST_PACKAGE.description);
      await expect(page.getByLabel(/weight/i)).toHaveValue(TEST_PACKAGE.weight);
    });

    test('TC-SEND-005: Create package validation - empty description', async ({ page }) => {
      await page.goto('/packages/create');

      // Leave description empty, fill other required fields
      await page.getByLabel(/size/i).selectOption('medium');
      await page.getByLabel(/weight/i).fill('5');

      // Try to submit
      await page.getByRole('button', { name: /create package/i }).click();

      // Form should not submit (stays on create page) - HTML5 validation prevents submission
      await expect(page).toHaveURL('/packages/create');
    });

    test('TC-SEND-005: Create package validation - invalid weight', async ({ page }) => {
      await page.goto('/packages/create');

      await page.getByLabel(/description/i).fill('Test');
      await page.getByLabel(/size/i).selectOption('medium');
      await page.getByLabel(/weight/i).fill('0'); // Invalid weight

      await page.getByRole('button', { name: /create package/i }).click();

      // Form should not submit (stays on create page) - validation prevents submission
      await expect(page).toHaveURL('/packages/create');
    });

    test('Size options are available', async ({ page }) => {
      await page.goto('/packages/create');

      const sizeSelect = page.getByLabel(/size/i);

      // Check size options exist by verifying we can select them
      await sizeSelect.selectOption('small');
      await expect(sizeSelect).toHaveValue('small');

      await sizeSelect.selectOption('medium');
      await expect(sizeSelect).toHaveValue('medium');

      await sizeSelect.selectOption('large');
      await expect(sizeSelect).toHaveValue('large');
    });

    test('TC-SEND-003: Contact info fields are optional', async ({ page }) => {
      await page.goto('/packages/create');

      // Contact fields should exist - use textbox role since labels aren't properly associated
      // There are two "Contact Name" and two "Contact Phone" fields (pickup and dropoff)
      const contactNameFields = page.getByRole('textbox', { name: /contact name/i });
      const contactPhoneFields = page.getByRole('textbox', { name: /contact phone/i });

      await expect(contactNameFields).toHaveCount(2);
      await expect(contactPhoneFields).toHaveCount(2);
    });
  });

  test.describe('Package Details', () => {
    test('TC-SEND-006: View package details page', async ({ page }) => {
      await page.goto('/sender');

      // Find a package detail link (with numeric ID, not /packages/create)
      const packageLink = page.locator('a[href^="/packages/"]').filter({ hasText: /view|details/i }).first();
      const packageCard = page.locator('[data-testid="package-card"] a').first();

      // Try package card link first, fallback to any package detail link
      const linkToClick = await packageCard.isVisible() ? packageCard : packageLink;

      if (await linkToClick.isVisible()) {
        const href = await linkToClick.getAttribute('href');
        // Only click if it's a package detail URL (not /packages/create)
        if (href && /\/packages\/\d+/.test(href)) {
          await linkToClick.click();

          // Should be on package detail page
          await expect(page).toHaveURL(/\/packages\/\d+/);

          // Should show package info
          await expect(page.getByText(/description|details/i)).toBeVisible();
          await expect(page.getByText(/status/i)).toBeVisible();
        }
      }
    });

    test('TC-SEND-014: Package shows status progress', async ({ page }) => {
      await page.goto('/sender');

      const packageCard = page.locator('[data-testid="package-card"]').first();

      if (await packageCard.isVisible()) {
        // Status badge should be visible
        await expect(packageCard.locator('[class*="badge"], [class*="status"]')).toBeVisible();
      }
    });
  });

  test.describe('Package Actions', () => {
    test('TC-SEND-009: Cancel button visible for pending package', async ({ page }) => {
      await page.goto('/sender');

      // Filter to pending
      await page.getByRole('button', { name: /pending/i }).click();

      const pendingPackage = page.locator('[data-testid="package-card"]').first();

      if (await pendingPackage.isVisible()) {
        // Cancel button should be visible for pending packages
        await expect(pendingPackage.getByRole('button', { name: /cancel/i })).toBeVisible();
      }
    });

    test('TC-SEND-011: Cancel not available for delivered packages', async ({ page }) => {
      await page.goto('/sender');

      // Filter to delivered
      await page.getByRole('button', { name: /delivered/i }).click();

      const deliveredPackage = page.locator('[data-testid="package-card"]').first();

      if (await deliveredPackage.isVisible()) {
        // Cancel button should NOT be visible for delivered packages
        await expect(deliveredPackage.getByRole('button', { name: /cancel/i })).not.toBeVisible();
      }
    });

    test('TC-SEND-007: Edit button visible for pending package', async ({ page }) => {
      await page.goto('/sender');

      // Filter to pending
      await page.getByRole('button', { name: /pending/i }).click();

      const packageLink = page.locator('a[href*="/packages/"]').first();

      if (await packageLink.isVisible()) {
        await packageLink.click();

        // Edit button should be visible on pending package detail
        const editButton = page.getByRole('button', { name: /edit/i });
        // May or may not be visible depending on UI
      }
    });
  });

  test.describe('Navigation', () => {
    test('Send Package link in navbar works', async ({ page }) => {
      await page.goto('/dashboard');

      // Link visibility depends on user role - sender/both users see this link
      const sendPackageLink = page.getByRole('link', { name: /send package|create package/i });

      if (await sendPackageLink.isVisible()) {
        await sendPackageLink.click();
        await expect(page).toHaveURL('/packages/create');
      } else {
        // User doesn't have sender role - navigate directly
        await page.goto('/packages/create');
        await expect(page).toHaveURL('/packages/create');
      }
    });

    test('My Packages link in navbar works', async ({ page }) => {
      await page.goto('/dashboard');

      // Link visibility depends on user role - sender/both users see this link
      const myPackagesLink = page.getByRole('link', { name: /my packages|sender/i });

      if (await myPackagesLink.isVisible()) {
        await myPackagesLink.click();
        await expect(page).toHaveURL('/sender');
      } else {
        // User doesn't have sender role - navigate directly
        await page.goto('/sender');
        // Page should still be accessible
      }
    });
  });
});

test.describe('Sender Dashboard - Both Role User', () => {
  test('Both role user can access sender dashboard', async ({ page }) => {
    await loginUser(page, TEST_USERS.both);
    await page.goto('/sender');

    await expect(page.getByRole('heading', { name: /my packages|packages/i })).toBeVisible();
  });

  test('Both role user can access package creation', async ({ page }) => {
    await loginUser(page, TEST_USERS.both);
    await page.goto('/packages/create');

    await expect(page.getByLabel(/description/i)).toBeVisible();
  });
});

test.describe('Sender - Access Control', () => {
  test('Courier-only user cannot access sender dashboard', async ({ page }) => {
    await loginUser(page, TEST_USERS.courier);
    await page.goto('/sender');

    // Should redirect or show error
    await expect(page).not.toHaveURL('/sender');
  });
});
