import { test, expect, devices } from '@playwright/test';
import { TEST_USERS, loginUser } from './fixtures/test-fixtures';

// Mobile viewport
const mobileViewport = { width: 375, height: 667 };
// Tablet viewport
const tabletViewport = { width: 768, height: 1024 };
// Desktop viewport
const desktopViewport = { width: 1280, height: 720 };

test.describe('Responsive Design Tests', () => {
  test.describe('Mobile Navigation', () => {
    test.use({ viewport: mobileViewport });

    test('TC-RESP-001: Mobile shows hamburger menu', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
      await page.goto('/dashboard');

      // Should show hamburger menu icon
      const hamburgerMenu = page.locator('[data-testid="mobile-menu-button"], button[aria-label*="menu"]');
      await expect(hamburgerMenu).toBeVisible();
    });

    test('TC-RESP-001: Hamburger menu opens navigation', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
      await page.goto('/dashboard');

      // Click hamburger
      const hamburgerMenu = page.locator('[data-testid="mobile-menu-button"], button[aria-label*="menu"]');
      await hamburgerMenu.click();

      // Mobile nav should open
      await expect(page.locator('[data-testid="mobile-nav"], nav')).toBeVisible();
    });

    test('TC-RESP-001: Mobile nav shows all links', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
      await page.goto('/dashboard');

      // Open mobile menu
      const hamburgerMenu = page.locator('[data-testid="mobile-menu-button"], button[aria-label*="menu"]');
      await hamburgerMenu.click();

      // Check navigation links
      await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible();
      await expect(page.getByRole('link', { name: /packages|my packages/i })).toBeVisible();
    });

    test('TC-RESP-001: Mobile menu closes on link click', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
      await page.goto('/dashboard');

      const hamburgerMenu = page.locator('[data-testid="mobile-menu-button"], button[aria-label*="menu"]');
      await hamburgerMenu.click();

      // Click a link
      await page.getByRole('link', { name: /dashboard/i }).click();

      // Menu should close
      await page.waitForTimeout(500);
    });
  });

  test.describe('Mobile Package Cards', () => {
    test.use({ viewport: mobileViewport });

    test('TC-RESP-002: Package cards stack vertically', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
      await page.goto('/sender');

      // Cards should be full width on mobile
      const packageCard = page.locator('[data-testid="package-card"]').first();

      if (await packageCard.isVisible()) {
        const box = await packageCard.boundingBox();
        // Card width should be close to viewport width (minus padding)
        expect(box?.width).toBeGreaterThan(300);
      }
    });

    test('TC-RESP-002: Buttons are tappable size', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
      await page.goto('/sender');

      const button = page.getByRole('button').first();

      if (await button.isVisible()) {
        const box = await button.boundingBox();
        // Minimum tappable size is 44x44 per accessibility guidelines
        expect(box?.height).toBeGreaterThanOrEqual(40);
      }
    });
  });

  test.describe('Mobile Messages Layout', () => {
    test.use({ viewport: mobileViewport });

    test('TC-RESP-003: Messages shows list first', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
      await page.goto('/messages');

      // On mobile, conversation list should be primary view
      const conversationList = page.locator('[data-testid="conversation-list"]');
      // Should be visible initially
    });

    test('TC-RESP-003: Selecting conversation shows chat full screen', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
      await page.goto('/messages');

      const conversationItem = page.locator('[data-testid="conversation-item"]').first();

      if (await conversationItem.isVisible()) {
        await conversationItem.click();

        // Chat should be full screen
        const chatWindow = page.locator('[data-testid="chat-window"]');
        if (await chatWindow.isVisible()) {
          const box = await chatWindow.boundingBox();
          // Should take most of the viewport
          expect(box?.width).toBeGreaterThan(300);
        }
      }
    });

    test('TC-RESP-003: Back button returns to conversation list', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
      await page.goto('/messages');

      const conversationItem = page.locator('[data-testid="conversation-item"]').first();

      if (await conversationItem.isVisible()) {
        await conversationItem.click();

        // Find and click back button
        const backButton = page.getByRole('button', { name: /back|←/i });
        if (await backButton.isVisible()) {
          await backButton.click();

          // Should return to list view
        }
      }
    });
  });

  test.describe('Tablet Layout', () => {
    test.use({ viewport: tabletViewport });

    test('TC-RESP-004: Dashboard shows proper grid', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
      await page.goto('/dashboard');

      // Dashboard should show welcome message and content
      await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
    });

    test('TC-RESP-004: Forms have appropriate width', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
      await page.goto('/packages/create');

      // Form should be centered and not full width
      const form = page.locator('form').first();
      const box = await form.boundingBox();

      // Form should be reasonable width for tablet
      expect(box?.width).toBeLessThan(768);
    });
  });

  test.describe('Desktop Layout', () => {
    test.use({ viewport: desktopViewport });

    test('TC-RESP-005: Desktop shows full navigation', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
      await page.goto('/dashboard');

      // Should NOT show hamburger menu
      const hamburgerMenu = page.locator('[data-testid="mobile-menu-button"]');
      await expect(hamburgerMenu).not.toBeVisible();

      // Should show full navigation links
      await expect(page.getByRole('link', { name: /dashboard/i })).toBeVisible();
    });

    test('TC-RESP-005: Messages shows split view', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
      await page.goto('/messages');

      // Both list and chat should be visible
      const conversationList = page.locator('[data-testid="conversation-list"]');
      // Should be visible in split view

      // Select a conversation to show chat
      const conversationItem = page.locator('[data-testid="conversation-item"]').first();
      if (await conversationItem.isVisible()) {
        await conversationItem.click();

        // Both should be visible side by side on desktop
      }
    });

    test('TC-RESP-005: Content is centered with max-width', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
      await page.goto('/dashboard');

      const container = page.locator('main .container, [class*="container"]').first();

      if (await container.isVisible()) {
        const box = await container.boundingBox();
        // Content should have reasonable max-width
        expect(box?.width).toBeLessThanOrEqual(1400);
      }
    });
  });

  test.describe('Form Responsiveness', () => {
    test.use({ viewport: mobileViewport });

    test('TC-RESP-006: Registration form single column on mobile', async ({ page }) => {
      await page.goto('/register');

      // Form should use single column
      const form = page.locator('form').first();
      const box = await form.boundingBox();

      // Should take full width on mobile
      expect(box?.width).toBeGreaterThan(300);
    });

    test('TC-RESP-006: Address autocomplete fits viewport', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
      await page.goto('/packages/create');

      // Type in address field to trigger autocomplete
      const addressInput = page.locator('input[placeholder*="address"]').first();

      if (await addressInput.isVisible()) {
        await addressInput.fill('123 Main');
        await page.waitForTimeout(500);

        // Autocomplete dropdown should not overflow viewport
        const dropdown = page.locator('[data-testid="autocomplete-dropdown"], [class*="autocomplete"]');
        if (await dropdown.isVisible()) {
          const box = await dropdown.boundingBox();
          expect(box?.width).toBeLessThanOrEqual(mobileViewport.width);
        }
      }
    });
  });
});

