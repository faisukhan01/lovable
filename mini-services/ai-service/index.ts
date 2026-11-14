/**
 * Lovify AI Service — the Z.AI brain of the whole platform.
 *
 * Wraps z-ai-web-dev-sdk (backend-only) behind a small HTTP API that the
 * FastAPI main backend calls. Every AI feature of Lovify flows through here:
 *   - Full app generation (create mode)
 *   - Iterative app editing (edit mode)
 *   - General chat (assistant features)
 *
 * Port: 8001 (reached by FastAPI over localhost, by the browser via gateway)
 */

import ZAI from 'z-ai-web-dev-sdk';

const PORT = 8001;

/* ------------------------------------------------------------------ */
/*  Prompt engineering — what makes Lovify better than the rest       */
/* ------------------------------------------------------------------ */

const APP_BUILDER_SYSTEM = `You are Lovify AI — an elite full-stack product engineer and world-class UI designer, powered by Z.AI. You turn natural-language ideas into complete, stunning, fully-working web applications in a single shot.

## OUTPUT FORMAT (STRICT)
You ALWAYS respond with EXACTLY this structure and nothing else — no markdown fences, no text before or after:

<LOVIFY_META>
{"name": "Short App Name", "description": "One compelling sentence about the app", "summary": "1-3 friendly sentences describing what you built / changed, written to the user"}
</LOVIFY_META>
<LOVIFY_HTML>
<!DOCTYPE html>
...the complete HTML document...
</LOVIFY_HTML>

## DESIGN PHILOSOPHY (this is what makes you elite)
- Awwwards-level aesthetics: sophisticated palette, generous whitespace, strong typographic hierarchy, visual rhythm.
- Load Tailwind via <script src="https://cdn.tailwindcss.com"></script> and extend tailwind.config inline with a custom brand palette + font.
- Load 1-2 Google Fonts that fit the vibe (Space Grotesk, Sora, Inter, Playfair Display, JetBrains Mono...). Never rely on system fonts alone.
- Icons via <script src="https://unpkg.com/lucide@latest"></script> + lucide.createIcons() using <i data-lucide="name"></i>.
- Dark-mode-first looks premium: deep neutral backgrounds (zinc-950 style), vivid gradient accents (champagne gold, amber, orange, rose, fuchsia — avoid generic blue), subtle 1px borders (white/10), glassmorphism (backdrop-blur), rounded-2xl, layered shadows, gradient text for headlines.
- Micro-interactions everywhere: hover lifts, smooth 200ms transitions, fade-in keyframes, animated counters, pulsing highlights.
- Light themes are allowed when the request suits it — always keep the same level of polish.

## ENGINEERING RULES
- ONE self-contained HTML file. All CSS/JS inline; CDNs allowed; no build steps.
- Vanilla ES6+ JavaScript, clean and organized (state, render, events sections). No frameworks, no imports.
- Every interactive element must genuinely work: buttons, forms, filters, tabs, modals, drag interactions, keyboard shortcuts.
- Persist app state in localStorage when it makes sense (todos, notes, scores, settings, cart...). Wrap ALL localStorage access in try/catch so nothing breaks in sandboxed previews.
- No external paid APIs, no API keys, no network calls other than the allowed CDNs/fonts.
- If the app would look empty on first load, seed beautiful realistic demo data (never "lorem ipsum" placeholders).
- Escape any user-entered content when rendering it to avoid XSS.
- Responsive: flawless on mobile and desktop. Accessible: aria-labels, focus states, semantic HTML.
- Always finish the file: close every tag and end with </html>. Keep it complete and compact — target under ~1000 lines, never truncate content mid-way.

## EDIT MODE
When you receive an existing app (current HTML) plus a change request:
- Output the COMPLETE updated HTML file with the changes applied.
- Preserve everything that already works and keep the same design language unless asked to redesign.
- The "summary" field briefly tells the user exactly what you changed.`;

const CHAT_SYSTEM = `You are Lovify Assistant, the friendly AI copilot of the Lovify app-building platform, powered by Z.AI.
You help users with product ideas, app brainstorming, feature planning and platform questions.
Be concise, warm and practical. When users describe an app idea, suggest a sharp feature set and encourage them to hit "Build".`;

/* ------------------------------------------------------------------ */
/*  SDK bootstrap                                                     */
/* ------------------------------------------------------------------ */

