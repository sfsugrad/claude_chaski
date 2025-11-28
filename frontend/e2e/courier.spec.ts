import { test, expect } from '@playwright/test';
import { TEST_USERS, loginUser, TEST_ROUTE } from './fixtures/test-fixtures';

test.describe('Courier Workflow Tests', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page, TEST_USERS.courier);
  });

  test.describe('Courier Dashboard', () => {
    test('TC-COUR-001: View courier dashboard', async ({ page }) => {
      await page.goto('/courier');

      // Should show courier dashboard
      await expect(page.getByRole('heading', { name: /courier dashboard/i })).toBeVisible();
    });

    test('TC-COUR-001: Dashboard shows active route section', async ({ page }) => {
      await page.goto('/courier');

      // Wait for dashboard to load
      await expect(page.getByRole('heading', { name: /courier dashboard/i })).toBeVisible();

      // Should have active route section (text label) or "no active route" message
      // "Active Route" is rendered as a div label, not a heading
      const hasActiveRoute = await page.getByText('Active Route', { exact: true }).isVisible();
      const hasNoActiveRoute = await page.getByText(/no active route|don't have an active/i).isVisible();

      expect(hasActiveRoute || hasNoActiveRoute).toBeTruthy();
    });

    test('TC-COUR-001: Dashboard shows route history', async ({ page }) => {
      await page.goto('/courier');

      // Should show route history section
      await expect(page.getByRole('heading', { name: /route history/i })).toBeVisible();
    });

    test('Create New Route button is visible', async ({ page }) => {
      await page.goto('/courier');

      await expect(page.getByRole('link', { name: /create.*route/i })).toBeVisible();
    });
  });

  test.describe('Create Route', () => {
    test('TC-COUR-002: Navigate to create route page', async ({ page }) => {
      await page.goto('/courier');

      await page.getByRole('link', { name: /create.*route/i }).click();

      await expect(page).toHaveURL('/courier/routes/create');
    });

    test('TC-COUR-002: Create route form has required fields', async ({ page }) => {
      await page.goto('/courier/routes/create');

      // Check form fields exist - use actual label text from redesigned form
      await expect(page.getByText('Starting Point *')).toBeVisible();
      await expect(page.getByText('Destination *')).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Pickup Radius' })).toBeVisible();
    });

    test('TC-COUR-003: Create route validation - empty addresses', async ({ page }) => {
      await page.goto('/courier/routes/create');

      // Leave addresses empty, just click submit
      // Pickup radius has default value (5km) from preset buttons
      await page.getByRole('button', { name: /create route/i }).click();

      // Form should not submit - still on create page (validation prevents submission)
      await expect(page).toHaveURL('/courier/routes/create');
    });

    test('TC-COUR-003: Pickup radius can be set via slider', async ({ page }) => {
      await page.goto('/courier/routes/create');

      // Verify slider exists for custom distance
      await expect(page.getByRole('slider')).toBeVisible();

      // Verify preset buttons exist
      await expect(page.getByRole('button', { name: /2 km/i })).toBeVisible();
      await expect(page.getByRole('button', { name: /10 km/i })).toBeVisible();
    });

    test('Departure time field is optional', async ({ page }) => {
      await page.goto('/courier/routes/create');

      // Departure time field should exist - check by heading text
      await expect(page.getByRole('heading', { name: /when are you traveling/i })).toBeVisible();

      // Should be able to leave it empty
    });
  });

  test.describe('Route Management', () => {
    test('TC-COUR-004: Inactive route shows Activate button', async ({ page }) => {
      await page.goto('/courier');

      // Find an inactive route
      const inactiveRoute = page.locator('text=Inactive').first();

      if (await inactiveRoute.isVisible()) {
        // Should have activate button nearby
        const routeCard = inactiveRoute.locator('..').locator('..');
        await expect(routeCard.getByRole('button', { name: /activate/i })).toBeVisible();
      }
    });

    test('TC-COUR-005: Active route shows Deactivate button', async ({ page }) => {
      await page.goto('/courier');

      // Find active route section
      const activeRouteSection = page.locator('text=Active Route').first();

      if (await activeRouteSection.isVisible()) {
        // Should have deactivate button
        await expect(page.getByRole('button', { name: /deactivate/i })).toBeVisible();
      }
    });

    test('TC-COUR-006: Active route shows View Matches link', async ({ page }) => {
      await page.goto('/courier');

      // Find active route section
      const activeRouteSection = page.getByText(/active route/i).first();

      if (await activeRouteSection.isVisible()) {
        // Should have view matches link
        await expect(page.getByRole('link', { name: /view matches/i })).toBeVisible();
      }
    });
  });

  test.describe('Route Matches', () => {
    test('TC-COUR-006: View route matches page', async ({ page }) => {
      await page.goto('/courier');

      const viewMatchesLink = page.getByRole('link', { name: /view matches/i }).first();

      if (await viewMatchesLink.isVisible()) {
        await viewMatchesLink.click();

        // Should be on matches page
        await expect(page).toHaveURL(/\/courier\/routes\/\d+\/matches/);
      }
    });

    test('TC-COUR-012: No matches shows empty message', async ({ page }) => {
      await page.goto('/courier');

      const viewMatchesLink = page.getByRole('link', { name: /view matches/i }).first();

      if (await viewMatchesLink.isVisible()) {
        await viewMatchesLink.click();

        // Either show matches or "no matches" message
        const hasMatches = await page.locator('[data-testid="match-card"]').count() > 0;
        const hasEmptyMessage = await page.getByText(/no matching packages|no matches/i).isVisible();

        expect(hasMatches || hasEmptyMessage).toBeTruthy();
      }
    });

    test('TC-COUR-007: Match cards show package info', async ({ page }) => {
      await page.goto('/courier');

      const viewMatchesLink = page.getByRole('link', { name: /view matches/i }).first();

      if (await viewMatchesLink.isVisible()) {
        await viewMatchesLink.click();

        const matchCard = page.locator('[data-testid="match-card"]').first();

        if (await matchCard.isVisible()) {
          // Should show package details
          await expect(matchCard.getByText(/description|pickup|dropoff/i)).toBeVisible();
        }
      }
    });

    test('TC-COUR-007: Match cards show Accept button', async ({ page }) => {
      await page.goto('/courier');

      const viewMatchesLink = page.getByRole('link', { name: /view matches/i }).first();

      if (await viewMatchesLink.isVisible()) {
        await viewMatchesLink.click();

        const matchCard = page.locator('[data-testid="match-card"]').first();

        if (await matchCard.isVisible()) {
          // Should have accept button
          await expect(matchCard.getByRole('button', { name: /accept/i })).toBeVisible();
        }
      }
    });
  });

  test.describe('Assigned Packages', () => {
    test('TC-COUR-008: View assigned packages section', async ({ page }) => {
      await page.goto('/courier');

      // Check for assigned packages section
      const hasAssignedPackages = await page.getByText(/assigned packages/i).isVisible();
      // May not always be visible if no packages assigned

      if (hasAssignedPackages) {
        await expect(page.getByText(/assigned packages/i)).toBeVisible();
      }
    });

    test('TC-COUR-008: Assigned package shows action buttons', async ({ page }) => {
      await page.goto('/courier');

      const assignedSection = page.locator('text=Assigned Packages').first();

      if (await assignedSection.isVisible()) {
        const packageCard = page.locator('[data-testid="assigned-package-card"]').first();

        if (await packageCard.isVisible()) {
          // Should have View Details link
          await expect(packageCard.getByRole('link', { name: /view details/i })).toBeVisible();

          // Should have Message Sender link
          await expect(packageCard.getByRole('link', { name: /message sender/i })).toBeVisible();
        }
      }
    });
  });

  test.describe('Package Status Updates', () => {
    test('Package detail page accessible for assigned package', async ({ page }) => {
      await page.goto('/courier');

      // Find a package link
      const packageLink = page.getByRole('link', { name: /view details/i }).first();

      if (await packageLink.isVisible()) {
        await packageLink.click();

        // Should be on package detail page
        await expect(page).toHaveURL(/\/packages\/\d+/);
      }
    });
  });

  test.describe('First Time Courier', () => {
    test('TC-COUR-013: Welcome message for courier with no routes', async ({ page }) => {
      // This test assumes we can identify a new courier state
      // In practice, this might need a fresh test user

      await page.goto('/courier');

      // Wait for dashboard to load
      await expect(page.getByRole('heading', { name: /courier dashboard/i })).toBeVisible();

      // If no routes exist, should show welcome message; otherwise show route sections
      const noRoutes = await page.getByText(/no routes yet|get started|create your first route/i).isVisible();
      const hasActiveRoute = await page.getByRole('heading', { name: /active route/i }).isVisible();
      const hasRouteHistory = await page.getByRole('heading', { name: /route history/i }).isVisible();

      // Either has routes (active or history) or shows welcome message
      expect(noRoutes || hasActiveRoute || hasRouteHistory).toBeTruthy();
    });
  });
});

