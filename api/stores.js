// api/stores.js
// Uses Google Maps Places Text Search API to count store locations
// for any brand across India (or any specified country)
// Handles pagination to get accurate total counts

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const mapsKey = process.env.GOOGLE_MAPS_KEY;
  if (!mapsKey) return res.status(500).json({ error: 'Google Maps API key not configured' });

  const { brand, country = 'India', maxPages = 3 } = req.body || {};
  if (!brand) return res.status(400).json({ error: 'Missing brand name' });

  const results = [];
  const cities  = [];
  let pageToken  = null;
  let pages      = 0;

  try {
    // Text Search (New) — finds all places matching the brand name
    // We paginate up to maxPages to get a fuller count
    do {
      const body = {
        textQuery: `${brand} store ${country}`,
        maxResultCount: 20,
        languageCode: 'en',
      };
      if (pageToken) body.pageToken = pageToken;

      const response = await fetch(
        'https://places.googleapis.com/v1/places:searchText',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': mapsKey,
            'X-Goog-FieldMask': 'places.displayName,places.formattedAddress,places.rating,places.userRatingCount,places.regularOpeningHours,nextPageToken',
          },
          body: JSON.stringify(body),
        }
      );

      if (!response.ok) {
        const err = await response.text();
        return res.status(response.status).json({ error: `Maps API error: ${err}` });
      }

      const data = await response.json();
      const places = data.places || [];
      results.push(...places);

      // Extract unique cities from addresses
      places.forEach(p => {
        if (p.formattedAddress) {
          // Try to extract city from address
          const parts = p.formattedAddress.split(',');
          if (parts.length >= 2) {
            const city = parts[parts.length - 3]?.trim() || parts[parts.length - 2]?.trim();
            if (city && !cities.includes(city) && city !== country) {
              cities.push(city);
            }
          }
        }
      });

      pageToken = data.nextPageToken;
      pages++;
    } while (pageToken && pages < maxPages);

    // Deduplicate by name + address to avoid counting same store twice
    const seen = new Set();
    const unique = results.filter(p => {
      const key = `${p.displayName?.text}::${p.formattedAddress}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Calculate average rating
    const rated = unique.filter(p => p.rating);
    const avgRating = rated.length
      ? (rated.reduce((s, p) => s + p.rating, 0) / rated.length).toFixed(1)
      : null;

    const totalReviews = unique.reduce((s, p) => s + (p.userRatingCount || 0), 0);

    return res.status(200).json({
      brand,
      country,
      totalStores: unique.length,
      pagesScanned: pages,
      estimatedTotal: pageToken ? `${unique.length}+` : String(unique.length), // if more pages exist, show +
      cities: [...new Set(cities)].slice(0, 20),
      cityCount: [...new Set(cities)].length,
      avgRating: avgRating ? Number(avgRating) : null,
      totalReviews,
      stores: unique.slice(0, 50).map(p => ({
        name: p.displayName?.text,
        address: p.formattedAddress,
        rating: p.rating,
        reviews: p.userRatingCount,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Store count failed' });
  }
}
