/// <reference lib="deno.ns" />
// Supabase Edge Function `ai` (Deno). Actions: listing, price, receipt.
// Verifies the caller's JWT and business membership, enforces a daily cap, then calls the Anthropic Messages API
// with the ANTHROPIC_API_KEY secret (never sent to the app). See docs/AI.md.
import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  AI_MODEL,
  validateListingResult,
  validatePriceResult,
  validateReceiptResult,
  validateRequest,
} from '../_shared/ai.ts';
import type { AiListingInput, AiPriceInput, AiReceiptInput } from '../_shared/ai.ts';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
const err = (status: number, message: string) => json(status, { error: message });

const DEFAULT_CAP = 50;
const SIGNED_URL_SECONDS = 300;

// ---- Tool schemas (force structured output) --------------------------------------------------------------------

const LISTING_TOOL = {
  name: 'submit_listing',
  description: 'Submit the finished eBay Australia listing.',
  input_schema: {
    type: 'object',
    properties: {
      title: { type: 'string', description: 'At most 80 characters. Normal capitalisation, no ALL CAPS, no filler.' },
      description: { type: 'string', description: 'Plain text, no HTML or markdown. Line breaks allowed.' },
      keywords: { type: 'array', items: { type: 'string' }, description: '5 to 15 search keywords.' },
    },
    required: ['title', 'description', 'keywords'],
  },
};

const PRICE_TOOL = {
  name: 'submit_price',
  description: 'Submit the suggested listing price range in AUD.',
  input_schema: {
    type: 'object',
    properties: {
      low: { type: 'number' },
      high: { type: 'number' },
      suggested: { type: 'number', description: 'Between low and high.' },
      reasoning: { type: 'string', description: 'One to three short sentences.' },
    },
    required: ['low', 'high', 'suggested', 'reasoning'],
  },
};

const RECEIPT_TOOL = {
  name: 'submit_receipt',
  description: 'Submit what was read from the receipt.',
  input_schema: {
    type: 'object',
    properties: {
      shop: { type: 'string', description: 'Shop name as printed. Omit if unclear.' },
      date: { type: 'string', description: 'YYYY-MM-DD. Omit if unclear. Australian receipts are day/month/year.' },
      total: { type: 'number', description: 'Total paid in AUD. Omit if unclear.' },
      lines: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            description: { type: 'string' },
            qty: { type: 'integer', minimum: 1 },
            price: { type: 'number', description: 'Line total in AUD (qty times unit price), not the unit price.' },
          },
          required: ['description', 'qty', 'price'],
        },
      },
    },
    required: ['lines'],
  },
};

// ---- Anthropic -------------------------------------------------------------------------------------------------

type Block = { type: 'text'; text: string } | { type: 'image'; source: { type: 'url'; url: string } };

class UpstreamError extends Error {}

async function callClaude(
  tool: { name: string; description: string; input_schema: unknown },
  system: string,
  content: Block[],
): Promise<unknown> {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) throw new UpstreamError('missing key');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: AI_MODEL,
      max_tokens: 2000,
      system,
      tools: [tool],
      tool_choice: { type: 'tool', name: tool.name },
      messages: [{ role: 'user', content }],
    }),
  });
  if (!res.ok) {
    console.error('anthropic error', res.status, (await res.text()).slice(0, 500));
    throw new UpstreamError(`status ${res.status}`);
  }
  const data = await res.json();
  const block = (data.content ?? []).find((b: { type: string }) => b.type === 'tool_use');
  if (!block) throw new UpstreamError('no tool_use');
  return block.input;
}

// ---- Actions ---------------------------------------------------------------------------------------------------

const LISTING_SYSTEM =
  'You write eBay Australia listings for a secondhand clothing seller. Use Australian spelling (colour, grey). ' +
  'Title: at most 80 characters, normal capitalisation (not ALL CAPS), most searched words first: brand, item type, ' +
  'size, colour, style, then material or season. No filler like "L@@K" or "BEAUTIFUL". ' +
  'Description: plain text, keyword-rich but natural, describe what is visible (colour, fabric, cut, details). ' +
  'Do not invent measurements, fabric content or flaws you cannot see. End with a short checklist of placeholders in ' +
  'square brackets for the seller to check, e.g. [Size: confirm], [Brand: confirm], [Condition: describe any wear or flaws], ' +
  '[Measurements: pit to pit / length]. Mention the seller-supplied details when given.';

async function doListing(input: AiListingInput, urls: string[]) {
  const facts = [
    input.brand && `Brand: ${input.brand}`,
    input.itemType && `Item type: ${input.itemType}`,
    input.department && `Department: ${input.department}`,
    input.size && `Size: ${input.size}`,
    input.notes && `Seller notes: ${input.notes}`,
  ].filter(Boolean).join('\n');
  const content: Block[] = [];
  urls.forEach((url, i) => {
    content.push({ type: 'text', text: `Photo ${i + 1}:` }, { type: 'image', source: { type: 'url', url } });
  });
  content.push({
    type: 'text',
    text: `Write the listing for this item.\n${facts || '(No details supplied, work from the photos.)'}`,
  });
  return validateListingResult(await callClaude(LISTING_TOOL, LISTING_SYSTEM, content));
}