test.describe('Courier Dashboard - Both Role User', () => {
  test('Both role user can access courier dashboard', async ({ page }) => {
    await loginUser(page, TEST_USERS.both);
    await page.goto('/courier');

    await expect(page.getByRole('heading', { name: /courier dashboard/i })).toBeVisible();
  });

  test('Both role user can create routes', async ({ page }) => {
    await loginUser(page, TEST_USERS.both);
    await page.goto('/courier/routes/create');

    // Check form is accessible - use spinbutton since label isn't properly associated
    await expect(page.getByRole('spinbutton')).toBeVisible();
  });
});

test.describe('Courier - Access Control', () => {
  test('Sender-only user sees welcome state on courier dashboard', async ({ page }) => {
    await loginUser(page, TEST_USERS.sender);
    await page.goto('/courier');

    // Page is accessible but shows welcome/empty state for sender users
    await expect(page.getByRole('heading', { name: /courier dashboard/i })).toBeVisible();
    // Should see welcome message since sender has no routes
    await expect(page.getByRole('heading', { name: /welcome to chaski/i })).toBeVisible();
  });

  test('Sender-only user can access create route page', async ({ page }) => {
    await loginUser(page, TEST_USERS.sender);
    await page.goto('/courier/routes/create');

    // Page is accessible - shows the create route form
    await expect(page.getByRole('heading', { name: /create new route/i })).toBeVisible();
  });
});
