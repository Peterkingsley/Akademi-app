const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Set viewport for a mobile-like experience
  await page.setViewportSize({ width: 390, height: 844 });

  try {
    console.log('Navigating to app...');
    await page.goto('http://localhost:8081');

    // Wait for the app to load
    await page.waitForTimeout(5000);

    // Mock authentication and role
    await page.evaluate(() => {
      const authData = {
        state: {
          user: {
            id: 'admin-123',
            email: 'admin@akademi.com',
            name: 'Admin User',
            admin_role: 'CONTENT_MANAGER' // Not Super Admin
          },
          accessToken: 'fake-token',
          isAuthenticated: true,
          hasSeenOnboarding: true
        },
        version: 0
      };
      localStorage.setItem('auth-storage', JSON.stringify(authData));
      window.location.reload();
    });

    console.log('Reloading with auth...');
    await page.waitForTimeout(5000);

    // Take screenshot of Dashboard (Initial state)
    await page.screenshot({ path: 'admin_dashboard.png' });
    console.log('Dashboard screenshot saved.');

    // Attempt to navigate to Admin Stack
    // In RootNavigator, Admin is a stack screen.
    // We can try to force navigation if we have navigationRef
    await page.evaluate(() => {
      if (window.navigationRef && window.navigationRef.isReady()) {
        window.navigationRef.navigate('Admin', { screen: 'Dashboard' });
      }
    });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'admin_panel_loaded.png' });

    // Navigate to "More" tab
    await page.evaluate(() => {
        if (window.navigationRef && window.navigationRef.isReady()) {
          window.navigationRef.navigate('Admin', { screen: 'More' });
        }
    });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'admin_more_restricted.png' });
    console.log('More tab (Restricted) screenshot saved.');

    // Switch to Super Admin
    await page.evaluate(() => {
        const authData = JSON.parse(localStorage.getItem('auth-storage'));
        authData.state.user.admin_role = 'SUPER_ADMIN';
        localStorage.setItem('auth-storage', JSON.stringify(authData));
        window.location.reload();
    });
    await page.waitForTimeout(5000);

    // Navigate to "More" tab as Super Admin
    await page.evaluate(() => {
        if (window.navigationRef && window.navigationRef.isReady()) {
          window.navigationRef.navigate('Admin', { screen: 'More' });
        }
    });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'admin_more_full.png' });
    console.log('More tab (Full) screenshot saved.');

    // Navigate to "Moderation" tab
    await page.evaluate(() => {
        if (window.navigationRef && window.navigationRef.isReady()) {
          window.navigationRef.navigate('Admin', { screen: 'Moderation' });
        }
    });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'admin_moderation.png' });
    console.log('Moderation tab screenshot saved.');

  } catch (error) {
    console.error('Error during verification:', error);
  } finally {
    await browser.close();
  }
})();
