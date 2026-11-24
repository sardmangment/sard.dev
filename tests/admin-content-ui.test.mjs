// DEV-194: /admin Projects tab — list, add (with validation), edit, hide, reorder and delete with confirmation.
// The admin API is mocked; every write must carry the CSRF token from the session.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getChromium, getChromeExecutablePath, BASE_URL } from './test-helper.mjs';

const CSRF = 'ui-csrf-token';
const P1 = '11111111-2222-4333-8444-555555555555';
const P2 = '66666666-7777-4888-9999-aaaaaaaaaaaa';

async function launch() {
  const chromium = await getChromium();
  const opts = { headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] };
  const chromePath = getChromeExecutablePath();
  if (chromePath) opts.executablePath = chromePath;
  return chromium.launch(opts);
}

async function openAdmin(browser, { lang, viewport, initial }) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.addInitScript((l) => { try { localStorage.setItem('i18nextLng', l); } catch { /* ignore */ } }, lang);

  const store = initial || {
    projects: [
      { id: P1, title_ar: 'سرد فور فت', title_en: 'Sard for Fit', status: 'in_development', image_url: null, is_published: true, display_order: 1 },
      { id: P2, title_ar: 'سرد فيجوالز', title_en: 'Sard Visuals', status: 'launched', image_url: null, is_published: true, display_order: 2 },
    ],
  };
  const writes = [];
  const uploads = [];
  await page.route('**/api/admin/upload', (r) => {
    uploads.push({ csrf: r.request().headers()['x-csrf-token'], body: r.request().postDataBuffer()?.toString('latin1') || '' });
    return r.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ url: `${BASE_URL}/logo.png` }) });
  });
  await page.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
  await page.route('**/api/admin/session', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: true, csrfToken: CSRF }) }));
  await page.route('**/api/admin/appointments**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"data":[]}' }));
  await page.route('**/api/admin/content**', async (route) => {
    const req = route.request();
    const method = req.method();
    const type = new URL(req.url()).searchParams.get('type');
    let rows = store[type] || [];
    if (method === 'GET') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: rows }) });
    const body = req.postData() ? JSON.parse(req.postData()) : null;
    writes.push({ method, url: req.url(), body, csrf: req.headers()['x-csrf-token'] });
    if (method === 'POST') rows = [...rows, { id: 'new-1', ...body, display_order: rows.length + 1 }];
    if (method === 'PATCH' && body.order) rows = body.order.map((id) => rows.find((r) => r.id === id));
    else if (method === 'PATCH') rows = rows.map((r) => (r.id === body.id ? { ...r, ...body } : r));
    if (method === 'DELETE') { const id = new URL(req.url()).searchParams.get('id'); rows = rows.filter((r) => r.id !== id); }
    store[type] = rows;
    return route.fulfill({ status: method === 'POST' ? 201 : 200, contentType: 'application/json', body: '{"data":{}}' });
  });

  await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-testid="admin-tab-projects"]').waitFor({ timeout: 10000 });
  return { page, errors, writes, uploads, rowsTitles: () => store.projects.map((r) => r.title_en) };
}

