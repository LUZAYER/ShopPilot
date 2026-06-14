import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

(async () => {
  const docsDir = path.join(process.cwd(), '../docs/screenshots');
  if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
  }

  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium' });
  const page = await browser.newPage({
    viewport: { width: 1280, height: 800 }
  });
  
  // Login
  await page.goto('http://localhost:3000/login');
  await page.fill('input[type="email"]', 'demo@shoppilot.ai');
  await page.fill('input[type="password"]', 'demo1234');
  await page.click('button[type="submit"]');
  
  // Wait for login to complete and redirect to dashboard
  await page.waitForURL('**/dashboard*');
  await page.waitForTimeout(1500); // wait for charts to render
  await page.screenshot({ path: path.join(docsDir, '01-dashboard.png') });
  
  // Content Studio
  await page.goto('http://localhost:3000/content');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(docsDir, '02-content-studio.png') });

  // Inbox
  await page.goto('http://localhost:3000/inbox');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(docsDir, '03-inbox.png') });

  // Orders
  await page.goto('http://localhost:3000/orders');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(docsDir, '04-orders.png') });

  await browser.close();
  console.log("Screenshots captured successfully!");
})();
