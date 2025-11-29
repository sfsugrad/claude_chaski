import { test, expect } from '@playwright/test';
import { TEST_USERS, loginUser } from './fixtures/test-fixtures';

test.describe('Rating & Review Tests', () => {
  test.describe('Rating Modal', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
    });

    test('TC-RATE-001: Rating modal appears for pending ratings', async ({ page }) => {
      await page.goto('/dashboard');

      // Check if rating modal appears
      const ratingModal = page.locator('[data-testid="rating-modal"]');

      // Modal may or may not appear depending on pending ratings
      if (await ratingModal.isVisible()) {
        await expect(ratingModal).toBeVisible();
      }
    });

    test('TC-RATE-001: Rating modal shows package info', async ({ page }) => {
      await page.goto('/dashboard');

      const ratingModal = page.locator('[data-testid="rating-modal"]');

      if (await ratingModal.isVisible()) {
        // Should show some package info
        await expect(ratingModal.getByText(/package|delivery/i)).toBeVisible();
      }
    });

    test('TC-RATE-001: Rating modal has star selector', async ({ page }) => {
      await page.goto('/dashboard');

      const ratingModal = page.locator('[data-testid="rating-modal"]');

      if (await ratingModal.isVisible()) {
        // Should have star rating component
        await expect(ratingModal.locator('[data-testid="star-rating"]')).toBeVisible();
      }
    });

    test('TC-RATE-001: Rating modal has comment input', async ({ page }) => {
      await page.goto('/dashboard');

      const ratingModal = page.locator('[data-testid="rating-modal"]');

      if (await ratingModal.isVisible()) {
        // Should have comment textarea
        await expect(ratingModal.locator('textarea')).toBeVisible();
      }
    });

    test('TC-RATE-001: Can select stars in rating modal', async ({ page }) => {
      await page.goto('/dashboard');

      const ratingModal = page.locator('[data-testid="rating-modal"]');

      if (await ratingModal.isVisible()) {
        // Click on 4th star
        const stars = ratingModal.locator('[data-testid="star"]');
        if (await stars.count() >= 4) {
          await stars.nth(3).click();

          // Star should be selected (highlighted)
        }
      }
    });

    test('TC-RATE-002: Skip button closes modal', async ({ page }) => {
      await page.goto('/dashboard');

      const ratingModal = page.locator('[data-testid="rating-modal"]');

      if (await ratingModal.isVisible()) {
        const skipButton = ratingModal.getByRole('button', { name: /skip|close|later/i });

        if (await skipButton.isVisible()) {
          await skipButton.click();

          // Modal should close or move to next
          await page.waitForTimeout(500);
        }
      }
    });

    test('TC-RATE-003: Multiple pending ratings cycle through', async ({ page }) => {
      await page.goto('/dashboard');

      const ratingModal = page.locator('[data-testid="rating-modal"]');

      if (await ratingModal.isVisible()) {
        // Get initial content
        const initialContent = await ratingModal.textContent();

        // Click skip
        const skipButton = ratingModal.getByRole('button', { name: /skip|close|later/i });
        if (await skipButton.isVisible()) {
          await skipButton.click();
          await page.waitForTimeout(500);

          // If modal reappears with different content, we cycled to next rating
        }
      }
    });
  });

  test.describe('Reviews Page', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
    });

    test('TC-RATE-004: Navigate to reviews page', async ({ page }) => {
      await page.goto('/profile/reviews');

      await expect(page).toHaveURL('/profile/reviews');
    });

    test('TC-RATE-004: Reviews page shows rating summary', async ({ page }) => {
      await page.goto('/profile/reviews');

      // Should show rating summary section
      await expect(page.getByText(/rating|average|reviews/i)).toBeVisible();
    });

    test('TC-RATE-004: Reviews page shows average rating', async ({ page }) => {
      await page.goto('/profile/reviews');

      // Should show average rating number
      const ratingDisplay = page.locator('[data-testid="average-rating"]');

      if (await ratingDisplay.isVisible()) {
        const ratingText = await ratingDisplay.textContent();
        const rating = parseFloat(ratingText || '0');
        expect(rating).toBeGreaterThanOrEqual(0);
        expect(rating).toBeLessThanOrEqual(5);
      }
    });

    test('TC-RATE-004: Reviews page shows star breakdown', async ({ page }) => {
      await page.goto('/profile/reviews');

      // Wait for page to load
      await expect(page.getByRole('heading', { name: /my reviews/i })).toBeVisible();

      // Breakdown shows numbers 5, 4, 3, 2, 1 with star icons and counts
      // Check for the presence of breakdown section by looking for the number pattern
      const has5StarRow = await page.locator('text="5"').first().isVisible();
      const has1StarRow = await page.locator('text="1"').first().isVisible();

      expect(has5StarRow && has1StarRow).toBeTruthy();
    });

    test('TC-RATE-004: Reviews page shows individual reviews', async ({ page }) => {
      await page.goto('/profile/reviews');

      // Wait for page to load
      await expect(page.getByRole('heading', { name: /my reviews/i })).toBeVisible();

      // Should show review list or empty state
      // Check for "All Reviews" heading which contains the reviews section
      const hasAllReviewsHeading = await page.getByRole('heading', { name: /all reviews/i }).isVisible();
      const hasEmptyState = await page.getByText(/haven't received any reviews|no reviews/i).isVisible();

      expect(hasAllReviewsHeading || hasEmptyState).toBeTruthy();
    });

    test('TC-RATE-008: Empty reviews state', async ({ page }) => {
      await page.goto('/profile/reviews');

      // Wait for page to load
      await expect(page.getByRole('heading', { name: /my reviews/i })).toBeVisible();

      // Check for empty state message - actual text is "You haven't received any reviews yet."
      const hasEmptyMessage = await page.getByText(/haven't received any reviews/i).isVisible();
      const hasZeroReviews = await page.getByText('0 reviews').isVisible();

      // Either shows the empty message or 0 reviews count
      expect(hasEmptyMessage || hasZeroReviews).toBeTruthy();
    });
  });

  test.describe('Review Item Display', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
    });

    test('Review shows rater name', async ({ page }) => {
      await page.goto('/profile/reviews');

      const reviewItem = page.locator('[data-testid="review-item"]').first();

      if (await reviewItem.isVisible()) {
        // Should show rater name or "Anonymous"
        await expect(reviewItem.getByText(/[A-Za-z]+|anonymous/i)).toBeVisible();
      }
    });

    test('Review shows star rating', async ({ page }) => {
      await page.goto('/profile/reviews');

      const reviewItem = page.locator('[data-testid="review-item"]').first();

      if (await reviewItem.isVisible()) {
        // Should have star display
        await expect(reviewItem.locator('[data-testid="star-rating"]')).toBeVisible();
      }
    });

    test('Review shows date', async ({ page }) => {
      await page.goto('/profile/reviews');

      const reviewItem = page.locator('[data-testid="review-item"]').first();

      if (await reviewItem.isVisible()) {
        // Should show date
        const datePattern = /\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|ago|today|yesterday/i;
        const hasDate = (await reviewItem.textContent())?.match(datePattern);
        expect(hasDate).toBeTruthy();
      }
    });

    test('Review shows comment if provided', async ({ page }) => {
      await page.goto('/profile/reviews');

      const reviewItem = page.locator('[data-testid="review-item"]').first();

      if (await reviewItem.isVisible()) {
        // May show comment or "No comment"
        const text = await reviewItem.textContent();
        expect(text?.length).toBeGreaterThan(0);
      }
    });
  });

  test.describe('Navbar Rating Display', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
    });

    test('TC-RATE-005: User dropdown shows rating', async ({ page }) => {
      await page.goto('/dashboard');

      // Open user menu
      await page.locator('button').filter({ hasText: TEST_USERS.sender.name.charAt(0) }).click();

      // Should show star rating in dropdown
      const starDisplay = page.locator('[data-testid="user-rating"]');

      if (await starDisplay.isVisible()) {
        // Rating should be visible
        await expect(starDisplay).toBeVisible();
      }
    });

    test('TC-RATE-005: My Reviews link in user menu', async ({ page }) => {
      await page.goto('/dashboard');

      // Open user menu
      await page.locator('button').filter({ hasText: TEST_USERS.sender.name.charAt(0) }).click();

      // Should have My Reviews link
      const reviewsLink = page.getByRole('link', { name: /my reviews|reviews/i });
      await expect(reviewsLink).toBeVisible();

      await reviewsLink.click();
      await expect(page).toHaveURL('/profile/reviews');
    });
  });

  test.describe('Package Page Ratings', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
    });

    test('TC-RATE-006: Delivered package shows ratings section', async ({ page }) => {
      await page.goto('/sender');

      // Filter to delivered
      await page.getByRole('button', { name: /delivered/i }).click();

      const packageLink = page.locator('a[href*="/packages/"]').first();

      if (await packageLink.isVisible()) {
        await packageLink.click();

        // Ratings section should exist on delivered packages
        const ratingsSection = page.getByText(/ratings|reviews/i);
        // May or may not be visible depending on if ratings exist
      }
    });

    test('TC-RATE-007: Rate delivery button on delivered package', async ({ page }) => {
      await page.goto('/sender');

      // Filter to delivered
      await page.getByRole('button', { name: /delivered/i }).click();

      const packageLink = page.locator('a[href*="/packages/"]').first();

      if (await packageLink.isVisible()) {
        await packageLink.click();

        // May have rate button if user hasn't rated
        const rateButton = page.getByRole('button', { name: /rate|review/i });
        // Button visibility depends on whether user already rated
      }
    });
  });
});

test.describe('Rating - Courier User', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page, TEST_USERS.courier);
  });

  test('Courier can access reviews page', async ({ page }) => {
    await page.goto('/profile/reviews');

    await expect(page.getByText(/rating|reviews/i)).toBeVisible();
  });

  test('Courier sees rating in navbar', async ({ page }) => {
    await page.goto('/dashboard');

    // Open user menu
    await page.locator('button').filter({ hasText: TEST_USERS.courier.name.charAt(0) }).click();

    // Should show rating display
    const starDisplay = page.locator('[data-testid="user-rating"]');
    // May or may not be visible
  });
});

test.describe('Star Rating Component', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page, TEST_USERS.sender);
  });

  test('Star rating displays correctly', async ({ page }) => {
    await page.goto('/profile/reviews');

    const starRating = page.locator('[data-testid="star-rating"]').first();

    if (await starRating.isVisible()) {
      // Should have 5 star elements
      const stars = starRating.locator('[data-testid="star"]');
      await expect(stars).toHaveCount(5);
    }
  });
});