test('Admin Projects tab: add, edit, hide, reorder and delete (AR/EN, desktop and 375px)', async () => {
  const browser = await launch();
  try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
      for (const lang of ['ar', 'en']) {
        const { page, errors, writes, rowsTitles } = await openAdmin(browser, { lang, viewport });
        await page.locator('[data-testid="admin-tab-projects"]').click();
        const manager = page.locator('[data-testid="manager-projects"]');
        await manager.locator('[data-testid="content-row"]').first().waitFor({ timeout: 8000 });
        assert.equal(await manager.locator('[data-testid="content-row"]').count(), 2);
        assert.ok((await manager.textContent()).includes(lang === 'ar' ? 'سرد فور فت' : 'Sard for Fit'), 'titles in the page language');

        // Add: empty submit shows errors and sends nothing; then a valid project is posted.
        await manager.getByRole('button', { name: lang === 'ar' ? 'إضافة مشروع' : 'Add project' }).click();
        const editor = page.locator('[data-testid="content-editor"]');
        await editor.waitFor();
        await editor.locator('button[type="submit"]').click();
        assert.ok(await editor.locator('[role="alert"]').count() >= 2, 'required title errors');
        assert.equal(writes.length, 0);
        await editor.locator('#f-title_ar').fill('مشروع جديد');
        await editor.locator('#f-title_en').fill('New Project');
        await editor.locator('#f-status').selectOption('launched');
        await editor.locator('#f-project_date').fill('2026-12-01');
        await editor.locator('button[type="submit"]').click();
        await editor.waitFor({ state: 'detached' });
        assert.equal(writes[0].method, 'POST');
        assert.equal(writes[0].csrf, CSRF, 'CSRF header sent');
        assert.equal(writes[0].body.title_en, 'New Project');
        assert.equal(writes[0].body.status, 'launched');
        assert.equal(writes[0].body.is_published, true);
        await manager.locator('[data-testid="content-row"]').nth(2).waitFor();

        // Edit the first project
        await manager.locator('[data-testid="edit-row"]').first().click();
        await editor.waitFor();
        assert.equal(await editor.locator('#f-title_en').inputValue(), 'Sard for Fit', 'editor prefilled');
        await editor.locator('#f-title_en').fill('Sard for Fit 2');
        await editor.locator('button[type="submit"]').click();
        await editor.waitFor({ state: 'detached' });
        assert.equal(writes[1].method, 'PATCH');
        assert.equal(writes[1].body.id, P1);
        assert.equal(writes[1].body.title_en, 'Sard for Fit 2');

        // Hide the second project
        await manager.locator('[data-testid="toggle-visibility"]').nth(1).click();
        await page.waitForFunction(() => document.querySelectorAll('[data-testid="row-visibility"]')[1]?.textContent.match(/Hidden|مخفي/));
        assert.deepEqual(writes[2].body, { id: P2, is_published: false });

        // Move the second project up
        await manager.getByRole('button', { name: lang === 'ar' ? 'تحريك لأعلى' : 'Move up' }).nth(1).click();
        await page.waitForFunction(() => document.querySelector('[data-testid="content-row"]')?.textContent.includes('Visuals') || document.querySelector('[data-testid="content-row"]')?.textContent.includes('فيجوالز'));
        assert.deepEqual(writes[3].body.order.slice(0, 2), [P2, P1]);

        // Delete asks for confirmation; cancel sends nothing, confirm deletes.
        await manager.locator('[data-testid="delete-row"]').first().click();
        const confirm = page.locator('[data-testid="delete-confirm"]');
        await confirm.waitFor();
        await page.keyboard.press('Escape');
        await confirm.waitFor({ state: 'detached' });
        assert.equal(writes.length, 4, 'cancel sends nothing');
        await manager.locator('[data-testid="delete-row"]').first().click();
        await confirm.locator('[data-testid="confirm-delete"]').click();
        await confirm.waitFor({ state: 'detached' });
        assert.equal(writes[4].method, 'DELETE');
        assert.ok(writes[4].url.includes(`id=${P2}`));
        await page.waitForFunction(() => document.querySelectorAll('[data-testid="content-row"]').length === 2);
        assert.deepEqual(rowsTitles(), ['Sard for Fit 2', 'New Project']);

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 1, `/admin ${lang} @${viewport.width}px overflows by ${overflow}px`);
        assert.deepEqual(errors, [], `/admin ${lang} page errors`);
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
});