let zaiPromise: Promise<any> | null = null;
function getZAI() {
  if (!zaiPromise) zaiPromise = ZAI.create();
  return zaiPromise;
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/* ------------------------------------------------------------------ */
/*  Core completion with retries                                      */
/* ------------------------------------------------------------------ */

function isAuthError(err: any): boolean {
  const msg = String(err?.message || err || '');
  return (
    msg.includes('X-Token') ||
    msg.includes('status 401') ||
    msg.includes('Configuration file not found')
  );
}

async function complete(messages: any[], retries = 2, maxTokens = 16000): Promise<string> {
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const zai = await getZAI();
      const completion = await zai.chat.completions.create({
        messages,
        thinking: { type: 'disabled' },
        max_tokens: maxTokens,
      });
      const content = completion?.choices?.[0]?.message?.content;
      if (!content || String(content).trim().length === 0) {
        throw new Error('Empty response from model');
      }
      return String(content);
    } catch (err: any) {
      lastError = err;
      console.error(`[ai-service] attempt ${attempt + 1} failed:`, err?.message || err);
      /* The SDK caches its credentials the first time it is created. If the
         platform credentials get refreshed (e.g. /etc/.z-ai-config re-issued
         after boot), the cached client keeps calling without a valid
         X-Token — drop the cache so the next attempt re-reads the config. */
      if (isAuthError(err)) {
        console.log('[ai-service] auth failure — re-reading Z.AI credentials');
        zaiPromise = null;
      }
      if (attempt < retries) {
        await new Promise((r) => setTimeout(r, 1200 * (attempt + 1)));
      }
    }
  }
  throw lastError;
}

/* ------------------------------------------------------------------ */
/*  Routes                                                            */
/* ------------------------------------------------------------------ */

Bun.serve({
  port: PORT,
  idleTimeout: 255,
  async fetch(req) {
    const url = new URL(req.url);

    if (url.pathname === '/health') {
      return json({ status: 'ok', service: 'lovify-ai-service', brain: 'Z.AI' });
    }

    /* -------- App generation / editing (used by FastAPI backend) ---- */
    if (url.pathname === '/generate' && req.method === 'POST') {
      try {
        const body = await req.json();
        const mode: 'create' | 'edit' = body.mode === 'edit' ? 'edit' : 'create';
        const prompt: string = String(body.prompt || '').slice(0, 8000);
        const currentHtml: string | undefined = body.currentHtml;
        const history: { role: string; content: string }[] = Array.isArray(body.history)
          ? body.history.slice(-8)
          : [];

        const messages: any[] = [{ role: 'assistant', content: APP_BUILDER_SYSTEM }];

        for (const h of history) {
          if (!h?.content) continue;
          messages.push({ role: h.role === 'assistant' ? 'assistant' : 'user', content: String(h.content).slice(0, 2000) });
        }

        if (mode === 'edit' && currentHtml) {
          messages.push({
            role: 'user',
            content: `Here is the CURRENT app (complete HTML):\n\n<CURRENT_APP>\n${currentHtml.slice(0, 120000)}\n</CURRENT_APP>\n\nChange request: ${prompt}\n\nApply the change and output the complete updated app in the required format.`,
          });
        } else {
          messages.push({
            role: 'user',
            content: `Build a complete, stunning, fully-working web app for this request:\n\n${prompt}\n\nRespond in the required Lovify format.`,
          });
        }

        const raw = await complete(messages);
        // Auto-recovery: if the file got cut off by token limits, ask the
        // model once to regenerate a compact but COMPLETE version.
        const htmlStart = raw.toLowerCase().indexOf('<!doctype');
        const looksTruncated = htmlStart !== -1 && !raw.toLowerCase().includes('</html>', htmlStart);
        if (looksTruncated) {
          console.log('[ai-service] output truncated — retrying with compaction instruction');
          messages.push({ role: 'assistant', content: raw.slice(-2000) });
          messages.push({
            role: 'user',
            content:
              'Your previous output was CUT OFF before finishing the HTML file. Regenerate the ENTIRE app in the required Lovify format, this time writing tighter code: minify CSS/JS whitespace, drop comments, shorten copy — but keep EVERY feature, screen and interaction, and always close all tags ending with </html>.',
          });
          const raw2 = await complete(messages, 1);
          if (raw2.toLowerCase().includes('</html>')) {
            return json({ ok: true, raw: raw2 });
          }
          return json(
            {
              ok: false,
              error: 'The app was too large and got truncated. Try a more focused request, or ask for a simpler version.',
            },
            502
          );
        }
        return json({ ok: true, raw });
      } catch (err: any) {
        console.error('[ai-service] /generate error:', err?.message || err);
        return json({ ok: false, error: String(err?.message || 'generation failed') }, 502);
      }
    }

    /* -------- Generic chat (assistant / future features) ------------ */
    if (url.pathname === '/chat' && req.method === 'POST') {
      try {
        const body = await req.json();
        const prompt = String(body.prompt || '').slice(0, 8000);
        const system = body.system ? String(body.system).slice(0, 4000) : CHAT_SYSTEM;
        const history: { role: string; content: string }[] = Array.isArray(body.history)
          ? body.history.slice(-12)
          : [];

        const messages = [
          { role: 'assistant', content: system },
          ...history.map((h) => ({ role: h.role === 'assistant' ? 'assistant' : 'user', content: String(h.content).slice(0, 4000) })),
          { role: 'user', content: prompt },
        ];
        const raw = await complete(messages);
        return json({ ok: true, raw });
      } catch (err: any) {
        return json({ ok: false, error: String(err?.message || 'chat failed') }, 502);
      }
    }

    return json({ error: 'Not found' }, 404);
  },
});

console.log(`[ai-service] Lovify Z.AI brain listening on http://localhost:${PORT}`);
