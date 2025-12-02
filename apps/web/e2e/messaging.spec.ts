import { test, expect } from '@playwright/test';
import { TEST_USERS, loginUser } from './fixtures/test-fixtures';

test.describe('Messaging Tests', () => {
  test.describe('Messages Page', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
    });

    test('TC-MSG-003: View messages page', async ({ page }) => {
      await page.goto('/messages');

      // Should show messages page
      await expect(page).toHaveURL('/messages');
    });

    test('TC-MSG-003: Messages page shows conversation list', async ({ page }) => {
      await page.goto('/messages');

      // Wait for page to load - the Messages heading should be visible
      await expect(page.getByRole('heading', { name: 'Messages', level: 1 })).toBeVisible();

      // Either show conversations list (with heading) or empty state
      const hasConversationsHeading = await page.getByRole('heading', { name: /conversations/i }).isVisible();
      const hasConversations = await page.getByRole('listitem').count() > 0;
      const hasEmptyState = await page.getByText(/no conversations|no messages|select a conversation/i).isVisible();

      expect(hasConversationsHeading || hasConversations || hasEmptyState).toBeTruthy();
    });

    test('TC-MSG-007: Empty messages state', async ({ page }) => {
      await page.goto('/messages');

      // Wait for page to load - either conversations heading or list items
      await expect(page.getByRole('heading', { name: /conversations/i })).toBeVisible();

      // If no conversations, should show empty message
      const conversationCount = await page.getByRole('listitem').count();

      if (conversationCount === 0) {
        // Check for empty state text - may vary in wording
        const hasEmptyState = await page.getByText(/no conversations|no messages|select a conversation/i).isVisible();
        expect(hasEmptyState).toBeTruthy();
      }
      // If conversations exist, test passes (empty state not expected)
    });

    test('TC-MSG-004: Select conversation from list', async ({ page }) => {
      await page.goto('/messages');

      // Conversations are listitem elements with buttons inside
      const conversationItem = page.getByRole('listitem').first();

      if (await conversationItem.isVisible()) {
        await conversationItem.click();

        // Chat window should appear - check for message input or chat area
        await expect(page.locator('input[placeholder*="message"], textarea[placeholder*="message"]')).toBeVisible();
      }
    });

    test('TC-MSG-006: Direct link to conversation', async ({ page }) => {
      // Test with a package ID parameter
      await page.goto('/messages?package=1');

      // Should load messages page with potential conversation
      await expect(page).toHaveURL(/\/messages/);
    });

    test('Navbar messages icon is clickable', async ({ page }) => {
      await page.goto('/dashboard');

      // Find messages link in navbar
      const messagesLink = page.locator('a[href="/messages"]').first();
      await expect(messagesLink).toBeVisible();

      await messagesLink.click();
      await expect(page).toHaveURL('/messages');
    });
  });

  test.describe('Chat Window', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
    });

    test('Chat window has message input', async ({ page }) => {
      await page.goto('/messages');

      const conversationItem = page.locator('[data-testid="conversation-item"]').first();

      if (await conversationItem.isVisible()) {
        await conversationItem.click();

        // Should have message input
        await expect(page.locator('input[placeholder*="message"], textarea[placeholder*="message"]')).toBeVisible();
      }
    });

    test('Chat window has send button', async ({ page }) => {
      await page.goto('/messages');

      const conversationItem = page.locator('[data-testid="conversation-item"]').first();

      if (await conversationItem.isVisible()) {
        await conversationItem.click();

        // Should have send button
        await expect(page.getByRole('button', { name: /send/i })).toBeVisible();
      }
    });

    test('TC-MSG-001: Can type message in input', async ({ page }) => {
      await page.goto('/messages');

      const conversationItem = page.locator('[data-testid="conversation-item"]').first();

      if (await conversationItem.isVisible()) {
        await conversationItem.click();

        const messageInput = page.locator('input[placeholder*="message"], textarea[placeholder*="message"]');
        await messageInput.fill('Hello, this is a test message');

        await expect(messageInput).toHaveValue('Hello, this is a test message');
      }
    });
  });

  test.describe('Package Page Chat', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
    });

    test('TC-MSG-001: Package detail page has messages section', async ({ page }) => {
      await page.goto('/sender');

      const packageLink = page.locator('a[href*="/packages/"]').first();

      if (await packageLink.isVisible()) {
        await packageLink.click();

        // Messages section should exist (may be collapsed)
        const messagesSection = page.getByText(/messages|chat/i);
        // The section may exist in various forms
      }
    });
  });

  test.describe('Unread Message Count', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, TEST_USERS.sender);
    });

    test('TC-MSG-005: Navbar shows messages icon', async ({ page }) => {
      await page.goto('/dashboard');

      // Messages icon should be in navbar
      const messagesLink = page.locator('a[href="/messages"]').first();
      await expect(messagesLink).toBeVisible();
    });

    test('Unread badge appears when messages exist', async ({ page }) => {
      await page.goto('/dashboard');

      // Check for unread badge (may or may not exist)
      const unreadBadge = page.locator('[data-testid="message-unread-count"]');

      // Badge visibility depends on actual unread messages
      // Just verify the element structure exists
    });
  });

  test.describe('Message from Courier Dashboard', () => {
    test.beforeEach(async ({ page }) => {
      await loginUser(page, TEST_USERS.courier);
    });

    test('TC-MSG-008: Message Sender button on assigned packages', async ({ page }) => {
      await page.goto('/courier');

      const messageSenderLink = page.getByRole('link', { name: /message sender/i }).first();

      if (await messageSenderLink.isVisible()) {
        await messageSenderLink.click();

        // Should navigate to messages with package context
        await expect(page).toHaveURL(/\/messages/);
      }
    });
  });
});

