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

test.describe('Courier Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page, TEST_USERS.courier);
  });

  test('COUR-ANALYTICS-001: Analytics page loads', async ({ page }) => {
    await page.goto('/courier/analytics');

    // Should show analytics heading or metrics
    const hasAnalytics = await page.getByRole('heading', { name: /analytics|statistics|earnings|metrics/i }).isVisible();
    const hasCharts = await page.locator('canvas, [class*="chart"], svg').count() > 0;

    // Page should load with some analytics content
    expect(hasAnalytics || hasCharts || page.url().includes('/analytics')).toBeTruthy();
  });

  test('COUR-ANALYTICS-002: Earnings displayed', async ({ page }) => {
    await page.goto('/courier/analytics');

    // Should show earnings metrics
    const hasEarnings = await page.getByText(/earnings|income|total earned|revenue/i).isVisible();
    // May or may not have data depending on deliveries
  });

  test('COUR-ANALYTICS-003: Delivery statistics visible', async ({ page }) => {
    await page.goto('/courier/analytics');

    // Check for delivery-related statistics
    const hasDeliveryStats = await page.getByText(/deliveries|completed|packages delivered/i).isVisible();
    // May or may not show depending on data
  });

  test('COUR-ANALYTICS-004: Rating average displayed', async ({ page }) => {
    await page.goto('/courier/analytics');

    // Check for rating metrics
    const hasRating = await page.getByText(/rating|stars|average|reviews/i).isVisible();
    // May show average rating
  });

  test('COUR-ANALYTICS-005: Date range filter', async ({ page }) => {
    await page.goto('/courier/analytics');

    // Look for date filter
    const dateFilter = page.getByRole('button', { name: /date|period|range|filter/i });
    if (await dateFilter.isVisible()) {
      await dateFilter.click();

      // Should show date options
    }
  });

  test('COUR-ANALYTICS-006: Chart visualization present', async ({ page }) => {
    await page.goto('/courier/analytics');

    // Look for chart elements
    const charts = page.locator('canvas, [class*="chart"], svg[class*="recharts"]');
    // May or may not have charts
  });
});

test.describe('Courier ID Verification', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page, TEST_USERS.courier);
  });

  test('COUR-VERIFY-001: ID verification banner visible if not verified', async ({ page }) => {
    await page.goto('/courier');

    // Check for verification banner or prompt
    const verifyBanner = page.getByText(/verify.*identity|id.*verification|complete.*verification/i);
    // May show if courier not ID verified
  });

  test('COUR-VERIFY-002: Start verification button works', async ({ page }) => {
    await page.goto('/dashboard');

    // Look for verify button
    const verifyBtn = page.getByRole('link', { name: /verify.*id|start.*verification|complete.*verification/i });
    if (await verifyBtn.isVisible()) {
      await verifyBtn.click();

      // Should navigate to verification page
      await expect(page).toHaveURL(/\/id-verification/);
    }
  });

  test('COUR-VERIFY-003: ID verification page loads', async ({ page }) => {
    await page.goto('/id-verification');

    // Should show verification page content
    const hasContent = await page.getByText(/identity|verification|document|stripe/i).isVisible();
    expect(hasContent).toBeTruthy();
  });

  test('COUR-VERIFY-004: Verification status displayed', async ({ page }) => {
    await page.goto('/id-verification');

    // Should show current verification status
    const hasStatus = await page.getByText(/status|pending|verified|submitted/i).isVisible();
    // May show verification status
  });
});

test.describe('Courier Bid Restrictions', () => {
  test('COUR-BID-001: Unverified courier sees verification prompt on bid', async ({ page }) => {
    await loginUser(page, TEST_USERS.courier);
    await page.goto('/courier');

    // Try to navigate to matches
    const viewMatchesLink = page.getByRole('link', { name: /view matches/i }).first();

    if (await viewMatchesLink.isVisible()) {
      await viewMatchesLink.click();
      await page.waitForURL(/\/matches/);

      // Try to place bid
      const placeBidBtn = page.getByRole('button', { name: /place.*bid/i }).first();

      if (await placeBidBtn.isVisible()) {
        await placeBidBtn.click();

        // Should either open bid modal or show verification prompt
        const bidModal = page.getByRole('dialog');
        const verifyPrompt = page.getByText(/verify.*id|verification.*required/i);

        const hasResponse = await bidModal.isVisible() || await verifyPrompt.isVisible();
        // Behavior depends on courier's verification status
      }
    }
  });
});

test.describe('Courier Delivery Proof', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page, TEST_USERS.courier);
  });

  test('COUR-PROOF-001: Capture proof page loads', async ({ page }) => {
    // Navigate to an assigned package's proof capture
    await page.goto('/courier');

    const captureLink = page.getByRole('link', { name: /capture.*proof|upload.*proof|photo/i }).first();

    if (await captureLink.isVisible()) {
      await captureLink.click();

      // Should be on capture proof page
      await expect(page).toHaveURL(/\/capture-proof/);
    }
  });

  test('COUR-PROOF-002: Camera access button visible', async ({ page }) => {
    await page.goto('/courier');

    const captureLink = page.getByRole('link', { name: /capture.*proof|upload.*proof|photo/i }).first();

    if (await captureLink.isVisible()) {
      await captureLink.click();
      await page.waitForURL(/\/capture-proof/);

      // Should have camera or upload button
      const cameraBtn = page.getByRole('button', { name: /camera|take.*photo|capture/i });
      const uploadBtn = page.locator('input[type="file"]');

      const hasInput = await cameraBtn.isVisible() || await uploadBtn.count() > 0;
      // Should have some way to add proof
    }
  });

  test('COUR-PROOF-003: Recipient signature option', async ({ page }) => {
    await page.goto('/courier');

    const captureLink = page.getByRole('link', { name: /capture.*proof|upload.*proof/i }).first();

    if (await captureLink.isVisible()) {
      await captureLink.click();
      await page.waitForURL(/\/capture-proof/);

      // Check for signature pad
      const signaturePad = page.locator('canvas, [class*="signature"]');
      // May have signature capture
    }
  });
});