const PRICE_SYSTEM =
  'You suggest eBay Australia listing prices in AUD for secondhand clothing. You are given the seller\'s own past ' +
  'sales of similar items (sale price and days to sell). Anchor on those; if there are none or few, say so and be ' +
  'cautious, using general knowledge of the brand and item type. Prices that sold slowly suggest a lower price. ' +
  'low <= suggested <= high. Reasoning: one to three plain sentences, mention how many of her sales you used.';

async function doPrice(input: AiPriceInput) {
  const it = input.item;
  const comps = input.comparables.length
    ? input.comparables
        .map((c, i) => `${i + 1}. ${c.title || `${c.brand} ${c.itemType}`} | ${c.brand} | ${c.itemType} | size ${c.size} | sold $${c.salePrice} | ${c.daysToSell} days to sell`)
        .join('\n')
    : '(none)';
  const text =
    `Item: ${it.title ?? ''}\nBrand: ${it.brand}\nType: ${it.itemType}\nDepartment: ${it.department}\nSize: ${it.size}\n\n` +
    `Seller's own comparable sales:\n${comps}`;
  return validatePriceResult(await callClaude(PRICE_TOOL, PRICE_SYSTEM, [{ type: 'text', text }]));
}

const RECEIPT_SYSTEM =
  'You read shop receipts from Australian op shops and retailers. Extract the shop name, date (as YYYY-MM-DD; ' +
  'Australian day/month/year), the total paid in AUD, and each purchased line with quantity and the LINE TOTAL ' +
  '(qty x unit price). Skip subtotals, GST, change, tender and discount-summary rows, unless a discount is a line ' +
  'that reduces the price of an item (then fold it into that line). Leave out anything you cannot read rather than guessing.';

async function doReceipt(url: string) {
  return validateReceiptResult(
    await callClaude(RECEIPT_TOOL, RECEIPT_SYSTEM, [
      { type: 'image', source: { type: 'url', url } },
      { type: 'text', text: 'Read this receipt.' },
    ]),
  );
}

// ---- Handler ---------------------------------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return err(405, 'Use POST.');

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) return err(401, 'Please sign in again.');

    const url = Deno.env.get('SUPABASE_URL')!;
    const userClient = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return err(401, 'Please sign in again.');

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return err(422, 'That request was not understood.');
    }
    const parsed = validateRequest(body);
    if (!parsed.ok) return err(422, parsed.error);
    const request = parsed.value;

    const { data: member, error: memErr } = await userClient.rpc('is_member', { bid: request.businessId });
    if (memErr) {
      console.error('is_member failed', memErr.message);
      return err(500, 'Something went wrong. Please try again.');
    }
    if (member !== true) return err(403, "You don't have access to this business.");

    const admin = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

    const cap = Number.parseInt(Deno.env.get('AI_DAILY_CAP') ?? '', 10) || DEFAULT_CAP;
    const { error: capErr } = await admin.rpc('ai_take_call', { p_business_id: request.businessId, p_cap: cap });
    if (capErr) {
      if (capErr.message.includes('ai_daily_cap_reached')) {
        return err(429, `You've used all ${cap} AI helpers for today. They reset tomorrow.`);
      }
      console.error('ai_take_call failed', capErr.message);
      return err(500, 'Something went wrong. Please try again.');
    }

    const paths = request.action === 'listing' ? request.photoPaths : request.action === 'receipt' ? [request.receiptPath] : [];
    let urls: string[] = [];
    if (paths.length) {
      const { data: signed, error: signErr } = await admin.storage.from('photos').createSignedUrls(paths, SIGNED_URL_SECONDS);
      if (signErr || !signed || signed.some((s) => !s.signedUrl || s.error)) {
        return err(422, "Couldn't find one of the photos. Check it has finished uploading.");
      }
      urls = signed.map((s) => s.signedUrl as string);
    }

    const result =
      request.action === 'listing'
        ? await doListing(request, urls)
        : request.action === 'price'
          ? await doPrice(request)
          : await doReceipt(urls[0]);

    if (!result.ok) return err(422, `The AI answer wasn't usable (${result.error}). Please try again.`);
    return json(200, result.value);
  } catch (e) {
    console.error('ai function error', e instanceof Error ? e.message : e);
    if (e instanceof UpstreamError) return err(500, 'The AI helper is not available right now. Please try again in a minute.');
    return err(500, 'Something went wrong. Please try again.');
  }
});
