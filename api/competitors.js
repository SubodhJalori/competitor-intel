// api/competitors.js
// Discovers the top competitors for any brand using Claude + web search
// Returns structured competitor cards with key differentiators

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Anthropic API key not configured' });

  const { brand, industry, country = 'India' } = req.body || {};
  if (!brand) return res.status(400).json({ error: 'Missing brand name' });

  const prompt = `You are a strategy consultant and competitive intelligence analyst.

Identify the top 8 competitors for "${brand}" (industry: ${industry || 'consumer brand'}, country: ${country}).

Search for:
1. Direct competitors — same product category, same price range, same customer
2. Indirect competitors — adjacent categories that compete for the same wallet
3. For each competitor, find: approximate revenue, funding, store count, website domain, what makes them different

Think about this carefully. For example:
- If brand is "Traya Health" (hair care D2C India) → competitors include: Mamaearth (hair range), Wow Skin Science, Pilgrim, The Derma Co, Minimalist, mCaffeine, Beardo, Just Herbs
- If brand is "Mokobara" (luggage D2C India) → competitors include: Uppercase, Nasher Miles, Wildcraft, Safari Industries, American Tourister, Skybags, Beetle
- If brand is "Zomato" (food delivery India) → competitors include: Swiggy, Blinkit, Zepto, Dunzo, Magicpin

Return ONLY raw JSON, no markdown:
{
  "brand": "string",
  "industry": "string",
  "competitorLandscape": "1-2 sentence description of the competitive landscape",
  "competitors": [
    {
      "name": "Brand name",
      "domain": "website.com or null",
      "country": "string",
      "type": "Direct / Indirect / Emerging",
      "positioning": "e.g. Mass market / Premium / Niche D2C",
      "estimatedRevenue": "e.g. ₹200-400 Cr or Unknown",
      "estimatedFunding": "e.g. $15M or Bootstrapped or Listed or Unknown",
      "storeCount": number_or_null,
      "keyDifferentiator": "1 sentence — what makes them different from ${brand}",
      "threat": "High / Medium / Low",
      "threatReason": "1 sentence why"
    }
  ]
}`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const data = await response.json();
    const textBlock = data.content?.find(b => b.type === 'text');
    if (!textBlock) return res.status(500).json({ error: 'No text in response' });

    const raw = textBlock.text.trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    if (s === -1 || e === -1) throw new Error('No JSON in response');

    return res.status(200).json(JSON.parse(raw.slice(s, e + 1)));
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Competitor discovery failed' });
  }
}
