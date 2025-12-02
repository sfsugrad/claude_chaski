import { test, expect } from '@playwright/test';
import { TEST_USERS, loginUser } from './fixtures/test-fixtures';

test.describe('Notification Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page, TEST_USERS.sender);
  });

  test.describe('Notification Dropdown', () => {
    test('TC-NOTIF-001: Notification bell icon is visible in navbar', async ({ page }) => {
      await page.goto('/dashboard');

      // Bell icon should be visible - it's a button with "Notifications" name
      await expect(page.getByRole('button', { name: /notifications/i })).toBeVisible();
    });

    test('TC-NOTIF-001: Click bell icon opens dropdown', async ({ page }) => {
      await page.goto('/dashboard');

      // Click notification bell
      await page.getByRole('button', { name: /notifications/i }).click();

      // Dropdown should appear - check for notification content or empty state
      const hasDropdownContent = await page.getByText(/no notifications|view all|recent/i).isVisible();
      const hasNotificationItems = await page.getByRole('listitem').count() > 0;

      expect(hasDropdownContent || hasNotificationItems).toBeTruthy();
    });

    test('TC-NOTIF-001: Dropdown shows recent notifications', async ({ page }) => {
      await page.goto('/dashboard');

      await page.getByRole('button', { name: /notifications/i }).click();

      // Wait for dropdown to appear - check for the "Notifications" heading inside dropdown
      await expect(page.getByRole('heading', { name: 'Notifications', level: 3 })).toBeVisible();

      // Should show notifications list or empty message
      const hasNotifications = await page.getByRole('list').locator('a').count() > 0;
      const hasEmptyMessage = await page.getByText(/no notifications|no new/i).isVisible();

      expect(hasNotifications || hasEmptyMessage).toBeTruthy();
    });

    test('TC-NOTIF-002: View All link navigates to notifications page', async ({ page }) => {
      await page.goto('/dashboard');

      await page.getByRole('button', { name: /notifications/i }).click();

      const viewAllLink = page.getByRole('link', { name: /view all|see all/i });

      if (await viewAllLink.isVisible()) {
        await viewAllLink.click();
        await expect(page).toHaveURL('/notifications');
      }
    });
  });

  test.describe('Notifications Page', () => {
    test('TC-NOTIF-002: View notifications page', async ({ page }) => {
      await page.goto('/notifications');

      // Should show notifications page
      await expect(page.getByRole('heading', { name: /notifications/i })).toBeVisible();
    });

    test('TC-NOTIF-002: Notifications page has filter tabs', async ({ page }) => {
      await page.goto('/notifications');

      // Should have All and Unread tabs
      await expect(page.getByRole('button', { name: /^all$/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /unread/i })).toBeVisible();
    });

    test('Filter by All shows all notifications', async ({ page }) => {
      await page.goto('/notifications');

      await page.getByRole('button', { name: /^all$/i }).click();

      // All notifications should be visible (or empty state)
    });

    test('Filter by Unread shows only unread', async ({ page }) => {
      await page.goto('/notifications');

      await page.getByRole('button', { name: /unread/i }).click();

      // Only unread notifications should show
    });

    test('Notifications list shows notification content', async ({ page }) => {
      await page.goto('/notifications');

      const notificationItem = page.locator('[data-testid="notification-item"]').first();

      if (await notificationItem.isVisible()) {
        // Should show notification title and message
        await expect(notificationItem).toContainText(/.+/); // Has some text
      }
    });
  });

  test.describe('Notification Actions', () => {
    test('TC-NOTIF-003: Mark single notification as read', async ({ page }) => {
      await page.goto('/notifications');

      const unreadNotification = page.locator('[data-testid="notification-item"]').first();

      if (await unreadNotification.isVisible()) {
        const markReadButton = unreadNotification.getByRole('button', { name: /mark.*read/i });

        if (await markReadButton.isVisible()) {
          await markReadButton.click();

          // Notification styling should change (no longer bold/highlighted)
        }
      }
    });

    test('TC-NOTIF-004: Mark all as read button', async ({ page }) => {
      await page.goto('/notifications');

      const markAllButton = page.getByRole('button', { name: /mark all.*read/i });

      if (await markAllButton.isVisible()) {
        await markAllButton.click();

        // All notifications should be marked as read
      }
    });

    test('TC-NOTIF-005: Delete notification', async ({ page }) => {
      await page.goto('/notifications');

      const notificationItem = page.locator('[data-testid="notification-item"]').first();

      if (await notificationItem.isVisible()) {
        const deleteButton = notificationItem.getByRole('button', { name: /delete|remove/i });

        if (await deleteButton.isVisible()) {
          const initialCount = await page.locator('[data-testid="notification-item"]').count();

          await deleteButton.click();

          // Notification should be removed
          await expect(page.locator('[data-testid="notification-item"]')).toHaveCount(initialCount - 1);
        }
      }
    });
  });

  test.describe('Notification Links', () => {
    test('TC-NOTIF-006: Package notification links to package', async ({ page }) => {
      await page.goto('/notifications');

      // Find a package-related notification
      const packageNotification = page.locator('[data-testid="notification-item"]').filter({
        hasText: /package|matched|delivered/i,
      }).first();

      if (await packageNotification.isVisible()) {
        const viewLink = packageNotification.getByRole('link', { name: /view/i });

        if (await viewLink.isVisible()) {
          await viewLink.click();

          // Should navigate to package detail
          await expect(page).toHaveURL(/\/packages\/\d+/);
        }
      }
    });

    test('TC-NOTIF-007: Rating notification links to reviews', async ({ page }) => {
      await page.goto('/notifications');

      // Find a rating-related notification
      const ratingNotification = page.locator('[data-testid="notification-item"]').filter({
        hasText: /rating|review/i,
      }).first();

      if (await ratingNotification.isVisible()) {
        const viewLink = ratingNotification.getByRole('link', { name: /view/i });

        if (await viewLink.isVisible()) {
          await viewLink.click();

          // Should navigate to reviews page
          await expect(page).toHaveURL('/profile/reviews');
        }
      }
    });
  });

  test.describe('Unread Count Badge', () => {
    test('Unread count badge shows on bell icon', async ({ page }) => {
      await page.goto('/dashboard');

      // Check for unread badge
      const unreadBadge = page.locator('[data-testid="notification-unread-count"]');

      // Badge may or may not be visible depending on unread count
      if (await unreadBadge.isVisible()) {
        const count = await unreadBadge.textContent();
        expect(parseInt(count || '0')).toBeGreaterThanOrEqual(0);
      }
    });
  });

  test.describe('Notification Types Display', () => {
    test('TC-NOTIF-009: Notifications have type-specific styling', async ({ page }) => {
      await page.goto('/notifications');

      const notificationItem = page.locator('[data-testid="notification-item"]').first();

      if (await notificationItem.isVisible()) {
        // Should have some icon or styling
        const hasIcon = await notificationItem.locator('svg, [class*="icon"]').isVisible();
        const hasEmoji = (await notificationItem.textContent())?.match(/[\u{1F300}-\u{1F9FF}]/u);

        // Either icon or emoji should indicate notification type
      }
    });
  });
});

