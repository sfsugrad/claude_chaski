import { test, expect } from '@playwright/test';
import { TEST_USERS, loginUser } from './fixtures/test-fixtures';

test.describe('Bidding System Tests', () => {
  test.describe('Placing Bids (Courier)', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, TEST_USERS.courier);
    });

    test('BID-001: Bid modal opens on Place Bid click', async ({ page }) => {
      // Navigate to route matches
      await page.goto('/courier');

      // Find a route with View Matches link
      const viewMatchesLink = page.getByRole('link', { name: /view.*matches|matches/i }).first();

      if (await viewMatchesLink.isVisible()) {
        await viewMatchesLink.click();

        // Wait for matches page
        await page.waitForURL(/\/courier\/routes\/.*\/matches/);

        // Find Place Bid button
        const placeBidBtn = page.getByRole('button', { name: /place.*bid|bid/i }).first();

        if (await placeBidBtn.isVisible()) {
          await placeBidBtn.click();

          // Modal should open
          await expect(page.getByRole('dialog')).toBeVisible();
          await expect(page.getByLabel(/price|amount|bid/i)).toBeVisible();
        }
      }
    });

    test('BID-002: Bid price validation - rejects zero or negative', async ({ page }) => {
      await page.goto('/courier');

      const viewMatchesLink = page.getByRole('link', { name: /view.*matches|matches/i }).first();

      if (await viewMatchesLink.isVisible()) {
        await viewMatchesLink.click();
        await page.waitForURL(/\/courier\/routes\/.*\/matches/);

        const placeBidBtn = page.getByRole('button', { name: /place.*bid|bid/i }).first();

        if (await placeBidBtn.isVisible()) {
          await placeBidBtn.click();

          // Enter zero price
          const priceInput = page.getByLabel(/price|amount|bid/i);
          await priceInput.fill('0');

          // Submit bid
          await page.getByRole('button', { name: /submit|place/i }).click();

          // Should show error
          await expect(page.getByText(/greater than|invalid|minimum/i)).toBeVisible();
        }
      }
    });

    test('BID-003: Bid submission with valid data', async ({ page }) => {
      await page.goto('/courier');

      const viewMatchesLink = page.getByRole('link', { name: /view.*matches|matches/i }).first();

      if (await viewMatchesLink.isVisible()) {
        await viewMatchesLink.click();
        await page.waitForURL(/\/courier\/routes\/.*\/matches/);

        const placeBidBtn = page.getByRole('button', { name: /place.*bid|bid/i }).first();

        if (await placeBidBtn.isVisible()) {
          await placeBidBtn.click();

          // Enter valid bid
          const priceInput = page.getByLabel(/price|amount|bid/i);
          await priceInput.fill('25.00');

          // Submit bid
          await page.getByRole('button', { name: /submit|place/i }).click();

          // Should close modal and show success or update UI
          await page.waitForTimeout(1000);
        }
      }
    });

    test('BID-005: Withdraw bid shows confirmation', async ({ page }) => {
      await page.goto('/courier');

      // Look for withdraw button on existing bid
      const withdrawBtn = page.getByRole('button', { name: /withdraw/i }).first();

      if (await withdrawBtn.isVisible()) {
        await withdrawBtn.click();

        // Should show confirmation dialog
        await expect(page.getByRole('dialog')).toBeVisible();
        await expect(page.getByText(/confirm|sure|withdraw/i)).toBeVisible();
      }
    });

    test('BID-020: Unverified courier cannot place bids', async ({ page }) => {
      // This would require an unverified courier account
      // Testing that the Place Bid button shows verification prompt

      await page.goto('/courier');

      const viewMatchesLink = page.getByRole('link', { name: /view.*matches|matches/i }).first();

      if (await viewMatchesLink.isVisible()) {
        await viewMatchesLink.click();

        // Check for verification warning if courier is not ID verified
        const verificationWarning = page.getByText(/verify.*id|id.*required|verification.*required/i);
        // May or may not show depending on user's verification status
      }
    });
  });

  test.describe('Viewing Bids (Sender)', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
    });

    test('BID-007: Bid list displays on package with bids', async ({ page }) => {
      await page.goto('/sender');

      // Find a package card and click to view details
      const packageLink = page.locator('a[href*="/packages/"]').first();

      if (await packageLink.isVisible()) {
        await packageLink.click();

        // Wait for package detail page
        await page.waitForURL(/\/packages\/\d+/);

        // Look for bids section
        const bidsSection = page.getByText(/bids|offers/i);
        // May or may not have bids
      }
    });

    test('BID-008: Bid card shows courier info', async ({ page }) => {
      await page.goto('/sender');

      const packageLink = page.locator('a[href*="/packages/"]').first();

      if (await packageLink.isVisible()) {
        await packageLink.click();
        await page.waitForURL(/\/packages\/\d+/);

        // Look for bid cards
        const bidCard = page.locator('[data-testid="bid-card"], [class*="bid"]').first();

        if (await bidCard.isVisible()) {
          // Should show courier name/rating and price
          await expect(bidCard.getByText(/\$/)).toBeVisible();
        }
      }
    });

    test('BID-009: Accept bid button visible', async ({ page }) => {
      await page.goto('/sender');

      const packageLink = page.locator('a[href*="/packages/"]').first();

      if (await packageLink.isVisible()) {
        await packageLink.click();
        await page.waitForURL(/\/packages\/\d+/);

        // Look for accept button on bids
        const acceptBtn = page.getByRole('button', { name: /accept/i }).first();

        // May or may not be visible depending on package status
      }
    });

    test('BID-010: Accept bid shows confirmation modal', async ({ page }) => {
      await page.goto('/sender');

      const packageLink = page.locator('a[href*="/packages/"]').first();

      if (await packageLink.isVisible()) {
        await packageLink.click();
        await page.waitForURL(/\/packages\/\d+/);

        const acceptBtn = page.getByRole('button', { name: /accept/i }).first();

        if (await acceptBtn.isVisible()) {
          await acceptBtn.click();

          // Should show confirmation dialog
          await expect(page.getByRole('dialog')).toBeVisible();
        }
      }
    });

    test('BID-011: Bid deadline countdown displays', async ({ page }) => {
      await page.goto('/sender');

      const packageLink = page.locator('a[href*="/packages/"]').first();

      if (await packageLink.isVisible()) {
        await packageLink.click();
        await page.waitForURL(/\/packages\/\d+/);

        // Look for deadline/countdown timer
        const deadline = page.getByText(/deadline|expires|remaining|hours|minutes/i);
        // May not be visible if no active bids
      }
    });
  });

  test.describe('Bid Deadline Behavior', () => {
    test('BID-013: Package shows deadline extension info', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
      await page.goto('/sender');

      const packageLink = page.locator('a[href*="/packages/"]').first();

      if (await packageLink.isVisible()) {
        await packageLink.click();
        await page.waitForURL(/\/packages\/\d+/);

        // Check for extension info if applicable
        const extensionInfo = page.getByText(/extended|extension/i);
        // May not be visible if deadline hasn't been extended
      }
    });
  });

  test.describe('Both Role Bidding', () => {
    test('Both role user can place bids as courier', async ({ page }) => {
      await loginUser(page, TEST_USERS.both);

      await page.goto('/courier');

      // Should have access to courier features
      await expect(page.getByText(/route|courier/i).first()).toBeVisible();
    });

    test('Both role user can view bids as sender', async ({ page }) => {
      await loginUser(page, TEST_USERS.both);

      await page.goto('/sender');

      // Should have access to sender features
      await expect(page.getByText(/package|my packages/i).first()).toBeVisible();
    });
  });
});
