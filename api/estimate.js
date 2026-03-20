// api/estimate.js
// Runs the proxy revenue estimation model:
// Offline: stores × revenue_per_store
// Online:  reviews × units_per_review × avg_price
// Returns range with confidence intervals

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Anthropic API key not configured' });

  const { brand, assumptions } = req.body || {};
  if (!brand || !assumptions) return res.status(400).json({ error: 'Missing brand or assumptions' });

  const {
    storeCount,
    revenuePerStoreLow,
    revenuePerStoreHigh,
    onlineReviews,
    reviewsPerUnit,
    avgPrice,
    onlineChannels,
    storeTypes,
    industryContext,
  } = assumptions;

  const prompt = `You are a CFO-level financial analyst. Run a proxy revenue estimation model for "${brand}".

Input assumptions provided by user:
- Physical stores: ${storeCount ?? 'unknown'}
- Revenue per store range: ₹${revenuePerStoreLow ?? '?'}Cr – ₹${revenuePerStoreHigh ?? '?'}Cr per year
- Store types: ${storeTypes ?? 'not specified'}
- Total online reviews (across all platforms): ${onlineReviews ?? 'unknown'}
- Estimated units per review ratio: 1 review per ${reviewsPerUnit ?? '100'} units sold
- Average selling price: ₹${avgPrice ?? 'unknown'}
- Online channels: ${onlineChannels ?? 'website, Amazon, Flipkart'}
- Industry context: ${industryContext ?? 'Indian D2C brand'}

Run these calculations and add appropriate uncertainty ranges. Account for:
1. Store age mix (new stores earn 60-70% of mature store revenue)
2. Store type mix (EBO vs MBO vs shop-in-shop revenue differences)
3. Review accumulation lag (recent reviews are better signal than old ones)
4. D2C vs marketplace revenue differences
5. Return rates typical for this category

Return ONLY raw JSON, no markdown:
{
  "brand": "string",
  "estimatedRevenue": {
    "offlineMin": number_crores,
    "offlineMid": number_crores,
    "offlineMax": number_crores,
    "offlineMethod": "explanation of calculation",
    "onlineMin": number_crores_or_null,
    "onlineMid": number_crores_or_null,
    "onlineMax": number_crores_or_null,
    "onlineMethod": "explanation of calculation",
    "totalMin": number_crores,
    "totalMid": number_crores,
    "totalMax": number_crores
  },
  "confidence": "High / Medium / Low",
  "confidenceReason": "string",
  "keyAssumptions": ["assumption1", "assumption2", "assumption3"],
  "skewFactors": ["things that could make real revenue higher or lower"],
  "benchmarks": [
    { "reference": "comparable brand or data point", "revenue": "value", "context": "why relevant" }
  ],
  "analystNote": "2-3 sentence CFO-level commentary on the estimate quality and what to watch"
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
    if (s === -1 || e === -1) throw new Error('No JSON found');

    const result = JSON.parse(raw.slice(s, e + 1));
    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Estimation failed' });
  }
}
