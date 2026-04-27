import { fallbackGames } from '../data/fallbackGames.js';
import { applyApiCategory, categoryMatchesGame, cleanGame, isAllowedGame, localFilter, sortGames } from './gameData.js';

const RAWG_URL = 'https://api.rawg.io/api/games';
export const RAWG_KEY = import.meta.env.VITE_RAWG_API_KEY;
const RAWG_REQUEST_TIMEOUT_MS = 8000;
const jsonCache = new Map();
const MAX_JSON_CACHE_ENTRIES = 80;

function rememberJson(url, requestPromise) {
  jsonCache.set(url, requestPromise);

  if (jsonCache.size > MAX_JSON_CACHE_ENTRIES) {
    jsonCache.delete(jsonCache.keys().next().value);
  }

  return requestPromise;
}

async function fetchJsonWithTimeout(url, errorMessage, timeoutMs = RAWG_REQUEST_TIMEOUT_MS) {
  if (jsonCache.has(url)) {
    return jsonCache.get(url);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const requestPromise = fetch(url, { signal: controller.signal })
    .then((response) => {
      if (!response.ok) {
        throw new Error(errorMessage);
      }

      return response.json();
    })
    .catch((error) => {
      jsonCache.delete(url);

      if (error.name === 'AbortError') {
        throw new Error('RAWG request timed out.');
      }

      throw error;
    })
    .finally(() => {
      clearTimeout(timeout);
    });

  return rememberJson(url, requestPromise);
}

export async function fetchRawgGames(filters, pageSize = 40) {
  if (!RAWG_KEY) {
    return localFilter(fallbackGames, filters);
  }

  const hasSearch = Boolean(filters.search.trim());
  const params = new URLSearchParams({
    key: RAWG_KEY,
    page_size: String(pageSize),
  });

  if (hasSearch) {
    params.set('search', filters.search.trim());
    params.set('search_precise', 'true');
  }

  if (!hasSearch && filters.ordering && filters.ordering !== 'queuecraft') {
    params.set('ordering', filters.ordering);
  }

  if (filters.page && filters.page > 1) {
    params.set('page', String(filters.page));
  }

  applyApiCategory(params, filters);

  if (filters.platform) {
    params.set('parent_platforms', filters.platform);
  }

  const data = await fetchJsonWithTimeout(`${RAWG_URL}?${params}`, 'RAWG search failed.');
  const filtered = (data.results || [])
    .map(cleanGame)
    .filter(isAllowedGame)
    .filter((game) => game.rating >= filters.minRating)
    .filter((game) => categoryMatchesGame(game, filters.category));

  return sortGames(filtered, filters);
}

export async function fetchGameDetails(gameId) {
  if (!RAWG_KEY) {
    return null;
  }

  try {
    return await fetchJsonWithTimeout(`${RAWG_URL}/${gameId}?key=${RAWG_KEY}`, 'RAWG detail failed.', 5000);
  } catch {
    return null;
  }
}

export async function fetchGameScreenshots(gameId) {
  if (!RAWG_KEY) {
    return [];
  }

  try {
    const data = await fetchJsonWithTimeout(`${RAWG_URL}/${gameId}/screenshots?key=${RAWG_KEY}&page_size=8`, 'RAWG screenshots failed.', 5000);
    return data.results || [];
  } catch {
    return [];
  }
}

export async function fetchGameMovies(gameId) {
  if (!RAWG_KEY) {
    return [];
  }

  try {
    const data = await fetchJsonWithTimeout(`${RAWG_URL}/${gameId}/movies?key=${RAWG_KEY}&page_size=4`, 'RAWG trailers failed.', 5000);
    return data.results || [];
  } catch {
    return [];
  }
}

export async function fetchGameAdditions(gameId) {
  if (!RAWG_KEY) {
    return [];
  }

  try {
    const data = await fetchJsonWithTimeout(`${RAWG_URL}/${gameId}/additions?key=${RAWG_KEY}&page_size=8`, 'RAWG additions failed.', 5000);
    return (data.results || []).map(cleanGame).filter(isAllowedGame);
  } catch {
    return [];
  }
}

export async function fetchGameSeries(gameId) {
  if (!RAWG_KEY) {
    return [];
  }

  try {
    const data = await fetchJsonWithTimeout(`${RAWG_URL}/${gameId}/game-series?key=${RAWG_KEY}&page_size=8`, 'RAWG game series failed.', 5000);
    return (data.results || []).map(cleanGame).filter(isAllowedGame);
  } catch {
    return [];
  }
}
