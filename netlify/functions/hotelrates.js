// Netlify serverless function — proxies SerpAPI Google Hotels (CORS bypass)
// GET /api/hotelrates?chk_in=2026-09-21&chk_out=2026-09-22
//
// SECURITY: the SerpAPI key must be set as a Netlify environment variable
// named SERPAPI_KEY (Site settings -> Environment variables). Never hardcode
// it here — a key committed to source is a key anyone with repo access can
// use on your account's billing.

const CACHE = {};
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

// Keyword match against whatever exact name Google Hotels returns —
// their naming varies slightly, so we match on a distinctive substring.
const TARGET_HOTELS = [
  { id: "portofino",    match: "portofino" },
  { id: "hardrock",     match: "hard rock" },
  { id: "royalpacific", match: "royal pacific" },
  { id: "helios",       match: "helios" },
];

exports.handler = async (event) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  const { chk_in, chk_out } = event.queryStringParameters || {};

  if (!chk_in || !chk_out) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: "Missing chk_in or chk_out" }) };
  }

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: "SERPAPI_KEY environment variable not set" }) };
  }

  const cacheKey = `${chk_in}|${chk_out}`;
  const cached = CACHE[cacheKey];
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return { statusCode: 200, headers, body: JSON.stringify({ ...cached.data, cached: true }) };
  }

  try {
    const params = new URLSearchParams({
      engine: "google_hotels",
      q: "Universal Orlando Resort hotels",
      check_in_date: chk_in,
      check_out_date: chk_out,
      gl: "us",
      hl: "en",
      currency: "USD",
      adults: "2",
      api_key: apiKey,
    });

    const url = `https://serpapi.com/search?${params.toString()}`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.error) {
      return { statusCode: 502, headers, body: JSON.stringify({ error: data.error }) };
    }

    const properties = data.properties || [];
    const hotels = {};
    for (const target of TARGET_HOTELS) {
      const found = properties.find(p => (p.name || "").toLowerCase().includes(target.match));
      hotels[target.id] = found
        ? {
            name: found.name,
            rate: found.rate_per_night?.extracted_lowest ?? null,
            link: found.link ?? null,
          }
        : { name: null, rate: null, link: null };
    }

    const result = { hotels, checkIn: chk_in, checkOut: chk_out };
    CACHE[cacheKey] = { data: result, ts: Date.now() };
    return { statusCode: 200, headers, body: JSON.stringify(result) };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
