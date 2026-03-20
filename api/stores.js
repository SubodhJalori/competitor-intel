// api/stores.js
// Uses TomTom Search API (free - 50,000 calls/day) to count brand store locations
// Falls back to OpenStreetMap Nominatim (completely free, no key) if TomTom key not set
// TomTom key: sign up free at developer.tomtom.com

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const tomtomKey = process.env.TOMTOM_KEY;
  const { brand, country = 'India', maxPages = 3 } = req.body || {};
  if (!brand) return res.status(400).json({ error: 'Missing brand name' });

  // Country bounding boxes for better results
  const COUNTRY_BOUNDS = {
    'India':       { lat: 20.5937, lon: 78.9629, radius: 2000000 },
    'USA':         { lat: 37.0902, lon: -95.7129, radius: 3000000 },
    'UK':          { lat: 55.3781, lon: -3.4360,  radius: 600000  },
    'UAE':         { lat: 23.4241, lon: 53.8478,  radius: 400000  },
    'Singapore':   { lat: 1.3521,  lon: 103.8198, radius: 30000   },
  };

  const bounds = COUNTRY_BOUNDS[country] || COUNTRY_BOUNDS['India'];

  try {
    let stores = [];
    let source = '';

    if (tomtomKey) {
      // ── TomTom Fuzzy Search API (free 50K/day) ──
      // Search for brand POIs within country radius
      source = 'TomTom';
      const pages = Math.min(maxPages, 5);
      const pageSize = 20;

      for (let page = 0; page < pages; page++) {
        const url = new URL('https://api.tomtom.com/search/2/poiSearch/' + encodeURIComponent(brand) + '.json');
        url.searchParams.set('key',        tomtomKey);
        url.searchParams.set('limit',      pageSize);
        url.searchParams.set('offset',     page * pageSize);
        url.searchParams.set('lat',        bounds.lat);
        url.searchParams.set('lon',        bounds.lon);
        url.searchParams.set('radius',     bounds.radius);
        url.searchParams.set('countrySet', country === 'India' ? 'IN' : country === 'USA' ? 'US' : country === 'UK' ? 'GB' : country === 'UAE' ? 'AE' : 'IN');
        url.searchParams.set('language',   'en-GB');

        const response = await fetch(url.toString());
        if (!response.ok) {
          // If key is wrong, fall through to Nominatim
          break;
        }

        const data = await response.json();
        const results = data.results || [];
        if (results.length === 0) break;

        stores.push(...results.map(r => ({
          name:    r.poi?.name || brand,
          address: [r.address?.streetName, r.address?.municipality, r.address?.countrySubdivision].filter(Boolean).join(', '),
          city:    r.address?.municipality || r.address?.localName || '',
          state:   r.address?.countrySubdivision || '',
          lat:     r.position?.lat,
          lon:     r.position?.lon,
        })));

        if (results.length < pageSize) break; // no more pages
      }
    }

    // ── Fallback: OpenStreetMap Nominatim (no key, completely free) ──
    // NOTE: Nominatim has 1 req/sec limit and is better for address lookup than brand search
    // For brand search without TomTom, we use it with the brand name as a query
    if (stores.length === 0) {
      source = 'OpenStreetMap Nominatim';
      const countryCode = country === 'India' ? 'in' : country === 'USA' ? 'us' : country === 'UK' ? 'gb' : country === 'UAE' ? 'ae' : 'in';

      const url = `https://nominatim.openstreetmap.org/search?` + new URLSearchParams({
        q:              brand,
        format:         'json',
        countrycodes:   countryCode,
        limit:          50,
        addressdetails: 1,
      });

      const response = await fetch(url, {
        headers: { 'User-Agent': 'CompetitorIntelTool/1.0' }, // Nominatim requires User-Agent
      });

      if (response.ok) {
        const data = await response.json();
        stores = data.map(r => ({
          name:    r.display_name?.split(',')[0] || brand,
          address: r.display_name || '',
          city:    r.address?.city || r.address?.town || r.address?.village || '',
          state:   r.address?.state || '',
          lat:     r.lat,
          lon:     r.lon,
        }));
      }
    }

    // Deduplicate by address
    const seen = new Set();
    const unique = stores.filter(s => {
      const key = s.address?.slice(0, 40);
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Extract cities
    const cities = [...new Set(unique.map(s => s.city).filter(Boolean))];
    const states = [...new Set(unique.map(s => s.state).filter(Boolean))];

    return res.status(200).json({
      brand,
      country,
      source,
      totalStores:      unique.length,
      estimatedTotal:   unique.length >= (maxPages * 20) ? `${unique.length}+` : String(unique.length),
      cities:           cities.slice(0, 25),
      states:           states.slice(0, 15),
      cityCount:        cities.length,
      hasTomTomKey:     !!tomtomKey,
      stores:           unique.slice(0, 60).map(s => ({
        name:    s.name,
        address: s.address,
        city:    s.city,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Store count failed' });
  }
}
