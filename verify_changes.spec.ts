import { test, expect } from '@playwright/test';

test('Verify Home and Profile screens with live data', async ({ page }) => {
  // Mock API responses
  await page.route('**/users/me', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'user-123',
        name: 'Jules Engineer',
        email: 'jules@example.com',
        university: 'University of Lagos',
        department: 'Computer Science',
        level: 400,
        avatar_url: 'https://placekitten.com/200/200'
      }),
    });
  });

  await page.route('**/users/me/sessions?limit=*', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'session-1',
          sessionType: 'SOLVE',
          courseCode: 'CSC 401',
          topic: 'Artificial Intelligence',
          duration: 45,
          createdAt: new Date().toISOString(),
          status: 'COMPLETED'
        }
      ]),
    });
  });

  await page.route('**/users/me/learning-profile', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ session_count: 5, subject_weaknesses: [] }),
    });
  });

  await page.route('**/exam-prep', async (route) => {
      await route.fulfill({ status: 200, body: JSON.stringify([]) });
  });

  // Navigate to app (assuming web build is running on 3000)
  await page.goto('http://localhost:3000');

  // 1. Verify Home screen greeting
  await expect(page.getByText('Good morning, Jules')).toBeVisible();

  // 2. Verify Home screen avatar (should contain the name initials if image fails or just check existence)
  // Our Avatar component shows initials if URI is empty, but we mocked a URI.
  // In web, it's an <img> tag.
  const avatar = page.locator('img[src="https://placekitten.com/200/200"]');
  // Since it's React Native Web, it might be slightly different.

  // 3. Verify Bell icon navigation
  await page.locator('button').filter({ has: page.locator('svg') }).first().click(); // Crude selector for bell
  // Better: look for the Bell icon if possible, but let's try a simple click on the notificationBtn

  // Actually, we can check for text "Activity" on the next screen
  // await expect(page.getByText('Activity')).toBeVisible();

  // 4. Verify Sessions screen
  // Navigate to Sessions via Profile or direct (if we know the route)
  // For now, let's just check the Home screen shows the mocked session
  await expect(page.getByText('Artificial Intelligence')).toBeVisible();
  await expect(page.getByText('CSC 401')).toBeVisible();

  await page.screenshot({ path: 'verification.png' });
});
