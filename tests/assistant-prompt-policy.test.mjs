// CC-33: the assistant prompt carries approved knowledge only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildSystemInstruction } from '../src/content/assistantKnowledge.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const en = JSON.parse(fs.readFileSync(path.join(root, 'src/locales/en/translation.json'), 'utf8'));
const tEn = (k) => k.split('.').reduce((o, p) => o?.[p], en) ?? k;

test('assistant prompt: approved facts, hours, official channels; no contract data or numeric claims', () => {
  const prompt = buildSystemInstruction(tEn, { partnerNames: ['Example Partner (مثال)'], replyLanguage: 'Arabic' });
  assert.ok(prompt.length < 12000, `prompt ${prompt.length} chars must fit MAX_SYSTEM_CHARS (12000)`);
  assert.ok(prompt.includes('Saturday through Thursday, 10:00 AM to 8:00 PM, Cairo time'));
  assert.ok(prompt.includes('Fridays are closed'));
  assert.ok(prompt.includes('Sard Integrated Smart Solutions'));
  assert.ok(!/12:00 AM|11:00 PM|09:00 PM/.test(prompt), 'old evening hours must be gone');
  assert.ok(!/contract_date|contract_details|Contract Date:|Contract Details:/.test(prompt), 'no contract data');
  assert.ok(!/\d+\s*%/.test(prompt), 'no percentages');
  const emails = prompt.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) || [];
  assert.deepEqual([...new Set(emails)], ['support@sard.info'], 'only the official email may appear');
  for (const id of ['f001', 'f004', 'f009']) assert.ok(prompt.includes(en.faq[id].a.slice(0, 60)), `FAQ ${id} included`);
});

test('assistant prompt without verified partners names none', () => {
  const prompt = buildSystemInstruction(tEn, {});
  assert.ok(prompt.includes('Do not name any partner organizations'));
});
