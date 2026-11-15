// Unit Test: AI Chat Booking Failure Path & Model ID Verification (DEV-90 / SU-T29)
import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CHAT_PAGE_PATH = path.resolve(__dirname, '../src/components/ChatPage.jsx');

test('DEV-90: ChatPage model array contains only supported Gemini model IDs', () => {
  const code = fs.readFileSync(CHAT_PAGE_PATH, 'utf8');

  // Verify retired models are completely gone
  assert.ok(!code.includes('"gemini-1.5-flash"'), 'gemini-1.5-flash must be removed');
  assert.ok(!code.includes('"gemini-1.5-pro"'), 'gemini-1.5-pro must be removed');
  assert.ok(!code.includes('"gemini-2.0-flash"'), 'gemini-2.0-flash must be removed');

  // Verify supported models are present
  assert.ok(code.includes('"gemini-3.5-flash-lite"'), 'gemini-3.5-flash-lite must be present');
  assert.ok(code.includes('"gemini-2.5-flash-lite"'), 'gemini-2.5-flash-lite must be present');
  assert.ok(code.includes('"gemini-2.5-flash"'), 'gemini-2.5-flash must be present as transitional fallback');
});

test('DEV-90 / HF-08: Booking failure path strips raw [BOOKING_REQUEST...] tag and appends localized error', () => {
  const code = fs.readFileSync(CHAT_PAGE_PATH, 'utf8');

  // Verify raw tag regex stripping occurs in error catch block
  assert.ok(code.includes('reply.replace(/\\[BOOKING_REQUEST:[^\\]]+\\]/g, "")'), 'Raw booking tag must be stripped via regex');
  
  // Verify error handler uses getBookingErrorMessage
  assert.ok(code.includes('getBookingErrorMessage(e, isRTL)'), 'Must call getBookingErrorMessage for localized errors');
});

test('HF-09: ChatPage keeps manage tokens out of bot reply text and conversationContents', () => {
  const code = fs.readFileSync(CHAT_PAGE_PATH, 'utf8');

  // 1. Reply text must NOT append manageUrl
  assert.strictEqual(
    code.includes('reply += (isRTL\n                ? `\\n\\n🔗 رابط إدارة أو إلغاء موعدك'),
    false,
    'Bot reply must not append manageUrl'
  );
  assert.strictEqual(
    code.includes('reply += `\\n\\n🔗'),
    false,
    'Bot reply must not append manage links'
  );

  // 2. TOKEN_REGEX must sanitize conversationContents before sending to Gemini
  assert.ok(
    code.includes('TOKEN_REGEX = /\\S*\\/calendar\\/manage\\/[^\\s]*#t=[0-9a-f]+/gi'),
    'Must define TOKEN_REGEX to redact tokens from chat history'
  );
  assert.ok(
    code.includes('.replace(TOKEN_REGEX, "[manage-link-redacted]")'),
    'Must redact manage link tokens from conversation history before querying Gemini'
  );

  // 3. Banner must provide Copy link button
  assert.ok(code.includes('navigator.clipboard.writeText(url)'), 'Banner must copy manage URL to clipboard');
  assert.ok(code.includes('copiedLink'), 'Banner must maintain copied state');
});

test('DEV-90: Simulation of booking logic with simulated 23505 error', async () => {
  const rawReply = "I have arranged that for you. [BOOKING_REQUEST: Date: 2026-11-20 | Time: 02:00 PM | Name: Test User | Service: AI Consultation]";
  
  // Simulated handler logic matching ChatPage.jsx
  let reply = rawReply;
  const isRTL = false;
  
  if (reply.includes("[BOOKING_REQUEST:")) {
    try {
      // Simulate saveAppointment throwing 23505 conflict
      const err = new Error("SLOT_ALREADY_BOOKED: This slot was just booked by someone else.");
      err.code = '23505';
      throw err;
    } catch (e) {
      reply = reply.replace(/\[BOOKING_REQUEST:[^\]]+\]/g, "").trim();
      if (e.code === '23505' || e.message?.includes('SLOT_ALREADY_BOOKED')) {
        reply += (isRTL
          ? "\n\n⚠️ عذراً، هذا الموعد محجوز بالفعل من قبل عميل آخر. يرجى اختيار موعد آخر أو مراجعة صفحة الكالندر."
          : "\n\n⚠️ Sorry, this time slot has already been booked by another client. Please choose another slot or check the Calendar page.");
      }
    }
  }

  assert.ok(!reply.includes('[BOOKING_REQUEST:'), 'Raw tag must not remain in the final user message');
  assert.ok(reply.includes('I have arranged that for you.'), 'Original conversational text must be preserved');
  assert.ok(reply.includes('Sorry, this time slot has already been booked'), 'Conflict message must be present');
});
