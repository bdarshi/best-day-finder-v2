// Netlify serverless function — scrapes Thrill Data's Islands of Adventure
// predictive crowd calendar. One fetch returns the whole calendar year as a
// {"YYYY-MM-DD": score} map, so the client only needs ONE call regardless of
// how many dates it needs to look up.
//
// Source: https://www.thrill-data.com/trip-planning/crowd-calendar/islands-of-adventure
// The page is server-rendered HTML with links like:
//   <a href=".../research/islands-of-adventure/09/21">Sep 21 20</a>
// We regex out the month/day from the URL (reliable) and the trailing
// number (the predicted score) from the link text.

const CACHE_TTL = 1000 * 60 * 60 * 6; // 6 hours
let cache = { data: null, ts: 0 };

const SOURCE_URL = "https://www.thrill-data.com/trip-planning/crowd-calendar/islands-of-adventure";

exports.handler = async () => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
  };

  if (cache.data && Date.now() - cache.ts < CACHE_TTL) {
    return { statusCode: 200, headers, body: JSON.stringify({ scores: cache.data, cached: true }) };
  }

  try {
    const res = await fetch(SOURCE_URL, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://www.thrill-data.com/",
      },
    });
    if (!res.ok) throw new Error(`Thrill Data returned ${res.status}`);
    const html = await res.text();

    // Two-stage parse, tolerant of attribute order / whitespace variance:
    // Stage 1 — grab every anchor linking to a specific day's research page.
    // Stage 2 — strip any inner markup and pull the trailing number (the score).
    const anchorRe = /<a\s+[^>]*href=["'][^"']*research\/islands-of-adventure\/(\d{2})\/(\d{2})["'][^>]*>([\s\S]*?)<\/a>/g;
    const scores = {};
    let match;
    const year = new Date().getFullYear();

    while ((match = anchorRe.exec(html)) !== null) {
      const [, mm, dd, innerRaw] = match;
      const inner = innerRaw.replace(/<[^>]*>/g, " ").trim();
      const numMatch = inner.match(/(\d+)\s*$/);
      if (numMatch) {
        scores[`${year}-${mm}-${dd}`] = parseInt(numMatch[1], 10);
      }
    }

    if (Object.keys(scores).length === 0) {
      throw new Error("No dates parsed — Thrill Data page structure may have changed");
    }

    cache = { data: scores, ts: Date.now() };
    return { statusCode: 200, headers, body: JSON.stringify({ scores, cached: false, count: Object.keys(scores).length }) };
  } catch (err) {
    if (cache.data) {
      return { statusCode: 200, headers, body: JSON.stringify({ scores: cache.data, cached: true, stale: true, error: err.message }) };
    }
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message, scores: {} }) };
  }
};
