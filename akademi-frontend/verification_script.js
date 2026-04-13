const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function run() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Set viewport for a mobile-like experience
  await page.setViewportSize({ width: 375, height: 812 });

  console.log('Navigating to local web build...');
  try {
    await page.goto('http://localhost:8081');
    await page.waitForTimeout(5000); // Wait for splash/app to load

    // Check for the presence of the app
    const bodyText = await page.innerText('body');
    console.log('Initial page load check...');

    // Take a screenshot of the home screen or whatever is currently showing
    await page.screenshot({ path: 'home_verification.png' });
    console.log('Screenshot saved as home_verification.png');

    // Attempt to find navigation elements
    const hasProfile = await page.isVisible('text=Profile');
    console.log('Profile tab visible:', hasProfile);

  } catch (error) {
    console.error('Verification failed:', error.message);
  } finally {
    await browser.close();
  }
}

run();
