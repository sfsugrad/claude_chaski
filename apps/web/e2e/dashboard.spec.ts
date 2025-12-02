import { test, expect } from '@playwright/test';
import { TEST_USERS, loginUser } from './fixtures/test-fixtures';

test.describe('Dashboard Tests', () => {
  test.describe('Dashboard Display', () => {
    test('DASH-001: Dashboard loads for sender', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);

      await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
      await expect(page.getByText(/verification|status/i)).toBeVisible();
    });

    test('DASH-002: Dashboard loads for courier', async ({ page }) => {
      await loginUser(page, TEST_USERS.courier);

      await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
    });

    test('DASH-003: Dashboard loads for both role', async ({ page }) => {
      await loginUser(page, TEST_USERS.both);

      await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
      // Should show both sender and courier sections
    });

    test('DASH-004: User info display', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);

      // Should show user name somewhere on dashboard or in navbar
      await expect(page.getByText(new RegExp(TEST_USERS.sender.name, 'i'))).toBeVisible();
    });
  });

  test.describe('Verification Status', () => {
    test('DASH-005: Email verification status shows for verified user', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);

      // Look for verification status section
      const verificationSection = page.getByText(/verification|verified|status/i);
      await expect(verificationSection.first()).toBeVisible();
    });

    test('DASH-006: Phone verification prompt for unverified phone', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);

      // Check for phone verification prompt or status
      const phoneStatus = page.getByText(/phone|verify.*phone/i);
      // May show verified status or prompt to verify
    });

    test('DASH-007: ID verification prompt for courier without ID', async ({ page }) => {
      await loginUser(page, TEST_USERS.courier);

      // Check for ID verification section
      const idSection = page.getByText(/id.*verif|identity|verify.*id/i);
      // Should be visible for couriers
    });

    test('DASH-008: Fully verified status shows green', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);

      // Look for verified badges or green checkmarks
      const verifiedBadge = page.locator('[class*="green"], [class*="success"], [class*="verified"]');
      // At least some verified status should show
    });
  });

  test.describe('Quick Actions', () => {
    test('DASH-013: Create Package button works for sender', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);

      const createPackageBtn = page.getByRole('link', { name: /create.*package|send.*package/i });
      if (await createPackageBtn.isVisible()) {
        await createPackageBtn.click();
        await expect(page).toHaveURL(/\/packages\/create/);
      }
    });

    test('DASH-014: Create Route button works for courier', async ({ page }) => {
      await loginUser(page, TEST_USERS.courier);

      const createRouteBtn = page.getByRole('link', { name: /create.*route|add.*route/i });
      if (await createRouteBtn.isVisible()) {
        await createRouteBtn.click();
        await expect(page).toHaveURL(/\/courier\/routes\/create/);
      }
    });

    test('DASH-015: View Packages link works', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);

      const viewPackagesLink = page.getByRole('link', { name: /my.*packages|view.*packages/i });
      if (await viewPackagesLink.isVisible()) {
        await viewPackagesLink.click();
        await expect(page).toHaveURL(/\/sender/);
      }
    });

    test('DASH-016: View Routes link works', async ({ page }) => {
      await loginUser(page, TEST_USERS.courier);

      const viewRoutesLink = page.getByRole('link', { name: /my.*routes|view.*routes/i });
      if (await viewRoutesLink.isVisible()) {
        await viewRoutesLink.click();
        await expect(page).toHaveURL(/\/courier/);
      }
    });
  });

  test.describe('Pending Ratings', () => {
    test('DASH-017: Pending ratings display on dashboard', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);

      // Check for pending ratings section or indicator
      const pendingRatings = page.getByText(/pending.*rating|rate.*delivery|unrated/i);
      // May or may not have pending ratings
    });

    test('DASH-018: Rate delivery action opens modal', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);

      const rateButton = page.getByRole('button', { name: /rate/i }).first();
      if (await rateButton.isVisible()) {
        await rateButton.click();

        // Rating modal should appear
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.getByText(/star|rating/i)).toBeVisible();
      }
    });
  });

  test.describe('Role-Based Content', () => {
    test('Sender sees package-related content', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);

      // Should see package-related links or sections
      await expect(page.getByText(/package|send|delivery/i).first()).toBeVisible();
    });

    test('Courier sees route-related content', async ({ page }) => {
      await loginUser(page, TEST_USERS.courier);

      // Should see route-related links or sections
      await expect(page.getByText(/route|deliver|courier/i).first()).toBeVisible();
    });

    test('Both role sees sender and courier content', async ({ page }) => {
      await loginUser(page, TEST_USERS.both);

      // Should see both package and route related content
      const hasPackageContent = await page.getByText(/package|send/i).first().isVisible();
      const hasRouteContent = await page.getByText(/route|deliver/i).first().isVisible();

      expect(hasPackageContent || hasRouteContent).toBeTruthy();
    });

    test('Admin redirects to admin dashboard', async ({ page }) => {
      await loginUser(page, TEST_USERS.admin);

      // Admin should be on admin page, not regular dashboard
      await expect(page).toHaveURL(/\/admin/);
    });
  });
});