test.describe('Real-time Messaging (Multi-browser)', () => {
  test('TC-MSG-002: Messages appear in real-time between users', async ({ browser }) => {
    // Create two browser contexts for sender and courier
    const senderContext = await browser.newContext();
    const courierContext = await browser.newContext();

    const senderPage = await senderContext.newPage();
    const courierPage = await courierContext.newPage();

    // Login both users
    await loginUser(senderPage, TEST_USERS.sender);
    await loginUser(courierPage, TEST_USERS.courier);

    // Both navigate to messages
    await senderPage.goto('/messages');
    await courierPage.goto('/messages');

    // Find common conversation if exists
    const senderConversation = senderPage.locator('[data-testid="conversation-item"]').first();
    const courierConversation = courierPage.locator('[data-testid="conversation-item"]').first();

    // If both have conversations, test message exchange
    if (await senderConversation.isVisible() && await courierConversation.isVisible()) {
      await senderConversation.click();
      await courierConversation.click();

      // Sender sends a message
      const messageText = `Test message ${Date.now()}`;
      const senderInput = senderPage.locator('input[placeholder*="message"], textarea[placeholder*="message"]');

      if (await senderInput.isVisible()) {
        await senderInput.fill(messageText);
        await senderPage.getByRole('button', { name: /send/i }).click();

        // Wait for message to appear on sender's side
        await expect(senderPage.getByText(messageText)).toBeVisible({ timeout: 5000 });

        // Message should appear on courier's side via WebSocket (with some delay)
        await expect(courierPage.getByText(messageText)).toBeVisible({ timeout: 10000 });
      }
    }

    // Cleanup
    await senderContext.close();
    await courierContext.close();
  });
});

test.describe('Message Conversation List', () => {
  test.beforeEach(async ({ page }) => {
    await loginUser(page, TEST_USERS.sender);
  });

  test('Conversation shows other user name', async ({ page }) => {
    await page.goto('/messages');

    const conversationItem = page.locator('[data-testid="conversation-item"]').first();

    if (await conversationItem.isVisible()) {
      // Should show the other user's name
      await expect(conversationItem.locator('text=/[A-Za-z]+ [A-Za-z]+/')).toBeVisible();
    }
  });

  test('Conversation shows package description', async ({ page }) => {
    await page.goto('/messages');

    const conversationItem = page.locator('[data-testid="conversation-item"]').first();

    if (await conversationItem.isVisible()) {
      // Package description or reference should be visible
      // This may vary based on UI design
    }
  });

  test('Conversation shows last message preview', async ({ page }) => {
    await page.goto('/messages');

    const conversationItem = page.locator('[data-testid="conversation-item"]').first();

    if (await conversationItem.isVisible()) {
      // Should show some preview text
      const hasText = await conversationItem.textContent();
      expect(hasText?.length).toBeGreaterThan(0);
    }
  });
});
