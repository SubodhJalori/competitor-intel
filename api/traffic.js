// api/traffic.js
// Combines Similarweb DigitalRank API (free) + Claude analysis
// to estimate website traffic and online revenue velocity for any brand

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey    = process.env.ANTHROPIC_API_KEY;
  const swKey     = process.env.SIMILARWEB_KEY; // optional — DigitalRank is free but needs key
  if (!apiKey) return res.status(500).json({ error: 'Anthropic API key not configured' });

  const { brand, domain, industry, avgOrderValue } = req.body || {};
  if (!brand) return res.status(400).json({ error: 'Missing brand name' });

  let rankData = null;
  let trafficData = null;

  // Step 1 — Try Similarweb DigitalRank API if key provided (free, 100 calls/month)
  if (swKey && domain) {
    try {
      const swRes = await fetch(
        `https://api.similarweb.com/v1/website/${domain}/rank/rank?api_key=${swKey}`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (swRes.ok) {
        const swData = await swRes.json();
        rankData = {
          globalRank:  swData.global_rank  || null,
          countryRank: swData.country_rank || null,
          country:     swData.country      || 'IN',
        };
      }
    } catch { /* proceed without rank data */ }
  }

  // Step 2 — Claude web search to find traffic + estimate online sales velocity
  const prompt = `You are a digital commerce analyst. Research the online presence and sales velocity of "${brand}" (domain: ${domain || 'unknown'}, industry: ${industry || 'retail/ecommerce'}).

${rankData ? `Similarweb data: Global rank ${rankData.globalRank}, Country rank ${rankData.countryRank}` : ''}
${avgOrderValue ? `Average order value: ₹${avgOrderValue}` : ''}

Search for:
1. Monthly website visitors (from Similarweb public data, Semrush, or any public source)
2. App downloads / ratings if they have an app
3. Amazon/Flipkart seller rating and review count
4. Social media following (Instagram, Facebook) as proxy for brand awareness
5. Any published GMV or online revenue figures
6. Online vs offline revenue split if known

Use the traffic data to estimate:
- Monthly website visits
- Estimated conversion rate for this category (typical D2C ecommerce: 1.5-3%)
- Estimated monthly online orders
- Estimated monthly online GMV
- Annualised online revenue estimate

Return ONLY raw JSON, no markdown:
{
  "brand": "string",
  "domain": "string or null",
  "webTraffic": {
    "monthlyVisits": number_or_null,
    "globalRank": number_or_null,
    "indiaRank": number_or_null,
    "source": "Similarweb / Semrush / estimated",
    "confidence": "High / Medium / Low"
  },
  "onlinePresence": {
    "hasApp": boolean,
    "appRating": number_or_null,
    "amazonPresence": boolean,
    "flipkartPresence": boolean,
    "amazonReviews": number_or_null,
    "instagramFollowers": number_or_null,
    "channels": ["list of sales channels"]
  },
  "salesVelocity": {
    "estimatedConversionRate": number_percentage,
    "estimatedMonthlyOrders": number_or_null,
    "estimatedMonthlyGMV": number_INR_or_null,
    "estimatedAnnualOnlineRevenue": number_crores_or_null,
    "avgOrderValue": number_INR_or_null,
    "method": "explanation of how estimate was calculated"
  },
  "publishedOnlineRevenue": {
    "value": number_crores_or_null,
    "period": "string",
    "source": "string"
  },
  "onlineShareOfTotal": number_percentage_or_null,
  "analystNote": "2 sentence assessment of online sales velocity and growth trajectory"
}`;

  try {
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      return res.status(claudeRes.status).json({ error: err });
    }

    const claudeData = await claudeRes.json();
    const textBlock = claudeData.content?.find(b => b.type === 'text');
    if (!textBlock) return res.status(500).json({ error: 'No text in response' });

    const raw = textBlock.text.trim()
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '').trim();
    const s = raw.indexOf('{'), e = raw.lastIndexOf('}');
    if (s === -1 || e === -1) throw new Error('No JSON in response');

    const result = JSON.parse(raw.slice(s, e + 1));
    // Merge in rank data if we got it from Similarweb API
    if (rankData && result.webTraffic) {
      result.webTraffic.globalRank  = result.webTraffic.globalRank  || rankData.globalRank;
      result.webTraffic.indiaRank   = result.webTraffic.indiaRank   || rankData.countryRank;
    }

    return res.status(200).json(result);
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Traffic analysis failed' });
  }
}
