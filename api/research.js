// api/research.js — uses Haiku with short prompts to stay under rate limits

const MODEL = 'claude-haiku-4-5-20251001';

async function callClaude(apiKey, prompt, useSearch = true) {
  for (let attempt = 0; attempt < 3; attempt++) {
    if (attempt > 0) await new Promise(r => setTimeout(r, attempt * 10000));
    const body = {
      model: MODEL, max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }],
    };
    if (useSearch) body.tools = [{ type: 'web_search_20250305', name: 'web_search' }];
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify(body),
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
  const { brand, industry = 'retail', country = 'India' } = req.body || {};
  if (!brand) return res.status(400).json({ error: 'Missing brand' });

  const isIndian = country.toLowerCase().includes('india');
  const today = new Date().toISOString().split('T')[0];

  const prompt = `Research "${brand}" (${industry}, ${country}). Search these sources:
${isIndian ? '- tofler.in (RoC revenue range)\n- Entrackr, Inc42, YourStory (funding/revenue)\n- Economic Times, Moneycontrol' : '- Company IR page / annual report\n- Crunchbase (funding)\n- SEC Edgar if US listed'}
- Brand website (store count, press releases)
- LinkedIn (employee count)

Return ONLY raw JSON, no markdown, filling every field you find (null if unknown):
{"brand":"${brand}","legalName":null,"industry":"${industry}","country":"${country}","domain":null,"lastUpdated":"${today}","financials":{"latestRevenue":{"value":null,"currency":"INR Cr","period":null,"source":null,"confidence":"Low"},"previousRevenue":{"value":null,"currency":"INR Cr","period":null,"source":null},"revenueGrowth":null,"ebitdaMargin":null,"profitStatus":"Unknown","burnRate":null,"toflerRevenueRange":null},"funding":{"totalRaised":{"value":null,"currency":"USD M"},"latestRound":{"type":null,"amount":null,"currency":"USD M","date":null,"leadInvestor":null},"keyInvestors":[],"valuation":{"value":null,"currency":"USD M","asOf":null},"isPubliclyListed":false,"stockSymbol":null},"retail":{"totalStores":null,"storeTypes":null,"citiesPresent":null,"countriesPresent":null,"expansionPlan":null,"revenuePerStore":{"value":null,"currency":"INR Cr","note":null}},"online":{"domain":null,"channels":[],"onlineShareOfRevenue":null,"monthlyWebTraffic":null,"websiteTrafficSource":null,"amazonReviews":null},"employees":{"count":null,"growth":null,"source":null},"recentNews":[],"statedGoals":null,"dataGaps":[],"analystNote":null,"dataQuality":"Limited"}`;

  try {
    const raw = await callClaude(apiKey, prompt, true);
    return res.status(200).json(parseJSON(raw));
  } catch (err) {
    const status = err.message.includes('Rate limit') ? 429 : 500;
    return res.status(status).json({ error: err.message });
  }
}
