import { test, expect } from '@playwright/test';

test('verify login screen centering and text', async ({ page }) => {
  await page.goto('http://localhost:19006/Login');

  // Wait for wordmark to be visible
  const wordmark = page.locator('text=Akademi').first();
  await expect(wordmark).toBeVisible();

  // Check if headline and subtext are centered
  // In react-native-web, these are often divs with specific styles
  const headline = page.locator('text=Welcome back 👋');
  const subtext = page.locator('text=Sign in to continue learning');

  await expect(headline).toHaveCSS('text-align', 'center');
  await expect(subtext).toHaveCSS('text-align', 'center');

  await page.screenshot({ path: 'login-screen.png' });
});

test('verify onboarding flow redirection', async ({ page }) => {
  await page.goto('http://localhost:19006/Register');

  // Should see error banner because no academic data is present
  const errorBanner = page.locator('text=Missing academic profile');
  await expect(errorBanner).toBeVisible();

  await page.screenshot({ path: 'register-enforcement.png' });
});
