const puppeteer = require('puppeteer');

const ROLES = ['receptionist', 'clinician', 'nurse', 'pharmacist', 'lab_technician', 'admin'];
const BASE = 'http://localhost:3000';

(async () => {
    console.log('Starting Route Verification...');
    const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });

    for (const role of ROLES) {
        const page = await browser.newPage();

        // Fake auth
        const user = { id: '99', username: role, role: role, name: `${role} User` };
        const token = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, ...user })).toString('base64');

        await page.evaluateOnNewDocument((t, u) => {
            localStorage.setItem('auth_token', t);
            localStorage.setItem('user_data', JSON.stringify(u));
        }, token, user);

        console.log(`Checking dashboard for role: ${role}...`);
        try {
            const response = await page.goto(`${BASE}/dashboard/${role}`, { waitUntil: 'networkidle0', timeout: 10000 });
            const status = response ? response.status() : 'Unknown';

            if (status >= 200 && status < 300) {
                console.log(`✅ [PASS] ${role}: status ${status}`);
            } else {
                console.log(`❌ [FAIL] ${role}: status ${status}`);
            }

            // Check for error text
            const content = await page.content();
            if (content.includes('Application Error') || content.includes('Runtime Error')) {
                console.log(`❌ [FAIL] ${role}: Content contains error message`);
            }

        } catch (error) {
            console.log(`❌ [FAIL] ${role}: Navigation error - ${error.message}`);
        }

        await page.close();
    }

    await browser.close();
    console.log('Verification Complete.');
})();