test('Admin Jobs & Training and Collaborations tabs: new items start hidden, logo upload, closed badge (AR/EN)', async () => {
  const browser = await launch();
  try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
      for (const lang of ['ar', 'en']) {
        const initial = {
          openings: [{ id: P1, kind: 'job', title_ar: 'مطور', title_en: 'Developer', is_published: true, closes_at: '2020-01-01', display_order: 1 }],
          collaborations: [],
        };
        const { page, errors, writes, uploads } = await openAdmin(browser, { lang, viewport, initial });

        // Jobs & Training
        await page.locator('[data-testid="admin-tab-openings"]').click();
        const openings = page.locator('[data-testid="manager-openings"]');
        await openings.locator('[data-testid="content-row"]').first().waitFor({ timeout: 8000 });
        assert.ok((await openings.textContent()).includes(lang === 'ar' ? 'مغلقة' : 'Closed'), 'past closing date is flagged');
        await openings.getByRole('button', { name: lang === 'ar' ? 'إضافة فرصة' : 'Add opening' }).click();
        const editor = page.locator('[data-testid="content-editor"]');
        await editor.waitFor();
        assert.equal(await editor.locator('#f-is_published').isChecked(), false, 'new openings start hidden');
        await editor.locator('#f-kind').selectOption('training');
        await editor.locator('#f-title_ar').fill('تدريب صيفي');
        await editor.locator('#f-title_en').fill('Summer Training');
        await editor.locator('#f-work_mode').selectOption('remote');
        await editor.locator('#f-closes_at').fill('2026-12-31');
        await editor.locator('button[type="submit"]').click();
        await editor.waitFor({ state: 'detached' });
        const post = writes.find((w) => w.method === 'POST');
        assert.ok(post.url.includes('type=openings'));
        assert.equal(post.body.kind, 'training');
        assert.equal(post.body.work_mode, 'remote');
        assert.equal(post.body.is_published, false);
        assert.equal(post.csrf, CSRF);

        // Collaborations: empty state, add with an uploaded logo
        await page.locator('[data-testid="admin-tab-collaborations"]').click();
        const collabs = page.locator('[data-testid="manager-collaborations"]');
        await collabs.getByText(lang === 'ar' ? 'لا توجد تعاونات بعد.' : 'No collaborations yet.').waitFor({ timeout: 8000 });
        await collabs.getByRole('button', { name: lang === 'ar' ? 'إضافة تعاون' : 'Add collaboration' }).click();
        await editor.waitFor();
        await editor.locator('#f-name_ar').fill('جامعة الإسكندرية');
        await editor.locator('#f-name_en').fill('Alexandria University');
        await editor.locator('#f-kind').selectOption('academic');
        await editor.locator('[data-testid="upload-logo_url"]').setInputFiles({ name: 'logo.png', mimeType: 'image/png', buffer: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) });
        await page.waitForFunction(() => document.querySelector('[data-testid="content-editor"] img'));
        assert.equal(uploads.length, 1);
        assert.equal(uploads[0].csrf, CSRF, 'upload carries the CSRF token');
        assert.ok(uploads[0].body.includes('collaborations'), 'upload goes to the collaborations folder');
        await editor.locator('button[type="submit"]').click();
        await editor.waitFor({ state: 'detached' });
        const collabPost = writes.filter((w) => w.method === 'POST').find((w) => w.url.includes('type=collaborations'));
        assert.equal(collabPost.body.logo_url, `${BASE_URL}/logo.png`);
        assert.equal(collabPost.body.kind, 'academic');
        await collabs.locator('[data-testid="content-row"]').first().waitFor();

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 1, `/admin ${lang} @${viewport.width}px overflows by ${overflow}px`);
        assert.deepEqual(errors, [], `/admin ${lang} page errors`);
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
});

