// api/estimate.js — Haiku with short prompt to avoid rate limits

const MODEL = 'claude-haiku-4-5-20251001';

function parseJSON(raw) {
  const text = raw.trim().replace(/^```json\s*/i,'').replace(/^```\s*/i,'').replace(/```\s*$/i,'').trim();
  const s = text.indexOf('{'), e = text.lastIndexOf('}');
  if (s === -1 || e === -1) throw new Error('No JSON in response');
  return JSON.parse(text.slice(s, e + 1));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured' });
  const { brand, assumptions } = req.body || {};
  if (!brand || !assumptions) return res.status(400).json({ error: 'Missing brand or assumptions' });

  const { storeCount, revenuePerStoreLow, revenuePerStoreHigh, onlineReviews,
          reviewsPerUnit, avgPrice, onlineChannels, storeTypes, industryContext } = assumptions;

  const prompt = `Revenue estimation model for "${brand}" (${industryContext || 'retail'}).

Inputs:
- Stores: ${storeCount ?? 'unknown'}, types: ${storeTypes ?? 'EBO'}
- Revenue/store range: ₹${revenuePerStoreLow ?? '?'}–${revenuePerStoreHigh ?? '?'} Cr/year
- Online reviews total: ${onlineReviews ?? 'unknown'}
- Units per review: 1:${reviewsPerUnit ?? 100}
- Avg price: ₹${avgPrice ?? 'unknown'}
- Channels: ${onlineChannels ?? 'website, Amazon, Flipkart'}

Calculate offline revenue (stores × rev/store, adjust for store age mix) and online revenue (reviews ÷ units_per_review × price). Apply typical return rates. Show range.

Return ONLY raw JSON:
{"brand":"${brand}","estimatedRevenue":{"offlineMin":null,"offlineMid":null,"offlineMax":null,"offlineMethod":"string","onlineMin":null,"onlineMid":null,"onlineMax":null,"onlineMethod":"string","totalMin":null,"totalMid":null,"totalMax":null},"confidence":"Medium","confidenceReason":"string","keyAssumptions":["string"],"skewFactors":["string"],"benchmarks":[{"reference":"string","revenue":"string","context":"string"}],"analystNote":"string"}`;

  try {
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 10000));
      const res2 = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
        body: JSON.stringify({ model: MODEL, max_tokens: 800, messages: [{ role: 'user', content: prompt }] }),
      });
      if (res2.status === 429) { if (attempt === 2) throw new Error('Rate limit — wait 60s and retry'); continue; }
      if (!res2.ok) throw new Error(`API ${res2.status}: ${await res2.text()}`);
      const data = await res2.json();
      const block = data.content?.find(b => b.type === 'text');
      if (!block) throw new Error('No text in response');
      return res.status(200).json(parseJSON(block.text));
    }
  } catch (err) {
    const status = err.message.includes('Rate limit') ? 429 : 500;
    return res.status(status).json({ error: err.message });
  }
}