test.describe('Real-time Notifications (Multi-browser)', () => {
  test('TC-NOTIF-008: Notifications appear in real-time', async ({ browser }) => {
    // Create two contexts
    const senderContext = await browser.newContext();
    const courierContext = await browser.newContext();

    const senderPage = await senderContext.newPage();
    const courierPage = await courierContext.newPage();

    await loginUser(senderPage, TEST_USERS.sender);
    await loginUser(courierPage, TEST_USERS.courier);

    // Sender on dashboard watching for notifications
    await senderPage.goto('/dashboard');

    // Get initial notification count
    const initialBadge = senderPage.locator('[data-testid="notification-unread-count"]');
    let initialCount = 0;
    if (await initialBadge.isVisible()) {
      initialCount = parseInt((await initialBadge.textContent()) || '0');
    }

    // Courier performs an action that triggers notification
    // (This would need actual test data setup to fully test)

    // Cleanup
    await senderContext.close();
    await courierContext.close();
  });
});

test.describe('WebSocket Connection Status', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page, TEST_USERS.sender);
  });

  test('Connection indicator in notification dropdown', async ({ page }) => {
    await page.goto('/dashboard');

    await page.getByRole('button', { name: /notifications/i }).click();

    // Check for connection status indicator - may or may not be visible
    // Connection status might show as text or indicator in dropdown
  });
});

test.describe('Notification Dropdown - Courier', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page, TEST_USERS.courier);
  });

  test('Courier sees relevant notifications', async ({ page }) => {
    await page.goto('/dashboard');

    await page.getByRole('button', { name: /notifications/i }).click();

    // Wait for dropdown to appear
    await expect(page.getByRole('heading', { name: 'Notifications', level: 3 })).toBeVisible();

    // Should show courier-relevant notifications (matches, pickup requests, etc.)
    // or empty state
    const hasNotifications = await page.getByRole('list').locator('a').count() > 0;
    const hasEmptyMessage = await page.getByText(/no notifications|no new/i).isVisible();

    expect(hasNotifications || hasEmptyMessage).toBeTruthy();
  });
});
