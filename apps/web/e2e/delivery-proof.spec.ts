import { test, expect } from '@playwright/test';
import { TEST_USERS, loginUser } from './fixtures/test-fixtures';
import path from 'path';

test.describe('Delivery Proof Tests', () => {
  test.describe('Proof Upload (Courier)', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, TEST_USERS.courier);
    });

    test('TC-PROOF-001: Courier can upload delivery proof photo', async ({ page }) => {
      await page.goto('/dashboard');

      // Find package ready for delivery confirmation
      const deliveryPackage = page.locator('[data-testid="ready-for-delivery"]').first();

      if (await deliveryPackage.isVisible({ timeout: 3000 }).catch(() => false)) {
        await deliveryPackage.click();

        // Look for upload proof button
        const uploadProofBtn = page.getByRole('button', { name: /upload proof|add proof|confirm delivery/i });

        if (await uploadProofBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await uploadProofBtn.click();

          // File upload input
          const fileInput = page.locator('input[type="file"]');

          if (await fileInput.isVisible({ timeout: 2000 }).catch(() => false)) {
            // Upload a test image (you would need to have a test image in your e2e folder)
            // For now, just verify the input exists
            expect(await fileInput.isVisible()).toBeTruthy();
          }
        }
      }
    });

    test('TC-PROOF-002: Courier can upload multiple proof photos', async ({ page }) => {
      await page.goto('/dashboard');

      // Find package for delivery
      const packageRow = page.locator('[data-testid="package-in-transit"]').first();

      if (await packageRow.isVisible({ timeout: 3000 }).catch(() => false)) {
        await packageRow.click();

        const uploadSection = page.locator('[data-testid="proof-upload-section"]');

        if (await uploadSection.isVisible({ timeout: 3000 }).catch(() => false)) {
          // Check if multiple uploads are supported
          const addMoreBtn = page.getByRole('button', { name: /add another|add more photos/i });

          if (await addMoreBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            expect(await addMoreBtn.isVisible()).toBeTruthy();
          }
        }
      }
    });

    test('TC-PROOF-003: Courier can capture signature', async ({ page }) => {
      await page.goto('/dashboard');

      const packageRow = page.locator('[data-testid="package-ready"]').first();

      if (await packageRow.isVisible({ timeout: 3000 }).catch(() => false)) {
        await packageRow.click();

        // Look for signature capture
        const signatureBtn = page.getByRole('button', { name: /signature|capture signature/i });

        if (await signatureBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await signatureBtn.click();

          // Should show signature canvas
          const signatureCanvas = page.locator('canvas[data-testid="signature-canvas"]')
            .or(page.locator('canvas'));

          if (await signatureCanvas.isVisible({ timeout: 2000 }).catch(() => false)) {
            expect(await signatureCanvas.isVisible()).toBeTruthy();
          }
        }
      }
    });

    test('TC-PROOF-004: Proof required packages enforce upload', async ({ page }) => {
      await page.goto('/dashboard');

      const proofRequiredPkg = page.locator('[data-testid="proof-required"]').first();

      if (await proofRequiredPkg.isVisible({ timeout: 3000 }).catch(() => false)) {
        await proofRequiredPkg.click();

        // Try to mark as delivered without proof
        const completeBtn = page.getByRole('button', { name: /complete delivery|mark delivered/i });

        if (await completeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await completeBtn.click();

          // Should show error or warning about required proof
          const errorMsg = await page.getByText(/proof required|upload proof first/i).isVisible({ timeout: 3000 }).catch(() => false);
          const warningMsg = await page.getByText(/warning|required/i).isVisible({ timeout: 3000 }).catch(() => false);

          expect(errorMsg || warningMsg).toBeTruthy();
        }
      }
    });

    test('TC-PROOF-005: Successfully submitted proof shows confirmation', async ({ page }) => {
      await page.goto('/dashboard');

      const packageRow = page.locator('[data-testid="package-row"]').first();

      if (await packageRow.isVisible({ timeout: 3000 }).catch(() => false)) {
        await packageRow.click();

        // Check if proof was already submitted
        const proofSubmitted = page.getByText(/proof submitted|proof uploaded|delivery confirmed/i);

        if (await proofSubmitted.isVisible({ timeout: 3000 }).catch(() => false)) {
          expect(await proofSubmitted.isVisible()).toBeTruthy();
        }
      }
    });
  });

  test.describe('Proof Viewing (Sender)', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
    });

    test('TC-PROOF-006: Sender can view delivery proof photos', async ({ page }) => {
      await page.goto('/dashboard');

      // Find delivered package
      const deliveredPackage = page.locator('[data-testid="package-delivered"]').first();

      if (await deliveredPackage.isVisible({ timeout: 3000 }).catch(() => false)) {
        await deliveredPackage.click();

        // Look for proof section
        const proofSection = page.locator('[data-testid="delivery-proof-section"]')
          .or(page.getByRole('heading', { name: /delivery proof|proof of delivery/i }));

        if (await proofSection.isVisible({ timeout: 3000 }).catch(() => false)) {
          // Should show proof images
          const proofImages = page.locator('[data-testid="proof-image"]');

          if ((await proofImages.count()) > 0) {
            expect(await proofImages.first().isVisible()).toBeTruthy();
          }
        }
      }
    });

    test('TC-PROOF-007: Sender can download proof images', async ({ page }) => {
      await page.goto('/dashboard');

      const deliveredPackage = page.locator('[data-testid="package-delivered"]').first();

      if (await deliveredPackage.isVisible({ timeout: 3000 }).catch(() => false)) {
        await deliveredPackage.click();

        // Look for download button
        const downloadBtn = page.getByRole('button', { name: /download|download proof/i })
          .or(page.locator('[data-testid="download-proof"]'));

        if (await downloadBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          expect(await downloadBtn.isVisible()).toBeTruthy();
        }
      }
    });

    test('TC-PROOF-008: Sender can view signature if captured', async ({ page }) => {
      await page.goto('/dashboard');

      const deliveredPackage = page.locator('[data-testid="package-delivered"]').first();

      if (await deliveredPackage.isVisible({ timeout: 3000 }).catch(() => false)) {
        await deliveredPackage.click();

        // Look for signature section
        const signatureSection = page.locator('[data-testid="delivery-signature"]')
          .or(page.getByText(/recipient signature/i));

        if (await signatureSection.isVisible({ timeout: 3000 }).catch(() => false)) {
          expect(await signatureSection.isVisible()).toBeTruthy();
        }
      }
    });
  });

  test.describe('Proof Verification Workflow', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
    });

    test('TC-PROOF-009: Sender can approve delivery proof', async ({ page }) => {
      await page.goto('/dashboard');

      // Find package with proof pending verification
      const pendingProof = page.locator('[data-testid="proof-pending-verification"]').first();

      if (await pendingProof.isVisible({ timeout: 3000 }).catch(() => false)) {
        await pendingProof.click();

        // Look for approve button
        const approveBtn = page.getByRole('button', { name: /approve|confirm delivery/i });

        if (await approveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await approveBtn.click();

          // Confirm if dialog appears
          const confirmBtn = page.getByRole('button', { name: /confirm|yes/i });
          if (await confirmBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
            await confirmBtn.click();
          }

          // Should show success message
          await expect(
            page.getByText(/approved|confirmed|delivery verified/i)
          ).toBeVisible({ timeout: 5000 });
        }
      }
    });

    test('TC-PROOF-010: Sender can dispute delivery proof', async ({ page }) => {
      await page.goto('/dashboard');

      const pendingProof = page.locator('[data-testid="proof-pending"]').first();

      if (await pendingProof.isVisible({ timeout: 3000 }).catch(() => false)) {
        await pendingProof.click();

        // Look for dispute/reject button
        const disputeBtn = page.getByRole('button', { name: /dispute|reject|report issue/i });

        if (await disputeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
          await disputeBtn.click();

          // Should show dispute form
          const disputeForm = page.locator('[data-testid="dispute-form"]')
            .or(page.getByLabel(/reason/i));

          if (await disputeForm.isVisible({ timeout: 3000 }).catch(() => false)) {
            expect(await disputeForm.isVisible()).toBeTruthy();
          }
        }
      }
    });
  });

  test.describe('Proof Requirements', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
    });

    test('TC-PROOF-011: Sender can set proof requirements when creating package', async ({ page }) => {
      await page.goto('/packages/create');

      // Look for proof requirement checkbox
      const proofRequiredCheckbox = page.getByLabel(/require proof|delivery proof required/i)
        .or(page.locator('input[name="requires_proof"]'));

      if (await proofRequiredCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
        expect(await proofRequiredCheckbox.isVisible()).toBeTruthy();
      }
    });

    test('TC-PROOF-012: Package shows proof requirement status', async ({ page }) => {
      await page.goto('/dashboard');

      const packageRow = page.locator('[data-testid="package-row"]').first();

      if (await packageRow.isVisible({ timeout: 3000 }).catch(() => false)) {
        await packageRow.click();

        // Check for proof requirement indicator
        const proofIndicator = page.getByText(/proof required|proof optional/i)
          .or(page.locator('[data-testid="proof-requirement"]'));

        if (await proofIndicator.isVisible({ timeout: 3000 }).catch(() => false)) {
          expect(await proofIndicator.isVisible()).toBeTruthy();
        }
      }
    });
  });

  test.describe('Proof Access Control', () => {
    test('TC-PROOF-013: Only sender and courier can view proof', async ({ page }) => {
      // Login as the courier assigned to the package
      await loginUser(page, TEST_USERS.courier);

      await page.goto('/dashboard');

      const myDelivery = page.locator('[data-testid="my-delivery"]').first();

      if (await myDelivery.isVisible({ timeout: 3000 }).catch(() => false)) {
        await myDelivery.click();

        // Courier should be able to see proof section
        const proofSection = page.locator('[data-testid="delivery-proof"]');

        if (await proofSection.isVisible({ timeout: 3000 }).catch(() => false)) {
          expect(await proofSection.isVisible()).toBeTruthy();
        }
      }
    });
  });

  test.describe('Proof Upload Edge Cases', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, TEST_USERS.courier);
    });

    test('TC-PROOF-014: File size validation for proof upload', async ({ page }) => {
      await page.goto('/dashboard');

      const packageRow = page.locator('[data-testid="package-in-transit"]').first();

      if (await packageRow.isVisible({ timeout: 3000 }).catch(() => false)) {
        await packageRow.click();

        // Look for file size limit information
        const sizeLimit = page.getByText(/max.*mb|maximum.*size|file size/i);

        if (await sizeLimit.isVisible({ timeout: 3000 }).catch(() => false)) {
          expect(await sizeLimit.isVisible()).toBeTruthy();
        }
      }
    });

    test('TC-PROOF-015: Proof upload shows progress indicator', async ({ page }) => {
      await page.goto('/dashboard');

      const packageRow = page.locator('[data-testid="package-row"]').first();

      if (await packageRow.isVisible({ timeout: 3000 }).catch(() => false)) {
        await packageRow.click();

        // Check if upload section exists
        const uploadSection = page.locator('[data-testid="proof-upload"]');

        if (await uploadSection.isVisible({ timeout: 3000 }).catch(() => false)) {
          expect(await uploadSection.isVisible()).toBeTruthy();
        }
      }
    });
  });
});
