import { test, expect } from '@playwright/test';

test('verify register screen enhancements', async ({ page }) => {
  await page.goto('http://localhost:19006/Register');

  // Verify Error Banner with Go Back button
  const errorBanner = page.locator('text=Missing academic profile');
  await expect(errorBanner).toBeVisible();
  const goBackButton = page.locator('text=Go back');
  await expect(goBackButton).toBeVisible();

  // Verify Social Coming Soon
  const googleBtn = page.locator('text=Google');
  await googleBtn.click();
  const toast = page.locator('text=Coming soon...');
  await expect(toast).toBeVisible();

  await page.screenshot({ path: 'register-verification.png' });
});

test('verify login screen social buttons', async ({ page }) => {
  await page.goto('http://localhost:19006/Login');

  const appleBtn = page.locator('text=Apple');
  await appleBtn.click();
  const toast = page.locator('text=Coming soon...');
  await expect(toast).toBeVisible();

  await page.screenshot({ path: 'login-verification.png' });
});
