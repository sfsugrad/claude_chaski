import { test, expect } from '@playwright/test';
import { TEST_USERS, loginUser } from './fixtures/test-fixtures';

test.describe('Payment Tests', () => {
  test.describe('Payment Methods Management', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
    });

    test('TC-PAY-001: Navigate to payment settings', async ({ page }) => {
      await page.goto('/dashboard');

      // Navigate to payment settings (could be in user menu or settings)
      // Check if payment settings link is visible
      const paymentLink = page.locator('a[href*="/payment"]').first();
      if (await paymentLink.isVisible()) {
        await paymentLink.click();
        await expect(page).toHaveURL(/\/payment/);
      } else {
        // Try navigating directly
        await page.goto('/settings/payment');
      }

      // Should show payment methods section
      await expect(
        page.getByRole('heading', { name: /payment.*method/i })
      ).toBeVisible({ timeout: 10000 });
    });

    test('TC-PAY-002: View existing payment methods', async ({ page }) => {
      await page.goto('/settings/payment');

      // Should show payment methods list or empty state
      const hasPaymentMethods = (await page.locator('[data-testid="payment-method-card"]').count()) > 0;
      const hasEmptyState = await page.getByText(/no payment methods/i).isVisible();

      expect(hasPaymentMethods || hasEmptyState).toBeTruthy();
    });

    test('TC-PAY-003: Add payment method button is visible', async ({ page }) => {
      await page.goto('/settings/payment');

      // Should show add payment method button
      const addButton = page.getByRole('button', { name: /add.*payment.*method|add.*card/i });
      await expect(addButton).toBeVisible();
    });

    test('TC-PAY-004: Add payment method opens Stripe form', async ({ page }) => {
      await page.goto('/settings/payment');

      // Click add payment method
      const addButton = page.getByRole('button', { name: /add.*payment.*method|add.*card/i });
      await addButton.click();

      // Should show Stripe Elements iframe or card input form
      // Wait for either iframe or card number input to appear
      await page.waitForTimeout(2000); // Allow Stripe to load

      const hasStripeIframe = (await page.frameLocator('iframe[name*="stripe"]').count()) > 0;
      const hasCardInput = await page.locator('input[placeholder*="card"]').isVisible();

      expect(hasStripeIframe || hasCardInput).toBeTruthy();
    });

    test('TC-PAY-005: Delete payment method', async ({ page }) => {
      await page.goto('/settings/payment');

      // Check if any payment methods exist
      const paymentMethodCards = page.locator('[data-testid="payment-method-card"]');
      const count = await paymentMethodCards.count();

      if (count > 0) {
        // Find delete button
        const deleteButton = paymentMethodCards.first().getByRole('button', { name: /delete|remove/i });

        if (await deleteButton.isVisible()) {
          await deleteButton.click();

          // May show confirmation dialog
          const confirmButton = page.getByRole('button', { name: /confirm|yes|delete/i });
          if (await confirmButton.isVisible({ timeout: 2000 })) {
            await confirmButton.click();
          }

          // Should show success message or payment method removed
          await expect(
            page.getByText(/removed|deleted/i).or(page.getByText(/success/i))
          ).toBeVisible({ timeout: 5000 });
        }
      }
    });

    test('TC-PAY-006: Set default payment method', async ({ page }) => {
      await page.goto('/settings/payment');

      // Check if multiple payment methods exist
      const paymentMethodCards = page.locator('[data-testid="payment-method-card"]');
      const count = await paymentMethodCards.count();

      if (count > 1) {
        // Find a non-default payment method
        const setDefaultButton = page.getByRole('button', { name: /set.*default|make.*default/i }).first();

        if (await setDefaultButton.isVisible()) {
          await setDefaultButton.click();

          // Should show success message or update UI
          await expect(
            page.getByText(/default.*updated|set.*default/i).or(page.getByText(/success/i))
          ).toBeVisible({ timeout: 5000 });
        }
      }
    });
  });

  test.describe('Package Payment Flow', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
    });

    test('TC-PAY-007: View package payment option', async ({ page }) => {
      await page.goto('/sender');

      // Find a package with selected bid that needs payment
      const packageCards = page.locator('[data-testid="package-card"]');
      const count = await packageCards.count();

      if (count > 0) {
        // Click first package to view details
        await packageCards.first().click();

        // Check if pay button is visible (for packages with selected bids)
        const payButton = page.getByRole('button', { name: /pay|payment|charge/i });

        // Either pay button exists or package doesn't need payment yet
        const hasPayButton = await payButton.isVisible({ timeout: 3000 }).catch(() => false);
        const hasStatusInfo = await page.locator('[data-testid="package-status"]').isVisible();

        expect(hasPayButton || hasStatusInfo).toBeTruthy();
      }
    });

    test('TC-PAY-008: Payment confirmation shows amount', async ({ page }) => {
      await page.goto('/sender');

      // Find a package that needs payment
      const packageCards = page.locator('[data-testid="package-card"]');
      const count = await packageCards.count();

      if (count > 0) {
        await packageCards.first().click();

        // Look for pay button
        const payButton = page.getByRole('button', { name: /pay|payment|charge/i });

        if (await payButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          await payButton.click();

          // Should show payment confirmation with amount
          await expect(
            page.getByText(/\$\d+/).or(page.getByText(/total|amount/i))
          ).toBeVisible({ timeout: 5000 });
        }
      }
    });
  });

  test.describe('Transaction History', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
    });

    test('TC-PAY-009: View transaction history', async ({ page }) => {
      // Navigate to transactions page (could be in payments or dashboard)
      await page.goto('/payments/transactions');

      // Should show transactions heading or navigate via menu
      const hasTransactionHeading = await page.getByRole('heading', { name: /transaction/i }).isVisible({ timeout: 3000 }).catch(() => false);

      if (!hasTransactionHeading) {
        // Try alternative routes
        await page.goto('/settings/payment');
        const transactionLink = page.getByRole('link', { name: /transaction.*history/i });
        if (await transactionLink.isVisible({ timeout: 2000 }).catch(() => false)) {
          await transactionLink.click();
        }
      }

      // Should show transaction list or empty state
      const hasTransactions = (await page.locator('[data-testid="transaction-row"]').count()) > 0;
      const hasEmptyState = await page.getByText(/no transactions/i).isVisible({ timeout: 2000 }).catch(() => false);

      expect(hasTransactions || hasEmptyState).toBeTruthy();
    });

    test('TC-PAY-010: Transaction details show package info', async ({ page }) => {
      await page.goto('/payments/transactions');

      // Check if any transactions exist
      const transactionRows = page.locator('[data-testid="transaction-row"]');
      const count = await transactionRows.count();

      if (count > 0) {
        // Click first transaction to view details
        await transactionRows.first().click();

        // Should show transaction details including package info
        await expect(
          page.getByText(/package|amount|status|date/i)
        ).toBeVisible({ timeout: 5000 });
      }
    });
  });

  test.describe('Payment Error Handling', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
    });

    test('TC-PAY-011: Shows error when no payment method available', async ({ page }) => {
      await page.goto('/sender');

      // Find a package that needs payment
      const packageCards = page.locator('[data-testid="package-card"]');
      const count = await packageCards.count();

      if (count > 0) {
        await packageCards.first().click();

        // Look for pay button
        const payButton = page.getByRole('button', { name: /pay|payment|charge/i });

        if (await payButton.isVisible({ timeout: 3000 }).catch(() => false)) {
          // Check if it shows message about adding payment method first
          // or if it navigates to add payment method
          await payButton.click();

          // Either shows error or navigates to payment setup
          const hasError = await page.getByText(/add.*payment.*method|no payment method/i).isVisible({ timeout: 3000 }).catch(() => false);
          const hasPaymentForm = await page.locator('iframe[name*="stripe"]').count() > 0;

          expect(hasError || hasPaymentForm).toBeTruthy();
        }
      }
    });
  });

  test.describe('Role-based Payment Access', () => {
    test('TC-PAY-012: Courier cannot access sender payment settings', async ({ page }) => {
      await loginUser(page, TEST_USERS.courier);

      // Try to access payment settings (sender-only)
      await page.goto('/settings/payment');

      // Should either redirect or show access denied
      // Couriers have payout settings instead
      await expect(
        page.getByRole('heading', { name: /payout|earnings/i })
          .or(page.getByText(/access denied|unauthorized/i))
      ).toBeVisible({ timeout: 10000 });
    });

    test('TC-PAY-013: Both role can access payment methods', async ({ page }) => {
      await loginUser(page, TEST_USERS.both);

      await page.goto('/settings/payment');

      // Should show payment methods page (since both role can send packages)
      await expect(
        page.getByRole('heading', { name: /payment.*method/i })
      ).toBeVisible({ timeout: 10000 });
    });
  });
});
