// api/traffic.js — Haiku with short prompt to avoid rate limits

const MODEL = 'claude-haiku-4-5-20251001';

async function callClaude(apiKey, prompt) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 10000));
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({
        model: MODEL, max_tokens: 1000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });
    if (res.status === 429) { if (attempt === 2) throw new Error('Rate limit — wait 60s and retry'); continue; }
    if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const block = data.content?.find(b => b.type === 'text');
    if (!block) throw new Error('No text in response');
    return block.text;
  }
}

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
  const { brand, domain, industry, avgOrderValue } = req.body || {};
  if (!brand) return res.status(400).json({ error: 'Missing brand' });

  // Optional: Similarweb free rank API
  let rankNote = '';
  const swKey = process.env.SIMILARWEB_KEY;
  if (swKey && domain) {
    try {
      const swRes = await fetch(`https://api.similarweb.com/v1/website/${domain}/rank/rank?api_key=${swKey}`);
      if (swRes.ok) {
        const sw = await swRes.json();
        rankNote = `Similarweb global rank: ${sw.global_rank}, India rank: ${sw.country_rank}.`;
      }
    } catch {}
  }

  const prompt = `Research online sales velocity for "${brand}" (${domain || 'unknown domain'}, ${industry || 'ecommerce'}).
${rankNote}
${avgOrderValue ? `Average order value: ₹${avgOrderValue}` : ''}
Search: monthly website visitors (Similarweb public), Amazon/Flipkart reviews, app rating, published GMV.
Estimate: monthly visits → conversion rate → monthly orders → annual online revenue.

Return ONLY raw JSON:
{"brand":"${brand}","domain":"${domain || null}","webTraffic":{"monthlyVisits":null,"globalRank":null,"indiaRank":null,"source":"estimated","confidence":"Low"},"onlinePresence":{"hasApp":false,"appRating":null,"amazonPresence":false,"flipkartPresence":false,"amazonReviews":null,"instagramFollowers":null,"channels":[]},"salesVelocity":{"estimatedConversionRate":null,"estimatedMonthlyOrders":null,"estimatedMonthlyGMV":null,"estimatedAnnualOnlineRevenue":null,"avgOrderValue":null,"method":"string"},"publishedOnlineRevenue":{"value":null,"period":null,"source":null},"onlineShareOfTotal":null,"analystNote":"string"}`;

  try {
    const raw = await callClaude(apiKey, prompt);
    return res.status(200).json(parseJSON(raw));
  } catch (err) {
    const status = err.message.includes('Rate limit') ? 429 : 500;
    return res.status(status).json({ error: err.message });
  }
}
