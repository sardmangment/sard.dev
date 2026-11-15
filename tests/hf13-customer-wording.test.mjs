// tests/hf13-customer-wording.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

test('HF-13: CalendarPage contains approved booking link & device list wording', () => {
  const calPath = path.resolve(__dirname, '../src/pages/CalendarPage.jsx');
  const content = fs.readFileSync(calPath, 'utf8');

  assert.ok(content.includes('رابط إدارة حجزك الخاص'), 'Missing Arabic title in CalendarPage');
  assert.ok(content.includes('Your private booking link'), 'Missing English title in CalendarPage');
  assert.ok(content.includes('احفظ هذا الرابط — هو الطريقة الوحيدة لعرض حجزك أو إلغائه لاحقاً. لا تشاركه مع أي شخص.'), 'Missing Arabic helper in CalendarPage');
  assert.ok(content.includes("Save this link — it's the only way to view or cancel your booking later. Don't share it with anyone."), 'Missing English helper in CalendarPage');
  assert.ok(content.includes('نسخ الرابط'), 'Missing Arabic copy link in CalendarPage');
  assert.ok(content.includes('Copy link'), 'Missing English copy link in CalendarPage');
  assert.ok(content.includes('تم النسخ'), 'Missing Arabic copied in CalendarPage');
  assert.ok(content.includes('Copied'), 'Missing English copied in CalendarPage');
  assert.ok(content.includes('عرض الحجز'), 'Missing Arabic view booking in CalendarPage');
  assert.ok(content.includes('View booking'), 'Missing English view booking in CalendarPage');
  assert.ok(content.includes('حجوزاتك على هذا الجهاز'), 'Missing Arabic device list heading in CalendarPage');
  assert.ok(content.includes('Your bookings on this device'), 'Missing English device list heading in CalendarPage');
  assert.ok(content.includes('تظهر هنا فقط على هذا الجهاز والمتصفح.'), 'Missing Arabic device list note in CalendarPage');
  assert.ok(content.includes('Shown only on this device and browser.'), 'Missing English device list note in CalendarPage');
});

test('HF-13: ManageAppointmentPage contains approved wording for link, cancelled state, and invalid link', () => {
  const managePath = path.resolve(__dirname, '../src/pages/ManageAppointmentPage.jsx');
  const content = fs.readFileSync(managePath, 'utf8');

  assert.ok(content.includes('رابط إدارة حجزك الخاص'), 'Missing Arabic title in ManageAppointmentPage');
  assert.ok(content.includes('Your private booking link'), 'Missing English title in ManageAppointmentPage');
  assert.ok(content.includes('رابط خاص بك — لا تشاركه.'), 'Missing Arabic header line in ManageAppointmentPage');
  assert.ok(content.includes("This is your private link — don't share it."), 'Missing English header line in ManageAppointmentPage');
  assert.ok(content.includes('احفظ هذا الرابط — هو الطريقة الوحيدة لعرض حجزك أو إلغائه لاحقاً. لا تشاركه مع أي شخص.'), 'Missing Arabic helper in ManageAppointmentPage');
  assert.ok(content.includes("Save this link — it's the only way to view or cancel your booking later. Don't share it with anyone."), 'Missing English helper in ManageAppointmentPage');
  assert.ok(content.includes('هذا الرابط غير صالح أو انتهت صلاحيته. إذا فقدت رابط حجزك، تواصل معنا وسنساعدك.'), 'Missing Arabic invalid link in ManageAppointmentPage');
  assert.ok(content.includes("This link is invalid or has expired. If you lost your booking link, contact us and we'll help."), 'Missing English invalid link in ManageAppointmentPage');
  assert.ok(content.includes('تم إلغاء هذا الحجز.'), 'Missing Arabic cancelled in ManageAppointmentPage');
  assert.ok(content.includes('This booking has been cancelled.'), 'Missing English cancelled in ManageAppointmentPage');
});

test('HF-13: ChatPage booking banner contains View booking / Copy link', () => {
  const chatPath = path.resolve(__dirname, '../src/components/ChatPage.jsx');
  const content = fs.readFileSync(chatPath, 'utf8');

  assert.ok(content.includes('عرض الحجز'), 'Missing Arabic view booking in ChatPage');
  assert.ok(content.includes('View booking'), 'Missing English view booking in ChatPage');
  assert.ok(content.includes('نسخ الرابط'), 'Missing Arabic copy link in ChatPage');
  assert.ok(content.includes('Copy link'), 'Missing English copy link in ChatPage');
});
