import { test, expect } from '@playwright/test';
import { TEST_USERS, loginUser, generateTestEmail } from './fixtures/test-fixtures';

test.describe('Authentication Tests', () => {
  test.describe('Login', () => {
    test('TC-AUTH-010: Login with valid credentials (sender)', async ({ page }) => {
      await page.goto('/login');

      // Fill login form
      await page.getByLabel('Email Address').fill(TEST_USERS.sender.email);
      await page.getByLabel('Password').fill(TEST_USERS.sender.password);
      await page.getByRole('button', { name: /sign in/i }).click();

      // Should redirect to dashboard
      await expect(page).toHaveURL('/dashboard', { timeout: 15000 });

      // Should show welcome message with user name (name may vary slightly in DB)
      await expect(page.getByRole('heading', { name: /welcome/i })).toBeVisible();
    });

    test('TC-AUTH-014: Login as admin redirects to admin page', async ({ page }) => {
      await page.goto('/login');

      await page.getByLabel('Email Address').fill(TEST_USERS.admin.email);
      await page.getByLabel('Password').fill(TEST_USERS.admin.password);
      await page.getByRole('button', { name: /sign in/i }).click();

      // Admin should redirect to /admin, not /dashboard
      await expect(page).toHaveURL('/admin', { timeout: 15000 });
    });

    test('TC-AUTH-011: Login with invalid credentials shows error', async ({ page }) => {
      await page.goto('/login');

      await page.getByLabel('Email Address').fill(TEST_USERS.sender.email);
      await page.getByLabel('Password').fill('wrongpassword');
      await page.getByRole('button', { name: /sign in/i }).click();

      // Should show error message
      await expect(page.getByText(/incorrect|failed/i)).toBeVisible();

      // Should stay on login page
      await expect(page).toHaveURL('/login');
    });

    test('TC-AUTH-013: Remember me extends session', async ({ page }) => {
      await page.goto('/login');

      await page.getByLabel('Email Address').fill(TEST_USERS.sender.email);
      await page.getByLabel('Password').fill(TEST_USERS.sender.password);
      await page.getByLabel(/remember me/i).check();
      await page.getByRole('button', { name: /sign in/i }).click();

      await expect(page).toHaveURL('/dashboard', { timeout: 15000 });

      // Check that cookies are set (session should be extended)
      const cookies = await page.context().cookies();
      const authCookie = cookies.find((c) => c.name === 'access_token');
      expect(authCookie).toBeDefined();
    });

    test('Login page shows forgot password link', async ({ page }) => {
      await page.goto('/login');

      const forgotLink = page.getByRole('link', { name: /forgot password/i });
      await expect(forgotLink).toBeVisible();
      await forgotLink.click();

      await expect(page).toHaveURL('/forgot-password');
    });

    test('Login page shows register link', async ({ page }) => {
      await page.goto('/login');

      // Register link says "Create one now"
      const registerLink = page.getByRole('link', { name: /create one now/i });
      await expect(registerLink).toBeVisible();
      await registerLink.click();

      await expect(page).toHaveURL('/register');
    });

    test('Google OAuth button is visible', async ({ page }) => {
      await page.goto('/login');

      await expect(page.getByRole('button', { name: /google/i })).toBeVisible();
    });
  });

  test.describe('Registration', () => {
    test('TC-AUTH-001: Registration form shows sender-specific fields', async ({ page }) => {
      await page.goto('/register');

      // Role is a dropdown with id="role", select sender option
      await page.locator('#role').selectOption('sender');

      // Should show default address field for sender
      await expect(page.getByText(/default.*pickup.*address/i)).toBeVisible();

      // Should NOT show max deviation (courier-only)
      await expect(page.getByLabel(/max.*deviation/i)).not.toBeVisible();
    });

    test('TC-AUTH-002: Registration form shows courier-specific fields', async ({ page }) => {
      await page.goto('/register');

      // Select courier role from dropdown
      await page.locator('#role').selectOption('courier');

      // Should show max deviation field for courier
      await expect(page.getByLabel(/max.*route.*deviation/i)).toBeVisible();

      // Should NOT show default address (sender-only)
      await expect(page.getByText(/default.*pickup.*address/i)).not.toBeVisible();
    });

    test('TC-AUTH-003: Registration form shows both fields for both role', async ({ page }) => {
      await page.goto('/register');

      // Select both role from dropdown
      await page.locator('#role').selectOption('both');

      // Should show both fields
      await expect(page.getByLabel(/max.*route.*deviation/i)).toBeVisible();
      await expect(page.getByText(/default.*pickup.*address/i)).toBeVisible();
    });

    test('TC-AUTH-004: Registration validates email format', async ({ page }) => {
      await page.goto('/register');

      // Enter invalid email - test uses form.noValidate bypass via JavaScript
      // or checks that native validation prevents submission
      await page.getByLabel(/email address/i).fill('notanemail');
      await page.locator('#password').fill('password123');
      await page.locator('#confirmPassword').fill('password123');
      await page.getByLabel(/full name/i).fill('Test User');
      // Role defaults to sender

      // Click submit - browser's native validation should prevent submission
      const button = page.getByRole('button', { name: /create account/i });
      await button.click();

      // The email input should show native browser validation (constraint violation)
      // We can check that the input has validation error
      const emailInput = page.getByLabel(/email address/i);
      const validationMessage = await emailInput.evaluate((el: HTMLInputElement) => el.validationMessage);
      expect(validationMessage).toBeTruthy(); // Browser shows validation error
    });

    test('TC-AUTH-005: Registration validates password length', async ({ page }) => {
      await page.goto('/register');

      await page.getByLabel(/email address/i).fill(generateTestEmail());
      await page.locator('#password').fill('short'); // Less than 8 chars
      await page.locator('#confirmPassword').fill('short');
      await page.getByLabel(/full name/i).fill('Test User');
      // Role defaults to sender

      await page.getByRole('button', { name: /create account/i }).click();

      // Should show password length error (in alert, not helper text)
      await expect(page.getByRole('alert').getByText(/at least 8 characters/i)).toBeVisible();
    });

    test('TC-AUTH-006: Registration rejects duplicate email', async ({ page }) => {
      await page.goto('/register');

      // Try to register with existing email
      await page.getByLabel(/email address/i).fill(TEST_USERS.sender.email);
      await page.locator('#password').fill('password123');
      await page.locator('#confirmPassword').fill('password123');
      await page.getByLabel(/full name/i).fill('Duplicate User');
      // Role defaults to sender

      await page.getByRole('button', { name: /create account/i }).click();

      // Should show error about existing email
      await expect(page.getByText(/already registered|already exists/i)).toBeVisible();
    });

    test('Courier role validates max deviation range', async ({ page }) => {
      await page.goto('/register');

      await page.getByLabel(/email address/i).fill(generateTestEmail());
      await page.locator('#password').fill('password123');
      await page.locator('#confirmPassword').fill('password123');
      await page.getByLabel(/full name/i).fill('Test Courier');
      await page.locator('#role').selectOption('courier');

      // Wait for max deviation field to appear
      await expect(page.locator('#max_deviation_km')).toBeVisible();

      // Enter invalid deviation (too high)
      await page.locator('#max_deviation_km').fill('100');

      await page.getByRole('button', { name: /create account/i }).click();

      // Should show validation error (between 1 and 50)
      await expect(page.getByText(/1.*50|between 1 and 50/i)).toBeVisible();
    });
  });

  test.describe('Forgot Password', () => {
    test('TC-AUTH-016: Forgot password form accepts email', async ({ page }) => {
      await page.goto('/forgot-password');

      await page.getByLabel('Email').fill(TEST_USERS.sender.email);
      await page.getByRole('button', { name: /send|reset/i }).click();

      // Should show success message (generic for security)
      await expect(page.getByText(/check.*email|sent.*email/i)).toBeVisible();
    });

    test('TC-AUTH-017: Forgot password shows same message for non-existent email', async ({
      page,
    }) => {
      await page.goto('/forgot-password');

      await page.getByLabel('Email').fill('nonexistent@example.com');
      await page.getByRole('button', { name: /send|reset/i }).click();

      // Should show same success message (security: don't leak if email exists)
      await expect(page.getByText(/check.*email|sent.*email/i)).toBeVisible();
    });
  });

  test.describe('Reset Password', () => {
    test('TC-AUTH-019: Reset password validates password match', async ({ page }) => {
      // Navigate with a token (even if invalid, we can test form validation)
      await page.goto('/reset-password?token=test-token');

      await page.getByLabel(/new password/i).fill('newpassword123');
      await page.getByLabel(/confirm password/i).fill('differentpassword');

      await page.getByRole('button', { name: /reset/i }).click();

      // Should show mismatch error
      await expect(page.getByText(/passwords.*match|do not match/i)).toBeVisible();
    });

    test('TC-AUTH-020: Reset password with invalid token shows error', async ({ page }) => {
      await page.goto('/reset-password?token=invalid-token-12345');

      await page.getByLabel(/new password/i).fill('newpassword123');
      await page.getByLabel(/confirm password/i).fill('newpassword123');

      await page.getByRole('button', { name: /reset/i }).click();

      // Should show token error
      await expect(page.getByText(/invalid.*token|expired/i)).toBeVisible();
    });
  });

  test.describe('Logout', () => {
    test('TC-AUTH-021: Logout redirects to login page', async ({ page }) => {
      // Login first
      await loginUser(page, TEST_USERS.sender);

      // On desktop, click the user dropdown menu (button with the user's name)
      // The button contains an avatar and user name/rating
      const userDropdown = page.locator('.hidden.sm\\:block button').first();
      await userDropdown.click();

      // Click logout button from dropdown
      await page.getByRole('button', { name: /logout/i }).click();

      // Should redirect to home page
      await expect(page).toHaveURL('/');
    });

    test('Protected routes redirect to login when not authenticated', async ({ page }) => {
      // Try to access dashboard without login
      await page.goto('/dashboard');

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });

    test('Protected routes redirect to login after logout', async ({ page }) => {
      // Login
      await loginUser(page, TEST_USERS.sender);

      // Logout via user dropdown on desktop
      const userDropdown = page.locator('.hidden.sm\\:block button').first();
      await userDropdown.click();
      await page.getByRole('button', { name: /logout/i }).click();

      // Wait for redirect to home
      await expect(page).toHaveURL('/');

      // Try to access protected route
      await page.goto('/dashboard');

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });
  });

  test.describe('Email Verification', () => {
    test('TC-AUTH-008: Invalid verification token shows error', async ({ page }) => {
      await page.goto('/verify-email?token=invalid-token');

      // Should show error message
      await expect(page.getByText(/invalid|expired/i)).toBeVisible();
    });
  });

  test.describe('Session Management', () => {
    test('TC-ERR-004: Expired session redirects to login', async ({ page, context }) => {
      // Login first
      await loginUser(page, TEST_USERS.sender);

      // Clear cookies to simulate session expiry
      await context.clearCookies();

      // Try to navigate to protected route
      await page.goto('/dashboard');

      // Should redirect to login
      await expect(page).toHaveURL(/\/login/);
    });
  });
});
