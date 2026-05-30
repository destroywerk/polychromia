// radio-browser.info API wrapper

const BASE_URL = '/radio-api/json';

export async function searchStations({ country = '', genre = '', name = '', limit = 20 } = {}) {
  const params = new URLSearchParams();
  if (country) params.set('countrycode', country.toUpperCase());
  if (genre) params.set('tag', genre);
  if (name) params.set('name', name);
  params.set('limit', limit);
  params.set('hidebroken', 'true');
  params.set('has_extended_info', 'false');
  params.set('order', 'votes');
  params.set('reverse', 'true');

  try {
    const res = await fetch(`${BASE_URL}/stations/search?${params}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error('Radio API error:', e);
    return [];
  }
}

export async function getTopStations(limit = 30) {
  try {
    const res = await fetch(`${BASE_URL}/stations/topvote/${limit}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error('Radio API error:', e);
    return [];
  }
}

export async function getStationsByTag(tag, limit = 20) {
  return searchStations({ genre: tag, limit });
}

export async function getCountries() {
  try {
    const res = await fetch(`${BASE_URL}/countries`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.filter(c => c.stationcount > 5).sort((a, b) => b.stationcount - a.stationcount);
  } catch (e) {
    console.error('Radio API error:', e);
    return [];
  }
}

export async function getTags(limit = 50) {
  try {
    const res = await fetch(`${BASE_URL}/tags?order=stationcount&reverse=true&limit=${limit}&hidebroken=true`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error('Radio API error:', e);
    return [];
  }
}

export const AMBIENT_GENRES = [
  'ambient', 'drone', 'experimental', 'classical', 'electronic',
  'nature', 'meditation', 'jazz', 'world', 'folk', 'minimal',
];
