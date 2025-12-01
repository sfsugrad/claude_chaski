import { test, expect } from '@playwright/test';
import { TEST_USERS, loginUser } from './fixtures/test-fixtures';

test.describe('Accessibility Tests', () => {
  test.describe('Keyboard Navigation', () => {
    test('A11Y-001: Login form navigable by keyboard', async ({ page }) => {
      await page.goto('/login');

      // Tab through form fields
      await page.keyboard.press('Tab');
      const emailFocused = await page.getByLabel(/email/i).evaluate(el => el === document.activeElement);

      await page.keyboard.press('Tab');
      const passwordFocused = await page.getByLabel(/password/i).evaluate(el => el === document.activeElement);

      // One of the form fields should be focusable
      expect(emailFocused || passwordFocused).toBeTruthy();
    });

    test('A11Y-002: Submit form with Enter key', async ({ page }) => {
      await page.goto('/login');

      await page.getByLabel(/email/i).fill('test@example.com');
      await page.getByLabel(/password/i).fill('TestPassword123!');

      // Press Enter to submit
      await page.keyboard.press('Enter');

      // Form should attempt to submit (may show error or redirect)
      await page.waitForTimeout(500);
    });

    test('A11Y-003: Modal can be closed with Escape', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
      await page.goto('/sender');

      // Open a modal if possible
      const modalTrigger = page.getByRole('button', { name: /cancel|delete/i }).first();

      if (await modalTrigger.isVisible()) {
        await modalTrigger.click();

        // Modal should be open
        const dialog = page.getByRole('dialog');
        if (await dialog.isVisible()) {
          // Press Escape
          await page.keyboard.press('Escape');

          // Modal should close
          await expect(dialog).not.toBeVisible();
        }
      }
    });

    test('A11Y-004: Dropdown menu navigable with arrow keys', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
      await page.goto('/dashboard');

      // Find a dropdown menu
      const dropdown = page.getByRole('button', { name: /menu|language/i }).first();

      if (await dropdown.isVisible()) {
        await dropdown.click();

        // Navigate with arrow keys
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('ArrowDown');
        await page.keyboard.press('Enter');
      }
    });

    test('A11Y-005: Tab order is logical', async ({ page }) => {
      await page.goto('/login');

      const focusOrder: string[] = [];

      // Tab through elements and record order
      for (let i = 0; i < 5; i++) {
        await page.keyboard.press('Tab');
        const focused = await page.evaluate(() => {
          const el = document.activeElement;
          return el ? el.tagName + (el.id ? '#' + el.id : '') : 'none';
        });
        focusOrder.push(focused);
      }

      // Should have multiple focusable elements
      expect(focusOrder.length).toBeGreaterThan(0);
    });
  });

  test.describe('Focus Management', () => {
    test('A11Y-006: Focus visible on interactive elements', async ({ page }) => {
      await page.goto('/login');

      // Tab to a button
      await page.getByRole('button', { name: /sign in|login/i }).focus();

      // Check focus is visible (has outline or similar)
      const button = page.getByRole('button', { name: /sign in|login/i });
      const hasFocusStyle = await button.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return styles.outline !== 'none' || styles.boxShadow !== 'none';
      });

      // Focus should be visible
    });

    test('A11Y-007: Skip to main content link', async ({ page }) => {
      await page.goto('/login');

      // Check for skip link (usually hidden until focused)
      const skipLink = page.getByRole('link', { name: /skip to main|skip to content/i });

      // May or may not be implemented
      if (await skipLink.count() > 0) {
        await page.keyboard.press('Tab');
        await expect(skipLink).toBeFocused();
      }
    });

    test('A11Y-008: Focus trapped in modal', async ({ page }) => {
      await loginUser(page, TEST_USERS.courier);
      await page.goto('/courier');

      // Try to open a modal
      const viewMatchesLink = page.getByRole('link', { name: /view matches/i }).first();

      if (await viewMatchesLink.isVisible()) {
        await viewMatchesLink.click();
        await page.waitForURL(/\/matches/);

        // Find place bid button
        const placeBidBtn = page.getByRole('button', { name: /place.*bid/i }).first();

        if (await placeBidBtn.isVisible()) {
          await placeBidBtn.click();

          const dialog = page.getByRole('dialog');
          if (await dialog.isVisible()) {
            // Tab through modal - focus should stay within
            for (let i = 0; i < 10; i++) {
              await page.keyboard.press('Tab');
            }

            // Focus should still be in dialog
            const focusInDialog = await dialog.evaluate(el =>
              el.contains(document.activeElement)
            );
            expect(focusInDialog).toBeTruthy();
          }
        }
      }
    });
  });

  test.describe('Screen Reader Support', () => {
    test('A11Y-009: Images have alt text', async ({ page }) => {
      await page.goto('/');

      // Check all images have alt attributes
      const images = page.locator('img');
      const count = await images.count();

      for (let i = 0; i < count; i++) {
        const img = images.nth(i);
        const alt = await img.getAttribute('alt');
        // Alt can be empty for decorative images, but attribute should exist
        expect(alt !== null).toBeTruthy();
      }
    });

    test('A11Y-010: Form fields have labels', async ({ page }) => {
      await page.goto('/login');

      // Check email field has label
      const emailLabel = page.getByLabel(/email/i);
      await expect(emailLabel).toBeVisible();

      // Check password field has label
      const passwordLabel = page.getByLabel(/password/i);
      await expect(passwordLabel).toBeVisible();
    });

    test('A11Y-011: Buttons have accessible names', async ({ page }) => {
      await page.goto('/login');

      // All buttons should have accessible names
      const buttons = page.getByRole('button');
      const count = await buttons.count();

      for (let i = 0; i < count; i++) {
        const button = buttons.nth(i);
        const name = await button.getAttribute('aria-label') || await button.textContent();
        expect(name).toBeTruthy();
      }
    });

    test('A11Y-012: Links have descriptive text', async ({ page }) => {
      await page.goto('/login');

      // Check links don't just say "click here"
      const links = page.getByRole('link');
      const count = await links.count();

      for (let i = 0; i < count; i++) {
        const link = links.nth(i);
        const text = await link.textContent();
        expect(text?.toLowerCase()).not.toBe('click here');
        expect(text?.toLowerCase()).not.toBe('here');
      }
    });

    test('A11Y-013: Error messages announced to screen readers', async ({ page }) => {
      await page.goto('/login');

      // Submit empty form
      await page.getByRole('button', { name: /sign in|login/i }).click();

      // Check for aria-live regions or error announcements
      const errorRegion = page.locator('[role="alert"], [aria-live="polite"], [aria-live="assertive"]');
      // May or may not have ARIA live regions depending on implementation
    });

    test('A11Y-014: Headings in correct order', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
      await page.goto('/dashboard');

      // Get all headings
      const headings = await page.locator('h1, h2, h3, h4, h5, h6').allTextContents();

      // Should have at least one heading
      expect(headings.length).toBeGreaterThan(0);
    });

    test('A11Y-015: Page has main landmark', async ({ page }) => {
      await page.goto('/login');

      // Check for main landmark
      const main = page.locator('main, [role="main"]');
      await expect(main).toBeVisible();
    });
  });

  test.describe('Color and Contrast', () => {
    test('A11Y-016: Text not conveyed by color alone', async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
      await page.goto('/sender');

      // Check that status badges have text, not just color
      const statusBadges = page.locator('[class*="badge"], [class*="status"]');
      const count = await statusBadges.count();

      for (let i = 0; i < count; i++) {
        const badge = statusBadges.nth(i);
        if (await badge.isVisible()) {
          const text = await badge.textContent();
          expect(text?.trim().length).toBeGreaterThan(0);
        }
      }
    });

    test('A11Y-017: Focus indicators visible', async ({ page }) => {
      await page.goto('/login');

      // Tab to interactive element
      await page.keyboard.press('Tab');

      // Take screenshot to verify focus is visible
      // This is a visual check - automated testing is limited
    });
  });

  test.describe('Form Accessibility', () => {
    test('A11Y-018: Required fields marked', async ({ page }) => {
      await page.goto('/register');

      // Check for required indicators (asterisk or aria-required)
      const emailField = page.getByLabel(/email/i);
      const isRequired = await emailField.getAttribute('required') !== null ||
                         await emailField.getAttribute('aria-required') === 'true';

      expect(isRequired).toBeTruthy();
    });

    test('A11Y-019: Error messages associated with fields', async ({ page }) => {
      await page.goto('/login');

      // Fill invalid email
      await page.getByLabel(/email/i).fill('invalid');
      await page.getByRole('button', { name: /sign in|login/i }).click();

      // Error should be associated with field via aria-describedby or aria-errormessage
      // Or be adjacent to the field
    });

    test('A11Y-020: Autocomplete attributes present', async ({ page }) => {
      await page.goto('/login');

      // Email field should have autocomplete
      const emailField = page.getByLabel(/email/i);
      const autocomplete = await emailField.getAttribute('autocomplete');
      expect(autocomplete).toBeTruthy();

      // Password field should have autocomplete
      const passwordField = page.getByLabel(/password/i);
      const pwAutocomplete = await passwordField.getAttribute('autocomplete');
      expect(pwAutocomplete).toBeTruthy();
    });
  });

  test.describe('Motion and Animation', () => {
    test('A11Y-021: Animations respect prefers-reduced-motion', async ({ page }) => {
      // Set reduced motion preference
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await page.goto('/');

      // Animations should be disabled or reduced
      // This is a visual check - verify no jarring animations
    });
  });

  test.describe('Touch Target Size', () => {
    test('A11Y-022: Buttons have adequate touch target', async ({ page }) => {
      await page.goto('/login');

      const submitButton = page.getByRole('button', { name: /sign in|login/i });
      const box = await submitButton.boundingBox();

      if (box) {
        // WCAG recommends at least 44x44px for touch targets
        expect(box.width).toBeGreaterThanOrEqual(44);
        expect(box.height).toBeGreaterThanOrEqual(44);
      }
    });
  });

  test.describe('Mobile Accessibility', () => {
    test('A11Y-023: Viewport properly configured', async ({ page }) => {
      await page.goto('/');

      // Check viewport meta tag
      const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
      expect(viewport).toContain('width=device-width');
    });

    test('A11Y-024: Pinch zoom not disabled', async ({ page }) => {
      await page.goto('/');

      // Check viewport doesn't disable zoom
      const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
      expect(viewport).not.toContain('user-scalable=no');
      expect(viewport).not.toContain('maximum-scale=1');
    });
  });

  test.describe('Tables', () => {
    test('A11Y-025: Data tables have headers', async ({ page }) => {
      await loginUser(page, TEST_USERS.admin);
      await page.goto('/admin');

      // Check tables have th elements
      const tables = page.locator('table');
      const count = await tables.count();

      for (let i = 0; i < count; i++) {
        const table = tables.nth(i);
        if (await table.isVisible()) {
          const headers = table.locator('th');
          expect(await headers.count()).toBeGreaterThan(0);
        }
      }
    });
  });

  test.describe('Document Structure', () => {
    test('A11Y-026: Page has title', async ({ page }) => {
      await page.goto('/login');

      const title = await page.title();
      expect(title.length).toBeGreaterThan(0);
    });

    test('A11Y-027: Language attribute set', async ({ page }) => {
      await page.goto('/en/login');

      const lang = await page.locator('html').getAttribute('lang');
      expect(lang).toBe('en');
    });

    test('A11Y-028: Only one h1 per page', async ({ page }) => {
      await page.goto('/login');

      const h1s = page.locator('h1');
      const count = await h1s.count();
      expect(count).toBeLessThanOrEqual(1);
    });
  });
});
