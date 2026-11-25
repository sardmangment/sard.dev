// CC-10 / CC-70: approved-content and publication-policy checks (static, no network).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const en = JSON.parse(read('src/locales/en/translation.json'));
const ar = JSON.parse(read('src/locales/ar/translation.json'));

function walk(dir) {
  return fs.readdirSync(path.join(root, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = path.join(dir, e.name);
    if (e.isDirectory()) return walk(rel);
    return /\.(jsx?|tsx?|json|html)$/.test(e.name) ? [rel] : [];
  });
}
const srcFiles = walk('src').filter((f) => !f.replace(/\\/g, '/').endsWith('integrations/supabase/types.ts'));

function leaves(obj, prefix = '') {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? leaves(v, `${prefix}${k}.`) : [[`${prefix}${k}`, v]]
  );
}

test('FAQ-001…009 exist in both locales with question and answer', () => {
  for (let i = 1; i <= 9; i++) {
    const id = `f00${i}`;
    for (const [lang, dict] of [['en', en], ['ar', ar]]) {
      assert.ok(dict.faq?.[id]?.q?.length > 10, `${lang} faq.${id}.q missing`);
      assert.ok(dict.faq?.[id]?.a?.length > 40, `${lang} faq.${id}.a missing`);
    }
  }
  // Verbatim anchors from the CEO-approved dictionary (C-…)
  assert.ok(en.faq.f001.a.startsWith('Sard Integrated Smart Solutions is a technology company based in Alexandria, Egypt, serving organizations across the Arab world'));
  assert.ok(en.faq.f005.a.includes('ISO/IEC 42001 for AI management.'));
  assert.equal(en.hero.title, 'Connect your business. Accelerate growth. Stay in control.');
  assert.equal(en.legal.underReviewTitle, 'Under Legal Review');
});

test('Exactly six approved core values, in order (C-D05)', () => {
  const titles = ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'].map((k) => en.values[k].title);
  assert.deepEqual(titles, [
    'Strategic Partnership',
    'Governance & Accountability',
    'Practical Innovation',
    'Efficiency & Measurable Value',
    'Trust & Data Protection',
    'Human-Centered Growth',
  ]);
  for (const k of ['humanCentered', 'collaborative', 'purposeDriven', 'innovation', 'ethical']) {
    assert.equal(en.values[k], undefined, `superseded value key values.${k} must be removed`);
  }
});

test('Every locale key exists in both languages (no untranslated holes)', () => {
  const enKeys = new Set(leaves(en).map(([k]) => k));
  const arKeys = new Set(leaves(ar).map(([k]) => k));
  assert.deepEqual([...enKeys].filter((k) => !arKeys.has(k)), [], 'keys missing in ar');
  assert.deepEqual([...arKeys].filter((k) => !enKeys.has(k)), [], 'keys missing in en');
});

test('Every t() key used by the calendar booking pages exists in both locales', () => {
  const get = (d, k) => k.split('.').reduce((o, p) => (o == null ? undefined : o[p]), d);
  for (const f of ['src/pages/CalendarPage.jsx', 'src/pages/ManageAppointmentPage.jsx']) {
    const keys = [...new Set([...read(f).matchAll(/\bt\(\s*['"]([\w.]+)['"]/g)].map((m) => m[1]))];
    for (const [lang, dict] of [['en', en], ['ar', ar]]) {
      const missing = keys.filter((k) => typeof get(dict, k) !== 'string');
      assert.deepEqual(missing, [], `${f}: keys missing in ${lang}`);
    }
  }
});

test('No numeric ROI/savings claims or guarantees in public copy (C-E05)', () => {
  for (const [lang, dict] of [['en', en], ['ar', ar]]) {
    for (const [k, v] of leaves(dict)) {
      if (typeof v !== 'string') continue;
      assert.ok(!/\d+\s*%|\d+\s*x\b|guarantee|نضمن|مضمون/i.test(v), `${lang}:${k} contains a numeric claim or guarantee: "${v}"`);
    }
  }
  for (const f of ['src/components/AboutSection.jsx', 'src/components/HeroSection.jsx', 'src/components/ServicesSection.jsx']) {
    assert.ok(!/>\s*(100%|10x)\s*</.test(read(f)), `${f} must not show numeric claims`);
  }
});

test('No contract data, personal contacts, X/Twitter or unofficial numbers in src/ (C-F03, C-G01, C-A17)', () => {
  for (const f of srcFiles) {
    const code = read(f);
    assert.ok(!/contract_date|contract_details/.test(code), `${f} references partner contract data`);
    assert.ok(!/twitter\.com|\bx\.com/.test(code), `${f} links X/Twitter`);
    assert.ok(!/Aya_saaed|linkedin\.com\/company\/sardai/i.test(code), `${f} contains a personal/unofficial handle`);
    const waNumbers = [...code.matchAll(/wa\.me\/(\d+)/g)].map((m) => m[1]);
    assert.ok(waNumbers.every((n) => n === '201509027729'), `${f} has an unofficial WhatsApp number`);
  }
  const html = read('index.html');
  assert.ok(!/twitter\.com|linkedin\.com\/company\/sardai/.test(html), 'index.html JSON-LD must list official profiles only');
});

test('Team page is linked from the "About Sard" menu and the footer (DEV-199, replaces C-G03)', () => {
  for (const f of ['src/config/navigation.js', 'src/components/layout/Footer.tsx']) {
    assert.ok(read(f).includes("to: '/team'"), `${f} links /team`);
  }
  const team = read('src/pages/TeamPage.jsx');
  assert.ok(team.includes("rpc('get_public_team')"), 'team page reads the RPC only');
  assert.ok(!team.includes(".from('team_members')"), 'team page never reads the table');
});

test('Partner UI and assistant use publication RPCs, never the partnerships table', () => {
  const partnerUi = read('src/pages/PartnerDetailsPage.jsx') + read('src/components/PartnersSection.jsx') + read('src/components/ChatPage.jsx');
  assert.ok(partnerUi.includes("rpc('get_published_partner'"), 'partner page must use get_published_partner');
  assert.ok(partnerUi.includes("rpc('get_published_partners')"), 'partner list must use get_published_partners');
  assert.ok(!partnerUi.includes(".from('partnerships')"), 'partner UI must not read the partnerships table directly');
});

test('SEO: sitemap excludes restricted routes; _headers marks them noindex (CC-14)', () => {
  const sitemap = read('public/sitemap.xml');
  for (const p of ['/member/', '/admin', '/calendar/manage', '/privacy', '/terms']) {
    assert.ok(!sitemap.includes(`sard.dev${p}`), `sitemap must not list ${p}`);
  }
  const headers = read('public/_headers').replace(/\r\n/g, '\n');
  for (const p of ['/member/*', '/admin', '/calendar/manage/*']) {
    assert.ok(headers.includes(`${p}\n  X-Robots-Tag: noindex, nofollow`), `_headers must noindex ${p}`);
  }
  assert.ok(!read('public/robots.txt').includes('Disallow: /team'), '/team is public (DEV-199)');
  assert.ok(read('public/sitemap.xml').includes('sard.dev/team<'), 'sitemap lists /team');
});
