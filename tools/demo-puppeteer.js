const puppeteer = require('puppeteer');

const BASE = 'http://localhost:3000';

const users = [
  { id: '2', username: 'reception', role: 'receptionist', name: 'Receptionist' },
  { id: '3', username: 'clinician', role: 'clinician', name: 'Clinician' },
  { id: '4', username: 'lab_technician', role: 'lab_technician', name: 'Lab Technician' },
  { id: '5', username: 'pharmacist', role: 'pharmacist', name: 'Pharmacist' },
];

function buildTokenForUser(user) {
  const payload = { exp: Math.floor(Date.now() / 1000) + 3600, userId: user.id, username: user.username, role: user.role, name: user.name };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

async function wait(ms){ return new Promise(resolve => setTimeout(resolve, ms)); }

function extractIdFromResponse(resp) {
  if (!resp) return null;
  if (typeof resp === 'string') return resp;
  if (Array.isArray(resp)) return resp.length ? (resp[0].id || null) : null;
  if (resp.id) return resp.id;
  const keys = ['appointment','consultation','order','result','medication','invoice','data','item','record'];
  for (const k of keys) {
    if (resp[k] && resp[k].id) return resp[k].id;
  }
  // fallback: search first nested object with id
  for (const v of Object.values(resp)) {
    if (v && typeof v === 'object' && v.id) return v.id;
  }
  return null;
}

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox','--disable-setuid-sandbox'], timeout: 0 });
  // Open one page per role to simulate multiple users connected to WS
  const pages = {};
  for (const u of users) {
    const page = await browser.newPage();
    page.setDefaultNavigationTimeout(0);
    page.setDefaultTimeout(0);
    const token = buildTokenForUser(u);
    await page.evaluateOnNewDocument((t, user) => {
      localStorage.setItem('auth_token', t);
      localStorage.setItem('user_data', JSON.stringify({ id: user.id, username: user.username, role: user.role, name: user.name }));
    }, token, u);
    pages[u.role] = page;
  }

  // 1) Receptionist books an appointment (do the POST from Node to avoid CORS inside the page)
  const rec = pages['receptionist'];
  await rec.goto(BASE + '/dashboard/receptionist', { waitUntil: ['domcontentloaded','networkidle2'] }).catch(()=>{});
  let appt = null;
  try {
    const apptRespNode = await fetch('http://localhost:8080/api/appointments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patient_id: '1', scheduled_at: new Date(Date.now()+3600*1000).toISOString(), clinician_id: '3', created_by: '2' }) });
    appt = await apptRespNode.json().catch(()=>null);
  } catch(e) { appt = null }
  console.log('Created appointment response:', JSON.stringify(appt));
  console.log('Appointment id:', extractIdFromResponse(appt));
  await wait(800);
  try{
    await rec.screenshot({ path: '/tmp/demo-receptionist-after-appointment.png', fullPage: true });
  }catch(e){
    await new Promise(r=>setTimeout(r,500));
    await rec.screenshot({ path: '/tmp/demo-receptionist-after-appointment.png', fullPage: true });
  }

  // 2) Clinician views appointment and creates consultation
  const cli = pages['clinician'];
  await cli.goto(BASE + '/dashboard/clinician', { waitUntil: ['domcontentloaded','networkidle2'] }).catch(()=>{});
  let consultation = null;
  try {
    const consultRespNode = await fetch('http://localhost:8080/api/consultations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appointment_id: extractIdFromResponse(appt), clinician_id: '3', notes: 'Initial consult notes' }) });
    consultation = await consultRespNode.json().catch(()=>null);
  } catch(e) { consultation = null }
  console.log('Created consultation response:', JSON.stringify(consultation));
  console.log('Consultation id:', extractIdFromResponse(consultation));
  await wait(800);
  try{ await cli.screenshot({ path: '/tmp/demo-clinician-after-consultation.png', fullPage: true }); }catch(e){ await new Promise(r=>setTimeout(r,500)); await cli.screenshot({ path: '/tmp/demo-clinician-after-consultation.png', fullPage: true }); }

  // 3) Clinician orders a lab
  let labOrder = null;
  try {
    const labOrderRespNode = await fetch('http://localhost:8080/api/lab/orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patient_id: '1', tests: ['cbc','glucose'], ordered_by: '3' }) });
    labOrder = await labOrderRespNode.json().catch(()=>null);
  } catch(e) { labOrder = null }
  console.log('Created lab order response:', JSON.stringify(labOrder));
  console.log('Lab order id:', extractIdFromResponse(labOrder));
  await wait(800);
  try{ await cli.screenshot({ path: '/tmp/demo-clinician-after-laborder.png', fullPage: true }); }catch(e){ await new Promise(r=>setTimeout(r,500)); await cli.screenshot({ path: '/tmp/demo-clinician-after-laborder.png', fullPage: true }); }

  // 4) Lab technician posts result
  const lab = pages['lab_technician'];
  await lab.goto(BASE + '/dashboard/lab_technician', { waitUntil: ['domcontentloaded','networkidle2'] }).catch(()=>{});
  let labRes = null;
  try {
    const labResRespNode = await fetch('http://localhost:8080/api/lab/results', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ order_id: extractIdFromResponse(labOrder), patient_id: (labOrder && labOrder.order && labOrder.order.patient_id) ? labOrder.order.patient_id : '1', values: { cbc: 'normal', glucose: '95 mg/dL' }, created_by: '4' }) });
    labRes = await labResRespNode.json().catch(()=>null);
  } catch(e) { labRes = null }
  console.log('Posted lab result response:', JSON.stringify(labRes));
  console.log('Lab result id:', extractIdFromResponse(labRes));
  await wait(800);
  try{ await lab.screenshot({ path: '/tmp/demo-lab_after_result.png', fullPage: true }); }catch(e){ await new Promise(r=>setTimeout(r,500)); await lab.screenshot({ path: '/tmp/demo-lab_after_result.png', fullPage: true }); }

  // 5) Pharmacist creates medication entry and invoice
  const pharm = pages['pharmacist'];
  await pharm.goto(BASE + '/dashboard/pharmacist', { waitUntil: ['domcontentloaded','networkidle2'] }).catch(()=>{});
  let med = null;
  try {
    const medRespNode = await fetch('http://localhost:8080/api/medications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Amoxicillin', dosage: '500mg', stock: 50 }) });
    med = await medRespNode.json().catch(()=>null);
  } catch(e) { med = null }
  console.log('Created medication response:', JSON.stringify(med));
  console.log('Medication id:', extractIdFromResponse(med));
  await wait(400);
  let inv = null;
  try {
    const invRespNode = await fetch('http://localhost:8080/api/invoices', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patient_id: '1', amount: 150 }) });
    inv = await invRespNode.json().catch(()=>null);
  } catch(e) { inv = null }
  console.log('Created invoice response:', JSON.stringify(inv));
  console.log('Invoice id:', extractIdFromResponse(inv));
  await wait(800);
  try{ await pharm.screenshot({ path: '/tmp/demo-pharmacist-after-invoice.png', fullPage: true }); }catch(e){ await new Promise(r=>setTimeout(r,500)); await pharm.screenshot({ path: '/tmp/demo-pharmacist-after-invoice.png', fullPage: true }); }

  // 6) Capture admin view summary
  const adminPage = await browser.newPage();
  adminPage.setDefaultNavigationTimeout(0);
  adminPage.setDefaultTimeout(0);
  const adminToken = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now()/1000)+3600, userId: '1', username: 'admin', role: 'admin', name: 'Admin User' })).toString('base64');
  await adminPage.evaluateOnNewDocument((t) => { localStorage.setItem('auth_token', t); }, adminToken);
  await adminPage.goto(BASE + '/dashboard/admin', { waitUntil: ['domcontentloaded','networkidle2'] }).catch(()=>{});
  await wait(800);
  try{ await adminPage.screenshot({ path: '/tmp/demo-admin-summary.png', fullPage: true }); }catch(e){ await new Promise(r=>setTimeout(r,500)); await adminPage.screenshot({ path: '/tmp/demo-admin-summary.png', fullPage: true }); }

  // Close pages and browser
  for (const p of Object.values(pages)) await p.close();
  await adminPage.close();
  await browser.close();
  console.log('Demo scenario complete. Screenshots saved to /tmp/demo-*.png');
  process.exit(0);
})();