test('Admin Applications tab: filters, status change, signed CV link and delete (AR/EN, desktop and 375px)', async () => {
  const browser = await launch();
  try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 375, height: 812 }]) {
      for (const lang of ['ar', 'en']) {
        const page = await browser.newPage({ viewport });
        const errors = [];
        page.on('pageerror', (e) => errors.push(e.message));
        await page.addInitScript((l) => { try { localStorage.setItem('i18nextLng', l); } catch { /* ignore */ } }, lang);
        let apps = [
          { id: P1, opening_id: P2, opening_title: 'Frontend Developer', full_name: 'Sara Ali', email: 'sara@example.com', phone: '+20 100 000 0000', city: 'Alexandria', profile_url: 'https://linkedin.com/in/sara', message: 'Hello', status: 'new', created_at: '2026-11-24T09:00:00Z' },
          { id: P2, opening_id: null, opening_title: null, full_name: 'Omar Hassan', email: 'omar@example.com', phone: '0100 111 2222', city: null, profile_url: null, message: null, status: 'reviewing', created_at: '2026-11-23T09:00:00Z' },
        ];
        const calls = [];
        await page.route('**/rest/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
        await page.route('**/api/admin/session', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ authenticated: true, csrfToken: CSRF }) }));
        await page.route('**/api/admin/appointments**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{"data":[]}' }));
        await page.route('**/api/admin/content**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: [{ id: P2, title_ar: 'مطور واجهات', title_en: 'Frontend Developer' }] }) }));
        await page.route('**/signed-cv.pdf**', (r) => r.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4' }));
        await page.route('**/api/admin/applications**', async (route) => {
          const rq = route.request();
          const u = new URL(rq.url());
          const body = rq.postData() ? JSON.parse(rq.postData()) : null;
          calls.push({ method: rq.method(), search: u.search, body, csrf: rq.headers()['x-csrf-token'] });
          if (rq.method() === 'GET') {
            const op = u.searchParams.get('opening');
            const list = apps.filter((a) => (op === 'general' ? !a.opening_id : op ? a.opening_id === op : true));
            return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ data: list }) });
          }
          if (rq.method() === 'PATCH') apps = apps.map((a) => (a.id === body.id ? { ...a, status: body.status } : a));
          if (rq.method() === 'DELETE') apps = apps.filter((a) => a.id !== u.searchParams.get('id'));
          if (rq.method() === 'POST') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ url: `${BASE_URL}/signed-cv.pdf?token=t` }) });
          return route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true}' });
        });

        await page.goto(`${BASE_URL}/admin`, { waitUntil: 'domcontentloaded' });
        await page.locator('[data-testid="admin-tab-applications"]').click();
        const mgr = page.locator('[data-testid="manager-applications"]');
        await mgr.locator('[data-testid="application-row"]').first().waitFor({ timeout: 8000 });
        assert.equal(await mgr.locator('[data-testid="application-row"]').count(), 2);
        const text = await mgr.textContent();
        assert.ok(text.includes(lang === 'ar' ? 'مطور واجهات' : 'Frontend Developer'), 'opening name shown');
        assert.ok(text.includes(lang === 'ar' ? 'طلب توظيف عام' : 'General application'), 'general application labelled');
        assert.equal(await mgr.locator('a[href="mailto:sara@example.com"]').count(), 1);

        // Filter: general applications only
        await mgr.locator('[data-testid="filter-opening"]').selectOption('general');
        await page.waitForFunction(() => document.querySelectorAll('[data-testid="application-row"]').length === 1);
        assert.ok(calls.some((c) => c.method === 'GET' && c.search.includes('opening=general')));
        await mgr.locator('[data-testid="filter-opening"]').selectOption('');
        await page.waitForFunction(() => document.querySelectorAll('[data-testid="application-row"]').length === 2);

        // Status change
        await mgr.locator('[data-testid="status-select"]').first().selectOption('shortlisted');
        await page.waitForFunction(() => /Shortlisted|القائمة المختصرة/.test(document.querySelector('[data-testid="application-status"]').textContent));
        const patch = calls.find((c) => c.method === 'PATCH');
        assert.deepEqual(patch.body, { id: P1, status: 'shortlisted' });
        assert.equal(patch.csrf, CSRF);

        // Open CV: POST with CSRF, new tab goes to the signed link
        const [popup] = await Promise.all([page.waitForEvent('popup'), mgr.locator('[data-testid="open-cv"]').first().click()]);
        await popup.waitForURL(/signed-cv\.pdf\?token=t/, { timeout: 5000 });
        const cv = calls.find((c) => c.method === 'POST');
        assert.deepEqual(cv.body, { action: 'cv', id: P1 });
        assert.equal(cv.csrf, CSRF);
        await popup.close();

        // Delete with confirmation
        await mgr.locator('[data-testid="delete-application"]').nth(1).click();
        const confirm = page.locator('[data-testid="application-delete-confirm"]');
        await confirm.waitFor();
        assert.ok((await confirm.textContent()).includes('Omar Hassan'));
        await confirm.locator('[data-testid="confirm-application-delete"]').click();
        await page.waitForFunction(() => document.querySelectorAll('[data-testid="application-row"]').length === 1);
        assert.ok(calls.some((c) => c.method === 'DELETE' && c.search.includes(`id=${P2}`)));

        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
        assert.ok(overflow <= 1, `/admin applications ${lang} @${viewport.width}px overflows by ${overflow}px`);
        assert.deepEqual(errors, [], `/admin applications ${lang} page errors`);
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
});
