// DEV-212: shared by the admin form (AssistantKeyManager) and the server (api/admin/assistant-key.js).
// A pasted key often carries extra characters: spaces or line breaks, invisible characters from chat
// or documents, quotes, or a "GEMINI_API_KEY=" prefix copied from a settings file. They are removed
// here. The format check is deliberately loose: the real check is asking Google whether the key works.

// Soft hyphen, zero-width characters, direction marks/embeddings, word joiners, BOM
// (built from code points so the source file itself contains no invisible characters).
const cp = (n) => String.fromCharCode(n);
const INVISIBLE = new RegExp(`[${cp(0xad)}${cp(0x200b)}-${cp(0x200f)}${cp(0x202a)}-${cp(0x202e)}${cp(0x2060)}-${cp(0x2064)}${cp(0xfeff)}]`, 'g');

export function normalizeAssistantKey(raw) {
  let s = typeof raw === 'string' ? raw : '';
  s = s.replace(INVISIBLE, '').trim();
  s = s.replace(/^[A-Za-z_][A-Za-z0-9_]*\s*[:=]\s*/, ''); // NAME=value or NAME: value
  s = s.replace(/^["'`]+|["'`]+$/g, ''); // surrounding quotes
  return s.replace(/\s+/g, '');
}

// Letters, digits and the URL/base64-safe symbols Google keys can use; 20–500 characters.
export const ASSISTANT_KEY_RE = /^[A-Za-z0-9._~+/=-]{20,500}$/;

export function isPlausibleAssistantKey(key) {
  return ASSISTANT_KEY_RE.test(key);
}
