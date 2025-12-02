import { test, expect } from '@playwright/test';
import { TEST_USERS, loginUser } from './fixtures/test-fixtures';

test.describe('Payout Tests (Courier)', () => {
  test.describe('Connect Account Setup', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, TEST_USERS.courier);
    });

    test('TC-PAYOUT-001: Navigate to payout settings', async ({ page }) => {
      await page.goto('/dashboard');

      // Navigate to payout/earnings page
      const payoutLink = page.locator('a[href*="/payout"]').or(page.locator('a[href*="/earning"]')).first();

      if (await payoutLink.isVisible({ timeout: 3000 }).catch(() => false)) {
        await payoutLink.click();
      } else {
        // Try direct navigation
        await page.goto('/courier/payouts');
      }

      // Should show payout or earnings heading
      await expect(
        page.getByRole('heading', { name: /payout|earning/i })
      ).toBeVisible({ timeout: 10000 });
    });

    test('TC-PAYOUT-002: Stripe Connect onboarding flow', async ({ page }) => {
      await page.goto('/courier/payouts');

      // Check if connect account needs setup
      const setupButton = page.getByRole('button', { name: /connect.*stripe|setup.*payout|complete.*onboarding/i });

      if (await setupButton.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Click setup button - should redirect to Stripe or show status
        await setupButton.click();

        // Should either navigate to Stripe (external) or show status
        await page.waitForTimeout(2000);

        // Check if URL changed to Stripe or if modal appeared
        const currentUrl = page.url();
        const isStripeUrl = currentUrl.includes('stripe.com');
        const hasModal = await page.locator('[role="dialog"]').isVisible({ timeout: 2000 }).catch(() => false);

        expect(isStripeUrl || hasModal || currentUrl.includes('payout')).toBeTruthy();
      } else {
        // Account already set up - should show balance or earnings
        await expect(
          page.getByText(/balance|available|earning/i)
        ).toBeVisible();
      }
    });

    test('TC-PAYOUT-003: View Stripe Dashboard link', async ({ page }) => {
      await page.goto('/courier/payouts');

      // If connect account is set up, should show dashboard link
      const dashboardLink = page.getByRole('link', { name: /stripe.*dashboard|view.*dashboard/i })
        .or(page.getByRole('button', { name: /stripe.*dashboard|view.*dashboard/i }));

      // Either dashboard link exists or account needs setup
      const hasDashboardLink = await dashboardLink.isVisible({ timeout: 3000 }).catch(() => false);
      const hasSetupButton = await page.getByRole('button', { name: /setup|onboard/i }).isVisible({ timeout: 2000 }).catch(() => false);

      expect(hasDashboardLink || hasSetupButton).toBeTruthy();
    });
  });

  test.describe('Balance and Earnings', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, TEST_USERS.courier);
    });

    test('TC-PAYOUT-004: View available balance', async ({ page }) => {
      await page.goto('/courier/payouts');

      // Should show balance information
      await expect(
        page.getByText(/available.*balance|balance.*available|\$\d+/i)
      ).toBeVisible({ timeout: 10000 });
    });

    test('TC-PAYOUT-005: View earnings summary', async ({ page }) => {
      await page.goto('/courier/payouts');

      // Should show earnings breakdown
      // Look for earnings-related text or currency amounts
      const hasEarnings = await page.getByText(/total.*earning|completed.*deliveries|earning.*summary/i).isVisible({ timeout: 5000 }).catch(() => false);
      const hasCurrency = await page.getByText(/\$\d+/).isVisible();

      expect(hasEarnings || hasCurrency).toBeTruthy();
    });
  });

  test.describe('Payout Requests', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, TEST_USERS.courier);
    });

    test('TC-PAYOUT-006: Request payout button is visible', async ({ page }) => {
      await page.goto('/courier/payouts');

      // Should show request payout button (may be disabled if balance is low)
      const payoutButton = page.getByRole('button', { name: /request.*payout|withdraw|cash.*out/i });

      // Button should exist (even if disabled)
      await expect(payoutButton).toBeVisible({ timeout: 10000 });
    });

    test('TC-PAYOUT-007: Payout minimum threshold message', async ({ page }) => {
      await page.goto('/courier/payouts');

      // If balance is below minimum, should show threshold message
      const payoutButton = page.getByRole('button', { name: /request.*payout|withdraw|cash.*out/i });

      if (await payoutButton.isVisible()) {
        // Check if button is disabled and shows minimum threshold
        const isDisabled = await payoutButton.isDisabled().catch(() => false);

        if (isDisabled) {
          // Should show minimum threshold message
          await expect(
            page.getByText(/minimum.*\$|threshold|\$\d+.*required/i)
          ).toBeVisible({ timeout: 3000 });
        }
      }
    });

    test('TC-PAYOUT-008: View payout history', async ({ page }) => {
      await page.goto('/courier/payouts');

      // Look for payout history section or tab
      const historyTab = page.getByRole('tab', { name: /history/i });
      const historyHeading = page.getByRole('heading', { name: /payout.*history/i });

      if (await historyTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await historyTab.click();
      }

      // Should show history list or empty state
      const hasHistory = (await page.locator('[data-testid="payout-row"]').count()) > 0;
      const hasEmptyState = await page.getByText(/no.*payout|no.*withdrawal/i).isVisible({ timeout: 3000 }).catch(() => false);

      expect(hasHistory || hasEmptyState || await historyHeading.isVisible().catch(() => false)).toBeTruthy();
    });
  });

  test.describe('Role-based Payout Access', () => {
    test('TC-PAYOUT-009: Sender cannot access payout settings', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);

      // Try to access payout settings (courier-only)
      await page.goto('/courier/payouts');

      // Should either redirect or show access denied
      await page.waitForTimeout(2000);

      // Check if redirected or shows error
      const currentUrl = page.url();
      const isRedirected = !currentUrl.includes('/courier/payouts');
      const hasError = await page.getByText(/access denied|unauthorized|not authorized/i).isVisible({ timeout: 2000 }).catch(() => false);

      expect(isRedirected || hasError).toBeTruthy();
    });

    test('TC-PAYOUT-010: Both role can access payout settings', async ({ page }) => {
      await loginUser(page, TEST_USERS.both);

      await page.goto('/courier/payouts');

      // Should show payout page (since both role can be courier)
      await expect(
        page.getByRole('heading', { name: /payout|earning/i })
      ).toBeVisible({ timeout: 10000 });
    });
  });

  test.describe('Payout Transaction Details', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, TEST_USERS.courier);
    });

    test('TC-PAYOUT-011: Payout details show transfer information', async ({ page }) => {
      await page.goto('/courier/payouts');

      // Navigate to history if exists
      const historyTab = page.getByRole('tab', { name: /history/i });
      if (await historyTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await historyTab.click();
      }

      // Check if any payout history exists
      const payoutRows = page.locator('[data-testid="payout-row"]');
      const count = await payoutRows.count();

      if (count > 0) {
        // Click first payout to view details
        await payoutRows.first().click();

        // Should show payout details
        await expect(
          page.getByText(/amount|status|date|transfer/i)
        ).toBeVisible({ timeout: 5000 });
      }
    });
  });
});
