// radio-browser.info API wrapper.
// Dev: hits the Vite proxy (/radio-api) to avoid CORS on the directory API.
// Prod: hits the public mirror directly (the directory API sends CORS headers).
const BASE_URL = import.meta.env.DEV ? '/radio-api/json' : 'https://de1.api.radio-browser.info/json';

// Stream playback note: to route a station through Web Audio (so it can be
// layered, effected and recorded) the stream must send CORS headers. We bias
// results toward HTTPS + MP3 + recently-verified stations to maximise success.
function playable(stations) {
  return stations
    .map((s) => ({ ...s, url: s.url_resolved || s.url }))
    .filter((s) => s.url && s.url.startsWith('https://'))
    .sort((a, b) => {
      const score = (s) => (s.lastcheckok ? 2 : 0) + (/mp3/i.test(s.codec || '') ? 1 : 0);
      return score(b) - score(a);
    });
}

async function get(path) {
  try {
    const res = await fetch(`${BASE_URL}${path}`, { headers: { 'User-Agent': 'Polychromia/1.0' } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.warn('Radio API error:', e?.message || e);
    return [];
  }
}

export async function searchStations({ country = '', genre = '', name = '', limit = 25 } = {}) {
  const params = new URLSearchParams();
  if (country) params.set('countrycode', country.toUpperCase());
  if (genre) params.set('tag', genre);
  if (name) params.set('name', name);
  params.set('limit', String(limit * 2));
  params.set('hidebroken', 'true');
  params.set('order', 'votes');
  params.set('reverse', 'true');
  const data = await get(`/stations/search?${params}`);
  return playable(data).slice(0, limit);
}

export async function getTopStations(limit = 30) {
  const data = await get(`/stations/topvote/${limit * 2}`);
  return playable(data).slice(0, limit);
}

export async function getStationsByTag(tag, limit = 20) {
  return searchStations({ genre: tag, limit });
}

// Curated, eclectic tag list biased toward world music, spoken word and
// unusual/textural content well-suited to ambient sampling and looping.
// Every tag here was verified to return HTTPS-playable stations via the
// radio-browser directory (tags returning nothing — e.g. 'shortwave',
// 'gamelan', 'throat singing' — were deliberately dropped). The leading
// entries surface first in the (sliced) genre pills, so the most evocative
// world/spoken-word tags come first.
export const AMBIENT_GENRES = [
  'world', 'spoken word', 'poetry', 'storytelling', 'field recording',
  'drone', 'ambient', 'experimental', 'folk', 'dub', 'meditation',
  'psychedelic', 'jazz', 'noise', 'nature', 'talk',
];
