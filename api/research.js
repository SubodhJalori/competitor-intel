// api/research.js
// Uses Claude with web_search to pull financial intelligence on ANY company
// Searches Tofler (Indian), SEC/Crunchbase (global), funding news, etc.

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'Anthropic API key not configured' });

  const { brand, industry = 'consumer / retail', country = 'India' } = req.body || {};
  if (!brand) return res.status(400).json({ error: 'Missing brand name' });

  const isIndian = country.toLowerCase().includes('india');

  const prompt = `You are a CFO-level financial analyst. Research the company "${brand}" (industry: ${industry}, country: ${country}).

Search these sources:
${isIndian ? `
- tofler.in — search "site:tofler.in ${brand}" for RoC filing data (revenue range, networth, growth)
- Entrackr.com, Inc42.com, YourStory.com — funding, revenue, profitability
- Tracxn.com — company profile and funding history  
- Economic Times, Business Standard, Moneycontrol — news and financial data
` : `
- Company investor relations / annual reports
- SEC EDGAR for US listed companies
- Crunchbase for funding history
- Bloomberg, Reuters, FT for financial news
`}
- Company website — store locator, about page, press releases
- LinkedIn — employee count
- Similarweb / Semrush public data — web traffic
- Amazon, Flipkart product pages — review counts
- Google Maps — store presence

Find: revenue (any year), growth rate, EBITDA, funding raised, store count, online channels, employee count, stated goals.

Return ONLY raw JSON:
{
  "brand": "string",
  "legalName": "registered name if different or null",
  "industry": "string",
  "country": "string",
  "domain": "website.com or null",
  "lastUpdated": "${new Date().toISOString().split('T')[0]}",
  "financials": {
    "latestRevenue": { "value": number_or_null, "currency": "INR Cr or USD M", "period": "FY25 etc", "source": "string", "confidence": "High/Medium/Low" },
    "previousRevenue": { "value": number_or_null, "currency": "string", "period": "string", "source": "string" },
    "revenueGrowth": number_percentage_or_null,
    "ebitdaMargin": number_percentage_or_null,
    "profitStatus": "Profitable/Loss-making/Break-even/Unknown",
    "burnRate": "string or null",
    "toflerRevenueRange": "e.g. ₹100-500 Cr or null"
  },
  "funding": {
    "totalRaised": { "value": number_or_null, "currency": "USD M or INR Cr" },
    "latestRound": { "type": "string", "amount": number_or_null, "currency": "USD M", "date": "string", "leadInvestor": "string or null" },
    "keyInvestors": ["string"],
    "valuation": { "value": number_or_null, "currency": "string", "asOf": "string" },
    "isPubliclyListed": false,
    "stockSymbol": null
  },
  "retail": {
    "totalStores": number_or_null,
    "storeTypes": "string",
    "citiesPresent": number_or_null,
    "countriesPresent": number_or_null,
    "expansionPlan": "string or null",
    "revenuePerStore": { "value": number_or_null, "currency": "INR Cr", "note": "string" }
  },
  "online": {
    "domain": "string or null",
    "channels": ["string"],
    "onlineShareOfRevenue": number_percentage_or_null,
    "monthlyWebTraffic": number_or_null,
    "websiteTrafficSource": "string",
    "amazonReviews": number_or_null
  },
  "employees": {
    "count": number_or_null,
    "growth": "string",
    "source": "string"
  },
  "recentNews": [
    { "headline": "string", "date": "Mon YYYY", "significance": "string" }
  ],
  "statedGoals": "string or null",
  "dataGaps": ["string"],
  "analystNote": "2-3 sentence CFO-level synthesis",
  "dataQuality": "Good/Fair/Limited"
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
        max_tokens: 3000,
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
    return res.status(500).json({ error: err.message || 'Research failed' });
  }
}