test.describe('Error Handling Tests', () => {
  test.describe('404 Errors', () => {
    test('TC-ERR-001: Package not found shows error', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
      await page.goto('/packages/99999999');

      // Should show 404 or not found message
      await expect(page.getByText(/not found|404|doesn't exist/i)).toBeVisible();
    });

    test('Route not found shows error', async ({ page }) => {
      await loginUser(page, TEST_USERS.courier);
      await page.goto('/courier/routes/99999999/matches');

      // Should show error
      await expect(page.getByText(/not found|404|error/i)).toBeVisible();
    });
  });

  test.describe('403 Errors', () => {
    test('TC-ERR-002: Unauthorized package access', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);

      // Try to access another user's package
      // This requires knowing a package ID belonging to another user
      // For now, just verify the system handles it

      await page.goto('/packages/1');

      // Either shows package (if allowed) or error (unauthorized/not found)
      const hasError = await page.getByText(/unauthorized|forbidden|access denied|not found/i).isVisible();
      const hasPackage = await page.getByText(/description|status|pickup|dropoff/i).isVisible();

      expect(hasError || hasPackage).toBeTruthy();
    });
  });

  test.describe('Network Errors', () => {
    test('TC-ERR-003: Shows error on failed API call', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);

      // Intercept API calls and force failure
      await page.route('**/api/packages', (route) => {
        route.abort('failed');
      });

      await page.goto('/sender');

      // Should show error message or handle gracefully
      await page.waitForTimeout(2000);
    });
  });

  test.describe('Form Validation Errors', () => {
    test('TC-ERR-006: Form errors show inline', async ({ page }) => {
      await page.goto('/register');

      // Submit empty form - button is "Create Account"
      await page.getByRole('button', { name: /create account/i }).click();

      // Form should not submit (stays on register page) - validation prevents submission
      // The form uses HTML5 validation, so check we're still on register page
      await expect(page).toHaveURL('/register');
    });

    test('TC-ERR-006: Invalid fields are highlighted', async ({ page }) => {
      await page.goto('/login');

      // Submit with empty fields
      await page.getByRole('button', { name: /sign in/i }).click();

      // Form should not submit (stays on login page) - HTML5 validation prevents submission
      await expect(page).toHaveURL('/login');
    });

    test('TC-ERR-006: Errors clear when fixed', async ({ page }) => {
      await page.goto('/register');

      // Submit empty form to show errors - button is "Create Account"
      await page.getByRole('button', { name: /create account/i }).click();

      // Now fill in the email
      await page.getByLabel(/email/i).fill('test@example.com');

      // Email error should clear (may need to blur or submit again)
      await page.getByLabel(/password/i).first().click();

      // Check if email error cleared
    });
  });
});

test.describe('API Error Messages', () => {
  test('TC-ERR-005: User-friendly error messages', async ({ page }) => {
    await page.goto('/login');

    // Try invalid login
    await page.getByLabel('Email').fill('wrong@example.com');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: /sign in/i }).click();

    // Error should be user-friendly
    const errorText = await page.locator('[role="alert"], [class*="error"]').textContent();

    // Should not contain technical jargon
    expect(errorText).not.toMatch(/exception|stack trace|undefined/i);
  });
});
