// Vercel Edge Function: Gemini Server-Side Proxy (Proposal D-18 / DEV-83 / AR-04 / AR-05 / AR-06 / HF-03)
// Protects Google AI Studio API key from client bundle exposure.
// Rate limited per client IP via shared Postgres RPC or fallback sliding window.

import { checkChatRateLimit } from "./_lib/rateLimit.js";

export const config = { runtime: "edge" };

const PRODUCTION_ORIGINS = [
  "https://sard.dev",
  "https://www.sard.dev",
];

const LOCAL_DEV_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:4173",
];

const SUPPORTED_MODELS = [
  "gemini-3.5-flash-lite",
  "gemini-2.5-flash-lite",
  "gemini-2.5-flash",
];

const MAX_PAYLOAD_BYTES = 32 * 1024; // 32 KB
const MAX_CONTENTS_LENGTH = 30;
const MAX_TOTAL_CHARS = 16000;
const MAX_SYSTEM_CHARS = 12000;

function isOriginAllowed(origin) {
  if (!origin) return false;
  if (PRODUCTION_ORIGINS.includes(origin)) return true;
  try {
    const url = new URL(origin);
    if (url.protocol === "https:" && (url.hostname.endsWith(".pages.dev") || url.hostname.endsWith(".vercel.app"))) {
      return true;
    }
  } catch {
    // invalid URL format
  }
  if (process.env.NODE_ENV !== "production" && LOCAL_DEV_ORIGINS.includes(origin)) {
    return true;
  }
  return false;
}

function validatePayload(body) {
  if (!body || typeof body !== "object") return false;
  const { contents, systemInstructionText } = body;

  if (!Array.isArray(contents) || contents.length === 0 || contents.length > MAX_CONTENTS_LENGTH) {
    return false;
  }

  let totalChars = 0;
  for (const item of contents) {
    if (!item || !Array.isArray(item.parts)) return false;
    for (const part of item.parts) {
      if (typeof part.text === "string") {
        totalChars += part.text.length;
      }
    }
  }

  if (totalChars > MAX_TOTAL_CHARS) {
    return false;
  }

  if (systemInstructionText !== undefined) {
    if (typeof systemInstructionText !== "string" || systemInstructionText.length > MAX_SYSTEM_CHARS) {
      return false;
    }
  }

  return true;
}

export default async function handler(req, env = (typeof globalThis !== 'undefined' && globalThis.__CF_ENV__) ? globalThis.__CF_ENV__ : {}) {
  const origin = req.headers.get("origin") || "";
  const clientIp = req.headers.get("cf-connecting-ip") || req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";

  if (!isOriginAllowed(origin)) {
    return new Response(JSON.stringify({ error: "Unauthorized origin" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const corsHeaders = {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin",
  };

  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Rate limit verification (HF-03: shared Postgres RPC, fails closed with 503 on store failure)
  try {
    const isAllowed = await checkChatRateLimit(clientIp);
    if (!isAllowed) {
      return new Response(
        JSON.stringify({ error: "Too many requests. Please wait a moment before sending another message." }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
  } catch (err) {
    console.warn(`[chat] rate_limit_store_unavailable: ${err.message}`);
    return new Response(
      JSON.stringify({ error: "Rate limit service temporarily unavailable. Chat protected against overage." }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Server-only secret. Read only GEMINI_API_KEY. Never read VITE_-prefixed variable.
  const apiKey = env.GEMINI_API_KEY || (typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '');
  if (!apiKey) {
    return new Response(
      JSON.stringify({ error: "Server AI proxy is pending server-side GEMINI_API_KEY configuration." }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  // Payload size cap: 32 KB
  const contentLength = parseInt(req.headers.get("content-length") || "0", 10);
  if (contentLength > MAX_PAYLOAD_BYTES) {
    return new Response(JSON.stringify({ error: "Payload too large" }), {
      status: 413,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let bodyText;
  try {
    bodyText = await req.text();
  } catch {
    return new Response(JSON.stringify({ error: "Failed to read request body" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (new Blob([bodyText]).size > MAX_PAYLOAD_BYTES) {
    return new Response(JSON.stringify({ error: "Payload too large" }), {
      status: 413,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let payload;
  try {
    payload = JSON.parse(bodyText);
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON format" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (!validatePayload(payload)) {
    return new Response(JSON.stringify({ error: "Invalid request payload" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { contents, systemInstructionText } = payload;

  for (const m of SUPPORTED_MODELS) {
    try {
      const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent`;
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents,
          systemInstruction: systemInstructionText ? { parts: [{ text: systemInstructionText }] } : undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        return new Response(JSON.stringify(data), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } catch {
      // Continue to next fallback model
    }
  }

  return new Response(JSON.stringify({ error: "AI service temporarily unavailable. Please try again later." }), {
    status: 502,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
