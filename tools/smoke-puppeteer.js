const puppeteer = require('puppeteer');
const fs = require('fs');

const BASE = 'http://localhost:3000';
const commonPaths = ['/', '/setup', '/verify-email', '/forgot-password', '/users', '/patients'];

// Per-role dashboard pages to check
const rolePaths = {
  admin: ['/dashboard/admin', '/users', '/settings'],
  receptionist: ['/dashboard/receptionist', '/patients', '/appointments'],
  clinician: ['/dashboard/clinician', '/patients', '/consultations']
};

const users = [
  { id: '1', username: 'admin', role: 'admin', name: 'Admin User' },
  { id: '2', username: 'reception', role: 'receptionist', name: 'Receptionist' },
  { id: '3', username: 'clinician', role: 'clinician', name: 'Clinician' },
];

function buildTokenForUser(user) {
  const payload = { exp: Math.floor(Date.now() / 1000) + 3600, userId: user.id, username: user.username, role: user.role, name: user.name };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  for (const u of users) {
    console.log('--- Testing user:', u.username, 'role:', u.role, '---');
    const page = await browser.newPage();
    // Inject a demo auth token and user data so protected pages render as authenticated
    const token = buildTokenForUser(u);
    await page.evaluateOnNewDocument((t, user) => {
      try {
        localStorage.setItem('auth_token', t);
        localStorage.setItem('user_data', JSON.stringify({ id: user.id, username: user.username, role: user.role, name: user.name, is_active: true, created_at: new Date().toISOString(), updated_at: new Date().toISOString() }));
      } catch (e) {}
    }, token, u);

    page.setDefaultNavigationTimeout(30000);

    const paths = [...commonPaths, ...(rolePaths[u.role] || [])];
    for (const p of paths) {
      const url = BASE + p;
      console.log('===', u.username, '->', url, '===');
      const consoleErrors = [];
      const consoleLogs = [];
      page.on('console', msg => {
        const text = msg.text();
        if (msg.type() === 'error') consoleErrors.push(text);
        else consoleLogs.push(text);
      });

      let response = null;
      try {
        response = await page.goto(url, { waitUntil: ['domcontentloaded', 'networkidle2'] });
      } catch (err) {
        console.log('navigation-error:', err.message);
      }

      const status = response ? response.status() : 'no-response';
      console.log('status:', status);

      // Get HTML snapshot length and first 400 chars
      let html = '';
      try {
        html = await page.content();
        console.log('html-length:', html.length);
        console.log('html-snip:', html.slice(0, 400).replace(/\s+/g, ' ').trim());
      } catch (err) {
        console.log('content-error:', err.message);
      }

      // Try to find first clickable element and click it
      try {
        const clickable = await page.$('button, a, [role="button"], input[type="submit"]');
        if (clickable) {
          const desc = await page.evaluate(el => el.outerHTML.slice(0,200), clickable);
          console.log('first-clickable:', desc.replace(/\n/g, ''));
          await clickable.click();
          await page.waitForTimeout(800);
          console.log('click-done');
        } else {
          console.log('no-clickable-found');
        }
      } catch (err) {
        console.log('click-error:', err.message);
      }

      // Save screenshot
      try {
        const safePath = p.replace(/\//g,'_') || 'root';
        const shotPath = `/tmp/front-smoke-${u.username}-${safePath}.png`;
        await page.screenshot({ path: shotPath, fullPage: true });
        console.log('screenshot:', shotPath);
      } catch (err) {
        console.log('screenshot-error:', err.message);
      }

      if (consoleErrors.length) {
        console.log('console-errors:');
        consoleErrors.forEach(e => console.log('  -', e));
      } else {
        console.log('no-console-errors');
      }

      // remove listeners to avoid duplication on next loop
      page.removeAllListeners('console');

      console.log('\n');
    }

    await page.close();
  }

  await browser.close();
  console.log('Smoke test complete');
  process.exit(0);
})();
